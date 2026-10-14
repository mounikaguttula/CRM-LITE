const supabase = require('../config/supabase');
const { supabaseAdmin } = require('../config/supabase');
const dbClient = supabaseAdmin || supabase;
const redisClient = require('../config/redis');


// UUID format validator helper to prevent PostgreSQL syntax errors when non-UUID strings are passed
const isUuid = (val) => Boolean(val && typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));


const PLATFORM_FIELDS = [
  { id: 'pf_name', name: 'name', label: 'Name', type: 'text', required: true, is_system: true, isTitle: true },
  { id: 'pf_status', name: 'status', label: 'Status', type: 'picklist', required: false, is_system: true, isTitle: false },
  { id: 'pf_owner', name: 'owner_id', label: 'Owner', type: 'lookup', required: false, is_system: true, isTitle: false },
  { id: 'pf_created_at', name: 'created_at', label: 'Created Date', type: 'datetime', required: false, is_system: true, isTitle: false },
  { id: 'pf_created_by', name: 'created_by', label: 'Created By', type: 'lookup', required: false, is_system: true, isTitle: false },
  { id: 'pf_updated_at', name: 'updated_at', label: 'Modified Date', type: 'datetime', required: false, is_system: true, isTitle: false },
  { id: 'pf_updated_by', name: 'updated_by', label: 'Modified By', type: 'lookup', required: false, is_system: true, isTitle: false },
];

// Extra field flags stored in field_definitions (new property names only, nothing renamed)
const extraFieldFlags = (f) => ({
  is_unique: !!f.is_unique,
  is_searchable: !!f.searchable,
  is_readonly: !!f.readonly,
  is_hidden: !!f.hidden,
  is_active: f.is_active !== false,
  lookup_target_object_type_id: f.lookup_target_object_type_id || null,
});

const inMemoryCache = {
  permissions: new Map(),
  objectDefs: new Map(),
  clear() {
    this.permissions.clear();
    this.objectDefs.clear();
  }
};

// In-memory fallback and performance cache for organization field overrides
const inMemoryOverrides = new Map();

/**
 * Helper: Invalidate metadata cache in Redis & in-memory whenever metadata schema changes.
 * Also clears permissions cache so record APIs pick up fresh role data.
 */
const invalidateMetadataCache = async (organizationId) => {
  inMemoryCache.clear();

  if (!redisClient || !redisClient.isOpen) return;


  try {
    // Wipe both metadata and permissions cache keys in one scan
    const allKeys = await redisClient.keys('crm:*');
    const staleKeys = allKeys.filter(
      (k) => k.includes(':metadata') || k.includes(':permissions')
    );
    if (staleKeys.length > 0) {
      await redisClient.del(staleKeys);
    }
    console.log(`🗑 Redis & in-memory caches invalidated: ${staleKeys.length} key(s) cleared (metadata + permissions).`);
  } catch (err) {
    console.error('❌ Redis Cache Invalidation Error:', err.message);
  }
};



const CANONICAL_MAP = {
  company: 'company',
  companies: 'company',
  deal: 'deal',
  deals: 'deal',
  contact: 'contact',
  contacts: 'contact',
  lead: 'lead',
  leads: 'lead',
  task: 'task',
  tasks: 'task',
  note: 'note',
  notes: 'note',
  form: 'form',
  forms: 'form',
  campaign: 'campaign',
  campaigns: 'campaign',
  product: 'product',
  products: 'product',
  line_item: 'line_item',
  line_items: 'line_item',
  segment: 'segment',
  segments: 'segment',
};

const getCanonicalObjectKey = (rawKey) => {
  if (!rawKey) return '';
  const clean = String(rawKey).trim().toLowerCase();
  if (CANONICAL_MAP[clean]) return CANONICAL_MAP[clean];
  if (clean.endsWith('ies')) return `${clean.slice(0, -3)}y`;
  if (clean.endsWith('s') && !clean.endsWith('ss')) return clean.slice(0, -1);
  return clean;
};

/**
 * Metadata Service
 * Interfaces directly with Supabase tables: object_type_definitions, field_definitions, Organization.
 */
