const supabase = require('../config/supabase');
const { supabaseAdmin } = require('../config/supabase');
const dbClient = supabaseAdmin || supabase;
const metadataService = require('./metadataService');
const objectService = require('./objectService');

const isUuid = (val) => Boolean(val && typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim()));

const segmentService = {
  /**
   * Helper: Resolve canonical 'segment' object type definition dynamically
   */
  resolveSegmentObjectType: async (organizationId) => {
    try {
      const def = await metadataService.getObjectTypeByApiName('segment', organizationId);
      if (def?.id) return def.id;
    } catch (e) {
      // fallback
    }
    // Fallback to ensuring system definition exists
    return await segmentService.ensureSegmentObjectType();
  },

  /**
   * Helper: Resolve 'contact' object type definition dynamically
   */
  resolveContactObjectType: async (organizationId) => {
    const def = await metadataService.getObjectTypeByApiName('contact', organizationId);
    if (!def?.id) {
      throw { statusCode: 500, message: 'Could not resolve Contact object definition for organization.' };
    }
    return def.id;
  },

  /**
   * Helper: Ensure canonical 'segment' object type is registered in object_type_definitions
   */
  ensureSegmentObjectType: async () => {
    try {
      const { data: existing } = await dbClient
        .from('object_type_definitions')
        .select('id')
        .eq('api_name', 'segment')
        .maybeSingle();

      if (existing?.id) return existing.id;

      const { data, error } = await dbClient
        .from('object_type_definitions')
        .upsert([{
          id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a48',
          organization_id: null,
          api_name: 'segment',
          display_name: 'Segments',
          description: 'Targeted static and dynamic CRM segments',
          is_system: true,
        }], { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.warn('[SegmentService] ensureSegmentObjectType warning:', error.message);
      }
      return data?.id || 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a48';
    } catch (e) {
      return 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a48';
    }
  },

  /**
   * Create a new segment
   */
  createSegment: async ({ name, description, target_object_type, type = 'static', organization_id, user_id }) => {
    if (!name || !name.trim()) {
      throw { statusCode: 400, message: 'Segment name is required.' };
    }
    if (!target_object_type || !target_object_type.trim()) {
      throw { statusCode: 400, message: 'Target module (target_object_type) is required.' };
    }

    const segmentDefId = await segmentService.resolveSegmentObjectType(organization_id);

    // Canonicalize target object key
    const targetObjKey = String(target_object_type).trim().toLowerCase();
    const cleanTarget = targetObjKey.endsWith('s') && targetObjKey !== 'status' ? targetObjKey.slice(0, -1) : targetObjKey;

    const segmentPayload = {
      object_type_id: segmentDefId,
      organization_id,
      name: name.trim(),
      status: 'active',
      owner_id: user_id || null,
      created_by: user_id || null,
      is_deleted: false,
      data: {
        description: description ? description.trim() : '',
        target_object_type: cleanTarget,
        type: type || 'static',
        contact_ids: [],
        _version: 1,
      },
    };

    const { data: segmentRow, error } = await dbClient
      .from('universal_table')
      .insert([segmentPayload])
      .select()
      .single();

    if (error) {
      console.error('[SegmentService] createSegment error:', error.message);
      throw { statusCode: 500, message: `Failed to create segment: ${error.message}` };
    }

    return {
      id: segmentRow.id,
      name: segmentRow.name,
      target_object_type: segmentRow.data?.target_object_type || cleanTarget,
      type: segmentRow.data?.type || 'static',
      description: segmentRow.data?.description || '',
      status: segmentRow.status || 'active',
      source_record_count: Number(segmentRow.data?.source_record_count) || 0,
      active_member_count: 0,
      member_count: Number(segmentRow.data?.source_record_count) || 0,
      created_at: segmentRow.created_at,
      updated_at: segmentRow.updated_at,
      owner_id: segmentRow.owner_id,
      created_by: segmentRow.created_by,
    };
  },

  /**
   * List segments
   */
  listSegments: async (organizationId, options = {}) => {
    const segmentDefId = await segmentService.resolveSegmentObjectType(organizationId);

    let query = dbClient
      .from('universal_table')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('object_type_id', segmentDefId)
      .eq('is_deleted', false);

    if (options.target_object_type) {
      const cleanTarget = String(options.target_object_type).toLowerCase();
      query = query.ilike('data->>target_object_type', `%${cleanTarget}%`);
    }

    if (options.search) {
      const searchClean = String(options.search).trim();
      query = query.ilike('name', `%${searchClean}%`);
    }

    const { data: rows, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[SegmentService] listSegments error:', error.message);
      throw { statusCode: 500, message: `Failed to fetch segments: ${error.message}` };
    }

    return (rows || []).map((row) => {
      const rawContactIds = Array.isArray(row.data?.contact_ids) ? row.data.contact_ids : [];
      return {
        id: row.id,
        name: row.name,
        target_object_type: row.data?.target_object_type || 'contact',
        type: row.data?.type || 'static',
        description: row.data?.description || '',
        status: row.status || 'active',
        source_record_count: Number(row.data?.source_record_count) || 0,
        active_member_count: rawContactIds.length,
        member_count: rawContactIds.length > 0 ? rawContactIds.length : (Number(row.data?.source_record_count) || 0),
        created_at: row.created_at,
        updated_at: row.updated_at,
        owner_id: row.owner_id,
        created_by: row.created_by,
      };
    });
  },

  /**
   * Get segment by ID
   */
  getSegmentById: async (segmentId, organizationId) => {
    if (!isUuid(segmentId)) {
      throw { statusCode: 400, message: 'Invalid segment ID format.' };
    }

    const segmentDefId = await segmentService.resolveSegmentObjectType(organizationId);

    const { data: segmentRow, error } = await dbClient
      .from('universal_table')
      .select('*')
      .eq('id', segmentId)
      .eq('organization_id', organizationId)
      .eq('object_type_id', segmentDefId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error || !segmentRow) {
      throw { statusCode: 404, message: 'Segment not found or access denied.' };
    }

    const rawContactIds = Array.isArray(segmentRow.data?.contact_ids) ? segmentRow.data.contact_ids : [];

    return {
      id: segmentRow.id,
      name: segmentRow.name,
      target_object_type: segmentRow.data?.target_object_type || 'contact',
      type: segmentRow.data?.type || 'static',
      description: segmentRow.data?.description || '',
      status: segmentRow.status || 'active',
      source_record_count: Number(segmentRow.data?.source_record_count) || 0,
      active_member_count: rawContactIds.length,
      member_count: rawContactIds.length > 0 ? rawContactIds.length : (Number(segmentRow.data?.source_record_count) || 0),
      contact_ids: rawContactIds,
      created_at: segmentRow.created_at,
      updated_at: segmentRow.updated_at,
      owner_id: segmentRow.owner_id,
      created_by: segmentRow.created_by,
    };
  },

  /**
   * Update segment (generic field edit)
   * Safely preserves contact_ids and existing custom metadata!
   */
  updateSegment: async (segmentId, organizationId, updates = {}, userId = null) => {
    if (!isUuid(segmentId)) {
      throw { statusCode: 400, message: 'Invalid segment ID format.' };
    }

    // Retrieve fresh raw row from database to ensure no stale overwrite
    const { data: existingRow, error: fetchErr } = await dbClient
      .from('universal_table')
      .select('*')
      .eq('id', segmentId)
      .eq('organization_id', organizationId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (fetchErr || !existingRow) {
      throw { statusCode: 404, message: 'Segment not found or access denied.' };
    }

    const updatePayload = {
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    };

    if (updates.name && updates.name.trim()) {
      updatePayload.name = updates.name.trim();
    }
    if (updates.status) {
      updatePayload.status = updates.status.trim();
    }

    // Preserve all existing custom data keys (including contact_ids, HubSpot metadata, etc.)
    const currentData = { ...(existingRow.data || {}) };
    if (updates.description !== undefined) {
      currentData.description = String(updates.description || '').trim();
    }
    if (updates.target_object_type) {
      currentData.target_object_type = String(updates.target_object_type).trim();
    }
    if (updates.type) {
      currentData.type = String(updates.type).trim();
    }
    // Never allow generic updates to mutate contact_ids directly
    delete updates.contact_ids;

    updatePayload.data = currentData;

    const { data: updatedRow, error } = await dbClient
      .from('universal_table')
      .update(updatePayload)
      .eq('id', segmentId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      throw { statusCode: 500, message: `Failed to update segment: ${error.message}` };
    }

    const rawContactIds = Array.isArray(updatedRow.data?.contact_ids) ? updatedRow.data.contact_ids : [];

    return {
      id: updatedRow.id,
      name: updatedRow.name,
      target_object_type: updatedRow.data?.target_object_type,
      type: updatedRow.data?.type || 'static',
      description: updatedRow.data?.description || '',
      status: updatedRow.status || 'active',
      source_record_count: Number(updatedRow.data?.source_record_count) || 0,
      active_member_count: rawContactIds.length,
      member_count: rawContactIds.length > 0 ? rawContactIds.length : (Number(updatedRow.data?.source_record_count) || 0),
      created_at: updatedRow.created_at,
      updated_at: updatedRow.updated_at,
    };
  },

  /**
   * Soft-delete segment
   */
  deleteSegment: async (segmentId, organizationId, userId = null) => {
    const existing = await segmentService.getSegmentById(segmentId, organizationId);

    const { error } = await dbClient
      .from('universal_table')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: userId || null,
      })
      .eq('id', segmentId)
      .eq('organization_id', organizationId);

    if (error) {
      throw { statusCode: 500, message: `Failed to delete segment: ${error.message}` };
    }

    return { success: true, message: `Segment '${existing.name}' deleted successfully.` };
  },

  /**
   * Get all active Contacts associated with a Segment
   */
  getSegmentContacts: async (segmentId, organizationId) => {
    if (!isUuid(segmentId)) {
      throw { statusCode: 400, message: 'Invalid segment ID format.' };
    }

    const segment = await segmentService.getSegmentById(segmentId, organizationId);
    const contactIds = Array.isArray(segment.contact_ids) ? segment.contact_ids.filter(isUuid) : [];

    if (contactIds.length === 0) {
      return {
        contacts: [],
        total: 0,
        source_record_count: segment.source_record_count,
        active_member_count: 0,
      };
    }

    const contactDefId = await segmentService.resolveContactObjectType(organizationId);

    // Chunk contact IDs in batches of 100 to avoid Cloudflare/PostgREST HTTP 414 (Request-URI Too Large)
    const CHUNK_SIZE = 100;
    const chunks = [];
    for (let i = 0; i < contactIds.length; i += CHUNK_SIZE) {
      chunks.push(contactIds.slice(i, i + CHUNK_SIZE));
    }

    const chunkResults = await Promise.all(
      chunks.map((chunk) =>
        dbClient
          .from('universal_table')
          .select('*')
          .in('id', chunk)
          .eq('organization_id', organizationId)
          .eq('object_type_id', contactDefId)
          .eq('is_deleted', false)
      )
    );

    let rows = [];
    for (const r of chunkResults) {
      if (r.error) {
        console.error('[SegmentService] getSegmentContacts error:', r.error.message);
        throw { statusCode: 500, message: `Failed to fetch contacts: ${r.error.message}` };
      }
      if (Array.isArray(r.data)) {
        rows.push(...r.data);
      }
    }

    // Sort by created_at descending
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const normalizedContacts = rows.map((row) => objectService.normalizeRecord(row));

    return {
      contacts: normalizedContacts,
      total: normalizedContacts.length,
      source_record_count: segment.source_record_count,
      active_member_count: normalizedContacts.length,
    };
  },

  /**
   * Associate existing Contacts with a Segment using OCC compare-and-swap with retry backoff
   */
  addContactsToSegment: async (segmentId, contactIds, organizationId, userId) => {
    if (!isUuid(segmentId)) {
      throw { statusCode: 400, message: 'Invalid segment ID format.' };
    }
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      throw { statusCode: 400, message: 'At least one contact ID is required.' };
    }

    // Validate UUID format for all input IDs
    for (const cId of contactIds) {
      if (!isUuid(cId)) {
        throw { statusCode: 400, message: `Invalid contact ID format: '${cId}'.` };
      }
    }

    const requestedIds = Array.from(new Set(contactIds.map(id => id.trim())));
    const contactDefId = await segmentService.resolveContactObjectType(organizationId);

    // Validate that all requested contacts exist, are active, and belong to the authenticated organization
    const CHUNK_SIZE = 100;
    const reqChunks = [];
    for (let i = 0; i < requestedIds.length; i += CHUNK_SIZE) {
      reqChunks.push(requestedIds.slice(i, i + CHUNK_SIZE));
    }

    const validResults = await Promise.all(
      reqChunks.map((chunk) =>
        dbClient
          .from('universal_table')
          .select('id')
          .in('id', chunk)
          .eq('organization_id', organizationId)
          .eq('object_type_id', contactDefId)
          .eq('is_deleted', false)
      )
    );

    let validRows = [];
    for (const r of validResults) {
      if (r.error) {
        throw { statusCode: 500, message: `Failed to validate contacts: ${r.error.message}` };
      }
      if (Array.isArray(r.data)) {
        validRows.push(...r.data);
      }
    }

    const validIdSet = new Set(validRows.map(r => r.id));
    for (const reqId of requestedIds) {
      if (!validIdSet.has(reqId)) {
        throw {
          statusCode: 400,
          message: 'One or more selected Contacts are invalid, deleted, or do not belong to this organization.',
        };
      }
    }

    const MAX_RETRIES = 5;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const { data: current, error: curErr } = await dbClient
        .from('universal_table')
        .select('*')
        .eq('id', segmentId)
        .eq('organization_id', organizationId)
        .eq('is_deleted', false)
        .maybeSingle();

      if (curErr || !current) {
        throw { statusCode: 404, message: 'Segment not found or access denied.' };
      }

      const existingIds = Array.isArray(current.data?.contact_ids) ? current.data.contact_ids : [];
      const mergedIds = Array.from(new Set([...existingIds, ...requestedIds]));

      // Idempotency: If all requested IDs are already present
      if (existingIds.length === mergedIds.length && requestedIds.every(id => existingIds.includes(id))) {
        return {
          success: true,
          message: 'Contacts already associated with segment.',
          addedCount: 0,
          totalAssociated: mergedIds.length,
        };
      }

      const currentVersion = Number(current.data?._version) || 0;
      const nextVersion = currentVersion + 1;

      // Preserve all current data keys edited concurrently by other writers
      const nextData = {
        ...(current.data || {}),
        contact_ids: mergedIds,
        _version: nextVersion,
      };
      const nextUpdatedAt = new Date().toISOString();

      let query = dbClient
        .from('universal_table')
        .update({
          data: nextData,
          updated_at: nextUpdatedAt,
          updated_by: userId || null,
        })
        .eq('id', segmentId)
        .eq('organization_id', organizationId)
        .eq('updated_at', current.updated_at);

      if (current.data?._version !== undefined) {
        query = query.contains('data', { _version: current.data._version });
      } else {
        query = query.is('data->_version', null);
      }

      const { data: updated, error: updateErr } = await query.select('id').maybeSingle();

      if (!updateErr && updated) {
        // Reciprocally synchronize Contact-side data.segment_ids and external IDs
        try {
          await segmentService.syncContactsSegmentIds(requestedIds, segmentId, 'add', organizationId, userId);
        } catch (syncErr) {
          console.warn('[SegmentService] Partial failure syncing Contact.data.segment_ids:', syncErr.message);
        }

        return {
          success: true,
          message: `Successfully associated ${requestedIds.length} contact(s).`,
          addedCount: mergedIds.length - existingIds.length,
          totalAssociated: mergedIds.length,
        };
      }

      // Collision detected: Wait jitter backoff before retrying
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 40) + 10));
    }

    throw {
      statusCode: 409,
      message: 'Concurrent modification conflict while updating segment associations. Please retry.',
    };
  },

  /**
   * Remove multiple Contact associations from a Segment using OCC compare-and-swap with retry backoff
   */
  removeContactsFromSegment: async (segmentId, contactIds, organizationId, userId) => {
    if (!isUuid(segmentId)) {
      throw { statusCode: 400, message: 'Invalid segment ID format.' };
    }
    const rawIds = Array.isArray(contactIds) ? contactIds : (contactIds ? [contactIds] : []);
    const validContactIds = rawIds.filter(isUuid);
    if (validContactIds.length === 0) {
      throw { statusCode: 400, message: 'No valid contact ID(s) provided.' };
    }
    const removeSet = new Set(validContactIds);

    const MAX_RETRIES = 5;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const { data: current, error: curErr } = await dbClient
        .from('universal_table')
        .select('*')
        .eq('id', segmentId)
        .eq('organization_id', organizationId)
        .eq('is_deleted', false)
        .maybeSingle();

      if (curErr || !current) {
        throw { statusCode: 404, message: 'Segment not found or access denied.' };
      }

      const existingIds = Array.isArray(current.data?.contact_ids) ? current.data.contact_ids : [];
      const updatedIds = existingIds.filter((id) => !removeSet.has(id));
      const removedCount = existingIds.length - updatedIds.length;

      // Idempotency: none of the contacts were associated
      if (removedCount === 0) {
        return {
          success: true,
          message: 'Contact(s) not associated with this segment.',
          removedCount: 0,
          totalAssociated: updatedIds.length,
          segment: current,
        };
      }

      const currentVersion = Number(current.data?._version) || 0;
      const nextVersion = currentVersion + 1;

      // Preserve all current data keys edited concurrently by other writers
      const nextData = {
        ...(current.data || {}),
        contact_ids: updatedIds,
        _version: nextVersion,
      };
      const nextUpdatedAt = new Date().toISOString();

      let query = dbClient
        .from('universal_table')
        .update({
          data: nextData,
          updated_at: nextUpdatedAt,
          updated_by: userId || null,
        })
        .eq('id', segmentId)
        .eq('organization_id', organizationId)
        .eq('updated_at', current.updated_at);

      if (current.data?._version !== undefined) {
        query = query.contains('data', { _version: current.data._version });
      } else {
        query = query.is('data->_version', null);
      }

      const { data: updated, error: updateErr } = await query.select('*').maybeSingle();

      if (!updateErr && updated) {
        // Reciprocally synchronize Contact-side data.segment_ids on removal
        try {
          await segmentService.syncContactsSegmentIds(validContactIds, segmentId, 'remove', organizationId, userId);
        } catch (syncErr) {
          console.warn('[SegmentService] Partial failure syncing Contact.data.segment_ids on removal:', syncErr.message);
        }

        return {
          success: true,
          message: removedCount === 1 ? 'Contact removed from segment successfully.' : `Successfully removed ${removedCount} contacts from segment.`,
          removedCount,
          totalAssociated: updatedIds.length,
          segment: updated,
        };
      }

      // Collision detected: Wait jitter backoff before retrying
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 40) + 10));
    }

    throw {
      statusCode: 409,
      message: 'Concurrent modification conflict while updating segment associations. Please retry.',
    };
  },

  /**
   * Remove a Contact association from a Segment using OCC compare-and-swap with retry backoff
   */
  removeContactFromSegment: async (segmentId, contactId, organizationId, userId) => {
    return segmentService.removeContactsFromSegment(segmentId, [contactId], organizationId, userId);
  },

  /**
   * Helper: Synchronize Contact-side data.segment_ids and external HubSpot IDs
   * Handles partial errors safely without crashing the primary operation.
   */
  syncContactsSegmentIds: async (contactIds, segmentId, action, organizationId, userId) => {
    if (!Array.isArray(contactIds) || contactIds.length === 0 || !isUuid(segmentId)) return;

    // Fetch the segment to know its external ID (record_id__c / hubspot_record_id) if available
    let segmentExtId = null;
    try {
      const { data: segRow } = await dbClient
        .from('universal_table')
        .select('data')
        .eq('id', segmentId)
        .maybeSingle();
      segmentExtId = segRow?.data?.record_id__c || segRow?.data?.hubspot_record_id || null;
    } catch (e) {}

    // Fetch the target contacts in chunks
    const CHUNK_SIZE = 100;
    const cChunks = [];
    for (let i = 0; i < contactIds.length; i += CHUNK_SIZE) {
      cChunks.push(contactIds.slice(i, i + CHUNK_SIZE));
    }

    const contactResults = await Promise.all(
      cChunks.map((chunk) =>
        dbClient
          .from('universal_table')
          .select('id, data')
          .in('id', chunk)
          .eq('organization_id', organizationId)
          .eq('is_deleted', false)
      )
    );

    let contacts = [];
    for (const r of contactResults) {
      if (Array.isArray(r.data)) {
        contacts.push(...r.data);
      }
    }

    if (contacts.length === 0) return;

    for (const c of contacts) {
      try {
        const cData = c.data || {};
        const currentSegmentIds = Array.isArray(cData.segment_ids) ? cData.segment_ids : [];
        let updatedSegmentIds = [];

        const currentExtIds = String(cData.associated_segment_ids__c || '')
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean);
        let updatedExtIds = [...currentExtIds];

        if (action === 'add') {
          updatedSegmentIds = Array.from(new Set([...currentSegmentIds, segmentId]));
          if (segmentExtId && !updatedExtIds.includes(String(segmentExtId))) {
            updatedExtIds.push(String(segmentExtId));
          }
        } else if (action === 'remove') {
          updatedSegmentIds = currentSegmentIds.filter((id) => id !== segmentId);
          if (segmentExtId) {
            updatedExtIds = updatedExtIds.filter((ext) => ext !== String(segmentExtId));
          }
        }

        const nextData = {
          ...cData,
          segment_ids: updatedSegmentIds,
          associated_segment_ids__c: updatedExtIds.join(';'),
        };

        await dbClient
          .from('universal_table')
          .update({
            data: nextData,
            updated_at: new Date().toISOString(),
            updated_by: userId || null,
          })
          .eq('id', c.id)
          .eq('organization_id', organizationId);
      } catch (err) {
        console.warn(`[SegmentService] Failed to sync segment ${segmentId} for contact ${c.id}:`, err.message);
      }
    }
  },

  /**
   * Reverse Lookup: Get all Segments containing a given Contact
   * Checks both Segment.data.contact_ids and Contact.data.segment_ids to return the unified deduplicated set.
   */
  getSegmentsForContact: async (contactId, organizationId) => {
    if (!isUuid(contactId)) {
      throw { statusCode: 400, message: 'Invalid contact ID format.' };
    }

    const contactDefId = await segmentService.resolveContactObjectType(organizationId);

    // Verify contact exists in the authenticated tenant and is active
    const { data: contactRow, error: cErr } = await dbClient
      .from('universal_table')
      .select('id, data')
      .eq('id', contactId)
      .eq('organization_id', organizationId)
      .eq('object_type_id', contactDefId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (cErr || !contactRow) {
      throw { statusCode: 404, message: 'Contact not found or access denied.' };
    }

    const segmentDefId = await segmentService.resolveSegmentObjectType(organizationId);

    // 1. Query segments containing contactId in Segment.data.contact_ids
    const { data: segmentRowsFromContacts, error: sErr } = await dbClient
      .from('universal_table')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('object_type_id', segmentDefId)
      .eq('is_deleted', false)
      .contains('data', { contact_ids: [contactId] });

    if (sErr) {
      console.error('[SegmentService] getSegmentsForContact error:', sErr.message);
      throw { statusCode: 500, message: `Failed to fetch associated segments: ${sErr.message}` };
    }

    // 2. Query segments directly referenced in Contact.data.segment_ids
    const contactSegIds = Array.isArray(contactRow.data?.segment_ids)
      ? contactRow.data.segment_ids.filter(isUuid)
      : [];

    let segmentRowsFromContactData = [];
    if (contactSegIds.length > 0) {
      const { data: directSegs } = await dbClient
        .from('universal_table')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('object_type_id', segmentDefId)
        .eq('is_deleted', false)
        .in('id', contactSegIds);
      segmentRowsFromContactData = directSegs || [];
    }

    // Merge and deduplicate by segment ID
    const segMap = new Map();
    (segmentRowsFromContacts || []).forEach((row) => segMap.set(row.id, row));
    (segmentRowsFromContactData || []).forEach((row) => segMap.set(row.id, row));

    const combinedRows = Array.from(segMap.values());
    combinedRows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return combinedRows.map((row) => {
      const rawContactIds = Array.isArray(row.data?.contact_ids) ? row.data.contact_ids : [];
      return {
        id: row.id,
        name: row.name,
        target_object_type: row.data?.target_object_type || 'contact',
        type: row.data?.type || 'static',
        description: row.data?.description || '',
        status: row.status || 'active',
        source_record_count: Number(row.data?.source_record_count) || 0,
        active_member_count: rawContactIds.length,
        member_count: rawContactIds.length > 0 ? rawContactIds.length : (Number(row.data?.source_record_count) || 0),
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });
  },
};

module.exports = segmentService;
