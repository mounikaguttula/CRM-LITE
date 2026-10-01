/**
 * CSV Import Mapping Utilities
 * Metadata-driven header-to-field mapping for standard and custom CRM fields.
 */

export const STANDARD_FIELD_ALIASES = [
  { aliases: ['companyid', 'companyuuid', 'parentid'], targetKey: 'company_id' },
  { aliases: ['contactid', 'contactuuid', 'secondaryparentid'], targetKey: 'contact_id' },
  { aliases: ['company', 'organization', 'account', 'org'], targetKey: 'company' },
  { aliases: ['companyname', 'organizationname', 'accountname'], targetKey: 'company_name' },
  { aliases: ['contact', 'contactname', 'primarycontact', 'personname'], targetKey: 'contact' },
  { aliases: ['name', 'fullname', 'dealname', 'opportunityname'], targetKey: 'name' },
  { aliases: ['first', 'firstname', 'fname', 'givenname'], targetKey: 'first_name' },
  { aliases: ['last', 'lastname', 'lname', 'surname', 'familyname'], targetKey: 'last_name' },
  { aliases: ['email', 'emailaddress', 'workemail', 'primaryemail'], targetKey: 'email' },
  { aliases: ['alternateemail', 'alternateemailid', 'secondaryemail', 'altemail', 'otheremail'], targetKey: 'alternate_email' },
  { aliases: ['phone', 'phonenumber', 'telephone', 'mobile', 'tel', 'cell'], targetKey: 'phone' },
  { aliases: ['title', 'jobtitle', 'designation', 'position', 'role'], targetKey: 'title' },
  { aliases: ['leadsource', 'source'], targetKey: 'lead_source' },
  { aliases: ['status'], targetKey: 'status' },
  { aliases: ['stage', 'dealstage', 'pipelinestage', 'opportunitystage'], targetKey: 'stage' },
  { aliases: ['amount', 'dealvalue', 'value', 'price', 'revenue', 'annualrevenue', 'total'], targetKey: 'amount' },
  { aliases: ['industry', 'sector'], targetKey: 'industry' },
  { aliases: ['website', 'domain', 'url', 'web'], targetKey: 'website' },
  { aliases: ['employees', 'numberofemployees', 'companysize', 'noofemployees'], targetKey: 'number_of_employees' },
  { aliases: ['city', 'town'], targetKey: 'city' },
  { aliases: ['state', 'province', 'region'], targetKey: 'state' },
  { aliases: ['country', 'nation'], targetKey: 'country' },
  { aliases: ['address', 'street', 'streetaddress'], targetKey: 'address' },
  { aliases: ['expectedclosedate', 'closedate', 'closingdate', 'targetdate'], targetKey: 'expected_close_date' },
  { aliases: ['description', 'note', 'notes', 'memo', 'comments'], targetKey: 'description' },
  { aliases: ['recordid', 'hubspotrefernceid', 'hubspotreferenceid', 'hubspotid', 'hsrecordid', 'hsobjectid', 'hubspotrefid'], targetKey: 'hubspot_reference_id' }
];

/**
 * Builds a comprehensive list of field metadata objects [{ key, label }] for the target object.
 * Incorporates fields returned from the backend metadata API as well as standard fallbacks.
 */
