const supabase = require('../config/supabase');

/**
 * Validation Rules Engine & Service
 * Multi-Tenant Single-Table (JSONB condition_groups) architecture.
 */

// Helper to evaluate a single condition row against record data
function evaluateConditionRow(condition, recordData) {
  const { field_name, operator, value } = condition;
  if (!field_name) return false;

  // Retrieve actual field value from recordData (or recordData.data if nested)
  let rawVal = recordData[field_name];
  if (rawVal === undefined && recordData.data) {
    rawVal = recordData.data[field_name];
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

    case 'regex': {
      try {
        const re = new RegExp(targetVal, 'i');
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

const validationRuleService = {
  /**
   * Evaluate all active rules for an objectType against a record.
   * Returns array of error messages if validation fails.
   */
  validateRecord: async (objectName, recordData, organizationId) => {
    let query = supabase
      .from('validation_rules')
      .select('*')
      .eq('object_name', objectName)
      .eq('is_active', true);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: rules, error } = await query;
    if (error) {
      console.error('Error fetching validation rules:', error);
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
   * List all rules for a given object_name and organization_id.
   */
  listRules: async (objectName, organizationId) => {
    let query = supabase
      .from('validation_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (objectName) {
      query = query.eq('object_name', objectName);
    }
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: rules, error } = await query;
    if (error) {
      throw { statusCode: 500, message: `Failed to fetch validation rules: ${error.message}` };
    }

    return rules || [];
  },

  /**
   * Fetch single rule by ID.
   */
  getRuleById: async (id, organizationId) => {
    let query = supabase
      .from('validation_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: rule, error } = await query;
    if (error) {
      throw { statusCode: 404, message: `Validation rule '${id}' not found.` };
    }

    return rule;
  },

  /**
   * Create a new validation rule.
   */
  createRule: async (ruleData, organizationId, userId) => {
    const payload = {
      organization_id: organizationId,
      object_name: ruleData.object_name || 'leads',
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
   */
  updateRule: async (id, ruleData, organizationId) => {
    const updatePayload = {
      rule_name: ruleData.rule_name,
      error_message: ruleData.error_message,
      is_active: ruleData.is_active !== undefined ? ruleData.is_active : true,
      condition_groups: ruleData.condition_groups || [],
      updated_at: new Date().toISOString(),
    };

    let query = supabase
      .from('validation_rules')
      .update(updatePayload)
      .eq('id', id);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: updated, error } = await query.select().single();
    if (error) {
      throw { statusCode: 400, message: `Failed to update validation rule: ${error.message}` };
    }

    return updated;
  },

  /**
   * Toggle active state for a rule.
   */
  toggleRule: async (id, is_active, organizationId) => {
    let query = supabase
      .from('validation_rules')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: updated, error } = await query.select().single();
    if (error) {
      throw { statusCode: 400, message: `Failed to toggle validation rule: ${error.message}` };
    }

    return updated;
  },

  /**
   * Delete a validation rule.
   */
  deleteRule: async (id, organizationId) => {
    let query = supabase
      .from('validation_rules')
      .delete()
      .eq('id', id);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { error } = await query;
    if (error) {
      throw { statusCode: 400, message: `Failed to delete validation rule: ${error.message}` };
    }

    return { success: true };
  },
};

module.exports = validationRuleService;
