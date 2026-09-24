/**
 * lookupUtils.js
 *
 * Derives which lookup data sources are required to render a CRM form,
 * based purely on the field definitions returned by the metadata API.
 *
 * Strategy (two-tier, no hardcoded object-type rules):
 *   1. Primary  — field.type === 'lookup'  (authoritative metadata signal)
 *   2. Fallback — field-name pattern matching (mirrors renderField heuristics
 *                 already used in CreatePage and EditPage)
 *
 * This ensures:
 *   - Lead "company" (type: 'text') → does NOT trigger /objects/companies
 *   - Contact "company_id" (type: 'lookup') → DOES trigger /objects/companies
 *   - Any custom object with a lookup field is handled automatically
 */

// Platform owner/user field names always present via PLATFORM_FIELDS in metadataService.
// These are type:'lookup' in the backend but we guard by name as an extra safety net.
const OWNER_FIELD_NAMES = new Set(['owner_id', 'owner', 'created_by', 'updated_by']);

/**
 * Given an array of field definitions returned by /metadata/objects/:id/fields,
 * returns an object describing which lookup data sources must be fetched.
 *
 * @param {Array} fields - Array of field definition objects
 * @returns {{ users: boolean, companies: boolean, contacts: boolean, deals: boolean, products: boolean }}
 */
export function deriveLookupRequirements(fields) {
  const needs = {
    users: false,
    companies: false,
    contacts: false,
    deals: false,
    products: false,
  };

  for (const f of (fields || [])) {
    const fType = (f.type || f.field_type || '').toLowerCase();
    const name  = (f.name || f.api_name || '').toLowerCase();

    // Primary signal: explicit lookup type from metadata
    const isLookup = fType === 'lookup';

    // Fallback signal: field-name heuristics (same logic as renderField in Create/EditPage)
    const isOwnerName   = name.includes('owner') || OWNER_FIELD_NAMES.has(name);
    const isCompanyName = name.includes('company') || name.includes('account') || name.includes('organization');
    const isContactName = name.includes('contact');
    const isDealName    = name.includes('deal');
    const isProductName = name.includes('product');

    // Users: needed when a lookup field is an owner/user field (primary + fallback both trigger this)
    // The owner_id platform field is always present with type:'lookup', so users is always true.
    if (isLookup || isOwnerName) {
      // Only set users if the field is actually a lookup OR is a known owner field name
      if (isLookup || isOwnerName) needs.users = true;
    }

    // For non-owner lookups, require type:'lookup' as the primary guard.
    // This prevents plain text fields (e.g. Lead's "company" text field) from
    // triggering an unnecessary fetch.
    if (isLookup && isCompanyName) needs.companies = true;
    if (isLookup && isContactName) needs.contacts  = true;
    if (isLookup && isDealName)    needs.deals     = true;
    if (isLookup && isProductName) needs.products  = true;
  }

  return needs;
}