export function buildFieldMetadataList(objectTypeId, fieldsList = []) {
  const fieldMap = new Map();

  const addField = (key, label) => {
    if (!key) return;
    const keyLower = String(key).trim().toLowerCase();
    if (!fieldMap.has(keyLower)) {
      fieldMap.set(keyLower, { key: String(key).trim(), label: String(label || key).trim() });
    }
  };

  // 1. Add all fields returned from the object fields metadata API (custom & standard fields)
  if (Array.isArray(fieldsList)) {
    for (const f of fieldsList) {
      if (!f) continue;
      const key = f.api_name || f.name;
      const label = f.display_name || f.label || key;
      if (key) {
        addField(key, label);
      }
    }
  }

  // 2. Add standard fallback fields for known object types to preserve compatibility
  const cleanKey = String(objectTypeId || '').toLowerCase();
  if (cleanKey.includes('contact') || cleanKey.includes('person')) {
    addField('first_name', 'First Name');
    addField('last_name', 'Last Name');
    addField('email', 'Email');
    addField('alternate_email', 'Alternate Email');
    addField('phone', 'Phone');
    addField('company', 'Company');
    addField('title', 'Job Title');
    addField('name', 'Full Name');
    addField('contact_name', 'Contact Name');
    addField('description', 'Description');
    addField('address', 'Address');
    addField('city', 'City');
    addField('state', 'State');
    addField('country', 'Country');
  } else if (cleanKey.includes('company') || cleanKey.includes('account')) {
    addField('name', 'Company Name');
    addField('company_name', 'Company Name');
    addField('industry', 'Industry');
    addField('website', 'Website');
    addField('domain', 'Domain');
    addField('number_of_employees', 'Employees');
    addField('phone', 'Phone');
    addField('city', 'City');
    addField('state', 'State');
    addField('country', 'Country');
    addField('address', 'Address');
    addField('annual_revenue', 'Annual Revenue');
    addField('description', 'Description');
  } else if (cleanKey.includes('deal') || cleanKey.includes('opportunity')) {
    addField('name', 'Deal Name');
    addField('deal_name', 'Deal Name');
    addField('amount', 'Amount');
    addField('stage', 'Stage');
    addField('expected_close_date', 'Close Date');
    addField('probability', 'Probability');
    addField('company', 'Company');
    addField('company_id', 'Company ID');
    addField('contact', 'Contact');
    addField('contact_id', 'Contact ID');
    addField('description', 'Description');
  } else if (cleanKey.includes('lead')) {
    addField('first_name', 'First Name');
    addField('last_name', 'Last Name');
    addField('email', 'Email');
    addField('alternate_email', 'Alternate Email');
    addField('phone', 'Phone');
    addField('company', 'Company');
    addField('title', 'Job Title');
    addField('lead_source', 'Lead Source');
    addField('status', 'Status');
    addField('name', 'Lead Name');
    addField('description', 'Description');
  } else {
    addField('name', 'Name');
    addField('title', 'Title');
    addField('status', 'Status');
    addField('description', 'Description');
  }

  return Array.from(fieldMap.values());
}

/**
 * Returns allowed fields for object CSV import.
 */
export function getObjectAllowedFields(objectTypeId, fieldsList = []) {
  return buildFieldMetadataList(objectTypeId, fieldsList);
}

/**
 * Maps a single CSV header string to a target field object [{ key, label }] using metadata-driven priority order:
 * 1. Exact API name match
 * 2. Exact field label match
 * 3. Normalized API name match
 * 4. Normalized label match
 * 5. Existing standard-field aliases / legacy mappings
 */
