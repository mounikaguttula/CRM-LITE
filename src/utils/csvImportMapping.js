/**
 * CSV Import Mapping Utilities
 * Reads ONLY what the metadata API returns. No per-object or per-header rules.
 */

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Normalizes the raw /metadata/objects/:id/fields response into the shape the importer uses.
 * Accepts both shapes the API produces:
 *   raw:    { api_name, display_name, field_type, required, is_unique, searchable, lookup_target_object_type_id, ... }
 *   mapped: { name, label, type, required, is_system, isTitle, ... }
 *
 * @param {Array} fieldsList  raw field definitions
 * @param {Array} objectList  raw /metadata/objects response (turns a target object id into its api_name)
 */
export function buildFieldMetadataList(fieldsList = [], objectList = []) {
  const objMap = new Map();
  (Array.isArray(objectList) ? objectList : []).forEach((o) => {
    if (!o) return;
    if (o.id) objMap.set(o.id, o);
    if (o.api_name) {
      const api = String(o.api_name).toLowerCase();
      objMap.set(api, o);
      objMap.set(o.api_name, o);
      // Add plural form: "company" → "companies", "lead" → "leads", any → append s
      if (api.endsWith('y')) objMap.set(`${api.slice(0, -1)}ies`, o);
      else if (!api.endsWith('s')) objMap.set(`${api}s`, o);
      // Add singular form: "companies" → "company", "leads" → "lead"
      if (api.endsWith('ies')) objMap.set(`${api.slice(0, -3)}y`, o);
      else if (api.endsWith('s')) objMap.set(api.slice(0, -1), o);
    }
    if (o.display_name) {
      const disp = String(o.display_name).toLowerCase();
      objMap.set(disp, o);
    }
  });

  const result = (Array.isArray(fieldsList) ? fieldsList : [])
    .map((f) => ({ f, key: f?.api_name || f?.name }))
    .filter(({ f, key }) =>
      key &&
      f.is_active !== false &&
      f.hidden !== true &&
      // readonly = audit / calculated fields that an import cannot write (only present in the raw shape)
      f.readonly !== true
    )
    .map(({ f, key }) => {
      const type = f.field_type || f.type;
      const isRelationship = type === 'lookup';

      // Target object comes from metadata only. If the API doesn't say, it stays null and the
      // user picks the target in the mapping UI. We never guess from the field name.
      let targetObject = null;
      if (isRelationship) {
        const rawTarget =
          f.lookup_target_object_type_id ||
          f.lookupTargetObjectTypeId ||
          f.target_object_type ||
          f.lookup_target ||
          f.lookupTarget ||
          f.targetObject ||
          null;
        const matched = rawTarget ? (objMap.get(rawTarget) || objMap.get(String(rawTarget).toLowerCase())) : null;
        targetObject = matched ? matched.api_name : (typeof rawTarget === 'string' ? rawTarget : null);
      }

      return {
        key,
        label: f.display_name || f.label || key,
        type,
        isSystem: !!f.is_system,
        isRequired: !!(f.required ?? f.is_required),
        isUnique: !!f.is_unique,
        isSearchable: !!(f.searchable ?? f.is_searchable),
        isTitle: !!(f.isTitle ?? f.is_title), // the record's display-name field
        isRelationship,
        targetObject,
      };
    });

  // Ensure 'id' (Record ID) is available at the top for upsert and update matching
  if (!result.some((f) => f.key === 'id')) {
    result.unshift({
      key: 'id',
      label: 'Record ID',
      type: 'text',
      isSystem: true,
      isRequired: false,
      isUnique: true,
      isSearchable: true,
      isTitle: false,
      isRelationship: false,
      targetObject: null,
    });
  }

  return result;
}

/**
 * Auto-map suggestion: exact then normalized match on API name or label only.
 * Anything else stays Unmapped and the user picks it manually.
 */
