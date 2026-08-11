const supabase = require('../config/supabase');
const crypto = require('crypto');

/**
 * Validation Rules Engine & Service
 * Multi-Tenant Single-Table (JSONB condition_groups) architecture.
 *
 * Rule Resolution Model (post Step-1 schema change):
 *   organization_id IS NULL  → platform/system rule  (lower precedence)
 *   organization_id = <uuid> → org-specific rule      (higher precedence)
 *
 * Precedence & Deduplication:
 *   Both sets are fetched separately and merged into a Map keyed by
 *   `rule.rule_key`. System rules are inserted first; org-specific rules
 *   overwrite any matching system rule at the same key.
 *   This guarantees:
 *     • A rule is never evaluated twice.
 *     • Org-specific rules always override their system counterparts.
 *     • Tenant isolation is strict — only the caller's org UUID is used
 *       in the org-side query; no other org's rows can appear.
 *
 *   Matching key rationale:
 *     `rule_key` is the immutable, unique logical identity of a validation rule.
 *     Using `rule_key` ensures that user edits to display names (`rule_name`)
 *     never break system-vs-org rule override resolution.
 */

// ---------------------------------------------------------------------------
// Pure evaluation helpers — unchanged from original implementation
// ---------------------------------------------------------------------------

// Helper to evaluate a single condition row against record data
function evaluateConditionRow(condition, recordData) {
  const { field_name, operator, value } = condition;
  if (!field_name) return false;

  // Retrieve actual field value from recordData (or recordData.data if nested)
  let rawVal = recordData[field_name];
  if (rawVal === undefined && recordData.data) {
    rawVal = recordData.data[field_name];
  }

  // Dynamic Case-Insensitive & Partial Key Match across all keys in recordData and recordData.data
  if (rawVal === undefined || rawVal === null || rawVal === '') {
    const targetClean = String(field_name).toLowerCase().replace(/[^a-z0-9]/g, '');
    const sources = [recordData, recordData.data || {}];
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      for (const [k, v] of Object.entries(src)) {
        if (k === 'data') continue;
        const kClean = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
        // 1. Clean exact match (e.g. "Company" == "company" or "company_name" == "Company Name")
        if (kClean === targetClean && v !== undefined && v !== null && v !== '') {
          rawVal = v;
          break;
        }
        // 2. Partial key match (e.g. "company" == "company_name" or "company_id")
        if ((kClean.startsWith(targetClean) || targetClean.startsWith(kClean)) && v !== undefined && v !== null && v !== '') {
          rawVal = v;
          break;
        }
      }
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') break;
    }
  }

  const strVal = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
  const targetVal = value !== undefined && value !== null ? String(value).trim() : '';

  switch (operator) {
    case 'is_blank':
    case 'is_empty':
      return strVal === '';

    case 'is_not_blank':
    case 'is_not_empty':
      return strVal !== '';

    case 'equals':
    case 'equal_to':
      return strVal.toLowerCase() === targetVal.toLowerCase();

    case 'not_equals':
    case 'not_equal_to':
      return strVal.toLowerCase() !== targetVal.toLowerCase();

    case 'contains':
      return strVal.toLowerCase().includes(targetVal.toLowerCase());

    case 'does_not_contain':
      return !strVal.toLowerCase().includes(targetVal.toLowerCase());

    case 'greater_than': {
      const numVal = parseFloat(strVal);
      const numTarget = parseFloat(targetVal);
      if (!isNaN(numVal) && !isNaN(numTarget)) return numVal > numTarget;
      return strVal > targetVal;
    }

    case 'less_than': {
      const numVal = parseFloat(strVal);
      const numTarget = parseFloat(targetVal);
      if (!isNaN(numVal) && !isNaN(numTarget)) return numVal < numTarget;
      return strVal < targetVal;
    }

    case 'not_regex':
    case 'does_not_match':
    case 'does_not_match_regex': {
      try {
        const re = new RegExp(targetVal, 'i');
        return !re.test(strVal);
      } catch (e) {
        return false;
      }
    }

    case 'regex': {
      try {
        const re = new RegExp(targetVal, 'i');
        // For format validation rules (like email format regex pattern), error condition occurs when value DOES NOT match pattern
        if (targetVal.includes('@') || String(field_name).toLowerCase().includes('email')) {
          return !re.test(strVal);
        }
        return re.test(strVal);
      } catch (e) {
        return false;
      }
    }

    case 'date_future': {
      const d = new Date(strVal);
      return !isNaN(d.getTime()) && d.getTime() > Date.now();
    }

    case 'date_past': {
      const d = new Date(strVal);
      return !isNaN(d.getTime()) && d.getTime() < Date.now();
    }

    default:
      return strVal.toLowerCase() === targetVal.toLowerCase();
  }
}

