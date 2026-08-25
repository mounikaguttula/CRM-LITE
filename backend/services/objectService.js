const supabase = require('../config/supabase');
const metadataService = require('./metadataService');
const validationRuleService = require('./validationRuleService');
const cacheService = require('./cacheService');

// Helper to validate UUID format to prevent PostgreSQL syntax errors
const isUuid = (val) => Boolean(val && typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

/**
 * Generic Object Service
 * Executes dynamic CRUD operations against Supabase universal_table.
 * Integrates Valkey cache-aside pattern for reads, with invalidation on writes.
 * ZERO object-specific code, ZERO hardcoded switch statements.
 */
const objectService = {
  /**
   * Helper to normalize universal_table row into flat JSON for React UI.
   */
  normalizeRecord: (row) => {
    if (!row) return null;
    const { id, name, status, owner_id, parent_id, secondary_parent_id, data, created_at, updated_at } = row;
    return {
      id,
      name,
      status,
      owner_id,
      parent_id,
      secondary_parent_id,
      created_at,
      updated_at,
      ...(typeof data === 'object' && data !== null ? data : {}),
    };
  },

  /**
   * List records from universal_table for any objectType.
   * Cache-aside: check Valkey first → on miss, query Supabase → store in cache.
   */
  listRecords: async (objectKey, organizationId) => {
    if (!objectKey || typeof objectKey !== 'string' || objectKey.includes('📁') || objectKey.trim() === '') {
      return [];
    }

    const objDef = await metadataService.getObjectTypeByApiName(objectKey, organizationId).catch(() => null);

    // Resolve object_type_id for cache key
    let objectTypeId = null;
    if (objDef && objDef.id) {
      objectTypeId = objDef.id;
    } else if (isUuid(objectKey)) {
      objectTypeId = objectKey;
    } else {
      return [];
    }

    // ── Cache-aside: Check Valkey first ──
    const cached = await cacheService.getListCache(organizationId, objectTypeId);
    if (cached) {
      return cached;
    }

    // ── Cache miss: Query Supabase ──
    let query = supabase
      .from('universal_table')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    query = query.eq('object_type_id', objectTypeId);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: rows, error } = await query;

    if (error) {
      throw { statusCode: 500, message: `Failed to fetch records for '${objectKey}': ${error.message}` };
    }

    const records = (rows || []).map(objectService.normalizeRecord);

    // ── Store in cache ──
    await cacheService.setListCache(organizationId, objectTypeId, records);

    return records;
  },

  /**
   * Fetch single record by ID from universal_table.
   * Cache-aside: check Valkey first → on miss, query Supabase → store in cache.
   */
  getRecordById: async (objectKey, id, organizationId) => {
    // ── Cache-aside: Check Valkey first ──
    const cached = await cacheService.getRecordCache(organizationId, id);
    if (cached) {
      return cached;
    }

    // ── Cache miss: Query Supabase ──
    let query = supabase
      .from('universal_table')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: row, error } = await query.single();

    if (error || !row) {
      throw { statusCode: 404, message: `Record '${id}' not found in '${objectKey}'.` };
    }

    const record = objectService.normalizeRecord(row);

    // ── Store in cache ──
    await cacheService.setRecordCache(organizationId, id, record);

    return record;
  },

  /**
   * Create record for any objectType in universal_table.
   * After insert → invalidate list cache for that org+objectType.
   */
  createRecord: async (objectKey, payload, organizationId, userId) => {
    const { definition: objDef, fields } = await metadataService.getObjectDefinition(objectKey, organizationId);

    // Map name aliases if first_name / last_name / name are present
    const rawName = (payload.name || payload.first_name || payload.title || '').trim();
    if (rawName) {
      if (!payload.name) payload.name = rawName;
      if (!payload.first_name) payload.first_name = rawName.split(' ')[0] || rawName;
      if (!payload.last_name) payload.last_name = rawName.split(' ').slice(1).join(' ') || payload.first_name;
    }

    // Validate required fields based on field_definitions metadata
    for (const field of fields) {
      if (field.required && (payload[field.name] === undefined || payload[field.name] === '')) {
        throw { statusCode: 400, message: `Validation Error: Field '${field.label || field.name}' is required for ${objectKey}.` };
      }
    }

    // Execute active custom validation rules
    const vErrorsCreate = await validationRuleService.validateRecord(objectKey, payload, organizationId).catch(() => []);
    if (vErrorsCreate.length > 0) {
      throw { statusCode: 400, message: vErrorsCreate.join(' | ') };
    }

    const { name, status, owner_id, parent_id, secondary_parent_id, ...customData } = payload;

    const resolvedParent = parent_id || (isUuid(payload.company_id) ? payload.company_id : (isUuid(payload.company) ? payload.company : null));
    const resolvedSecondary = secondary_parent_id || (isUuid(payload.contact_id) ? payload.contact_id : (isUuid(payload.contact) ? payload.contact : null));

    const newRow = {
      organization_id: organizationId,
      object_type_id: objDef.id || 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41',
      name: name || payload.title || payload.first_name || 'Untitled',
      status: status || 'Active',
      owner_id: owner_id || userId || null,
      parent_id: resolvedParent,
      secondary_parent_id: resolvedSecondary,
      data: customData,
      created_by: userId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: row, error } = await supabase
      .from('universal_table')
      .insert([newRow])
      .select()
      .single();

    if (error) {
      throw { statusCode: 400, message: `Failed to create ${objectKey} record: ${error.message}` };
    }

    // ── Invalidate list cache so next list fetch gets fresh data ──
    await cacheService.invalidateList(organizationId, objDef.id);

    return objectService.normalizeRecord(row);
  },

  /**
   * Update record in universal_table.
   * After update → invalidate both single record and list caches.
   */
  updateRecord: async (objectKey, id, payload, organizationId, userId) => {
    const existing = await objectService.getRecordById(objectKey, id, organizationId);

    const { name, status, owner_id, parent_id, secondary_parent_id, ...customData } = {
      ...existing,
      ...payload,
    };

    // Execute active custom validation rules on update
    const mergedRecord = { ...existing, ...payload };
    const vErrorsUpdate = await validationRuleService.validateRecord(objectKey, mergedRecord, organizationId).catch(() => []);
    if (vErrorsUpdate.length > 0) {
      throw { statusCode: 400, message: vErrorsUpdate.join(' | ') };
    }

    delete customData.id;
    delete customData.organization_id;
    delete customData.created_at;
    delete customData.updated_at;

    const resolvedParent = parent_id || (isUuid(payload.company_id) ? payload.company_id : (isUuid(payload.company) ? payload.company : existing.parent_id));
    const resolvedSecondary = secondary_parent_id || (isUuid(payload.contact_id) ? payload.contact_id : (isUuid(payload.contact) ? payload.contact : existing.secondary_parent_id));

    const updatePayload = {
      name: name || existing.name,
      status: status || existing.status,
      owner_id: owner_id || existing.owner_id,
      parent_id: resolvedParent,
      secondary_parent_id: resolvedSecondary,
      data: customData,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    const { data: row, error } = await supabase
      .from('universal_table')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw { statusCode: 400, message: `Failed to update ${objectKey} record: ${error.message}` };
    }

    // ── Invalidate both record and list caches ──
    const objDef = await metadataService.getObjectTypeByApiName(objectKey, organizationId).catch(() => null);
    const objectTypeId = objDef?.id || null;
    await cacheService.invalidateAll(organizationId, objectTypeId, id);

    return objectService.normalizeRecord(row);
  },

  /**
   * Soft delete record in universal_table.
   * After delete → invalidate both record and list caches.
   */
  deleteRecord: async (objectKey, id, organizationId, userId) => {
    const { error } = await supabase
      .from('universal_table')
      .update({
        is_deleted: true,
        deleted_by: userId || null,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      throw { statusCode: 400, message: `Failed to delete ${objectKey} record: ${error.message}` };
    }

    // ── Invalidate both record and list caches ──
    const objDef = await metadataService.getObjectTypeByApiName(objectKey, organizationId).catch(() => null);
    const objectTypeId = objDef?.id || null;
    await cacheService.invalidateAll(organizationId, objectTypeId, id);

    return { success: true, message: `Record '${id}' deleted successfully.` };
  },
};

module.exports = objectService;
