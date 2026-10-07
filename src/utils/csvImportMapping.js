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

  return (Array.isArray(fieldsList) ? fieldsList : [])
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
}

/**
 * Auto-map suggestion: exact then normalized match on API name or label only.
 * Anything else stays Unmapped and the user picks it manually.
 */
export function mapHeaderToField(rawHeader, fields = []) {
  const raw = String(rawHeader ?? '').trim().toLowerCase();
  const n = norm(rawHeader);
  if (!n) return null;
  return (
    fields.find((f) => f.key.toLowerCase() === raw) ||
    fields.find((f) => f.label.toLowerCase() === raw) ||
    fields.find((f) => norm(f.key) === n) ||
    fields.find((f) => norm(f.label) === n) ||
    null
  );
}