// Helper to evaluate a single condition group
function evaluateConditionGroup(group, recordData) {
  const conditions = group.conditions || [];
  if (conditions.length === 0) return true;

  let groupResult = evaluateConditionRow(conditions[0], recordData);

  for (let i = 1; i < conditions.length; i++) {
    const cond = conditions[i];
    const rowLogic = (cond.row_logic || 'AND').toUpperCase();
    const rowResult = evaluateConditionRow(cond, recordData);

    if (rowLogic === 'OR') {
      groupResult = groupResult || rowResult;
    } else {
      groupResult = groupResult && rowResult;
    }
  }

  return groupResult;
}

// Helper to evaluate a complete validation rule
function evaluateRule(rule, recordData) {
  if (!rule.is_active) return true; // Inactive rules do not fire

  const conditionGroups = rule.condition_groups || [];
  if (!Array.isArray(conditionGroups) || conditionGroups.length === 0) {
    // If no condition groups defined, rule fires unconditionally on save
    return false; // Returns false -> validation fails
  }

  let ruleMatches = evaluateConditionGroup(conditionGroups[0], recordData);

  for (let i = 1; i < conditionGroups.length; i++) {
    const grp = conditionGroups[i];
    const groupLogic = (grp.group_logic || 'AND').toUpperCase();
    const grpResult = evaluateConditionGroup(grp, recordData);

    if (groupLogic === 'OR') {
      ruleMatches = ruleMatches || grpResult;
    } else {
      ruleMatches = ruleMatches && grpResult;
    }
  }

  // If rule conditions match, validation rule FIRES -> validation fails!
  return !ruleMatches;
}

// ---------------------------------------------------------------------------
// Internal helper: fetch + merge system rules and org-specific rules
//
// Issues two parallel Supabase queries:
//   Query A — system rules: organization_id IS NULL
//   Query B — org rules:    organization_id = organizationId  (tenant-scoped)
//
// Merges into a Map keyed by `rule.rule_key`:
//   • System rules are inserted first  → lower precedence
//   • Org rules overwrite matching keys → higher precedence (org wins)
//
// Returns Array<rule> — deduplicated, org-precedent set.
// Throws the raw Supabase error object on DB failure (caller handles it).
// ---------------------------------------------------------------------------
async function fetchResolvedRules(organizationId, { objectName, activeOnly = false } = {}) {
  // Build the system-rule query (organization_id IS NULL)
  let systemQuery = supabase
    .from('validation_rules')
    .select('*')
    .is('organization_id', null);

  if (objectName) systemQuery = systemQuery.eq('object_name', objectName);
  if (activeOnly) systemQuery = systemQuery.eq('is_active', true);

  // Build the org-specific query (scoped strictly to this organization)
  let orgQuery = supabase
    .from('validation_rules')
    .select('*')
    .eq('organization_id', organizationId);

  if (objectName) orgQuery = orgQuery.eq('object_name', objectName);
  if (activeOnly) orgQuery = orgQuery.eq('is_active', true);

  // Run both queries in parallel
  const [{ data: systemRules, error: systemError }, { data: orgRules, error: orgError }] =
    await Promise.all([systemQuery, orgQuery]);

  if (systemError) throw systemError;
  if (orgError)   throw orgError;

  // Merge: system rules first (base), org rules overwrite matching keys
  const ruleMap = new Map();

  (systemRules || []).forEach((rule) => {
    const key = rule.rule_key;
    ruleMap.set(key, rule);
  });

  (orgRules || []).forEach((rule) => {
    const key = rule.rule_key;
    // Org rule overwrites system rule at the same key (higher precedence)
    ruleMap.set(key, rule);
  });

  return Array.from(ruleMap.values());
}