export function mapHeaderToField(rawHeader, fields = []) {
  const raw = String(rawHeader ?? '').trim().toLowerCase();
  const n = norm(rawHeader);
  if (!n) return null;

  const isSegmentOrHubSpot = fields.some((f) => f.key === 'hubspot_segment_id' || f.key === 'hubspot_list_id');

  // Specialized HubSpot Segment field mappings
  if (isSegmentOrHubSpot) {
    const findField = (k) => fields.find((f) => f.key === k);

    if (raw === 'ils segment id' || raw === 'segment id' || raw === 'hubspot segment id') return findField('hubspot_segment_id');
    if (raw === 'list id' || raw === 'hubspot list id') return findField('hubspot_list_id');
    if (raw === 'record id' || raw === 'record_id' || raw === 'hubspot record id') return findField('hubspot_record_id');
    if (raw === 'folder id' || raw === 'folder_id') return findField('folder_id');
    if (raw === 'list size' || raw === 'list_size') return findField('source_record_count');
    if (raw === 'processing type' || raw === 'processing_type') return findField('hubspot_processing_type');
    if (raw === 'segment name' || raw === 'segment_name') return findField('name');
    if (raw === 'object type' || raw === 'object_type') return findField('target_object_type');
    if (raw === 'description') return findField('description');

    if (raw === 'average lookalike similarity score' || raw === 'lookalike similarity score') return findField('lookalike_similarity_score');
    if (raw === 'email click through rate') return findField('email_click_through_rate');
    if (raw === 'cluster segment description') return findField('cluster_segment_description');
    if (raw === 'created at') return findField('hubspot_created_at');
    if (raw === 'created by user id') return findField('hubspot_created_by_user_id');
    if (raw === 'object create date/time' || raw === 'object create date time') return findField('hubspot_object_created_at');
    if (raw === 'email open rate') return findField('email_open_rate');
    if (raw === 'generated with ai') return findField('generated_with_ai');
    if (raw === 'type: active' || raw === 'type active') return findField('hubspot_type_active');
    if (raw === 'read only' || raw === 'read_only') return findField('is_read_only');
    if (raw === 'last record added at') return findField('last_record_added_at');
    if (raw === 'last record removed at') return findField('last_record_removed_at');
    if (raw === 'object last modified date/time' || raw === 'object last modified date time') return findField('hubspot_object_last_modified_at');
    if (raw === 'segment access level') return findField('segment_access_level');
    if (raw === 'notifications') return findField('hubspot_notifications');
    if (raw === 'used in') return findField('hubspot_used_in');
    if (raw === 'used in (count)' || raw === 'used in count') return findField('hubspot_used_in_count');
    if (raw === '7-day change' || raw === '7 day change') return findField('seven_day_change');
    if (raw === 'segment version') return findField('hubspot_segment_version');
    if (raw === 'lookalikes ai summary') return findField('lookalikes_ai_summary');
    if (raw === 'merged record ids') return findField('hubspot_merged_record_ids');
    if (raw === 'record source detail 1') return findField('record_source_detail_1');
    if (raw === 'record source detail 2') return findField('record_source_detail_2');
    if (raw === 'record source detail 3') return findField('record_source_detail_3');
    if (raw === 'record source') return findField('record_source');
    if (raw === 'teams with edit access') return findField('teams_with_edit_access');
    if (raw === 'updated at') return findField('hubspot_updated_at');
    if (raw === 'updated by user id') return findField('hubspot_updated_by_user_id');
    if (raw === 'users with edit access') return findField('users_with_edit_access');
    if (raw === 'owner assigned date') return findField('owner_assigned_date');
    if (raw === 'owner') return findField('hubspot_owner_name');

    // Strictly block HubSpot Record ID, List ID, ILS Segment ID, Folder ID from ever mapping to internal id
    if (
      raw === 'record id' || raw === 'record_id' ||
      raw === 'list id' || raw === 'list_id' ||
      raw === 'ils segment id' || raw === 'ils_segment_id' ||
      raw === 'folder id' || raw === 'folder_id'
    ) {
      return null;
    }
  }

  // Explicit check for CRMNow internal Record ID / ID headers
  // Only exact CRM internal ID aliases map to internal id; never generic "... id"
  if (raw === 'id' || raw === 'crm record id' || raw === 'crm_record_id' || raw === 'record_uuid' || (!isSegmentOrHubSpot && (raw === 'record id' || raw === 'record_id'))) {
    const idField = fields.find((f) => f.key === 'id');
    if (idField) return idField;
  }

  return (
    fields.find((f) => f.key.toLowerCase() === raw) ||
    fields.find((f) => f.label.toLowerCase() === raw) ||
    fields.find((f) => norm(f.key) === n) ||
    fields.find((f) => norm(f.label) === n) ||
    null
  );
}
