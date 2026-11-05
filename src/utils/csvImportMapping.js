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

  // Ensure 'id' (CRM Internal UUID) is available at the top for upsert and update matching
  if (!result.some((f) => f.key === 'id')) {
    result.unshift({
      key: 'id',
      label: 'Record ID (CRM Internal UUID)',
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
// Dedicated Migration Aliases for HubSpot Segments (decoupled from generic metadata mapping)
export const HUBSPOT_SEGMENT_ALIASES = {
  'ils segment id': 'hubspot_segment_id',
  'segment id': 'hubspot_segment_id',
  'hubspot segment id': 'hubspot_segment_id',
  'list id': 'hubspot_list_id',
  'hubspot list id': 'hubspot_list_id',
  'record id': 'hubspot_record_id',
  'record_id': 'hubspot_record_id',
  'hubspot record id': 'hubspot_record_id',
  'folder id': 'folder_id',
  'folder_id': 'folder_id',
  'list size': 'source_record_count',
  'list_size': 'source_record_count',
  'processing type': 'hubspot_processing_type',
  'processing_type': 'hubspot_processing_type',
  'segment name': 'name',
  'segment_name': 'name',
  'object type': 'target_object_type',
  'object_type': 'target_object_type',
  'description': 'description',
  'average lookalike similarity score': 'lookalike_similarity_score',
  'lookalike similarity score': 'lookalike_similarity_score',
  'email click through rate': 'email_click_through_rate',
  'cluster segment description': 'cluster_segment_description',
  'created at': 'hubspot_created_at',
  'created by user id': 'hubspot_created_by_user_id',
  'object create date/time': 'hubspot_object_created_at',
  'object create date time': 'hubspot_object_created_at',
  'email open rate': 'email_open_rate',
  'generated with ai': 'generated_with_ai',
  'type: active': 'hubspot_type_active',
  'type active': 'hubspot_type_active',
  'read only': 'is_read_only',
  'read_only': 'is_read_only',
  'last record added at': 'last_record_added_at',
  'last record removed at': 'last_record_removed_at',
  'object last modified date/time': 'hubspot_object_last_modified_at',
  'object last modified date time': 'hubspot_object_last_modified_at',
  'segment access level': 'segment_access_level',
  'notifications': 'hubspot_notifications',
  'used in': 'hubspot_used_in',
  'used in (count)': 'hubspot_used_in_count',
  'used in count': 'hubspot_used_in_count',
  '7-day change': 'seven_day_change',
  '7 day change': 'seven_day_change',
  'segment version': 'hubspot_segment_version',
  'lookalikes ai summary': 'lookalikes_ai_summary',
  'merged record ids': 'hubspot_merged_record_ids',
  'record source detail 1': 'record_source_detail_1',
  'record source detail 2': 'record_source_detail_2',
  'record source detail 3': 'record_source_detail_3',
  'record source': 'record_source',
  'teams with edit access': 'teams_with_edit_access',
  'updated at': 'hubspot_updated_at',
  'updated by user id': 'hubspot_updated_by_user_id',
  'users with edit access': 'users_with_edit_access',
  'owner assigned date': 'owner_assigned_date',
  'owner': 'hubspot_owner_name',
};

const HUBSPOT_BLOCKED_ID_HEADERS = new Set([
  'record id', 'record_id', 'hubspot record id', 'hubspot_record_id', 'hubspot id',
  'list id', 'list_id', 'ils segment id', 'ils_segment_id', 'folder id', 'folder_id'
]);

/**
 * Auto-map suggestion: exact then normalized match on API name or label only.
 * Anything else stays Unmapped and the user picks it manually.
 */
export function mapHeaderToField(rawHeader, fields = []) {
  const raw = String(rawHeader ?? '').trim().toLowerCase();
  const n = norm(rawHeader);
  if (!n) return null;

  const isSegmentOrHubSpot = fields.some((f) => f.key === 'hubspot_segment_id' || f.key === 'hubspot_list_id');

  // If this object supports HubSpot migration keys, evaluate migration aliases dictionary
  if (isSegmentOrHubSpot) {
    const targetKey = HUBSPOT_SEGMENT_ALIASES[raw];
    if (targetKey) {
      const match = fields.find((f) => f.key === targetKey);
      if (match) return match;
    }
    if (HUBSPOT_BLOCKED_ID_HEADERS.has(raw)) {
      return null;
    }
  }

  // Explicit check for CRMNow internal Record ID / ID headers
  // Only exact CRM internal ID aliases map to internal id; never generic "... id" or source Record ID
  if (
    raw === 'id' ||
    raw === 'crm record id' ||
    raw === 'crm_record_id' ||
    raw === 'crm contact id' ||
    raw === 'crm_contact_id' ||
    raw === 'crm id' ||
    raw === 'crm record uuid' ||
    raw === 'crm contact uuid' ||
    raw === 'crm_contact_uuid' ||
    raw === 'record_uuid' ||
    raw === 'contact_uuid' ||
    raw === 'record id (crm internal uuid)'
  ) {
    const idField = fields.find((f) => f.key === 'id');
    if (idField) return idField;
  }

  // Generic "Record ID" or "HubSpot Record ID" -> map to external Record ID field if present!
  if (
    raw === 'record id' ||
    raw === 'record_id' ||
    raw === 'hubspot record id' ||
    raw === 'hubspot_record_id' ||
    raw === 'hubspot id'
  ) {
    const extField = fields.find(
      (f) =>
        f.key === 'record_id__c' ||
        f.key === 'hubspot_record_id' ||
        f.key === 'hubspot_reference_id' ||
        f.key === 'external_id'
    );
    if (extField) return extField;
  }

  // Exact or normalized match against field key or label
  let match = fields.find((f) => f.key.toLowerCase() === raw) ||
              fields.find((f) => f.label.toLowerCase() === raw) ||
              fields.find((f) => norm(f.key) === n) ||
              fields.find((f) => norm(f.label) === n);
  if (match) return match;

  // Generic qualifier stripping ('url', 'number', 'no')
  // e.g. "Website URL" -> "website" matches Website, "Phone Number" -> "phone" matches Phone
  const qualifiers = [' url', ' number', ' no', ' ids', ' id'];
  for (const q of qualifiers) {
    if (raw.endsWith(q)) {
      const stripped = raw.slice(0, -q.length).trim();
      const nStripped = norm(stripped);
      match = fields.find((f) => f.key.toLowerCase() === stripped) ||
              fields.find((f) => f.label.toLowerCase() === stripped) ||
              fields.find((f) => norm(f.key) === nStripped) ||
              fields.find((f) => norm(f.label) === nStripped);
      if (match) return match;
    }
  }

  // Metadata-driven entity title field matching (e.g. "<Object> Name", "Name", "Title")
  if (raw.endsWith(' name') || raw === 'name' || raw === 'title') {
    const titleField = fields.find((f) => f.isTitle || f.key === 'name' || f.key === 'deal_name');
    if (titleField) return titleField;
  }

  // Metadata-driven source owner matching (when source_owner_name exists on the object)
  if (raw.endsWith(' owner') || raw.endsWith(' owner name') || raw === 'source owner') {
    const srcOwnerField = fields.find((f) => f.key === 'source_owner_name' || f.key === 'owner_id' || f.key === 'contact_owner');
    if (srcOwnerField) return srcOwnerField;
  }

  // Source creator aliases (source users from legacy systems)
  if (raw === 'created by user' || raw === 'created by user id' || raw === 'created by' || raw === 'source created by') {
    const creatorField = fields.find((f) =>
      f.key === 'source_created_by' || f.key === 'source_created_by_id' ||
      f.key === 'created_by_user' || f.key === 'created_by_user__c' || f.key === 'created_by'
    );
    if (creatorField) return creatorField;
  }

  // Source updater aliases (source users from legacy systems)
  if (raw === 'updated by user' || raw === 'updated by user id' || raw === 'updated by' || raw === 'source updated by' || raw === 'modified by user id') {
    const updaterField = fields.find((f) =>
      f.key === 'source_updated_by' || f.key === 'source_modified_by_id' || f.key === 'source_updated_by_id' ||
      f.key === 'updated_by_user' || f.key === 'updated_by_user__c' || f.key === 'updated_by'
    );
    if (updaterField) return updaterField;
  }

  // Message & inquiry content aliases
  if (raw === 'message' || raw === 'inquiry message' || raw === 'contact message' || raw === 'form message') {
    const msgField = fields.find((f) =>
      f.key === 'message' || f.key === 'message__c' || f.key === 'notes' || f.key === 'description' || f.key === 'details'
    );
    if (msgField) return msgField;
  }

  // Associated company aliases
  if (raw === 'associated company (primary)' || raw === 'associated company' || raw === 'primary company') {
    const compField = fields.find((f) =>
      f.key === 'associated_company' || f.key === 'parent_id' || f.key === 'company' || f.key === 'company_id' || f.key === 'primary_company_id'
    );
    if (compField) return compField;
  }

  // Engagement ID aliases
  if (raw === 'id of first engagement' || raw === 'first engagement id' || raw === 'engagement id') {
    const engField = fields.find((f) =>
      f.key === 'first_engagement_id' || f.key === 'id_of_first_engagement' || f.key === 'first_engagement_id__c'
    );
    if (engField) return engField;
  }

  return null;
}

export function autoMapColumns(headers, fields = []) {
  const mapping = {};
  (headers || []).forEach((h) => {
    // Normalize field list elements so they have .key and .label
    const normalizedFields = fields.map((f) => ({
      key: f.key || f.name || f.api_name,
      label: f.label || f.display_name || f.name || f.key,
      ...f
    }));
    const matched = mapHeaderToField(h, normalizedFields);
    if (matched) {
      mapping[h] = matched.key;
    }
  });
  return mapping;
}