// ---------------------------------------------------------------------------
// Canonical Platform System Validation Rules (Version-Controlled)
// ---------------------------------------------------------------------------
const SYSTEM_VALIDATION_RULES = [
  {
    rule_key: 'lead_company_required_for_qualified_lead',
    object_name: 'lead',
    rule_name: 'Company_Required_For_Qualified_Lead',
    error_message: 'Company is required when the lead status is Qualified.',
    is_active: true,
    condition_groups: [
      {
        group_order: 1,
        group_logic: 'AND',
        conditions: [
          { field_name: 'status', operator: 'equals', value: 'Qualified', row_logic: 'AND' },
          { field_name: 'company', operator: 'is_blank', value: '', row_logic: 'AND' },
        ],
      },
    ],
  },
  {
    rule_key: 'lead_valid_email_format',
    object_name: 'lead',
    rule_name: 'Valid_Email_Format',
    error_message: 'Please enter a valid email address (e.g. user@company.com).',
    is_active: true,
    condition_groups: [
      {
        group_order: 1,
        group_logic: 'AND',
        conditions: [
          { field_name: 'email', operator: 'is_not_blank', value: '', row_logic: 'AND' },
          { field_name: 'email', operator: 'not_regex', value: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', row_logic: 'AND' },
        ],
      },
    ],
  },
  {
    rule_key: 'deal_positive_amount_required',
    object_name: 'deal',
    rule_name: 'Positive_Amount_Required',
    error_message: 'Deal amount cannot be negative.',
    is_active: true,
    condition_groups: [
      {
        group_order: 1,
        group_logic: 'AND',
        conditions: [
          { field_name: 'amount', operator: 'less_than', value: '0', row_logic: 'AND' },
        ],
      },
    ],
  },
  {
    rule_key: 'deal_discount_percentage_range',
    object_name: 'deal',
    rule_name: 'Discount_Percentage_Range',
    error_message: 'Discount percentage must be between 0% and 100%.',
    is_active: true,
    condition_groups: [
      {
        group_order: 1,
        group_logic: 'AND',
        conditions: [
          { field_name: 'discount', operator: 'greater_than', value: '100', row_logic: 'AND' },
        ],
      },
    ],
  },
  {
    rule_key: 'deal_loss_reason_required_on_closed_lost',
    object_name: 'deal',
    rule_name: 'Loss_Reason_Required_On_Closed_Lost',
    error_message: 'Loss Reason is required when a deal is marked as Closed Lost.',
    is_active: true,
    condition_groups: [
      {
        group_order: 1,
        group_logic: 'AND',
        conditions: [
          { field_name: 'stage', operator: 'equals', value: 'Closed Lost', row_logic: 'AND' },
          { field_name: 'loss_reason', operator: 'is_blank', value: '', row_logic: 'AND' },
        ],
      },
    ],
  },
  {
    rule_key: 'contact_birth_date_past_only',
    object_name: 'contact',
    rule_name: 'Birth_Date_Past_Only',
    error_message: 'Birth date cannot be set in the future.',
    is_active: true,
    condition_groups: [
      {
        group_order: 1,
        group_logic: 'AND',
        conditions: [
          { field_name: 'birth_date', operator: 'date_future', value: '', row_logic: 'AND' },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
const validationRuleService = {
  /**
   * Evaluate all active rules for an objectType against a record.
   * Evaluates both applicable system rules and org-specific rules.
   * If an org-specific rule shares (object_name, rule_name) with a system
   * rule, only the org-specific rule is evaluated (org overrides system).
   * Returns array of error messages if validation fails.
   */
  validateRecord: async (objectName, recordData, organizationId) => {
    let rules;

    try {
      if (organizationId) {
        // Resolve system + org rules with precedence deduplication
        rules = await fetchResolvedRules(organizationId, {
          objectName,
          activeOnly: true,
        });
      } else {
        // No org context — evaluate system rules only (safe fallback)
        const { data, error } = await supabase
          .from('validation_rules')
          .select('*')
          .eq('object_name', objectName)
          .eq('is_active', true)
          .is('organization_id', null);

        if (error) {
          console.error('Error fetching validation rules:', error);
          return [];
        }
        rules = data || [];
      }
    } catch (err) {
      console.error('Error fetching validation rules:', err);
      return [];
    }

    const failedRules = [];
    (rules || []).forEach((rule) => {
      const isValid = evaluateRule(rule, recordData);
      if (!isValid) {
        failedRules.push(rule.error_message || `Validation rule '${rule.rule_name}' failed.`);
      }
    });

    return failedRules;
  },

  /**
   * List all rules visible to an organization:
   *   • system rules where organization_id IS NULL
   *   • rules belonging to this organization
   * Org-specific rules override system rules sharing the same
   * (object_name, rule_name) key — see module-level comment for rationale.
   * Results are sorted newest-first to match the original behaviour.
   */
  listRules: async (objectName, organizationId) => {
    try {
      if (organizationId) {
        const rules = await fetchResolvedRules(organizationId, { objectName });
        // Preserve original sort order: newest created_at first
        rules.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return rules;
      }

      // No org context — return system rules only, newest first
      let query = supabase
        .from('validation_rules')
        .select('*')
        .is('organization_id', null)
        .order('created_at', { ascending: false });

      if (objectName) {
        query = query.eq('object_name', objectName);
      }

      const { data: rules, error } = await query;
      if (error) {
        throw { statusCode: 500, message: `Failed to fetch validation rules: ${error.message}` };
      }
      return rules || [];
    } catch (err) {
      if (err.statusCode) throw err;
      throw { statusCode: 500, message: `Failed to fetch validation rules: ${err.message}` };
    }
  },

  /**
   * Fetch single rule by ID.
   */
  getRuleById: async (id, organizationId) => {
    let query = supabase
      .from('validation_rules')
      .select('*')
      .eq('id', id);

    if (organizationId) {
      query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    } else {
      query = query.is('organization_id', null);
    }

    const { data: rule, error } = await query.single();
    if (error) {
      throw { statusCode: 404, message: `Validation rule '${id}' not found.` };
    }

    return rule;
  },

  /**
   * Create a new validation rule.
   */
  createRule: async (ruleData, organizationId, userId) => {
    const objectName = ruleData.object_name || 'leads';
    const ruleKey = (ruleData.rule_key && typeof ruleData.rule_key === 'string' && ruleData.rule_key.trim())
      ? ruleData.rule_key.trim()
      : `${objectName}_custom_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

    const payload = {
      organization_id: organizationId,
      object_name: objectName,
      rule_key: ruleKey,
      rule_name: ruleData.rule_name || 'New_Validation_Rule',
      error_message: ruleData.error_message || 'Validation failed.',
      is_active: ruleData.is_active !== undefined ? ruleData.is_active : true,
      condition_groups: ruleData.condition_groups || [],
      created_by: userId || null,
    };

    const { data: inserted, error } = await supabase
      .from('validation_rules')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw { statusCode: 400, message: `Failed to create validation rule: ${error.message}` };
    }

    return inserted;
  },

  /**
   * Update an existing validation rule.
   * Note: rule_key is immutable after creation and cannot be updated.
   */
  updateRule: async (id, ruleData, organizationId) => {
    if (!organizationId) {
      throw { statusCode: 400, message: 'Organization ID is required to update validation rules.' };
    }

    // Explicitly strip rule_key from input to guarantee immutability
    const { rule_key, ...safeRuleData } = ruleData || {};

    const updatePayload = {
      rule_name: safeRuleData.rule_name,
      error_message: safeRuleData.error_message,
      is_active: safeRuleData.is_active !== undefined ? safeRuleData.is_active : true,
      condition_groups: safeRuleData.condition_groups || [],
      updated_at: new Date().toISOString(),
    };

    delete updatePayload.rule_key;

    const { data: updated, error } = await supabase
      .from('validation_rules')
      .update(updatePayload)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      throw { statusCode: 400, message: `Failed to update validation rule: ${error.message}` };
    }

    return updated;
  },

  /**
   * Toggle active state for a rule.
   */
  toggleRule: async (id, is_active, organizationId) => {
    if (!organizationId) {
      throw { statusCode: 400, message: 'Organization ID is required to toggle validation rules.' };
    }

    const { data: updated, error } = await supabase
      .from('validation_rules')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      throw { statusCode: 400, message: `Failed to toggle validation rule: ${error.message}` };
    }

    return updated;
  },

  /**
   * Delete a validation rule.
   */
  deleteRule: async (id, organizationId) => {
    if (!organizationId) {
      throw { statusCode: 400, message: 'Organization ID is required to delete validation rules.' };
    }

    const { error } = await supabase
      .from('validation_rules')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      throw { statusCode: 400, message: `Failed to delete validation rule: ${error.message}` };
    }

    return { success: true };
  },

  /**
   * Idempotent self-healing check for platform system validation rules.
   * Runs automatically on server startup before app.listen().
   * Ensures that all six canonical system rules exist in the database with organization_id = NULL.
   * If a system rule is missing, it is created. Existing system rules and organization rules are untouched.
   */
  ensureSystemRules: async () => {
    await Promise.all(
      SYSTEM_VALIDATION_RULES.map(async (sysRule) => {
        const { data: existing, error: checkError } = await supabase
          .from('validation_rules')
          .select('id')
          .eq('rule_key', sysRule.rule_key)
          .is('organization_id', null)
          .maybeSingle();

        if (checkError) {
          throw new Error(`Failed to verify system rule [${sysRule.rule_key}]: ${checkError.message}`);
        }

        if (!existing) {
          const payload = {
            organization_id: null,
            created_by: null,
            object_name: sysRule.object_name,
            rule_key: sysRule.rule_key,
            rule_name: sysRule.rule_name,
            error_message: sysRule.error_message,
            is_active: sysRule.is_active,
            condition_groups: sysRule.condition_groups,
          };

          const { error: insertError } = await supabase
            .from('validation_rules')
            .insert(payload);

          if (insertError) {
            // PostgreSQL error 23505 = unique_violation (concurrent startup race condition)
            if (insertError.code === '23505' || (insertError.message && insertError.message.includes('23505'))) {
              console.log(`ℹ️ System rule [${sysRule.rule_key}] created concurrently by another instance.`);
            } else {
              throw new Error(`Failed to seed system rule [${sysRule.rule_key}]: ${insertError.message}`);
            }
          } else {
            console.log(`✅ Seeded missing system rule [${sysRule.rule_key}]`);
          }
        }
      })
    );
  },
};

module.exports = validationRuleService;