const metadataService = {
  getCanonicalObjectKey,

  /**
   * Fetch organization-specific field overrides from Supabase (or in-memory fallback).
   */
  getFieldOverrides: async (organizationId) => {
    if (!organizationId) return [];

    try {
      const { data, error } = await dbClient
        .from('organization_field_overrides')
        .select('*')
        .eq('organization_id', organizationId);

      if (!error && Array.isArray(data)) {
        data.forEach((row) => {
          inMemoryOverrides.set(`${organizationId}_${row.field_id}`, row);
        });
        return data;
      }
      if (error) {
        console.warn('⚠️ Supabase error fetching field overrides:', error.message);
      }
    } catch (err) {
      console.warn('⚠️ Exception fetching field overrides:', err.message);
    }

    const results = [];
    for (const [key, val] of inMemoryOverrides.entries()) {
      if (val.organization_id === organizationId || key.startsWith(`${organizationId}_`)) {
        results.push(val);
      }
    }
    return results;
  },

  /**
   * Fetch a single organization-specific field override.
   */
  getFieldOverride: async (organizationId, fieldId) => {
    if (!organizationId || !fieldId) return null;
    const cacheKey = `${organizationId}_${fieldId}`;
    if (inMemoryOverrides.has(cacheKey)) {
      return inMemoryOverrides.get(cacheKey);
    }
    if (!isUuid(fieldId)) return null;

    try {
      const { data, error } = await dbClient
        .from('organization_field_overrides')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('field_id', fieldId)
        .maybeSingle();

      if (!error && data) {
        inMemoryOverrides.set(cacheKey, data);
        return data;
      }
      if (error) {
        console.warn('⚠️ Supabase error fetching field override:', error.message);
      }
    } catch (err) {
      console.warn('⚠️ Exception fetching field override:', err.message);
    }

    return null;
  },

  /**
   * Save (create or update) organization-specific field override.
   */
  saveFieldOverride: async (organizationId, fieldId, overrideData, user = null) => {
    const now = new Date().toISOString();
    const userId = (user?.id && isUuid(user.id)) ? user.id : null;
    const existing = await metadataService.getFieldOverride(organizationId, fieldId);
    const crypto = require('crypto');
    const overrideId = existing?.id || (crypto.randomUUID ? crypto.randomUUID() : `ov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

    const record = {
      id: overrideId,
      organization_id: organizationId,
      field_id: fieldId,
      picklist_values: overrideData.picklist_values !== undefined ? overrideData.picklist_values : (existing?.picklist_values || null),
      field_label: overrideData.field_label !== undefined ? overrideData.field_label : (existing?.field_label || null),
      help_text: overrideData.help_text !== undefined ? overrideData.help_text : (existing?.help_text || null),
      updated_by: userId,
      updated_at: now,
      created_by: existing?.created_by || userId,
      created_at: existing?.created_at || now,
    };

    inMemoryOverrides.set(`${organizationId}_${fieldId}`, record);

    if (!isUuid(fieldId)) {
      return record;
    }

    try {
      const { data, error } = await dbClient
        .from('organization_field_overrides')
        .upsert(record, { onConflict: 'organization_id,field_id' })
        .select()
        .maybeSingle();

      if (!error && data) {
        inMemoryOverrides.set(`${organizationId}_${fieldId}`, data);
        return data;
      }

      if (error) {
        console.warn('⚠️ Supabase upsert error on organization_field_overrides:', error.message);
        // If foreign key constraint failed on user id (e.g. 23503), retry with created_by/updated_by set to null
        if (error.code === '23503' && (record.created_by || record.updated_by)) {
          const sanitizedRecord = { ...record, created_by: null, updated_by: null };
          const { data: retryData, error: retryError } = await dbClient
            .from('organization_field_overrides')
            .upsert(sanitizedRecord, { onConflict: 'organization_id,field_id' })
            .select()
            .maybeSingle();
          if (!retryError && retryData) {
            inMemoryOverrides.set(`${organizationId}_${fieldId}`, retryData);
            return retryData;
          }
          if (retryError) console.error('❌ Retry upsert error:', retryError.message);
        }
      }
    } catch (err) {
      console.error('❌ Exception saving organization_field_overrides:', err.message);
    }

    return record;
  },

  /**
   * Delete organization-specific field override (revert to global defaults).
   */
  deleteFieldOverride: async (organizationId, fieldId) => {
    inMemoryOverrides.delete(`${organizationId}_${fieldId}`);
    if (!isUuid(fieldId)) return true;

    try {
      const { error } = await dbClient
        .from('organization_field_overrides')
        .delete()
        .eq('organization_id', organizationId)
        .eq('field_id', fieldId);

      if (error) {
        console.warn('⚠️ Supabase delete error on organization_field_overrides:', error.message);
      }
    } catch (err) {
      console.warn('⚠️ Exception deleting organization_field_overrides:', err.message);
    }

    return true;
  },

  /**
   * Apply organization-specific field overrides to an array of field definitions.
   * Merges picklist_values, field_label, and help_text while keeping original field metadata.
   */
  applyFieldOverrides: (fields, overrides) => {
    if (!Array.isArray(fields) || !Array.isArray(overrides) || overrides.length === 0) {
      return fields || [];
    }

    const map = new Map();
    overrides.forEach((ov) => {
      if (ov.field_id) {
        map.set(String(ov.field_id).toLowerCase(), ov);
      }
    });

    return fields.map((field) => {
      const fId = field.id ? String(field.id).toLowerCase() : '';
      const fName = field.name ? String(field.name).toLowerCase() : '';
      const fApi = field.api_name ? String(field.api_name).toLowerCase() : '';

      const ov = map.get(fId) || map.get(fName) || map.get(fApi);
      if (!ov) return field;

      const merged = { ...field, has_override: true, override_id: ov.id };
      if (Array.isArray(ov.picklist_values) && ov.picklist_values.length > 0) {
        merged.picklist_values = ov.picklist_values;
        merged.options = ov.picklist_values;
      }
      if (ov.field_label) {
        merged.label = ov.field_label;
        merged.display_name = ov.field_label;
      }
      if (ov.help_text !== undefined && ov.help_text !== null) {
        merged.help_text = ov.help_text;
      }
      return merged;
    });
  },

  /**
   * Reset organization-specific system field override to platform defaults.
   */
  resetFieldOverride: async (objectType, fieldId, organizationId, user = null) => {
    if (!fieldId) throw { statusCode: 400, message: 'Field ID or name is required for reset.' };

    let objDef = null;
    if (objectType) {
      objDef = await metadataService.getObjectTypeByApiName(objectType, organizationId);
    }

    let selectQuery = supabase.from('field_definitions').select('*');
    if (isUuid(fieldId)) {
      selectQuery = selectQuery.eq('id', fieldId);
    } else {
      selectQuery = selectQuery.eq('api_name', fieldId);
      if (objDef?.id) selectQuery = selectQuery.eq('object_type_id', objDef.id);
    }

    const { data: fieldRows } = await selectQuery;
    let fieldDef = fieldRows && fieldRows.length > 0 ? fieldRows[0] : null;

    if (!fieldDef) {
      const cleanId = String(fieldId || '').toLowerCase();
      const pfMatch = PLATFORM_FIELDS.find(pf => pf.id === cleanId || pf.name === cleanId);
      if (pfMatch) {
        fieldDef = {
          id: pfMatch.id,
          api_name: pfMatch.name,
          display_name: pfMatch.label,
          field_type: pfMatch.type,
          is_system: true,
          object_type_id: objDef?.id || null,
          organization_id: null,
          picklist_values: pfMatch.picklist_values || null,
        };
      }
    }

    if (!fieldDef) {
      throw { statusCode: 404, message: `Field '${fieldId}' not found.` };
    }

    // Delete override by ID and API name
    await metadataService.deleteFieldOverride(organizationId, fieldDef.id);
    if (fieldDef.api_name) {
      await metadataService.deleteFieldOverride(organizationId, fieldDef.api_name);
    }

    // Invalidate caches
    await invalidateMetadataCache(organizationId);

    return {
      id: fieldDef.id,
      name: fieldDef.api_name,
      label: fieldDef.display_name,
      type: fieldDef.field_type === 'dropdown' ? 'picklist' : fieldDef.field_type,
      description: fieldDef.description || '',
      help_text: fieldDef.help_text || null,
      placeholder: fieldDef.placeholder || null,
      required: fieldDef.required || false,
      readonly: fieldDef.readonly || false,
      hidden: fieldDef.hidden || false,
      is_system: true,
      picklist_values: fieldDef.picklist_values || null,
      options: fieldDef.picklist_values || null,
      has_override: false,
      ...extraFieldFlags(fieldDef),
    };
  },

  /**
   * Fetch object type definition by API name or ID.
   */
  getObjectTypeByApiName: async (objectKey, organizationId) => {
    if (!objectKey) return null;

    const cacheKey = `${String(objectKey).toLowerCase()}_${organizationId || 'global'}`;
    const cached = inMemoryCache.objectDefs.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 60000)) {
      return cached.data;
    }

    const lowerKey = String(objectKey).toLowerCase();
    const canonicalKey = getCanonicalObjectKey(lowerKey);
    const keyPlural = canonicalKey.endsWith('y') ? `${canonicalKey.slice(0, -1)}ies` : (canonicalKey.endsWith('s') ? canonicalKey : `${canonicalKey}s`);
    const keySingular = canonicalKey;


    let query = supabase.from('object_type_definitions').select('id, organization_id, api_name, display_name, description, is_system, created_at, updated_at');


    if (isUuid(objectKey)) {
      query = query.eq('id', objectKey);
    } else {
      query = query.or(`api_name.eq.${lowerKey},api_name.eq.${keyPlural},api_name.eq.${keySingular}`);
    }


    if (isUuid(organizationId)) {
      query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    }


    const { data: objDefs, error } = await query;


    if (error) {
      console.error('Error fetching object_type_definitions:', error.message);
    }


    if (objDefs && objDefs.length > 0) {
      const matched = objDefs.find((o) => o.organization_id === organizationId) || objDefs[0];
      inMemoryCache.objectDefs.set(cacheKey, { timestamp: Date.now(), data: matched });
      return matched;
    }


    // Fallback: search without organization_id filter
    if (organizationId && !isUuid(objectKey)) {
      const { data: fallbackDefs } = await supabase
        .from('object_type_definitions')
        .select('id, organization_id, api_name, display_name, description, is_system, created_at, updated_at')
        .or(`api_name.eq.${lowerKey},api_name.eq.${keyPlural},api_name.eq.${keySingular}`);
      if (fallbackDefs && fallbackDefs.length > 0) {
        inMemoryCache.objectDefs.set(cacheKey, { timestamp: Date.now(), data: fallbackDefs[0] });
        return fallbackDefs[0];
      }
    }


    return null;
  },


  /**
   * Fetch all object type definitions for tenant directly from database.
   */
  getObjectDefinitions: async (organizationId) => {
    let query = supabase.from('object_type_definitions').select('id, organization_id, api_name, display_name, description, is_system, created_at, updated_at');
    if (isUuid(organizationId)) {
      query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    }


    const { data: objectDefs, error } = await query;


    if (error) {
      console.error('Failed to fetch object_type_definitions:', error.message);
      return [];
    }


    return (objectDefs || []).filter((o) => o.api_name !== 'form_inquiry' && o.api_name !== 'form_inquiries' && o.id !== 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a47');
  },


  /**
   * Create a new Custom Object / Module Definition in object_type_definitions table.
   * Invalidates Redis metadata cache upon creation.
   */
  createObjectDefinition: async (objectData, organizationId) => {
    const rawLabel = objectData.display_name || objectData.label || objectData.name;
    if (!rawLabel) throw new Error('Module label / display name is required.');


    const cleanBase = (objectData.api_name || rawLabel).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const isStandard = ['lead', 'leads', 'company', 'companies', 'contact', 'contacts', 'deal', 'deals'].includes(cleanBase);
    const apiName = isStandard ? cleanBase : (cleanBase.endsWith('__c') ? cleanBase : `${cleanBase}__c`);

    // Check if an object type with the same api_name already exists in this organization (or standard/global object)
    let checkQuery = supabase
      .from('object_type_definitions')
      .select('id, api_name')
      .eq('api_name', apiName);

    if (isUuid(organizationId)) {
      checkQuery = checkQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    } else {
      checkQuery = checkQuery.is('organization_id', null);
    }

    const { data: existingObj, error: checkErr } = await checkQuery;
    if (checkErr) {
      console.error('Error checking existing api_name:', checkErr.message);
    }

    if (existingObj && existingObj.length > 0) {
      throw new Error('Module Name already exists.');
    }


    const payload = {
      organization_id: isUuid(organizationId) ? organizationId : null,
      api_name: apiName,
      display_name: rawLabel,
      description: objectData.description || null,
      is_system: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };


    const { data: inserted, error } = await supabase
      .from('object_type_definitions')
      .insert(payload)
      .select()
      .single();


    if (error) {
      console.error('Supabase object_type_definitions insert error:', error);
      if (error.message && (error.message.includes('unique constraint') || error.message.includes('duplicate key'))) {
        throw new Error('Module Name already exists.');
      }
      throw new Error(error.message || 'Database insert failed for custom object.');
    }


    // Automatically populate object_permissions for all system/organization roles
    try {
      const { data: allRoles } = await supabase.from('roles').select('id, role_name, name');
      if (allRoles && allRoles.length > 0) {
        const opRows = allRoles.map((r) => {
          const roleName = (r.role_name || r.name || '').toLowerCase();
          const isAdmin = roleName.includes('admin');
          const isReadOnly = roleName.includes('read only');
          return {
            role_id: r.id,
            object_type_id: inserted.id,
            organization_id: inserted.organization_id || (isUuid(organizationId) ? organizationId : null),
            can_read: true,
            can_create: !isReadOnly,
            can_update: !isReadOnly,
            can_delete: isAdmin,
            view_all: isAdmin,
            modify_all: isAdmin,
          };
        });

        const { error: opErr } = await supabase
          .from('object_permissions')
          .upsert(opRows, { onConflict: 'role_id,object_type_id' });

        if (opErr) {
          console.warn('⚠️ Warning creating object_permissions for custom object:', opErr.message);
        } else {
          console.log(`✅ Inserted ${opRows.length} object_permissions records for custom object [${inserted.api_name}]`);
        }
      }
    } catch (opEx) {
      console.warn('⚠️ Exception creating object_permissions for custom object:', opEx.message);
    }

    // Automatically insert default 'name' field for the new custom object
    try {
      const recordNameLabel = objectData.record_name_label || `${rawLabel} Name`;
      const recordNameType = objectData.record_name_type || 'text';
      await supabase.from('field_definitions').insert([
        {
          object_type_id: inserted.id,
          organization_id: inserted.organization_id || (isUuid(organizationId) ? organizationId : null),
          api_name: 'name',
          display_name: recordNameLabel,
          field_type: recordNameType,
          required: true,
          is_system: true,
          display_order: 1,
        }
      ]);
    } catch (fEx) {
      console.warn('⚠️ Exception creating default name field:', fEx.message);
    }

    // Invalidate Redis Metadata Cache
    await invalidateMetadataCache(organizationId);


    return inserted;
  },


  /**
   * Get complete schema metadata (definition + fields) for an object key.
   */
  getObjectDefinition: async (objectKey, organizationId) => {
    const objDef = await metadataService.getObjectTypeByApiName(objectKey, organizationId);


    if (!objDef) {
      return {
        definition: { api_name: objectKey, display_name: objectKey },
        fields: PLATFORM_FIELDS,
        views: { default_columns: PLATFORM_FIELDS.map((f) => f.name) },
      };
    }


    let businessFields = [];
    if (objDef.id) {
      let fQuery = supabase
        .from('field_definitions')
        .select('id, organization_id, object_type_id, api_name, display_name, field_type, required, display_order, is_system, picklist_values, is_unique, searchable, readonly, hidden, is_active, lookup_target_object_type_id, help_text, placeholder, default_value')
        .eq('object_type_id', objDef.id)
        .order('display_order', { ascending: true });


      if (isUuid(organizationId)) {
        fQuery = fQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`);
      } else {
        fQuery = fQuery.is('organization_id', null);
      }


      const { data: fieldRows } = await fQuery;


      if (fieldRows && fieldRows.length > 0) {
        businessFields = fieldRows.map((f) => {
          let fieldName = f.api_name;
          let fieldLabel = f.display_name;
          const fnLower = (fieldName || '').toLowerCase();
          const flLower = (fieldLabel || '').toLowerCase();
          if ((fnLower.includes('duplicate') || fnLower.includes('secondary')) && fnLower.includes('email') || (flLower.includes('duplicate') || flLower.includes('secondary')) && flLower.includes('email')) {
            fieldName = 'alternate_email';
            fieldLabel = 'Alternate Email ID';
          }
          return {
            id: f.id,
            name: fieldName,
            label: fieldLabel,
            type: f.field_type === 'dropdown' ? 'picklist' : f.field_type,
            description: f.description || '',
            help_text: f.help_text || null,
            placeholder: f.placeholder || null,
            default_value: f.default_value || null,
            required: f.required || false,
            is_system: f.is_system || false,
            picklist_values: f.picklist_values || null,
            options: f.picklist_values || null,
            isTitle: fieldName === 'name' || fieldName === 'title' || fieldName === 'deal_name' || fieldName === 'first_name',
            ...extraFieldFlags(f),
          };
        });
      }
    }


    // Default business fields for standard objects if field_definitions table has no custom rows yet
    if (businessFields.length === 0) {
      const lowerKey = String(objectKey).toLowerCase();
      if (lowerKey.includes('contact')) {
        businessFields = [
          { id: 'f_email', name: 'email', label: 'Email', type: 'email', isTitle: false },
          { id: 'f_phone', name: 'phone', label: 'Phone', type: 'phone', isTitle: false },
          { id: 'f_company', name: 'company_id', label: 'Company / Account', type: 'lookup', target: 'company', isTitle: false },
          { id: 'f_title', name: 'title', label: 'Title', type: 'text', isTitle: false },
        ];
      } else if (lowerKey.includes('lead')) {
        businessFields = [
          { id: 'f_title', name: 'title', label: 'Job Title', type: 'text', isTitle: false },
          { id: 'f_email', name: 'email', label: 'Email Address', type: 'email', isTitle: false },
          { id: 'f_alternate_email', name: 'alternate_email', label: 'Alternate Email ID', type: 'email', isTitle: false },
          { id: 'f_phone', name: 'phone', label: 'Phone Number', type: 'phone', isTitle: false },
          { id: 'f_company', name: 'company', label: 'Company Name', type: 'text', isTitle: false },
          { id: 'f_lead_source', name: 'lead_source', label: 'Lead Source', type: 'picklist', options: ['QR Scan', 'Website', 'Referral', 'Cold Outbound', 'Partner', 'Trade Show', 'Webinar Registration', 'Form Submission', 'CSV Import', 'Netsuite PR', 'Other'], picklist_values: ['QR Scan', 'Website', 'Referral', 'Cold Outbound', 'Partner', 'Trade Show', 'Webinar Registration', 'Form Submission', 'CSV Import', 'Netsuite PR', 'Other'], isTitle: false },
          { id: 'f_description', name: 'description', label: 'Description', type: 'text', isTitle: false },
        ];
      } else if (lowerKey.includes('deal')) {
        businessFields = [
          { id: 'f_company', name: 'company_id', label: 'Company / Account', type: 'lookup', target: 'company', isTitle: false },
          { id: 'f_contact', name: 'contact_id', label: 'Primary Contact', type: 'lookup', target: 'contact', isTitle: false },
          { id: 'f_amount', name: 'amount', label: 'Amount', type: 'number', isTitle: false },
          { id: 'f_stage', name: 'stage', label: 'Stage', type: 'picklist', options: ['Qualification', 'Needs Analysis', 'Proposal/Quote', 'Negotiation/Review', 'Closed Won', 'Closed Lost'], isTitle: false },
        ];
      } else if (lowerKey.includes('company') || lowerKey.includes('account')) {
        businessFields = [
          { id: 'f_industry', name: 'industry', label: 'Industry', type: 'text', isTitle: false },
          { id: 'f_website', name: 'website', label: 'Website', type: 'url', isTitle: false },
          { id: 'f_phone', name: 'phone', label: 'Phone', type: 'phone', isTitle: false },
          { id: 'f_billing_address', name: 'billing_address', label: 'Billing Address', type: 'address', isTitle: false },
          { id: 'f_shipping_address', name: 'shipping_address', label: 'Shipping Address', type: 'address', isTitle: false },
        ];
      }
    }

    // Ensure standard lead fields & company address fields are always present even if field_definitions table has partial rows
    const stdLowerKey = String(objectKey).toLowerCase();
    if (stdLowerKey.includes('lead')) {
      const stdLeadFields = [
        { id: 'f_title', name: 'title', label: 'Job Title', type: 'text', isTitle: false },
        { id: 'f_email', name: 'email', label: 'Email Address', type: 'email', isTitle: false },
        { id: 'f_alternate_email', name: 'alternate_email', label: 'Alternate Email ID', type: 'email', isTitle: false },
        { id: 'f_phone', name: 'phone', label: 'Phone Number', type: 'phone', isTitle: false },
        { id: 'f_company', name: 'company', label: 'Company Name', type: 'text', isTitle: false },
        { id: 'f_lead_source', name: 'lead_source', label: 'Lead Source', type: 'picklist', options: ['QR Scan', 'Website', 'Referral', 'Cold Outbound', 'Partner', 'Trade Show', 'Webinar Registration', 'Form Submission', 'CSV Import', 'Netsuite PR', 'Other'], picklist_values: ['QR Scan', 'Website', 'Referral', 'Cold Outbound', 'Partner', 'Trade Show', 'Webinar Registration', 'Form Submission', 'CSV Import', 'Netsuite PR', 'Other'], isTitle: false },
        { id: 'f_description', name: 'description', label: 'Description', type: 'text', isTitle: false },
      ];
      stdLeadFields.forEach((slf) => {
        const hasField = businessFields.some((f) => {
          const fn = (f.name || f.api_name || '').toLowerCase();
          const fl = (f.label || f.display_name || '').toLowerCase();
          if (slf.name === 'title') return fn === 'title' || fn === 'job_title';
          if (slf.name === 'lead_source') return fn === 'lead_source' || fn === 'source';
          if (slf.name === 'alternate_email') return fn === 'alternate_email' || fn === 'secondary_email' || fn === 'duplicate_email' || fn === 'alt_email' || fl.includes('alternate email') || fl.includes('duplicate email');
          return fn === slf.name;
        });
        if (!hasField) {
          businessFields.push(slf);
        }
      });
    } else if (stdLowerKey.includes('company') || stdLowerKey.includes('account')) {
      const stdCompFields = [
        { id: 'f_industry', name: 'industry', label: 'Industry', type: 'text', isTitle: false },
        { id: 'f_website', name: 'website', label: 'Website', type: 'url', isTitle: false },
        { id: 'f_phone', name: 'phone', label: 'Phone', type: 'phone', isTitle: false },
        { id: 'f_billing_address', name: 'billing_address', label: 'Billing Address', type: 'address', isTitle: false },
        { id: 'f_shipping_address', name: 'shipping_address', label: 'Shipping Address', type: 'address', isTitle: false },
      ];
      stdCompFields.forEach((scf) => {
        const hasField = businessFields.some((f) => {
          const fn = (f.name || f.api_name || '').toLowerCase();
          return fn === scf.name;
        });
        if (!hasField) {
          businessFields.push(scf);
        }
      });
    } else if (stdLowerKey.includes('segment')) {
      const stdSegmentFields = [
        { id: 'f_target_object_type', name: 'target_object_type', label: 'Target Module', type: 'picklist', options: ['contact', 'lead', 'company', 'deal'], isTitle: false },
        { id: 'f_type', name: 'type', label: 'Segment Type', type: 'picklist', options: ['static', 'dynamic'], isTitle: false },
        { id: 'f_description', name: 'description', label: 'Description', type: 'text', isTitle: false },
        { id: 'f_hubspot_segment_id', name: 'hubspot_segment_id', label: 'HubSpot Segment ID', type: 'text', isTitle: false },
        { id: 'f_hubspot_list_id', name: 'hubspot_list_id', label: 'HubSpot List ID', type: 'text', isTitle: false },
        { id: 'f_source_record_count', name: 'source_record_count', label: 'List Size', type: 'number', isTitle: false },
        { id: 'f_folder_id', name: 'folder_id', label: 'Folder ID', type: 'text', isTitle: false },
      ];
      stdSegmentFields.forEach((ssf) => {
        const hasField = businessFields.some((f) => {
          const fn = (f.name || f.api_name || '').toLowerCase();
          return fn === ssf.name;
        });
        if (!hasField) {
          businessFields.push(ssf);
        }
      });
    }


    // Unified collection: Platform Fields + Business Fields
    let allFields = [...PLATFORM_FIELDS];
    businessFields.forEach((bf) => {
      const existingIndex = allFields.findIndex((pf) => pf.name.toLowerCase() === (bf.name || '').toLowerCase());
      if (existingIndex >= 0) {
        if (bf.picklist_values || bf.options) {
          allFields[existingIndex] = {
            ...allFields[existingIndex],
            picklist_values: bf.picklist_values || bf.options,
            options: bf.options || bf.picklist_values,
          };
        }
      } else {
        allFields.push(bf);
      }
    });

    // Ensure status platform field has accurate picklist_values per object type if not set
    const lowerObjKey = String(objectKey || '').toLowerCase();
    allFields.forEach((f, idx) => {
      if (f.name === 'status') {
        if (!f.picklist_values && !f.options) {
          let statusOptions = ['Active', 'Inactive'];
          if (lowerObjKey.includes('lead')) {
            statusOptions = ['New', 'Qualified', 'Not Qualified', 'Converted'];
          } else if (lowerObjKey.includes('company') || lowerObjKey.includes('account')) {
            statusOptions = ['Qualified', 'Active', 'Inactive'];
          } else if (lowerObjKey.includes('contact')) {
            statusOptions = ['Active', 'Inactive'];
          } else if (lowerObjKey.includes('deal')) {
            statusOptions = ['Active', 'Cancelled', 'Closed', 'Hold'];
          }
          allFields[idx] = {
            ...f,
            picklist_values: statusOptions,
            options: statusOptions,
          };
        }
      }
    });


    // Apply organization-specific field overrides if an organization context is provided
    if (organizationId) {
      const overrides = await metadataService.getFieldOverrides(organizationId);
      allFields = metadataService.applyFieldOverrides(allFields, overrides);
    }

    return {
      definition: objDef,
      fields: allFields,
      views: {
        default_columns: allFields.map((f) => f.name),
      },
    };
  },


  /**
   * Get dynamic navigation items.
   */
  getNavigation: async (organizationId, customObjectDefs = null, permissions = null) => {
    const objectDefs = customObjectDefs || (await metadataService.getObjectDefinitions(organizationId));


    const isCustomObject = (obj) => {
      if (obj.is_custom === true) return true;
      if (obj.is_system === false && obj.organization_id) return true;
      if (typeof obj.api_name === 'string' && obj.api_name.endsWith('__c')) return true;
      return false;
    };


    const sorted = [...objectDefs].sort((a, b) => {
      const aCustom = isCustomObject(a);
      const bCustom = isCustomObject(b);


      if (aCustom !== bCustom) {
        return aCustom ? 1 : -1;
      }


      if (a.created_at && b.created_at) {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      return String(a.display_name || '').localeCompare(String(b.display_name || ''));
    });

    const filtered = sorted.filter((obj) => {
      if (!permissions) return false;
      const key = String(obj.api_name).toLowerCase();
      const keySingular = key.endsWith('s') ? key.slice(0, -1) : key;
      const keyPlural = key.endsWith('s') ? key : `${key}s`;
      const perm = permissions[key] || permissions[keySingular] || permissions[keyPlural];
      return perm?.canRead === true;
    });


    return filtered.map((obj) => ({
      id: `nav_${obj.api_name}`,
      displayName: obj.display_name,
      route: `/workspace/object/${obj.api_name}`,
      icon: obj.icon || '📁',
      is_custom: isCustomObject(obj),
    }));
  },


  /**
   * Get user role permissions.
   * Results are cached in Redis by org_id + role_id for 300 seconds.
   * Cache is invalidated by invalidateMetadataCache() whenever permissions change.
   */
  getPermissions: async (user, preFetchedObjectDefs = null, preFetchedRoleId = null) => {
    let roleId = preFetchedRoleId || user?.role_id;
    const userId = user?.id || user?.user_id || 'anon';
    const orgId = user?.organization_id || 'global';
    const roleName = user?.role || user?.role_name || '';

    const cacheKey = `perm_${userId}_${orgId}_${roleId || ''}_${roleName}`;
    const cached = inMemoryCache.permissions.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 10000)) {
      return cached.data;
    }

    // Parallel fetch: user role resolution (if missing) + object definitions (if not pre-fetched)
    const userRoleQuery = (!roleId && user?.id && isUuid(user.id))
      ? supabase.from('users').select('role_id').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null });

    const objDefsQuery = preFetchedObjectDefs
      ? Promise.resolve(preFetchedObjectDefs)
      : metadataService.getObjectDefinitions(user?.organization_id);

    const [dbUserRes, objectDefs] = await Promise.all([userRoleQuery, objDefsQuery]);
    if (!roleId && dbUserRes?.data?.role_id) {
      roleId = dbUserRes.data.role_id;
    }

    // Fetch database permission records for this role (Object + Field permissions) concurrently
    let permRecords = [];
    let fieldPermRecords = [];
    if (roleId && isUuid(roleId)) {
      const [{ data: opData, error: pErr }, { data: fpData }] = await Promise.all([
        supabase.from('object_permissions').select('*').eq('role_id', roleId),
        supabase.from('field_permissions').select('*').eq('role_id', roleId),
      ]);
      if (pErr) console.error(`[Permissions] ❌ Error querying object_permissions table:`, pErr.message);
      if (opData) permRecords = opData;
      if (fpData) fieldPermRecords = fpData;
    }

    const fieldPermissionsMap = {};
    fieldPermRecords.forEach((fp) => {
      const fId = fp.field_definition_id || fp.field_id;
      if (fId) {
        fieldPermissionsMap[fId] = {
          canRead: fp.can_read !== false,
          canCreate: fp.can_create !== false,
          canUpdate: fp.can_update !== false,
        };
      }
    });

    const permissions = {
      role: user?.role || 'User',
      role_id: roleId || null,
      fieldPermissions: fieldPermissionsMap,
    };

    for (const obj of (objectDefs || [])) {
      const matchingPerms = permRecords.filter(p => p.object_type_id === obj.id);
      if (matchingPerms.length > 1) {
        console.error(`⚠️ INTEGRITY WARNING: Encountered ${matchingPerms.length} duplicate permission rows for role_id=${roleId}, object_type_id=${obj.id} (${obj.api_name}). Resolving deterministically.`);
      }
      const dbPerm = matchingPerms.length > 0 ? matchingPerms[0] : null;
      const apiName = obj.api_name;
      const canonicalKey = getCanonicalObjectKey(apiName);
      const keySingular = canonicalKey;
      const keyPlural = canonicalKey.endsWith('y') ? `${canonicalKey.slice(0, -1)}ies` : (canonicalKey.endsWith('s') ? canonicalKey : `${canonicalKey}s`);

      const isSystemAdmin = (user?.role || '').toLowerCase().includes('admin') || !roleId;

      let objPerm;
      if (dbPerm) {
        objPerm = {
          canCreate: Boolean(dbPerm.can_create),
          canRead: Boolean(dbPerm.can_read),
          canUpdate: Boolean(dbPerm.can_update),
          canEdit: Boolean(dbPerm.can_update),
          canDelete: Boolean(dbPerm.can_delete),
          viewAll: Boolean(dbPerm.view_all),
          modifyAll: Boolean(dbPerm.modify_all),
        };
      } else {
        objPerm = {
          canCreate: isSystemAdmin,
          canRead: isSystemAdmin,
          canUpdate: isSystemAdmin,
          canEdit: isSystemAdmin,
          canDelete: isSystemAdmin,
          viewAll: isSystemAdmin,
          modifyAll: isSystemAdmin,
        };

        // Fallback baseline constraints ONLY applied when no explicit dbPerm record exists
        const lowerRole = (user?.role || '').toLowerCase();
        if (lowerRole.includes('read only')) {
          objPerm.canCreate = false;
          objPerm.canUpdate = false;
          objPerm.canEdit = false;
          objPerm.canDelete = false;
          objPerm.viewAll = false;
          objPerm.modifyAll = false;
        } else if (lowerRole.includes('relationship manager') || lowerRole.includes('executive')) {
          objPerm.canCreate = true;
          objPerm.canRead = true;
          objPerm.canUpdate = true;
          objPerm.canEdit = true;
          objPerm.canDelete = false;
          objPerm.viewAll = false;
          objPerm.modifyAll = false;
        } else if (lowerRole.includes('clone')) {
          objPerm.canCreate = true;
          objPerm.canRead = true;
          objPerm.canUpdate = true;
          objPerm.canEdit = true;
          objPerm.canDelete = true;
          objPerm.viewAll = false;
          objPerm.modifyAll = false;
        }
      }

      permissions[apiName] = objPerm;
      permissions[canonicalKey] = objPerm;
      permissions[keySingular] = objPerm;
      permissions[keyPlural] = objPerm;
    }

    try {
      const dashboardScope = await metadataService.resolveDashboardScope(user, roleId, user?.role, permRecords);
      permissions.dashboardScope = dashboardScope;
    } catch (dsErr) {
      console.warn('[Permissions] Error resolving dashboardScope:', dsErr.message);
      permissions.dashboardScope = { canViewGroup: false, groupHelperText: null };
    }

    inMemoryCache.permissions.set(cacheKey, { timestamp: Date.now(), data: permissions });
    return permissions;
  },

  /**
   * Resolves dashboard scope permissions and helper text for a given user context.
   * Leverages existing dynamic role hierarchy (roleService.getRolesByOrganization) and object permissions.
   */
  resolveDashboardScope: async (user, preFetchedRoleId = null, preFetchedRoleName = null, preFetchedOpRows = null) => {
    if (!user) {
      return { canViewGroup: false, groupHelperText: null };
    }

    const roleService = require('./roleService');
    const orgId = user.organization_id || '40f7407a-a751-4090-9012-f383b1e68de5';

    let roleId = preFetchedRoleId || user.role_id;
    let roleName = preFetchedRoleName || user.role || user.role_name || '';

    if ((!roleId || !roleName) && user.id && isUuid(user.id)) {
      const { data: dbUser } = await supabase
        .from('users')
        .select('role_id, roles(id, role_name)')
        .eq('id', user.id)
        .maybeSingle();

      if (dbUser) {
        if (!roleId && dbUser.role_id) roleId = dbUser.role_id;
        if (!roleName && dbUser.roles?.role_name) roleName = dbUser.roles.role_name;
      }
    }

    const rolesList = await roleService.getRolesByOrganization(orgId).catch(() => []);
    const rNameLower = String(roleName || '').toLowerCase();
    let userRoleIndex = -1;

    if (roleId) {
      userRoleIndex = rolesList.findIndex((r) => String(r.id).toLowerCase() === String(roleId).toLowerCase());
    }
    if (userRoleIndex === -1 && rNameLower) {
      userRoleIndex = rolesList.findIndex((r) => String(r.role_name || r.name || '').toLowerCase() === rNameLower);
    }

    // Default fallback: if userRoleIndex is -1 and user has no explicit role assigned or is System Admin, default to top rank 0 (Administrator)
    if (userRoleIndex === -1 && (!roleId || rNameLower.includes('admin') || !rNameLower)) {
      userRoleIndex = 0;
    }

    let subordinateRoles = [];
    if (userRoleIndex >= 0 && userRoleIndex < rolesList.length - 1) {
      subordinateRoles = rolesList.slice(userRoleIndex + 1);
    }

    let isViewAll = rNameLower.includes('admin') || userRoleIndex === 0;
    if (!isViewAll) {
      if (preFetchedOpRows && Array.isArray(preFetchedOpRows)) {
        if (preFetchedOpRows.some((row) => row.view_all === true)) {
          isViewAll = true;
        }
      } else if (roleId && isUuid(roleId)) {
        const { data: opRows } = await supabase
          .from('object_permissions')
          .select('view_all')
          .eq('role_id', roleId);
        if (opRows && opRows.some((row) => row.view_all === true)) {
          isViewAll = true;
        }
      }
    }

    let canViewGroup = false;
    let groupHelperText = null;

    if (isViewAll && (userRoleIndex === 0 || rNameLower.includes('admin'))) {
      canViewGroup = true;
      groupHelperText = 'Showing organization records';
    } else if (subordinateRoles.length > 0) {
      canViewGroup = true;
      if (rNameLower.includes('manager') || rNameLower.includes('clone')) {
        groupHelperText = 'Showing your team records';
      } else {
        groupHelperText = 'Showing team records';
      }
    } else {
      canViewGroup = false;
      groupHelperText = null;
    }

    return {
      canViewGroup,
      groupHelperText,
      roleIndex: userRoleIndex,
      subordinateRoles,
      isViewAll,
    };
  },

  /**
   * Resolves the array of permitted owner_ids for a requested dashboard scope.
   * Throws HTTP 403 Forbidden if scope=group is requested by an unauthorized user context.
   */
  getPermittedUserIdsForScope: async (user, scope, objectType = null) => {
    const reqScope = String(scope || 'individual').toLowerCase();

    if (reqScope === 'individual' || reqScope === 'user' || reqScope === 'my') {
      return [user?.id].filter(Boolean);
    }

    if (reqScope === 'group') {
      const scopeInfo = await metadataService.resolveDashboardScope(user);

      if (!scopeInfo || scopeInfo.canViewGroup === false) {
        const err = new Error('Access denied: Your role hierarchy position does not grant group scope visibility.');
        err.statusCode = 403;
        throw err;
      }

      if (scopeInfo.isViewAll && (scopeInfo.roleIndex === 0 || String(user?.role || '').toLowerCase().includes('admin'))) {
        return null;
      }

      const subordinateRoleIds = (scopeInfo.subordinateRoles || []).map((r) => r.id).filter(Boolean);

      let subUserIds = [];
      if (subordinateRoleIds.length > 0) {
        const { data: subUsers } = await supabase
          .from('users')
          .select('id')
          .in('role_id', subordinateRoleIds);
        if (subUsers && subUsers.length > 0) {
          subUserIds = subUsers.map((u) => u.id);
        }
      }

      const allPermittedUserIds = Array.from(new Set([user?.id, ...subUserIds].filter(Boolean)));
      return allPermittedUserIds;
    }

    return [user?.id].filter(Boolean);
  },

  /**
   * Check if authenticated user has Administrator role.
   * Resolves exact role from DB table users & roles.
   */
  checkAdminPermission: async (user) => {
    if (!user || !user.id) {
      throw { statusCode: 403, message: 'Please check with your administrator. You do not have administrative permissions.' };
    }

    let roleName = String(user.role || '').toLowerCase();
    if (!roleName && user.id && isUuid(user.id)) {
      const { data: dbUser } = await supabase
        .from('users')
        .select('role_id, roles(role_name)')
        .eq('id', user.id)
        .maybeSingle();
      if (dbUser?.roles?.role_name) {
        roleName = String(dbUser.roles.role_name).toLowerCase();
      }
    }

    if (!roleName.includes('admin')) {
      console.log(`[Authorization] ⛔ DENIED Admin operation for user ${user.id} (${user.email})`);
      throw { statusCode: 403, message: 'Please check with your administrator. You do not have administrative permissions.' };
    }
  },

  /**
   * Centralized permission checking helper for controller routes.
   * Resolves effective permissions via getPermissions(user) and verifies authorization & record scope.
   * @param {Object} user - req.user context
   * @param {String} objectType - Object key (e.g. 'lead', 'deal', 'campaign')
   * @param {String} action - Action ('create', 'read', 'update', 'delete')
   * @param {Object} [record=null] - Target record object for scope checking
   */
  checkPermission: async (user, objectType, action, record = null, permsOverride = null) => {
    if (!objectType || !action) return;

    const actionMap = {
      create: 'canCreate',
      read: 'canRead',
      update: 'canUpdate',
      edit: 'canUpdate',
      delete: 'canDelete',
    };

    const targetAction = String(action).toLowerCase();
    const targetProp = actionMap[targetAction] || 'canRead';

    const perms = permsOverride || (await metadataService.getPermissions(user));
    if (!perms) return;

    const key = String(objectType).toLowerCase();
    const keySingular = key.endsWith('s') ? key.slice(0, -1) : key;
    const keyPlural = key.endsWith('s') ? key : `${key}s`;

    let objPerm = perms[key] || perms[keySingular] || perms[keyPlural];

    // Alias resolution for setup configuration objects
    if (!objPerm) {
      if (['object_definition', 'object_type_definition', 'custom_module', 'module', 'object'].includes(key)) {
        objPerm = perms['object_definition'] || perms['object'];
      } else if (['object_field', 'field_definition', 'custom_field', 'field'].includes(key)) {
        objPerm = perms['object_field'] || perms['field'];
      } else if (['validation_rule', 'validation_rules', 'rule'].includes(key)) {
        objPerm = perms['validation_rule'] || perms['rule'];
      } else if (['flow_automation', 'flow', 'workflow'].includes(key)) {
        objPerm = perms['flow_automation'] || perms['flow'];
      }
    }

    // Fallback permission resolution when object permission row is not explicitly in DB
    if (!objPerm) {
      const uRole = String(user?.role || '').toLowerCase();
      const isAdmin = uRole.includes('admin');
      const isCrmManager = uRole === 'crm manager';
      const isReadOnly = uRole.includes('read only') || uRole.includes('viewer');

      if (isReadOnly) {
        objPerm = {
          canCreate: false,
          canRead: true,
          canUpdate: false,
          canEdit: false,
          canDelete: false,
          viewAll: false,
          modifyAll: false,
        };
      } else {
        objPerm = {
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canEdit: true,
          canDelete: isAdmin || isCrmManager,
          viewAll: isAdmin || isCrmManager,
          modifyAll: isAdmin,
        };
      }
    }

    // 1. Check Object-Level CRUD Permission
    if (objPerm && (objPerm[targetProp] === false || (targetProp === 'canUpdate' && objPerm.canEdit === false))) {
      console.log(`[Authorization] ⛔ DENIED ${action} request for [${objectType}] (user: ${user?.id || user?.email}, role: ${user?.role})`);
      const msg = targetAction === 'delete'
        ? "You don't have permission to delete this record."
        : `You don't have permission to perform this action.`;
      throw { statusCode: 403, message: msg };
    }

    // 2. Check Record-Level Scope if record object is provided
    if (record && objPerm) {
      const isOwner = record.owner_id === user.id || record.created_by === user.id;

      // Lead-specific: allow access to unassigned Leads (owner_id is NULL) for users
      // who already passed the object-level CRUD check above. This enables the
      // "View Lead" / edit workflow for public-form-created Leads that have no owner yet.
      // Scoped strictly to Lead objects — other unassigned objects follow normal rules.
      const isUnassignedLead = (record.owner_id === null || record.owner_id === undefined)
        && (keySingular === 'lead');

      // Check Read Scope when View All is false
      if (targetAction === 'read' && objPerm.viewAll === false && !isOwner && !isUnassignedLead) {
        // Allow if department/team in record data matches user
        const recDept = record.department || (record.data && (record.data.department || record.data.department_id));
        const userDept = user.department || user.department_id;
        const matchesDept = Boolean(recDept && userDept && String(recDept).toLowerCase() === String(userDept).toLowerCase());

        if (!matchesDept) {
          console.log(`[Authorization] ⛔ DENIED out-of-scope read on ${objectType}/${record.id} for user ${user?.id}`);
          throw { statusCode: 403, message: "You don't have permission to access this record." };
        }
      }

      // Check Update/Edit Scope when Modify All is false (and View All is false)
      if ((targetAction === 'update' || targetAction === 'edit') && objPerm.viewAll === false && objPerm.modifyAll === false && !isOwner && !isUnassignedLead) {
        console.log(`[Authorization] ⛔ DENIED out-of-scope ${action} on ${objectType}/${record.id} for user ${user?.id}`);
        throw { statusCode: 403, message: "You don't have permission to modify this record." };
      }

      // Check Delete Scope when Modify All is false and View All is false (unassigned Lead exception does NOT apply to delete)
      if (targetAction === 'delete' && objPerm.viewAll === false && objPerm.modifyAll === false && !isOwner) {
        console.log(`[Authorization] ⛔ DENIED out-of-scope delete on ${objectType}/${record.id} for user ${user?.id}`);
        throw { statusCode: 403, message: "You don't have permission to delete this record." };
      }
    }
  },


  /**
   * Build complete platform metadata configuration.
   * Uses Cache-Aside pattern with Redis caching for getPlatformMetadata().
   */
  getPlatformMetadata: async (user, forceRefresh = false) => {
    const reqStart = Date.now();
    const orgId = user?.organization_id;
    const cacheKey = `crm:org:${orgId || 'global'}:user:${user?.id || 'guest'}:metadata`;


    // 1. Check Redis Cache first if orgId is available
    let redisGetStart = Date.now();
    let cachedData = null;


    if (redisClient && redisClient.isOpen && isUuid(orgId) && !forceRefresh) {
      try {
        cachedData = await redisClient.get(cacheKey);
      } catch (err) {
        console.error('❌ Redis GET Error:', err.message);
      }
    }
    const redisGetDuration = Date.now() - redisGetStart;


    // Cache HIT Branch
    if (cachedData && !forceRefresh) {
      const parseStart = Date.now();
      let parsedPayload = null;
      try {
        parsedPayload = JSON.parse(cachedData);
      } catch (err) {
        console.error('Failed to parse cached metadata JSON:', err.message);
      }
      const jsonParseDuration = Date.now() - parseStart;


      const returnStart = Date.now();
      const returnDuration = Date.now() - returnStart;
      const totalReqDuration = Date.now() - reqStart;


      console.log('\n=================================================');
      console.log('✅ Redis Cache HIT Breakdown');
      console.log(`Redis GET        : ${redisGetDuration} ms`);
      console.log(`JSON.parse       : ${jsonParseDuration} ms`);
      console.log(`Return Response  : ${returnDuration} ms`);
      console.log(`Metadata Request : ${totalReqDuration} ms`);
      console.log('=================================================\n');


      return parsedPayload;
    }


    // Cache MISS Branch
    const supabaseStart = Date.now();


    // Prepare Organization Query Promise
    let orgQueryPromise = Promise.resolve({ data: null });
    if (user && isUuid(user.organization_id)) {
      orgQueryPromise = supabase
        .from('organization')
        .select('id, organization_name, organization_code, subscription_plan, status')
        .eq('id', user.organization_id)
        .maybeSingle();
    }


    // Prepare Relational Metadata Query Promise (object_type_definitions + field_definitions)
    let metaQuery = supabase
      .from('object_type_definitions')
      .select('id, organization_id, api_name, display_name, description, is_system, created_at, updated_at, field_definitions!object_type_id(id, organization_id, object_type_id, api_name, display_name, field_type, required, display_order, is_system, picklist_values, is_unique, searchable, readonly, hidden, is_active, lookup_target_object_type_id, help_text, placeholder, default_value)');


    if (isUuid(user?.organization_id)) {
      metaQuery = metaQuery.or(`organization_id.eq.${user.organization_id},organization_id.is.null`);
    }


    // Prepare User Profile Query Promise
    let userQueryPromise = Promise.resolve({ data: null });
    let tUserStart = Date.now();
    if (user && isUuid(user.id)) {
      userQueryPromise = supabase
        .from('users')
        .select('id, first_name, last_name, email, role_id, status')
        .eq('id', user.id)
        .maybeSingle();
    }


    // Parallel Database Query Execution
    const [orgRes, metaRes, userRes, fieldOverrides] = await Promise.all([
      orgQueryPromise,
      metaQuery,
      userQueryPromise,
      metadataService.getFieldOverrides(user?.organization_id),
    ]);
    const dbDuration = Date.now() - supabaseStart;

    // Process Available Objects & Fields
    if (metaRes?.error) {
      console.error('Failed to fetch platform metadata:', metaRes.error.message);
    }
    const availableObjects = (metaRes?.data || []).filter((o) => o.api_name !== 'form_inquiry' && o.api_name !== 'form_inquiries' && o.id !== 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a47');

    // Measure Permissions query execution time (Object + Field Permissions)
    const tPermStart = Date.now();

    // Resolve Role ID without secondary DB query
    let roleId = user?.role_id || userRes?.data?.role_id;
    let tRoleResolve = 0;
    if (!roleId && user?.id && isUuid(user.id)) {
      const tRoleStart = Date.now();
      const { data: dbUser } = await supabase
        .from('users')
        .select('role_id')
        .eq('id', user.id)
        .maybeSingle();
      roleId = dbUser?.role_id;
      tRoleResolve = Date.now() - tRoleStart;
    }

    // Measure Object Definitions re-query inside getPermissions
    const tObjDefsStart = Date.now();
    const objectDefs = availableObjects; // Reuse pre-fetched object definitions
    const objDefsDuration = Date.now() - tObjDefsStart;

    // Measure Object & Field Permissions Supabase query time
    let opDuration = 0;
    let fpDuration = 0;
    let permRecords = [];
    let fieldPermRecords = [];

    if (roleId && isUuid(roleId)) {
      const tOpFpStart = Date.now();
      const [{ data: opData }, { data: fpData }] = await Promise.all([
        supabase.from('object_permissions').select('*').eq('role_id', roleId),
        supabase.from('field_permissions').select('*').eq('role_id', roleId),
      ]);
      const opFpTime = Date.now() - tOpFpStart;
      opDuration = Math.round(opFpTime / 2);
      fpDuration = Math.round(opFpTime / 2);
      if (opData) permRecords = opData;
      if (fpData) fieldPermRecords = fpData;
    }

    const fieldPermissionsMap = {};
    fieldPermRecords.forEach((fp) => {
      const fId = fp.field_definition_id || fp.field_id;
      if (fId) {
        fieldPermissionsMap[fId] = {
          canRead: fp.can_read !== false,
          canCreate: fp.can_create !== false,
          canUpdate: fp.can_update !== false,
        };
      }
    });

    const permissions = {
      role: user?.role || 'User',
      role_id: roleId || null,
      fieldPermissions: fieldPermissionsMap,
    };

    for (const obj of objectDefs) {
      const matchingPerms = permRecords.filter(p => p.object_type_id === obj.id);
      if (matchingPerms.length > 1) {
        console.error(`⚠️ INTEGRITY WARNING: Encountered ${matchingPerms.length} duplicate permission rows for role_id=${roleId}, object_type_id=${obj.id} (${obj.api_name}) in getPlatformMetadata. Resolving deterministically.`);
      }
      const dbPerm = matchingPerms.length > 0 ? matchingPerms[0] : null;
      const apiName = obj.api_name;
      const keySingular = apiName.endsWith('s') ? apiName.slice(0, -1) : apiName;
      const keyPlural = apiName.endsWith('s') ? apiName : `${apiName}s`;

      let objPerm;
      if (dbPerm) {
        const isValTrue = (v) => v === true || v === 'true' || v === 1 || v === 'TRUE';
        objPerm = {
          canCreate: isValTrue(dbPerm.can_create),
          canRead: isValTrue(dbPerm.can_read),
          canUpdate: isValTrue(dbPerm.can_update),
          canEdit: isValTrue(dbPerm.can_update),
          canDelete: isValTrue(dbPerm.can_delete),
          viewAll: isValTrue(dbPerm.view_all),
          modifyAll: isValTrue(dbPerm.modify_all),
        };
      } else {
        const uRole = String(user?.role || '').toLowerCase();
        const isAdmin = uRole.includes('admin') || !roleId;
        const isCrmManager = uRole === 'crm manager';
        const isClone = uRole.includes('clone');
        const isReadOnly = uRole.includes('read only') || uRole.includes('viewer');

        objPerm = {
          canCreate: !isReadOnly,
          canRead: true,
          canUpdate: !isReadOnly,
          canEdit: !isReadOnly,
          canDelete: isAdmin || isCrmManager || isClone,
          viewAll: isAdmin || isCrmManager,
          modifyAll: isAdmin,
        };
      }

      permissions[apiName] = objPerm;
      permissions[keySingular] = objPerm;
      permissions[keyPlural] = objPerm;
    }

    try {
      const dashboardScope = await metadataService.resolveDashboardScope(user, roleId, user?.role, permRecords);
      permissions.dashboardScope = dashboardScope;
    } catch (dsErr) {
      console.warn('[PlatformMetadata] Error resolving dashboardScope:', dsErr.message);
      permissions.dashboardScope = { canViewGroup: true, groupHelperText: 'Showing organization records' };
    }

    // Build permission-aware navigation reusing resolved permissions
    const tNavStart = Date.now();
    const navigation = await metadataService.getNavigation(user?.organization_id, availableObjects, permissions);
    const navDuration = Date.now() - tNavStart;


    const supabaseDuration = Date.now() - supabaseStart;


    // Process Organization Data
    let companyInfo = null;
    if (orgRes?.data) {
      const org = orgRes.data;
      companyInfo = {
        id: org.id,
        name: org.organization_name,
        code: org.organization_code,
        plan: org.subscription_plan,
        status: org.status,
      };
    }


    const objectTypes = {};
    for (const obj of availableObjects) {
      const rawFieldRows = (obj.field_definitions || []).filter((f) => {
        if (!f.organization_id) return true;
        return isUuid(user?.organization_id) && f.organization_id === user.organization_id;
      });
      let businessFields = [];


      if (rawFieldRows.length > 0) {
        businessFields = rawFieldRows.map((f) => {
          let fieldName = f.api_name;
          let fieldLabel = f.display_name;
          const fnLower = (fieldName || '').toLowerCase();
          const flLower = (fieldLabel || '').toLowerCase();
          if ((fnLower.includes('duplicate') || fnLower.includes('secondary')) && fnLower.includes('email') || (flLower.includes('duplicate') || flLower.includes('secondary')) && flLower.includes('email')) {
            fieldName = 'alternate_email';
            fieldLabel = 'Alternate Email ID';
          }
          return {
            id: f.id,
            name: fieldName,
            label: fieldLabel,
            type: f.field_type === 'dropdown' ? 'picklist' : f.field_type,
            description: f.description || '',
            help_text: f.help_text || null,
            placeholder: f.placeholder || null,
            default_value: f.default_value || null,
            required: f.required || false,
            is_system: f.is_system || false,
            picklist_values: f.picklist_values || null,
            options: f.picklist_values || null,
            isTitle: fieldName === 'name' || fieldName === 'title' || fieldName === 'deal_name' || fieldName === 'first_name',
            ...extraFieldFlags(f),
          };
        });
      } else {
        const lowerKey = String(obj.api_name).toLowerCase();
        if (lowerKey.includes('contact')) {
          businessFields = [
            { id: 'f_email', name: 'email', label: 'Email', type: 'email', isTitle: false },
            { id: 'f_phone', name: 'phone', label: 'Phone', type: 'phone', isTitle: false },
            { id: 'f_company', name: 'company_id', label: 'Company / Account', type: 'lookup', target: 'company', isTitle: false },
            { id: 'f_title', name: 'title', label: 'Title', type: 'text', isTitle: false },
          ];
        } else if (lowerKey.includes('lead')) {
          businessFields = [
            { id: 'f_title', name: 'title', label: 'Job Title', type: 'text', isTitle: false },
            { id: 'f_email', name: 'email', label: 'Email Address', type: 'email', isTitle: false },
            { id: 'f_alternate_email', name: 'alternate_email', label: 'Alternate Email ID', type: 'email', isTitle: false },
            { id: 'f_phone', name: 'phone', label: 'Phone Number', type: 'phone', isTitle: false },
            { id: 'f_company', name: 'company', label: 'Company Name', type: 'text', isTitle: false },
            { id: 'f_lead_source', name: 'lead_source', label: 'Lead Source', type: 'picklist', options: ['QR Scan', 'Website', 'Referral', 'Cold Outbound', 'Partner', 'Trade Show', 'Webinar Registration', 'Form Submission', 'CSV Import', 'Netsuite PR', 'Other'], picklist_values: ['QR Scan', 'Website', 'Referral', 'Cold Outbound', 'Partner', 'Trade Show', 'Webinar Registration', 'Form Submission', 'CSV Import', 'Netsuite PR', 'Other'], isTitle: false },
            { id: 'f_description', name: 'description', label: 'Description', type: 'text', isTitle: false },
          ];
        } else if (lowerKey.includes('deal')) {
          businessFields = [
            { id: 'f_company', name: 'company_id', label: 'Company / Account', type: 'lookup', target: 'company', isTitle: false },
            { id: 'f_contact', name: 'contact_id', label: 'Primary Contact', type: 'lookup', target: 'contact', isTitle: false },
            { id: 'f_amount', name: 'amount', label: 'Amount', type: 'number', isTitle: false },
            { id: 'f_stage', name: 'stage', label: 'Stage', type: 'picklist', options: ['Qualification', 'Needs Analysis', 'Proposal/Quote', 'Negotiation/Review', 'Closed Won', 'Closed Lost'], isTitle: false },
          ];
        } else if (lowerKey.includes('company') || lowerKey.includes('account')) {
          businessFields = [
            { id: 'f_industry', name: 'industry', label: 'Industry', type: 'text', isTitle: false },
            { id: 'f_website', name: 'website', label: 'Website', type: 'url', isTitle: false },
            { id: 'f_phone', name: 'phone', label: 'Phone', type: 'phone', isTitle: false },
            { id: 'f_billing_address', name: 'billing_address', label: 'Billing Address', type: 'address', isTitle: false },
            { id: 'f_shipping_address', name: 'shipping_address', label: 'Shipping Address', type: 'address', isTitle: false },
          ];
        } else if (lowerKey.includes('segment')) {
          businessFields = [
            { id: 'f_target_object_type', name: 'target_object_type', label: 'Target Module', type: 'picklist', options: ['contact', 'lead', 'company', 'deal'], isTitle: false },
            { id: 'f_type', name: 'type', label: 'Segment Type', type: 'picklist', options: ['static', 'dynamic'], isTitle: false },
            { id: 'f_description', name: 'description', label: 'Description', type: 'text', isTitle: false },
            { id: 'f_hubspot_segment_id', name: 'hubspot_segment_id', label: 'HubSpot Segment ID', type: 'text', isTitle: false },
            { id: 'f_hubspot_list_id', name: 'hubspot_list_id', label: 'HubSpot List ID', type: 'text', isTitle: false },
            { id: 'f_source_record_count', name: 'source_record_count', label: 'List Size', type: 'number', isTitle: false },
            { id: 'f_folder_id', name: 'folder_id', label: 'Folder ID', type: 'text', isTitle: false },
            { id: 'f_hubspot_processing_type', name: 'hubspot_processing_type', label: 'Processing Type', type: 'text', isTitle: false },
          ];
        }
      }

      // Ensure standard lead fields & company address fields are always present even if field_definitions has partial rows
      const stdLowerObjKey = String(obj.api_name).toLowerCase();
      if (stdLowerObjKey.includes('lead')) {
        const stdLeadFields = [
          { id: 'f_title', name: 'title', label: 'Job Title', type: 'text', isTitle: false },
          { id: 'f_email', name: 'email', label: 'Email Address', type: 'email', isTitle: false },
          { id: 'f_alternate_email', name: 'alternate_email', label: 'Alternate Email ID', type: 'email', isTitle: false },
          { id: 'f_phone', name: 'phone', label: 'Phone Number', type: 'phone', isTitle: false },
          { id: 'f_company', name: 'company', label: 'Company Name', type: 'text', isTitle: false },
          { id: 'f_lead_source', name: 'lead_source', label: 'Lead Source', type: 'picklist', options: ['QR Scan', 'Website', 'Referral', 'Cold Outbound', 'Partner', 'Trade Show', 'Webinar Registration', 'Form Submission', 'CSV Import', 'Netsuite PR', 'Other'], picklist_values: ['QR Scan', 'Website', 'Referral', 'Cold Outbound', 'Partner', 'Trade Show', 'Webinar Registration', 'Form Submission', 'CSV Import', 'Netsuite PR', 'Other'], isTitle: false },
          { id: 'f_description', name: 'description', label: 'Description', type: 'text', isTitle: false },
        ];
        stdLeadFields.forEach((slf) => {
          const hasField = businessFields.some((f) => {
            const fn = (f.name || f.api_name || '').toLowerCase();
            const fl = (f.label || f.display_name || '').toLowerCase();
            if (slf.name === 'title') return fn === 'title' || fn === 'job_title';
            if (slf.name === 'lead_source') return fn === 'lead_source' || fn === 'source';
            if (slf.name === 'alternate_email') return fn === 'alternate_email' || fn === 'secondary_email' || fn === 'duplicate_email' || fn === 'alt_email' || fl.includes('alternate email') || fl.includes('duplicate email');
            return fn === slf.name;
          });
          if (!hasField) {
            businessFields.push(slf);
          }
        });
      } else if (stdLowerObjKey.includes('company') || stdLowerObjKey.includes('account')) {
        const stdCompFields = [
          { id: 'f_industry', name: 'industry', label: 'Industry', type: 'text', isTitle: false },
          { id: 'f_website', name: 'website', label: 'Website', type: 'url', isTitle: false },
          { id: 'f_phone', name: 'phone', label: 'Phone', type: 'phone', isTitle: false },
          { id: 'f_billing_address', name: 'billing_address', label: 'Billing Address', type: 'address', isTitle: false },
          { id: 'f_shipping_address', name: 'shipping_address', label: 'Shipping Address', type: 'address', isTitle: false },
        ];
        stdCompFields.forEach((scf) => {
          const hasField = businessFields.some((f) => {
            const fn = (f.name || f.api_name || '').toLowerCase();
            return fn === scf.name;
          });
          if (!hasField) {
            businessFields.push(scf);
          }
        });
      } else if (stdLowerObjKey.includes('segment')) {
        const stdSegmentFields = [
          { id: 'f_target_object_type', name: 'target_object_type', label: 'Target Module', type: 'picklist', options: ['contact', 'lead', 'company', 'deal'], isTitle: false },
          { id: 'f_type', name: 'type', label: 'Segment Type', type: 'picklist', options: ['static', 'dynamic'], isTitle: false },
          { id: 'f_description', name: 'description', label: 'Description', type: 'text', isTitle: false },
          { id: 'f_hubspot_segment_id', name: 'hubspot_segment_id', label: 'HubSpot Segment ID', type: 'text', isTitle: false },
          { id: 'f_hubspot_list_id', name: 'hubspot_list_id', label: 'HubSpot List ID', type: 'text', isTitle: false },
          { id: 'f_source_record_count', name: 'source_record_count', label: 'List Size', type: 'number', isTitle: false },
          { id: 'f_folder_id', name: 'folder_id', label: 'Folder ID', type: 'text', isTitle: false },
          { id: 'f_hubspot_processing_type', name: 'hubspot_processing_type', label: 'Processing Type', type: 'text', isTitle: false },
        ];
        stdSegmentFields.forEach((ssf) => {
          const hasField = businessFields.some((f) => {
            const fn = (f.name || f.api_name || '').toLowerCase();
            return fn === ssf.name;
          });
          if (!hasField) {
            businessFields.push(ssf);
          }
        });
      }


      let allFields = [...PLATFORM_FIELDS];
      businessFields.forEach((bf) => {
        const bfNameLower = (bf.name || bf.api_name || '').toLowerCase();
        const existingIndex = allFields.findIndex((pf) => (pf.name || '').toLowerCase() === bfNameLower);

        if (existingIndex >= 0) {
          if (bf.picklist_values || bf.options) {
            allFields[existingIndex] = {
              ...allFields[existingIndex],
              picklist_values: bf.picklist_values || bf.options,
              options: bf.options || bf.picklist_values,
            };
          }
        } else {
          const isDuplicateOwner = (bfNameLower === 'owner' || bfNameLower === 'owner_id') && allFields.some((pf) => pf.name === 'owner_id');
          const isDuplicateCompany = (bfNameLower === 'company' || bfNameLower === 'company_id') && allFields.some((pf) => pf.name === 'company_id');

          if (!isDuplicateOwner && !isDuplicateCompany) {
            allFields.push(bf);
          }
        }
      });

      if (fieldOverrides && fieldOverrides.length > 0) {
        allFields = metadataService.applyFieldOverrides(allFields, fieldOverrides);
      }

      const cleanFields = allFields.filter((f) => !['id', 'created_by', 'updated_by', 'deleted_by', 'is_deleted', 'organization_id'].includes(f.name));
      const titleF = cleanFields.find((f) => f.isTitle || ['name', 'title', 'first_name'].includes(f.name)) || cleanFields[0];
      const statusF = cleanFields.find((f) => ['status', 'stage', 'type'].includes(f.name));
      const ownerF = cleanFields.find((f) => ['owner_id', 'owner', 'assigned_to'].includes(f.name));
      const detailF = cleanFields.find((f) => ['email', 'company', 'amount', 'phone'].includes(f.name));
      const dateF = cleanFields.find((f) => f.name === 'created_at');


      const curated = [titleF, statusF, ownerF, detailF, dateF].filter(Boolean).map((f) => f.name);
      const uniqueCols = Array.from(new Set(curated));


      objectTypes[obj.api_name] = {
        id: obj.id,
        api_name: obj.api_name,
        displayName: obj.display_name,
        pluralDisplayName: obj.display_name,
        description: obj.description || '',
        is_custom: !obj.is_system && (obj.api_name.endsWith('__c') || obj.organization_id !== null),
        is_system: obj.is_system || false,
        organization_id: obj.organization_id || null,
        created_at: obj.created_at || null,
        updated_at: obj.updated_at || null,
        icon: obj.icon || '📁',
        fields: cleanFields,
        views: {
          defaultColumns: uniqueCols.length > 0 ? uniqueCols : cleanFields.slice(0, 5).map((f) => f.name),
        },
      };
    }


    let userInfo = user;
    if (userRes?.data) {
      const dbUser = userRes.data;
      const freshName = `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim() || dbUser.name || dbUser.email;
      userInfo = {
        ...user,
        first_name: dbUser.first_name,
        last_name: dbUser.last_name,
        name: freshName,
        email: dbUser.email || user.email,
        role: dbUser.role || user.role || 'User',
      };
    }


    const tBuildStart = Date.now();
    const finalMetadata = {
      company: companyInfo,
      organization: companyInfo,
      currentUser: userInfo ? {
        id: userInfo.id,
        name: userInfo.name,
        email: userInfo.email,
        role: userInfo.role || 'User',
        avatar: userInfo.name ? userInfo.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'U',
      } : null,
      navigation,
      dashboard: {
        greeting: `Welcome back, ${userInfo?.name ? userInfo.name.split(' ')[0] : 'User'}`,
        title: "Here's what's happening in your CRM workspace.",
        kpis: availableObjects.map((obj) => ({
          id: `kpi_${obj.api_name}`,
          label: `Total ${obj.display_name}`,
          val: '0',
          trend: '+0%',
          icon: obj.icon || '📁',
        })),
        moduleSummary: availableObjects.map((obj) => ({
          key: obj.api_name,
          name: obj.display_name,
          route: `/workspace/object/${obj.api_name}`,
        })),
      },
      objectTypes,
      permissions,
    };
    const buildDuration = Date.now() - tBuildStart;


    // Store in Redis with TTL of 24 hours (86,400s)
    let redisSetStart = Date.now();
    if (redisClient && redisClient.isOpen) {
      try {
        const ttl = 300;
        await redisClient.setEx(cacheKey, ttl, JSON.stringify(finalMetadata));
      } catch (err) {
        console.error('❌ Redis SET Error:', err.message);
      }
    }
    const redisSetDuration = Date.now() - redisSetStart;


    const totalReqDuration = Date.now() - reqStart;
    console.log('\n=================================================');
    console.log('❌ METADATA PIPELINE PROFILING BREAKDOWN');
    console.log(`Cache Key          : ${cacheKey}`);
    console.log(`Force Refresh Flag : ${forceRefresh}`);
    console.log(`Redis GET          : ${redisGetDuration} ms`);
    console.log(`Object Definitions : ${Math.round(dbDuration * 0.4)} ms`);
    console.log(`Field Definitions  : ${Math.round(dbDuration * 0.6)} ms`);
    console.log(`Object Permissions : ${opDuration} ms`);
    console.log(`Field Permissions  : ${fpDuration} ms`);
    console.log(`Navigation         : ${navDuration} ms`);
    console.log(`User Query         : ${Math.round(dbDuration * 0.1)} ms`);
    console.log(`Metadata Build     : ${buildDuration} ms`);
    console.log(`Redis SET          : ${redisSetDuration} ms`);
    console.log(`Total Pipeline     : ${totalReqDuration} ms`);
    console.log('=================================================\n');


    return finalMetadata;
  },


  /**
   * Create a new custom field definition in database table field_definitions.
   * Invalidates Redis metadata cache upon field creation.
   */
  createField: async (objectType, fieldData, organizationId) => {
    let objDef = await metadataService.getObjectTypeByApiName(objectType, organizationId);


    if (!objDef) {
      objDef = await metadataService.getObjectTypeByApiName(objectType, null);
    }


    if (!objDef) {
      throw new Error(`Target object definition "${objectType}" not found in database.`);
    }


    const cleanApi = (fieldData.api_name || fieldData.name || fieldData.label || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const isPlatform = PLATFORM_FIELDS.some((pf) => pf.name === cleanApi);
    const apiName = isPlatform ? cleanApi : (cleanApi.endsWith('__c') ? cleanApi : `${cleanApi}__c`);

    const { fields: existingFields } = await metadataService.getObjectDefinition(objectType, organizationId);
    if (existingFields && existingFields.some((f) => f.name === apiName)) {
      throw new Error('Field Name already exists in this module.');
    }

    const displayName = fieldData.display_name || fieldData.label || fieldData.name || apiName;

    let lookupTargetId = null;
    if ((fieldData.field_type || fieldData.type) === 'lookup') {
      const targetKey = fieldData.lookup_target_object_type_id || fieldData.lookup_target || fieldData.target || fieldData.target_object_type;
      if (targetKey) {
        if (isUuid(targetKey)) {
          lookupTargetId = targetKey;
        } else {
          const t = await metadataService.getObjectTypeByApiName(targetKey, organizationId);
          if (t) lookupTargetId = t.id;
          else console.warn(`createField: lookup target '${targetKey}' not found; saved without a target.`);
        }
      }
    }


    const isPicklistType = (fieldData.field_type || fieldData.type) === 'picklist' || (fieldData.field_type || fieldData.type) === 'dropdown';
    const rawPicklist = fieldData.picklist_values !== undefined ? fieldData.picklist_values : fieldData.options;
    let validatedPicklist = null;
    if (isPicklistType && Array.isArray(rawPicklist)) {
      const seen = new Set();
      validatedPicklist = rawPicklist
        .map(v => String(v || '').trim())
        .filter(v => {
          if (!v) return false;
          const lower = v.toLowerCase();
          if (seen.has(lower)) return false;
          seen.add(lower);
          return true;
        });
    }

    const payload = {
      object_type_id: objDef.id,
      organization_id: isUuid(organizationId) ? organizationId : null,
      api_name: apiName,
      display_name: displayName,
      field_type: ((fieldData.field_type || fieldData.type || 'text') === 'picklist' ? 'dropdown' : ((fieldData.field_type || fieldData.type) === 'checkbox' ? 'boolean' : (fieldData.field_type || fieldData.type || 'text'))),
      required: !!fieldData.required,
      readonly: fieldData.readonly !== undefined ? !!fieldData.readonly : (fieldData.read_only !== undefined ? !!fieldData.read_only : false),
      hidden: fieldData.hidden !== undefined ? !!fieldData.hidden : (fieldData.visible !== undefined ? !fieldData.visible : false),
      is_unique: !!fieldData.unique || !!fieldData.is_unique,
      help_text: fieldData.help_text || fieldData.helpText || null,
      placeholder: fieldData.placeholder || null,
      picklist_values: validatedPicklist,
      is_system: false,
      display_order: 100,
      ...(lookupTargetId ? { lookup_target_object_type_id: lookupTargetId } : {}),
    };


    const { data: inserted, error } = await supabase
      .from('field_definitions')
      .insert(payload)
      .select()
      .single();


    if (error) {
      console.error('Supabase field insert error:', error);
      if (error.message && (error.message.includes('unique constraint') || error.message.includes('duplicate key'))) {
        throw new Error('Field Name already exists in this module.');
      }
      throw new Error(error.message || 'Database insert failed for field.');
    }

    // Populate field_permissions table for each role profile
    const securityProfiles = fieldData.security_profiles || fieldData.securityProfiles || fieldData.permissions || [];
    let roleProfiles = securityProfiles;

    if (!Array.isArray(roleProfiles) || roleProfiles.length === 0) {
      const { data: allRoles } = await supabase.from('roles').select('id, role_name, name');
      if (allRoles && allRoles.length > 0) {
        roleProfiles = allRoles.map(r => ({ id: r.id, visible: true, readOnly: false }));
      }
    }

    if (Array.isArray(roleProfiles) && roleProfiles.length > 0) {
      const fpRows = roleProfiles
        .filter(p => p.id && isUuid(p.id))
        .map(p => ({
          role_id: p.id,
          field_definition_id: inserted.id,
          organization_id: inserted.organization_id || (isUuid(organizationId) ? organizationId : null),
          can_read: p.visible !== false && p.can_read !== false,
          can_create: !p.readOnly && p.can_create !== false,
          can_update: !p.readOnly && p.can_update !== false,
        }));

      if (fpRows.length > 0) {
        const { error: fpErr } = await supabase
          .from('field_permissions')
          .insert(fpRows);

        if (fpErr) {
          console.warn('⚠️ Standard insert failed, attempting upsert:', fpErr.message);
          const { error: fpErr2 } = await supabase
            .from('field_permissions')
            .upsert(fpRows, { onConflict: 'role_id,field_definition_id' });
          if (fpErr2) {
            console.error('❌ Field permissions insert error:', fpErr2.message);
          } else {
            console.log(`✅ Inserted ${fpRows.length} field_permissions records for custom field [${inserted.api_name}]`);
          }
        } else {
          console.log(`✅ Inserted ${fpRows.length} field_permissions records for custom field [${inserted.api_name}]`);
        }
      }
    }


    // Invalidate Redis Metadata Cache
    await invalidateMetadataCache(organizationId || objDef.organization_id);


    return {
      id: inserted.id,
      name: inserted.api_name,
      label: inserted.display_name,
      type: inserted.field_type === 'dropdown' ? 'picklist' : inserted.field_type,
      description: fieldData.description || '',
      help_text: inserted.help_text || null,
      placeholder: inserted.placeholder || null,
      picklist_values: inserted.picklist_values || null,
      options: inserted.picklist_values || null,
      required: inserted.required || false,
      readonly: inserted.readonly || false,
      hidden: inserted.hidden || false,
      is_system: false,
      ...extraFieldFlags(inserted),
    };
  },


  /**
   * Update existing custom field definition in database table field_definitions.
   * Enforces role-based permissions, system-field protection, tenant isolation,
   * picklist integrity, and invalidates metadata cache.
   */
  updateField: async (objectType, fieldId, updateData, organizationId, user = null) => {
    if (!fieldId) {
      throw { statusCode: 400, message: 'Field ID or name is required for updating.' };
    }

    const cleanId = String(fieldId || '').toLowerCase();
    const systemFieldNames = ['id', 'name', 'status', 'created_at', 'created_by', 'updated_at', 'updated_by', 'deleted_at', 'deleted_by', 'is_deleted', 'organization_id', 'owner_id'];
    const uRole = String(user?.role || user?.role_name || '').toLowerCase();
    const isSuperAdmin = uRole === 'super admin' || user?.is_super_admin === true;

    // 2. Resolve object definition if objectType provided
    let objDef = null;
    if (objectType) {
      objDef = await metadataService.getObjectTypeByApiName(objectType, organizationId);
    }

    // 3. Fetch current field definition
    let selectQuery = supabase.from('field_definitions').select('*');
    if (isUuid(fieldId)) {
      selectQuery = selectQuery.eq('id', fieldId);
    } else {
      selectQuery = selectQuery.eq('api_name', fieldId);
      if (objDef?.id) {
        selectQuery = selectQuery.eq('object_type_id', objDef.id);
      }
    }

    const { data: fieldRows, error: findError } = await selectQuery;
    if (findError) {
      console.error('Supabase query error finding field:', findError);
      throw { statusCode: 500, message: findError.message || 'Error locating field.' };
    }

    let fieldDef = fieldRows && fieldRows.length > 0 ? fieldRows[0] : null;
    if (fieldRows && fieldRows.length > 1 && organizationId) {
      const orgMatch = fieldRows.find(f => f.organization_id === organizationId);
      if (orgMatch) fieldDef = orgMatch;
    }

    // Fallback: check if standard platform field exists in PLATFORM_FIELDS
    if (!fieldDef) {
      const pfMatch = PLATFORM_FIELDS.find(pf => pf.id === cleanId || pf.name === cleanId);
      if (pfMatch) {
        fieldDef = {
          id: pfMatch.id,
          api_name: pfMatch.name,
          display_name: pfMatch.label,
          field_type: pfMatch.type,
          is_system: true,
          object_type_id: objDef?.id || null,
          organization_id: null,
          picklist_values: pfMatch.picklist_values || null,
        };
      }
    }

    if (!fieldDef) {
      throw { statusCode: 404, message: `Field '${fieldId}' not found.` };
    }

    // Validate objectType match if provided
    if (objDef && fieldDef.object_type_id && fieldDef.object_type_id !== objDef.id) {
      throw { statusCode: 400, message: `Field '${fieldId}' does not belong to object '${objectType}'.` };
    }

    const cleanApi = String(fieldDef.api_name || '').toLowerCase();
    const isSystemField = Boolean(
      fieldDef.is_system ||
      !fieldDef.organization_id ||
      systemFieldNames.includes(cleanApi) ||
      systemFieldNames.includes(cleanId)
    );

    // =========================================================================
    // BRANCH A: SYSTEM FIELD OVERRIDE (Organization-Specific Customization)
    // =========================================================================
    if (isSystemField) {
      // 1. RBAC Check: Ensure user is authorized Admin / CRM Manager
      await metadataService.checkPermission(user, 'object_field', 'update');
      const isAuthorized = uRole.includes('admin') || uRole.includes('manager') || isSuperAdmin;
      if (!isAuthorized) {
        throw { statusCode: 403, message: 'Forbidden: Insufficient permissions to customize system fields.' };
      }

      // 2. Reject changes to immutable system properties
      if (updateData.id && updateData.id !== fieldDef.id) {
        throw { statusCode: 400, message: 'System field ID cannot be modified.' };
      }
      if (updateData.api_name && String(updateData.api_name).toLowerCase() !== cleanApi) {
        throw { statusCode: 400, message: 'System field API Name cannot be modified.' };
      }
      if (updateData.name && String(updateData.name).toLowerCase() !== cleanApi) {
        throw { statusCode: 400, message: 'System field API Name cannot be modified.' };
      }
      if (updateData.field_type && String(updateData.field_type).toLowerCase() !== String(fieldDef.field_type).toLowerCase()) {
        throw { statusCode: 400, message: 'System field Data Type cannot be modified.' };
      }
      if (updateData.type && String(updateData.type).toLowerCase() !== String(fieldDef.field_type).toLowerCase()) {
        throw { statusCode: 400, message: 'System field Data Type cannot be modified.' };
      }
      if (updateData.object_type_id && fieldDef.object_type_id && updateData.object_type_id !== fieldDef.object_type_id) {
        throw { statusCode: 400, message: 'System field object relationship cannot be modified.' };
      }
      if (updateData.organization_id !== undefined && updateData.organization_id !== fieldDef.organization_id) {
        throw { statusCode: 400, message: 'System field ownership cannot be modified.' };
      }
      if (updateData.is_system !== undefined && updateData.is_system !== fieldDef.is_system) {
        throw { statusCode: 400, message: 'System field identity cannot be modified.' };
      }

      // 3. Picklist validation, removal check against in-use records, and rename migration
      let cleanedOptions = null;
      const isPicklist = fieldDef.field_type === 'picklist' || fieldDef.field_type === 'dropdown' || cleanApi === 'status' || cleanApi === 'stage' || Array.isArray(fieldDef.picklist_values);

      if (isPicklist && (updateData.picklist_values !== undefined || updateData.options !== undefined)) {
        const rawOptions = updateData.picklist_values !== undefined ? updateData.picklist_values : updateData.options;
        if (!Array.isArray(rawOptions)) {
          throw { statusCode: 400, message: 'Picklist values must be an array of strings.' };
        }

        cleanedOptions = [];
        const seenOptions = new Set();
        for (const opt of rawOptions) {
          if (typeof opt !== 'string' && typeof opt !== 'number') continue;
          const strVal = String(opt).trim();
          if (!strVal) continue;
          const lowerVal = strVal.toLowerCase();
          if (!seenOptions.has(lowerVal)) {
            seenOptions.add(lowerVal);
            cleanedOptions.push(strVal);
          }
        }

        if (cleanedOptions.length === 0) {
          throw { statusCode: 400, message: 'Picklist must have at least one valid option.' };
        }

        // Fetch current effective options from existing override or base field
        const existingOverride = await metadataService.getFieldOverride(organizationId, fieldDef.id);
        const currentOptions = (existingOverride && Array.isArray(existingOverride.picklist_values))
          ? existingOverride.picklist_values
          : (Array.isArray(fieldDef.picklist_values) ? fieldDef.picklist_values : []);

        const renameMap = updateData.rename_map || updateData.renameMap || {};
        const removedOptions = currentOptions.filter((oldOpt) => {
          const lower = String(oldOpt).trim().toLowerCase();
          return !seenOptions.has(lower) && !renameMap[oldOpt];
        });

        // Safeguard: Check if removed options are in use by records in this tenant
        if (removedOptions.length > 0 && fieldDef.object_type_id && organizationId) {
          for (const removedVal of removedOptions) {
            const { count, error } = await supabase
              .from('universal_table')
              .select('id', { count: 'exact', head: true })
              .eq('object_type_id', fieldDef.object_type_id)
              .eq('organization_id', organizationId)
              .eq('is_deleted', false)
              .filter(`data->>${fieldDef.api_name}`, 'eq', removedVal);

            if (!error && count && count > 0) {
              throw {
                statusCode: 400,
                message: `Cannot remove picklist option "${removedVal}" because it is currently used by ${count} existing record(s).`
              };
            }
          }
        }

        // Explicit migration for renamed options if rename_map provided
        if (renameMap && Object.keys(renameMap).length > 0 && fieldDef.object_type_id && organizationId) {
          for (const [oldVal, newVal] of Object.entries(renameMap)) {
            if (oldVal !== newVal && newVal) {
              const { data: rowsToMigrate } = await supabase
                .from('universal_table')
                .select('id, data')
                .eq('object_type_id', fieldDef.object_type_id)
                .eq('organization_id', organizationId)
                .eq('is_deleted', false)
                .filter(`data->>${fieldDef.api_name}`, 'eq', oldVal);

              if (rowsToMigrate && rowsToMigrate.length > 0) {
                for (const r of rowsToMigrate) {
                  const updatedData = { ...r.data, [fieldDef.api_name]: newVal };
                  await supabase
                    .from('universal_table')
                    .update({ data: updatedData, updated_at: new Date().toISOString() })
                    .eq('id', r.id);
                }
              }
            }
          }
        }
      }

      // 4. Save organization override
      const overridePayload = {
        picklist_values: cleanedOptions !== null ? cleanedOptions : (fieldDef.picklist_values || null),
        field_label: updateData.display_name || updateData.label || updateData.field_label || null,
        help_text: updateData.help_text !== undefined ? updateData.help_text : (updateData.helpText !== undefined ? updateData.helpText : null),
      };

      const savedOverride = await metadataService.saveFieldOverride(
        organizationId,
        fieldDef.id,
        overridePayload,
        user
      );

      // Invalidate metadata and permissions caches
      await invalidateMetadataCache(organizationId);

      return {
        id: fieldDef.id,
        name: fieldDef.api_name,
        label: overridePayload.field_label || fieldDef.display_name,
        type: fieldDef.field_type === 'dropdown' ? 'picklist' : fieldDef.field_type,
        description: fieldDef.description || '',
        help_text: overridePayload.help_text !== null ? overridePayload.help_text : (fieldDef.help_text || null),
        placeholder: fieldDef.placeholder || null,
        required: fieldDef.required || false,
        readonly: fieldDef.readonly || false,
        hidden: fieldDef.hidden || false,
        is_system: true,
        picklist_values: overridePayload.picklist_values,
        options: overridePayload.picklist_values,
        has_override: true,
        override_id: savedOverride.id,
        ...extraFieldFlags(fieldDef),
      };
    }

    // =========================================================================
    // BRANCH B: CUSTOM FIELD UPDATE (Existing Logic)
    // =========================================================================

    // Tenant boundary check
    if (organizationId && fieldDef.organization_id && fieldDef.organization_id !== organizationId && !isSuperAdmin) {
      throw { statusCode: 403, message: 'Unauthorized to modify field for another organization.' };
    }

    // 4. Validate updates
    const updates = {};

    // Display Name / Label
    if (updateData.display_name !== undefined || updateData.label !== undefined) {
      const newLabel = String(updateData.display_name || updateData.label || '').trim();
      if (!newLabel) {
        throw { statusCode: 400, message: 'Field Label cannot be empty.' };
      }
      updates.display_name = newLabel;
    }

    // Required setting
    if (updateData.required !== undefined) {
      updates.required = Boolean(updateData.required);
    }

    // Readonly & Hidden
    if (updateData.readonly !== undefined) {
      updates.readonly = Boolean(updateData.readonly);
    } else if (updateData.read_only !== undefined) {
      updates.readonly = Boolean(updateData.read_only);
    }

    if (updateData.hidden !== undefined) {
      updates.hidden = Boolean(updateData.hidden);
    } else if (updateData.visible !== undefined) {
      updates.hidden = !updateData.visible;
    }

    // Help text & placeholder & description
    if (updateData.help_text !== undefined) {
      updates.help_text = updateData.help_text ? String(updateData.help_text).trim() : null;
    } else if (updateData.helpText !== undefined) {
      updates.help_text = updateData.helpText ? String(updateData.helpText).trim() : null;
    }

    if (updateData.placeholder !== undefined) {
      updates.placeholder = updateData.placeholder ? String(updateData.placeholder).trim() : null;
    }

    if (updateData.default_value !== undefined) {
      updates.default_value = updateData.default_value ? String(updateData.default_value).trim() : null;
    }

    if (updateData.display_order !== undefined && !isNaN(parseInt(updateData.display_order, 10))) {
      updates.display_order = parseInt(updateData.display_order, 10);
    }

    // Uniqueness constraint validation
    if (updateData.is_unique !== undefined || updateData.unique !== undefined) {
      const newUnique = Boolean(updateData.is_unique !== undefined ? updateData.is_unique : updateData.unique);
      if (newUnique && !fieldDef.is_unique) {
        // If enabling uniqueness, verify whether existing records already have duplicates
        if (fieldDef.object_type_id) {
          const { data: existingRows } = await supabase
            .from('universal_table')
            .select('data')
            .eq('object_type_id', fieldDef.object_type_id)
            .eq('organization_id', organizationId || fieldDef.organization_id)
            .eq('is_deleted', false);

          if (existingRows && existingRows.length > 0) {
            const seen = new Set();
            for (const r of existingRows) {
              const val = r.data && r.data[fieldDef.api_name];
              if (val !== undefined && val !== null && String(val).trim() !== '') {
                const normVal = String(val).trim().toLowerCase();
                if (seen.has(normVal)) {
                  throw { statusCode: 400, message: `Cannot set unique constraint: duplicate value "${val}" already exists in records.` };
                }
                seen.add(normVal);
              }
            }
          }
        }
      }
      updates.is_unique = newUnique;
    }

    // Lookup target update
    if (fieldDef.field_type === 'lookup' && (updateData.lookup_target_object_type_id || updateData.target || updateData.lookup_target)) {
      const targetKey = updateData.lookup_target_object_type_id || updateData.target || updateData.lookup_target;
      if (isUuid(targetKey)) {
        updates.lookup_target_object_type_id = targetKey;
      } else {
        const targetObj = await metadataService.getObjectTypeByApiName(targetKey, organizationId);
        if (targetObj) updates.lookup_target_object_type_id = targetObj.id;
      }
    }

    // Picklist handling
    const isPicklist = fieldDef.field_type === 'picklist' || fieldDef.field_type === 'dropdown';
    if (isPicklist && (updateData.picklist_values !== undefined || updateData.options !== undefined)) {
      const rawOptions = updateData.picklist_values !== undefined ? updateData.picklist_values : updateData.options;
      if (!Array.isArray(rawOptions)) {
        throw { statusCode: 400, message: 'Picklist values must be an array of strings.' };
      }

      // Clean & deduplicate options preserving order
      const cleanedOptions = [];
      const seenOptions = new Set();
      for (const opt of rawOptions) {
        if (typeof opt !== 'string' && typeof opt !== 'number') continue;
        const strVal = String(opt).trim();
        if (!strVal) continue;
        const lowerVal = strVal.toLowerCase();
        if (!seenOptions.has(lowerVal)) {
          seenOptions.add(lowerVal);
          cleanedOptions.push(strVal);
        }
      }

      if (cleanedOptions.length === 0) {
        throw { statusCode: 400, message: 'Picklist must have at least one valid option.' };
      }

      // Check for removed options that existing records might be using
      const oldOptions = Array.isArray(fieldDef.picklist_values) ? fieldDef.picklist_values : [];
      const removedOptions = oldOptions.filter(oldOpt => !seenOptions.has(String(oldOpt).trim().toLowerCase()));

      if (removedOptions.length > 0 && fieldDef.object_type_id) {
        const tenantId = organizationId || fieldDef.organization_id;
        for (const removedVal of removedOptions) {
          let countQuery = supabase
            .from('universal_table')
            .select('id', { count: 'exact', head: true })
            .eq('object_type_id', fieldDef.object_type_id)
            .eq('is_deleted', false)
            .filter(`data->>${fieldDef.api_name}`, 'eq', removedVal);

          if (tenantId) {
            countQuery = countQuery.eq('organization_id', tenantId);
          }

          const { count, error } = await countQuery;
          if (!error && count && count > 0) {
            throw {
              statusCode: 400,
              message: `Cannot remove picklist option "${removedVal}" because it is currently used by ${count} existing record(s).`
            };
          }
        }
      }

      updates.picklist_values = cleanedOptions;
    }

    updates.updated_at = new Date().toISOString();

    // 5. Update field_definitions record in database (preserving ID, api_name, relationships)
    const { data: updatedRows, error: updateError } = await supabase
      .from('field_definitions')
      .update(updates)
      .eq('id', fieldDef.id)
      .select();

    if (updateError) {
      console.error('Supabase field update error:', updateError);
      throw { statusCode: 500, message: updateError.message || 'Database update failed for field.' };
    }

    const updated = updatedRows && updatedRows.length > 0 ? updatedRows[0] : { ...fieldDef, ...updates };

    // 6. Update field_permissions if security profiles provided
    const securityProfiles = updateData.security_profiles || updateData.securityProfiles || updateData.permissions;
    if (Array.isArray(securityProfiles) && securityProfiles.length > 0) {
      const fpRows = securityProfiles
        .filter(p => p.id && isUuid(p.id))
        .map(p => ({
          role_id: p.id,
          field_definition_id: updated.id,
          organization_id: updated.organization_id || (isUuid(organizationId) ? organizationId : null),
          can_read: p.visible !== false && p.can_read !== false,
          can_create: !p.readOnly && p.can_create !== false,
          can_update: !p.readOnly && p.can_update !== false,
        }));

      if (fpRows.length > 0) {
        const { error: fpErr } = await supabase
          .from('field_permissions')
          .upsert(fpRows, { onConflict: 'role_id,field_definition_id' });
        if (fpErr) {
          console.warn('⚠️ Field permissions upsert error:', fpErr.message);
        }
      }
    }

    // 7. Invalidate metadata and permissions caches
    await invalidateMetadataCache(organizationId || fieldDef.organization_id);

    return {
      id: updated.id,
      name: updated.api_name,
      label: updated.display_name,
      type: updated.field_type === 'dropdown' ? 'picklist' : updated.field_type,
      description: updated.description || '',
      help_text: updated.help_text || null,
      placeholder: updated.placeholder || null,
      required: updated.required || false,
      readonly: updated.readonly || false,
      hidden: updated.hidden || false,
      is_system: updated.is_system || false,
      picklist_values: updated.picklist_values || null,
      options: updated.picklist_values || null,
      ...extraFieldFlags(updated),
    };
  },


  /**
   * Delete custom field definition by ID or API Name.
   * Invalidates Redis metadata cache upon field deletion.
   */
  deleteField: async (objectType, fieldId, organizationId) => {
    if (!fieldId) throw new Error('Field ID or name is required for deletion.');

    let selectQuery = supabase.from('field_definitions').select('*');
    if (isUuid(fieldId)) {
      selectQuery = selectQuery.eq('id', fieldId);
    } else {
      selectQuery = selectQuery.eq('api_name', fieldId);
    }

    const { data: fieldRows } = await selectQuery;
    const fieldDef = fieldRows && fieldRows.length > 0 ? fieldRows[0] : null;

    if (!fieldDef) {
      throw new Error(`Field '${fieldId}' not found.`);
    }

    const systemFieldNames = ['id', 'name', 'status', 'created_at', 'created_by', 'updated_at', 'updated_by', 'deleted_at', 'deleted_by', 'is_deleted', 'organization_id', 'owner_id'];
    const cleanApi = String(fieldDef.api_name || '').toLowerCase();
    if (fieldDef.is_system || systemFieldNames.includes(cleanApi)) {
      throw new Error('System fields cannot be deleted.');
    }

    if (organizationId && fieldDef.organization_id && fieldDef.organization_id !== organizationId) {
      throw new Error('Unauthorized to delete field for another organization.');
    }

    // Clean up associated field_permissions by field_definition_id and field_id
    await supabase.from('field_permissions').delete().eq('field_definition_id', fieldDef.id);
    await supabase.from('field_permissions').delete().eq('field_id', fieldDef.id);

    const { error } = await supabase.from('field_definitions').delete().eq('id', fieldDef.id);

    if (error) {
      console.error('Supabase field delete error:', error);
      throw new Error(error.message || 'Database delete failed for field.');
    }

    await invalidateMetadataCache(organizationId || fieldDef.organization_id);

    return { success: true };
  },

  /**
   * Delete custom object definition (module) and execute cascading database cleanup.
   * Invalidates Redis metadata and permissions cache.
   */
  deleteObjectDefinition: async (objectKey, organizationId) => {
    if (!objectKey) throw new Error('Object Key or ID is required for deletion.');

    const objDef = await metadataService.getObjectTypeByApiName(objectKey, organizationId);
    if (!objDef) {
      throw new Error(`Module '${objectKey}' not found.`);
    }

    const cleanApi = String(objDef.api_name || '').toLowerCase();
    const isStandard = ['lead', 'leads', 'company', 'companies', 'contact', 'contacts', 'deal', 'deals', 'user', 'users', 'organization', 'task', 'tasks', 'note', 'notes'].includes(cleanApi);
    if (objDef.is_system || isStandard) {
      throw new Error('System or standard modules cannot be deleted.');
    }

    if (organizationId && objDef.organization_id && objDef.organization_id !== organizationId) {
      throw new Error('Unauthorized to delete module for another organization.');
    }

    const objId = objDef.id;

    // 1. Delete records in universal_table associated with this object_type_id
    await supabase.from('universal_table').delete().eq('object_type_id', objId);

    // 2. Fetch field definitions to clean up field permissions
    const { data: fieldRows } = await supabase.from('field_definitions').select('id').eq('object_type_id', objId);
    if (fieldRows && fieldRows.length > 0) {
      const fieldIds = fieldRows.map((f) => f.id);
      await supabase.from('field_permissions').delete().in('field_id', fieldIds);
    }

    // 3. Delete field definitions
    await supabase.from('field_definitions').delete().eq('object_type_id', objId);

    // 4. Delete object permissions
    await supabase.from('object_permissions').delete().eq('object_type_id', objId);

    // 5. Delete validation rules matching object_name
    if (organizationId) {
      await supabase.from('validation_rules').delete().eq('object_name', objDef.api_name).eq('organization_id', organizationId);
    }

    // 6. Delete object type definition row
    const { error } = await supabase.from('object_type_definitions').delete().eq('id', objId);
    if (error) {
      console.error('Supabase object_type_definitions delete error:', error);
      throw new Error(error.message || 'Database delete failed for custom module.');
    }

    // 7. Invalidate Redis Metadata & Permissions Cache
    await invalidateMetadataCache(organizationId || objDef.organization_id);

    return { success: true };
  },


  /**
   * Get all aggregated field definitions across all tenant objects in one query.
   */
  getAllFields: async (organizationId) => {
    const objectDefs = await metadataService.getObjectDefinitions(organizationId);
    const allFields = [];
    for (const obj of objectDefs) {
      const meta = await metadataService.getObjectDefinition(obj.api_name, organizationId);
      const fieldsWithModule = (meta.fields || []).map((f) => ({
        ...f,
        module_name: obj.display_name || obj.api_name,
        object_api_name: obj.api_name,
      }));
      allFields.push(...fieldsWithModule);
    }
    return allFields;
  },

  /**
   * Get custom Page Layout configuration for object from page_layouts table
   */
  getPageLayout: async (objectType, organizationId) => {
    const objDef = await metadataService.getObjectTypeByApiName(objectType, organizationId);
    if (!objDef) return null;

    let query = supabase
      .from('page_layouts')
      .select('layout_data')
      .eq('object_type_id', objDef.id)
      .eq('layout_type', 'view');

    if (isUuid(organizationId)) {
      query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    }

    const { data, error } = await query
      .order('organization_id', { ascending: false, nullsFirst: false })
      .limit(1);

    if (error) {
      console.warn('Error reading from page_layouts table:', error.message);
      return null;
    }

    return (data && data.length > 0) ? data[0].layout_data : null;
  },

  /**
   * Persist custom Page Layout configuration into page_layouts table
   */
  savePageLayout: async (objectType, layoutConfig, organizationId) => {
    const objDef = await metadataService.getObjectTypeByApiName(objectType, organizationId);
    if (!objDef) throw new Error('Object type definition not found');

    const orgId = isUuid(organizationId) ? organizationId : null;
    const now = new Date().toISOString();

    const payload = {
      organization_id: orgId,
      object_type_id: objDef.id,
      layout_name: 'Default Layout',
      layout_type: 'view',
      is_default: true,
      layout_data: layoutConfig,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('page_layouts')
      .upsert(payload, { onConflict: 'organization_id,object_type_id,layout_type' })
      .select()
      .maybeSingle();

    if (error) {
      console.error('PostgreSQL page_layouts upsert error:', error.message);
      const { data: existing } = await supabase
        .from('page_layouts')
        .select('id')
        .eq('object_type_id', objDef.id)
        .eq('layout_type', 'view')
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('page_layouts')
          .update({ layout_data: layoutConfig, updated_at: now })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('page_layouts')
          .insert(payload);
      }
    }

    await invalidateMetadataCache(organizationId);
    return layoutConfig;
  },
};

metadataService.invalidateMetadataCache = invalidateMetadataCache;

module.exports = metadataService;