export function mapHeaderToField(rawHeader, fieldMetadataList = []) {
  if (!rawHeader) return null;
  const hTrim = String(rawHeader).trim();
  if (!hTrim) return null;

  const hLower = hTrim.toLowerCase();
  const hNorm = hLower.replace(/[^a-z0-9]/g, '');

  const list = Array.isArray(fieldMetadataList)
    ? fieldMetadataList
    : (fieldMetadataList instanceof Map ? Array.from(fieldMetadataList.values()) : []);

  // 1. Exact API name match
  for (const field of list) {
    if (field.key === hTrim || String(field.key).toLowerCase() === hLower) {
      console.log(`[CSV Import Mapping] "${hTrim}" → matched field label "${field.label}" → API name "${field.key}" (via Exact API Name)`);
      return field;
    }
  }

  // 2. Exact field label match
  for (const field of list) {
    if (field.label === hTrim || String(field.label).toLowerCase() === hLower) {
      console.log(`[CSV Import Mapping] "${hTrim}" → matched field label "${field.label}" → API name "${field.key}" (via Exact Label)`);
      return field;
    }
  }

  // 3. Normalized API name match
  if (hNorm) {
    for (const field of list) {
      const fieldKeyNorm = String(field.key).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (fieldKeyNorm && fieldKeyNorm === hNorm) {
        console.log(`[CSV Import Mapping] "${hTrim}" → matched field label "${field.label}" → API name "${field.key}" (via Normalized API Name)`);
        return field;
      }
    }
  }

  // 4. Normalized label match
  if (hNorm) {
    for (const field of list) {
      const fieldLabelNorm = String(field.label).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (fieldLabelNorm && fieldLabelNorm === hNorm) {
        console.log(`[CSV Import Mapping] "${hTrim}" → matched field label "${field.label}" → API name "${field.key}" (via Normalized Label)`);
        return field;
      }
    }
  }

  // 5. Existing standard-field aliases / legacy mappings
  if (hNorm) {
    for (const aliasDef of STANDARD_FIELD_ALIASES) {
      if (aliasDef.aliases.includes(hNorm)) {
        const matchedField = list.find(f => String(f.key).toLowerCase() === aliasDef.targetKey.toLowerCase());
        if (matchedField) {
          console.log(`[CSV Import Mapping] "${hTrim}" → matched field label "${matchedField.label}" → API name "${matchedField.key}" (via Standard Alias)`);
          return matchedField;
        }
        const fallbackLabel = aliasDef.targetKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        console.log(`[CSV Import Mapping] "${hTrim}" → matched field label "${fallbackLabel}" → API name "${aliasDef.targetKey}" (via Standard Fallback Alias)`);
        return { key: aliasDef.targetKey, label: fallbackLabel };
      }
    }
  }

  console.log(`[CSV Import Mapping] "${hTrim}" → UNMAPPED`);
  return null;
}

/**
 * Returns a Set of meaningful field keys for object validation.
 */
export function getMeaningfulFieldKeys(objectTypeId, fieldsList = []) {
  const cleanKey = String(objectTypeId || '').toLowerCase();
  const GENERIC_SET = new Set(['description', 'custom_description', 'notes', 'memo', 'comments', 'created_at', 'updated_at', 'created_by', 'updated_by', 'owner', 'owner_id', 'status', 'is_deleted', 'id', '_id', 'organization_id']);
  const meaningfulSet = new Set();

  if (cleanKey.includes('contact') || cleanKey.includes('person')) {
    ['first_name', 'last_name', 'name', 'email', 'alternate_email', 'phone', 'company', 'title'].forEach(k => meaningfulSet.add(k));
  } else if (cleanKey.includes('company') || cleanKey.includes('account')) {
    ['name', 'company_name', 'industry', 'website', 'domain', 'phone'].forEach(k => meaningfulSet.add(k));
  } else if (cleanKey.includes('deal') || cleanKey.includes('opportunity')) {
    ['name', 'deal_name', 'opportunity_name', 'amount', 'stage', 'expected_close_date', 'company', 'company_id', 'contact', 'contact_id'].forEach(k => meaningfulSet.add(k));
  } else if (cleanKey.includes('lead')) {
    ['first_name', 'last_name', 'name', 'email', 'alternate_email', 'phone', 'company', 'title', 'lead_source'].forEach(k => meaningfulSet.add(k));
  }

  if (Array.isArray(fieldsList)) {
    for (const f of fieldsList) {
      if (!f) continue;
      const fname = String(f.api_name || f.name || '').toLowerCase();
      if (fname && !GENERIC_SET.has(fname)) {
        meaningfulSet.add(fname);
      }
    }
  }

  if (meaningfulSet.size === 0) {
    meaningfulSet.add('name');
    meaningfulSet.add('title');
    meaningfulSet.add('subject');
  }
  return meaningfulSet;
}
