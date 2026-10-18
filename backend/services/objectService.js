const supabase = require('../config/supabase');
const { supabaseAdmin } = require('../config/supabase');
const dbClient = supabaseAdmin || supabase;
const metadataService = require('./metadataService');
const validationRuleService = require('./validationRuleService');

// Helper to validate UUID format to prevent PostgreSQL syntax errors
const isUuid = (val) => Boolean(val && typeof val === 'string' && /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.test(val.trim()));

const cleanImportValue = (val) => {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str.startsWith('="') && str.endsWith('"')) {
    str = str.slice(2, -1);
  } else if (str.startsWith('=')) {
    str = str.replace(/^="?|"?$/g, '');
  }
  str = str.trim();
  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(str)) {
    const num = Number(str);
    if (!isNaN(num) && Number.isFinite(num)) {
      try {
        if (Math.floor(num) === num || Math.abs(num - Math.round(num)) < 1e-5) {
          str = BigInt(Math.round(num)).toString();
        } else {
          str = num.toFixed(0);
        }
      } catch (e) {
        str = num.toFixed(0);
      }
    }
  }
  return str;
};

const getNormalizedKeys = (val) => {
  if (val === null || val === undefined) return [];
  let str = cleanImportValue(val);
  if (!str) return [];
  const keys = new Set();
  const lower = str.toLowerCase();
  keys.add(lower);
  keys.add(str.toUpperCase());

  const num = Number(str);
  if (!Number.isNaN(num) && num > 0) {
    try {
      const exp5 = num.toExponential(5).toUpperCase();
      keys.add(exp5);
      keys.add(exp5.toLowerCase());
    } catch (e) {}
    try {
      if (Number.isInteger(num)) {
        const intStr = BigInt(Math.round(num)).toString().toLowerCase();
        keys.add(intStr);
      }
    } catch (e) {}
  }
  return Array.from(keys);
};

const normalizeIdentifier = (val) => getNormalizedKeys(val)[0] || '';

// Non-email field suffix list (fields whose names contain 'email' but are NOT email address fields)
const NON_EMAIL_SUFFIXES = ['domain', 'status', 'opt_out', 'optout', 'count', 'score', 'reason', 'type', 'id', 'link', 'date', 'time', 'timestamp'];

const isTrueEmailField = (key, fields = null) => {
  if (!key || typeof key !== 'string') return false;
  const lowerKey = key.toLowerCase().trim();

  if (Array.isArray(fields) && fields.length > 0) {
    const matchedField = fields.find(f => {
      const fName = String(f.name || f.api_name || '').toLowerCase();
      return fName === lowerKey;
    });
    if (matchedField) {
      return matchedField.type === 'email' || matchedField.field_type === 'email';
    }
  }

  const explicitEmailKeys = [
    'email', 'work_email', 'primary_email', 'email_address', 'contact_email', 'company_email',
    'alternate_email', 'alternate_email_id', 'secondary_email', 'alt_email', 'other_email', 'email_2', 'email2', 'alternate_email_address'
  ];
  if (explicitEmailKeys.includes(lowerKey)) return true;

  if (lowerKey.includes('email')) {
    const hasNonEmailSuffix = NON_EMAIL_SUFFIXES.some(s => lowerKey.endsWith(`_${s}`) || lowerKey.endsWith(s));
    if (!hasNonEmailSuffix) return true;
  }

  return false;
};

const sanitizeEmailValue = (rawVal) => {
  if (rawVal === undefined || rawVal === null) return '';
  let str = String(rawVal).trim();
  if (!str) return '';

  if (/^(n\/a|na|none|null|no-email|no email|-|unknown|undefined|\?)$/i.test(str)) {
    return '';
  }

  if (str.includes(',') || str.includes(';')) {
    const parts = str.split(/[,;]/).map(p => p.trim()).filter(Boolean);
    const validPart = parts.find(p => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/.test(p));
    return validPart || parts[0] || '';
  }

  return str;
};

// Helper to validate that Primary Email and Alternate Email ID are not identical (metadata-aware)
const validateDuplicateEmails = (payload, fields = null) => {
  if (!payload || typeof payload !== 'object') return;

  const emailValues = new Set();

  for (const [key, rawVal] of Object.entries(payload)) {
    if (key === 'data' || !isTrueEmailField(key, fields)) continue;
    const cleanVal = sanitizeEmailValue(rawVal);
    if (!cleanVal) continue;

    const lowerVal = cleanVal.toLowerCase();
    if (emailValues.has(lowerVal)) {
      throw {
        statusCode: 400,
        message: `Validation Error: Duplicate email address '${cleanVal}' specified for multiple email fields in the same record.`
      };
    }
    emailValues.add(lowerVal);
  }
};

// Helper to validate email format using dynamic field definitions metadata
const validateEmailFormats = (payload, fields = null, options = {}) => {
  if (!payload || typeof payload !== 'object') return;

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;
  const isBulkImport = options.isBulkImport === true;

  for (const [key, rawVal] of Object.entries(payload)) {
    if (rawVal === undefined || rawVal === null || key === 'data') continue;
    if (!isTrueEmailField(key, fields)) continue;

    const cleanVal = sanitizeEmailValue(rawVal);
    if (!cleanVal) {
      if (typeof rawVal === 'string' && /^(n\/a|na|none|null|no-email|no email|-|unknown)$/i.test(rawVal.trim())) {
        payload[key] = null;
      }
      continue;
    }

    if (!emailRegex.test(cleanVal)) {
      if (isBulkImport) {
        payload[key] = null;
      } else {
        const lowerKey = key.toLowerCase();
        const fieldLabel = (lowerKey.includes('alternate') || lowerKey.includes('secondary') || lowerKey.includes('alt') || lowerKey.includes('other') || lowerKey.includes('2'))
          ? 'Alternate Email ID'
          : 'Email Address';
        throw {
          statusCode: 400,
          message: `Validation Error: Please enter a valid email address for ${fieldLabel} (e.g. user@company.com).`
        };
      }
    } else {
      payload[key] = cleanVal;
    }
  }

  if (payload.data && typeof payload.data === 'object') {
    validateEmailFormats(payload.data, fields, options);
  }
};

// Helper to validate parent record existence, tenant ownership, and target object type
const validateParentRelationship = async (parentId, expectedObjectKey, organizationId, fieldLabel = 'Company') => {
  if (!parentId) return null;
  if (!isUuid(parentId)) {
    throw {
      statusCode: 400,
      message: `Validation Error: ${fieldLabel} ID '${parentId}' is not a valid UUID format.`,
    };
  }

  const { data: parentRow, error } = await supabase
    .from('universal_table')
    .select('id, organization_id, object_type_id, name, data, is_deleted')
    .eq('id', parentId)
    .maybeSingle();

  if (error || !parentRow || parentRow.is_deleted) {
    throw {
      statusCode: 400,
      message: `Validation Error: ${fieldLabel} ID '${parentId}' was not found.`,
    };
  }

  if (parentRow.organization_id !== organizationId) {
    throw {
      statusCode: 403,
      message: `Validation Error: ${fieldLabel} ID '${parentId}' does not belong to the current organization.`,
    };
  }

  if (expectedObjectKey) {
    const expectedDef = await metadataService.getObjectTypeByApiName(expectedObjectKey, organizationId).catch(() => null);
    if (expectedDef && expectedDef.id && parentRow.object_type_id !== expectedDef.id) {
      throw {
        statusCode: 400,
        message: `Validation Error: The referenced record '${parentId}' is not a ${fieldLabel} object type.`,
      };
    }
  }

  return parentRow;
};

/**
 * Helper to resolve company identifiers (UUIDs, external/HubSpot IDs) stored on a contact record.
 */
const resolveContactCompanyTokens = async (contactId, organizationId = null) => {
  if (!isUuid(contactId)) return [];
  try {
    let q = supabase
      .from('universal_table')
      .select('parent_id, data')
      .eq('id', contactId)
      .eq('is_deleted', false);
    if (organizationId) q = q.eq('organization_id', organizationId);
    const { data: contactRow } = await q.maybeSingle();

    if (!contactRow) return [];

    const rawTokens = [
      contactRow.parent_id,
      ...(Array.isArray(contactRow.data?.company_ids) ? contactRow.data.company_ids : []),
      ...(Array.isArray(contactRow.data?.associated_company_ids) ? contactRow.data.associated_company_ids : []),
      ...(typeof contactRow.data?.associated_company_ids__c === 'string'
        ? contactRow.data.associated_company_ids__c.split(';').map((s) => s.trim()).filter(Boolean)
        : []),
      ...(typeof contactRow.data?.associated_company_ids_primary__c === 'string'
        ? contactRow.data.associated_company_ids_primary__c.split(';').map((s) => s.trim()).filter(Boolean)
        : [])
    ].filter(Boolean);

    return [...new Set(rawTokens)];
  } catch (err) {
    console.warn('Could not resolve contact company tokens:', err.message);
    return [];
  }
};


// Helper to resolve parent by name within the current tenant, handling ambiguity
const resolveParentByName = async (nameInput, targetObjectKey, organizationId, fieldLabel = 'Company') => {
  if (!nameInput || typeof nameInput !== 'string' || !nameInput.trim()) return null;

  const targetDef = await metadataService.getObjectTypeByApiName(targetObjectKey, organizationId).catch(() => null);
  if (!targetDef || !targetDef.id) return null;

  const cleanName = nameInput.trim().toLowerCase();

  const { data: rows, error } = await supabase
    .from('universal_table')
    .select('id, name, data')
    .eq('object_type_id', targetDef.id)
    .eq('organization_id', organizationId)
    .eq('is_deleted', false);

  if (error || !rows || rows.length === 0) return null;

  const matches = rows.filter((r) => {
    const rName = String(r.name || r.data?.name || r.data?.company_name || r.data?.contact_name || '').trim().toLowerCase();
    return rName === cleanName;
  });

  if (matches.length > 1) {
    throw {
      statusCode: 400,
      message: `Validation Error: Multiple ${fieldLabel}s found with the name '${nameInput}'. Please provide ${fieldLabel} ID.`,
    };
  }

  return null;
};

// Supported Aliases for Company and Contact payload keys (in ID precedence order)
const COMPANY_ALIASES = ['company_id', 'Company_id', 'parent_id', 'company', 'Company', 'company_name'];
const CONTACT_ALIASES = ['contact_id', 'Contact_id', 'secondary_parent_id', 'contact', 'Contact', 'contact_name'];

/**
 * Dynamic payload alias extractor driven by field metadata definitions.
 * Follows ID precedence order and checks candidate field names/labels dynamically.
 */
const extractPayloadAliasValue = (payload, aliases) => {
  if (!payload || typeof payload !== 'object') return undefined;

  const candidateKeys = Array.isArray(aliases) ? aliases : [aliases];

  for (const key of candidateKeys) {
    if (payload[key] !== undefined && payload[key] !== null && String(payload[key]).trim() !== '') {
      return payload[key];
    }
  }
  return undefined;
};

// Helper to extract separated relationship inputs and resolve relationships
const resolveRecordRelationships = async (payload, cleanObjKey, organizationId) => {
  let companyIdInput = undefined;
  let companyNameInput = undefined;
  let contactIdInput = undefined;
  let contactNameInput = undefined;

  const isCompanyObject = cleanObjKey.includes('company') || cleanObjKey.includes('account');
  const isContactObject = cleanObjKey.includes('contact') || cleanObjKey.includes('person');

  if (!isCompanyObject) {
    // Explicit Company ID candidates
    const explicitCompanyIdKeys = ['company_id', 'Company ID', 'CompanyId', 'Company_id', 'company_uuid', 'parent_id'];
    for (const k of explicitCompanyIdKeys) {
      if (payload[k] !== undefined && payload[k] !== null && String(payload[k]).trim() !== '') {
        companyIdInput = String(payload[k]).trim();
        break;
      }
    }

    if (companyIdInput === undefined) {
      const rawComp = payload.company !== undefined ? payload.company : payload.Company;
      if (rawComp !== undefined && rawComp !== null && String(rawComp).trim() !== '') {
        const compStr = String(rawComp).trim();
        if (isUuid(compStr)) {
          companyIdInput = compStr;
        } else {
          companyNameInput = compStr;
        }
      }
    }

    if (companyNameInput === undefined) {
      const explicitCompanyNameKeys = ['company_name', 'Company Name', 'account_name', 'organization_name'];
      for (const k of explicitCompanyNameKeys) {
        if (payload[k] !== undefined && payload[k] !== null && String(payload[k]).trim() !== '') {
          const nameStr = String(payload[k]).trim();
          if (!isUuid(nameStr)) {
            companyNameInput = nameStr;
            break;
          }
        }
      }
    }
  } else {
    // Parent company lookup for Company objects
    const parentCompanyIdKeys = ['parent_company_id', 'parent_id', 'parent_company_uuid'];
    for (const k of parentCompanyIdKeys) {
      if (payload[k] !== undefined && payload[k] !== null && String(payload[k]).trim() !== '') {
        companyIdInput = String(payload[k]).trim();
        break;
      }
    }
    if (companyIdInput === undefined) {
      const rawParent = payload.parent_company !== undefined ? payload.parent_company : payload.ParentCompany;
      if (rawParent !== undefined && rawParent !== null && String(rawParent).trim() !== '') {
        const parentStr = String(rawParent).trim();
        if (isUuid(parentStr)) {
          companyIdInput = parentStr;
        } else {
          companyNameInput = parentStr;
        }
      }
    }
  }

  if (!isContactObject) {
    // Explicit Contact ID candidates
    const explicitContactIdKeys = ['contact_id', 'Contact ID', 'ContactId', 'Contact_id', 'contact_uuid', 'secondary_parent_id'];
    for (const k of explicitContactIdKeys) {
      if (payload[k] !== undefined && payload[k] !== null && String(payload[k]).trim() !== '') {
        contactIdInput = String(payload[k]).trim();
        break;
      }
    }

    if (contactIdInput === undefined) {
      const rawCont = payload.contact !== undefined ? payload.contact : payload.Contact;
      if (rawCont !== undefined && rawCont !== null && String(rawCont).trim() !== '') {
        const contStr = String(rawCont).trim();
        if (isUuid(contStr)) {
          contactIdInput = contStr;
        } else {
          contactNameInput = contStr;
        }
      }
    }

    if (contactNameInput === undefined) {
      const explicitContactNameKeys = ['contact_name', 'Contact Name', 'person_name'];
      for (const k of explicitContactNameKeys) {
        if (payload[k] !== undefined && payload[k] !== null && String(payload[k]).trim() !== '') {
          const nameStr = String(payload[k]).trim();
          if (!isUuid(nameStr)) {
            contactNameInput = nameStr;
            break;
          }
        }
      }
    }
  } else {
    // Secondary contact lookup for Contact objects
    const secondaryContactIdKeys = ['secondary_contact_id', 'secondary_parent_id'];
    for (const k of secondaryContactIdKeys) {
      if (payload[k] !== undefined && payload[k] !== null && String(payload[k]).trim() !== '') {
        contactIdInput = String(payload[k]).trim();
        break;
      }
    }
  }

  let resolvedParent = null;
  let resolvedParentName = null;
  let resolvedSecondary = null;
  let resolvedSecondaryName = null;

  // 1. Resolve Company Relationship
  if (companyIdInput !== undefined) {
    if (companyIdInput && companyIdInput !== 'null') {
      const expectedTarget = (cleanObjKey.includes('deal') || cleanObjKey.includes('opportunity')) ? 'company' : null;
      const parentRow = await validateParentRelationship(companyIdInput, expectedTarget, organizationId, 'Company');
      if (parentRow) {
        resolvedParent = parentRow.id;
        resolvedParentName = parentRow.name || parentRow.data?.name || parentRow.data?.company_name || 'Company';
      }
    }
  } else if (companyNameInput) {
    const expectedTarget = (cleanObjKey.includes('deal') || cleanObjKey.includes('opportunity')) ? 'company' : null;
    const parentRow = await resolveParentByName(companyNameInput, expectedTarget, organizationId, 'Company');
    if (parentRow) {
      resolvedParent = parentRow.id;
      resolvedParentName = parentRow.name || parentRow.data?.name || parentRow.data?.company_name || companyNameInput;
    } else if (expectedTarget) {
      throw {
        statusCode: 400,
        message: `Validation Error: Company '${companyNameInput}' was not found. Please provide a valid Company Name or Company ID.`,
      };
    } else {
      resolvedParentName = companyNameInput;
    }
  }

  // 2. Resolve Contact Relationship
  if (contactIdInput !== undefined) {
    if (contactIdInput && contactIdInput !== 'null') {
      const expectedSecondaryTarget = (cleanObjKey.includes('deal') || cleanObjKey.includes('opportunity') || cleanObjKey.includes('contact')) ? 'contact' : null;
      const secondaryRow = await validateParentRelationship(contactIdInput, expectedSecondaryTarget, organizationId, 'Contact');
      if (secondaryRow) {
        resolvedSecondary = secondaryRow.id;
        resolvedSecondaryName = secondaryRow.name || secondaryRow.data?.name || secondaryRow.data?.contact_name || 'Contact';
      }
    }
  } else if (contactNameInput) {
    const expectedSecondaryTarget = (cleanObjKey.includes('deal') || cleanObjKey.includes('opportunity') || cleanObjKey.includes('contact')) ? 'contact' : null;
    const secondaryRow = await resolveParentByName(contactNameInput, expectedSecondaryTarget, organizationId, 'Contact');
    if (secondaryRow) {
      resolvedSecondary = secondaryRow.id;
      resolvedSecondaryName = secondaryRow.name || secondaryRow.data?.name || secondaryRow.data?.contact_name || contactNameInput;
    } else if (expectedSecondaryTarget) {
      throw {
        statusCode: 400,
        message: `Validation Error: Contact '${contactNameInput}' was not found. Please provide a valid Contact Name or Contact ID.`,
      };
    } else {
      resolvedSecondaryName = contactNameInput;
    }
  }

  return {
    resolvedParent,
    resolvedParentName,
    resolvedSecondary,
    resolvedSecondaryName,
    companyIdInputProvided: companyIdInput !== undefined,
    contactIdInputProvided: contactIdInput !== undefined,
    companyNameInputProvided: companyNameInput !== undefined,
    contactNameInputProvided: contactNameInput !== undefined,
  };
};

/**
 * Generic Object Service
 * Executes dynamic CRUD operations against Supabase universal_table.
 * ZERO object-specific code, ZERO hardcoded switch statements.
 */
const objectService = {
  /**
   * Helper to normalize universal_table row into flat JSON for React UI.
   */
  normalizeRecord: (row) => {
    if (!row) return null;
    const { id, name, status, owner_id, created_by, updated_by, parent_id, secondary_parent_id, data, created_at, updated_at } = row;
    const dataObj = typeof data === 'object' && data !== null ? { ...data } : {};
    delete dataObj.data;

    // Harmonize alias fields for Job Title, Designation/Role, Address/Country, Employees, Lead Source, Deal Type
    const titleVal = dataObj.title || dataObj.job_title || '';
    const designationVal = dataObj.designation || dataObj.role || '';
    const addressVal = dataObj.address || dataObj.country || '';
    const employeesVal = dataObj.number_of_employees || dataObj.company_size || '';
    const sourceVal = dataObj.lead_source || dataObj.source || '';
    const stageVal = dataObj.stage || dataObj.Stage || null;
    const isDealRow = Boolean(stageVal || dataObj.deal_name || dataObj.DealType || dataObj.deal_type || dataObj.dealType);
    const dealTypeVal = dataObj.DealType || dataObj.deal_type || dataObj.dealType || (isDealRow ? dataObj.type : null) || null;

    // Resolve human name if row.name is a UUID
    let humanName = name;
    if (isUuid(name) || !name) {
      const candidateName = dataObj.name || dataObj.company_name || dataObj.account_name || dataObj.title || dataObj.subject || dataObj.display_name;
      if (candidateName && typeof candidateName === 'string' && !isUuid(candidateName)) {
        humanName = candidateName;
      }
    }

    if (humanName && typeof humanName === 'string' && !isUuid(humanName)) {
      dataObj.name = humanName;
    }

    // Map Campaign template to Type picklist value if type is not already explicitly set
    if (!dataObj.type) {
      const tId = dataObj.template_id || (row && row.template_id);
      const tName = dataObj.template_name || (row && row.template_name);
      const templateTypeMap = {
        welcome_email: 'Welcome Email',
        product_promo: 'Product Promotion',
        newsletter: 'Monthly Newsletter',
        event_invitation: 'Event Invitation',
        'welcome email': 'Welcome Email',
        'product promotion': 'Product Promotion',
        'monthly newsletter': 'Monthly Newsletter',
        'event invitation': 'Event Invitation',
      };
      if (tId && templateTypeMap[String(tId).toLowerCase()]) {
        dataObj.type = templateTypeMap[String(tId).toLowerCase()];
      } else if (tName && templateTypeMap[String(tName).toLowerCase()]) {
        dataObj.type = templateTypeMap[String(tName).toLowerCase()];
      } else if (tName && typeof tName === 'string') {
        dataObj.type = tName;
      }
    }

    return {
      id,
      name: humanName,
      status,
      owner_id,
      created_by: created_by || owner_id || null,
      updated_by: updated_by || null,
      parent_id,
      secondary_parent_id,
      created_at,
      updated_at,
      ...dataObj,
      ...(stageVal ? { stage: stageVal } : {}),
      ...(dealTypeVal ? { DealType: dealTypeVal, deal_type: dealTypeVal, type: dealTypeVal } : {}),
      ...(titleVal ? { title: titleVal, job_title: titleVal } : {}),
      ...(designationVal ? { designation: designationVal, role: designationVal } : {}),
      ...(addressVal ? { address: addressVal, country: addressVal } : {}),
      ...(employeesVal ? { number_of_employees: employeesVal, company_size: employeesVal } : {}),
      ...(sourceVal ? { lead_source: sourceVal, source: sourceVal } : {}),
    };
  },

  /**
   * List records from universal_table for any objectType.
   */
  listRecords: async (objectKey, organizationId, options = {}) => {
    const isPaginated = Boolean(options.paginated || options.page || options.pageSize);
    const reqPage = Math.max(1, parseInt(options.page, 10) || 1);
    const reqPageSize = Math.max(1, parseInt(options.pageSize, 10) || 25);

    if (!objectKey || typeof objectKey !== 'string' || objectKey.includes('📁') || objectKey.trim() === '') {
      return isPaginated ? { success: true, data: [], meta: { page: reqPage, pageSize: reqPageSize, total: 0, totalPages: 0 } } : [];
    }

    const cleanKey = String(objectKey || '').toLowerCase();
    const objDef = await metadataService.getObjectTypeByApiName(objectKey, organizationId).catch(() => null);
    const targetTypeId = objDef ? objDef.id : (isUuid(objectKey) ? objectKey : null);
    if (!targetTypeId) {
      return isPaginated ? { success: true, data: [], meta: { page: reqPage, pageSize: reqPageSize, total: 0, totalPages: 0 } } : [];
    }

    if (isPaginated) {
      let query = supabase
        .from('universal_table')
        .select('*', { count: 'exact' })
        .eq('is_deleted', false)
        .eq('object_type_id', targetTypeId);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      if (options.owner_ids && Array.isArray(options.owner_ids) && options.owner_ids.length > 0) {
        query = query.in('owner_id', options.owner_ids);
      } else if (options.owner_id) {
        query = query.eq('owner_id', options.owner_id);
      }

      if (options.search) {
        const searchClean = String(options.search).trim();
        if (searchClean) {
          query = query.ilike('name', `%${searchClean}%`);
        }
      }

      if (options.status && options.status !== 'ALL') {
        const cleanStatus = String(options.status).trim();
        query = query.or(`status.ilike.%${cleanStatus}%,data->>status.ilike.%${cleanStatus}%,data->>stage.ilike.%${cleanStatus}%`);
      }

      if (options.related_to && isUuid(options.related_to)) {
        const relId = options.related_to;
        const jsonFilter = JSON.stringify([relId]);
        const relType = String(options.related_type || '').toLowerCase();
        const isTargetCompany = cleanKey.includes('compan');

        if (isTargetCompany && relType === 'contact') {
          const compTokens = await resolveContactCompanyTokens(relId, organizationId);
          const uuidTokens = compTokens.filter(isUuid);
          const extTokens = compTokens.filter((t) => !isUuid(t) && typeof t === 'string' && t.trim() !== '');

          const orParts = [
            `data->contact_ids.cs.${jsonFilter}`,
            `data->associated_contact_ids.cs.${jsonFilter}`
          ];
          if (uuidTokens.length > 0) {
            orParts.push(`id.in.(${uuidTokens.join(',')})`);
          }
          if (extTokens.length > 0) {
            const cleanExt = extTokens.map((t) => t.replace(/[,()]/g, '')).filter(Boolean);
            if (cleanExt.length > 0) {
              orParts.push(`data->>record_id__c.in.(${cleanExt.join(',')})`);
              orParts.push(`data->>hubspot_id.in.(${cleanExt.join(',')})`);
            }
          }
          query = query.or(orParts.join(','));
        } else if (relType === 'contact') {
          query = query.or(`secondary_parent_id.eq.${relId},data->contact_ids.cs.${jsonFilter},data->associated_contact_ids.cs.${jsonFilter}`);
        } else {
          query = query.or(`parent_id.eq.${relId},data->company_ids.cs.${jsonFilter},data->associated_company_ids.cs.${jsonFilter}`);
        }
      }

      const sortCol = (options.sortBy === 'name' || options.sortBy === 'title')
        ? 'name'
        : (options.sortBy === 'status' || options.sortBy === 'stage')
        ? 'status'
        : 'created_at';

      const isAsc = String(options.sortOrder || 'desc').toLowerCase() === 'asc';
      query = query.order(sortCol, { ascending: isAsc });
      query = query.range((reqPage - 1) * reqPageSize, reqPage * reqPageSize - 1);

      const { data: rows, count, error } = await query;

      if (error) {
        if ((error.code === 'PGRST103' || (error.message && error.message.includes('range not satisfiable'))) && reqPage > 1) {
          return objectService.listRecords(objectKey, organizationId, { ...options, page: 1 });
        }
        console.error(`Supabase ERROR for '${objectKey}':`, error.message, error.code, error.details);
        throw { statusCode: 500, message: `Failed to fetch records for '${objectKey}': ${error.message}` };
      }

      let normalizedData = (rows || []).map(objectService.normalizeRecord);

      // Perform field-level sorting on normalized dataset
      const sortField = options.sortBy || 'created_at';
      normalizedData.sort((a, b) => {
        let valA = a[sortField] !== undefined ? a[sortField] : (a.data && a.data[sortField]);
        let valB = b[sortField] !== undefined ? b[sortField] : (b.data && b.data[sortField]);

        if (sortField === 'name' || sortField === 'title') {
          valA = a.name || a.lead_name || a.contact_name || a.first_name || '';
          valB = b.name || b.lead_name || b.contact_name || b.first_name || '';
        } else if (sortField === 'created_at' || sortField === 'created_date') {
          valA = new Date(a.created_at || a.created_date || 0).getTime();
          valB = new Date(b.created_at || b.created_date || 0).getTime();
        }

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'number' && typeof valB === 'number') {
          return isAsc ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();

        let cmp = 0;
        if (strA < strB) cmp = -1;
        if (strA > strB) cmp = 1;

        return isAsc ? cmp : -cmp;
      });
      const totalCount = typeof count === 'number' ? count : normalizedData.length;

      return {
        success: true,
        data: normalizedData,
        meta: {
          page: reqPage,
          pageSize: reqPageSize,
          total: totalCount,
          totalPages: Math.max(1, Math.ceil(totalCount / reqPageSize)),
        },
      };
    }

    // Unpaginated fallback for legacy bulk/export callers
    let allRows = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('universal_table')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      query = query.eq('object_type_id', targetTypeId);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      if (options.owner_ids && Array.isArray(options.owner_ids) && options.owner_ids.length > 0) {
        query = query.in('owner_id', options.owner_ids);
      } else if (options.owner_id) {
        query = query.eq('owner_id', options.owner_id);
      }

      if (options.search) {
        const searchClean = String(options.search).trim();
        if (searchClean) {
          query = query.ilike('name', `%${searchClean}%`);
        }
      }

      if (options.status && options.status !== 'ALL') {
        const cleanStatus = String(options.status).trim();
        query = query.or(`status.ilike.%${cleanStatus}%,data->>status.ilike.%${cleanStatus}%,data->>stage.ilike.%${cleanStatus}%`);
      }

      if (options.related_to && isUuid(options.related_to)) {
        const relId = options.related_to;
        const jsonFilter = JSON.stringify([relId]);
        const relType = String(options.related_type || '').toLowerCase();
        const isTargetCompany = cleanKey.includes('compan');

        if (isTargetCompany && relType === 'contact') {
          const compTokens = await resolveContactCompanyTokens(relId, organizationId);
          const uuidTokens = compTokens.filter(isUuid);
          const extTokens = compTokens.filter((t) => !isUuid(t) && typeof t === 'string' && t.trim() !== '');

          const orParts = [
            `data->contact_ids.cs.${jsonFilter}`,
            `data->associated_contact_ids.cs.${jsonFilter}`
          ];
          if (uuidTokens.length > 0) {
            orParts.push(`id.in.(${uuidTokens.join(',')})`);
          }
          if (extTokens.length > 0) {
            const cleanExt = extTokens.map((t) => t.replace(/[,()]/g, '')).filter(Boolean);
            if (cleanExt.length > 0) {
              orParts.push(`data->>record_id__c.in.(${cleanExt.join(',')})`);
              orParts.push(`data->>hubspot_id.in.(${cleanExt.join(',')})`);
            }
          }
          query = query.or(orParts.join(','));
        } else if (relType === 'contact') {
          query = query.or(`secondary_parent_id.eq.${relId},data->contact_ids.cs.${jsonFilter},data->associated_contact_ids.cs.${jsonFilter}`);
        } else {
          query = query.or(`parent_id.eq.${relId},data->company_ids.cs.${jsonFilter},data->associated_company_ids.cs.${jsonFilter}`);
        }
      }

      query = query.range(page * pageSize, (page + 1) * pageSize - 1);

      const { data: rows, error } = await query;

      if (error) {
        console.error(`Supabase ERROR for '${objectKey}':`, error.message, error.code, error.details);
        throw { statusCode: 500, message: `Failed to fetch records for '${objectKey}': ${error.message}` };
      }

      if (!rows || rows.length === 0) {
        hasMore = false;
      } else {
        allRows = allRows.concat(rows);
        if (rows.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    return allRows.map(objectService.normalizeRecord);
  },


  /**
   * Fetch single record by ID from universal_table.
   */
  getRecordById: async (objectKey, id, organizationId) => {
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

    return objectService.normalizeRecord(row);
  },

  /**
   * Create record for any objectType in universal_table.
   */
  createRecord: async (objectKey, payload, organizationId, userId) => {
    const { definition: objDef, fields } = await metadataService.getObjectDefinition(objectKey, organizationId);

    // Map name aliases if first_name / last_name / name are present
    const fnInput = (payload.first_name || '').trim();
    const lnInput = (payload.last_name || '').trim();
    const combinedFNLN = `${fnInput} ${lnInput}`.trim();
    const rawName = (payload.name || combinedFNLN || payload.first_name || payload.title || '').trim();
    if (rawName) {
      if (!payload.name) payload.name = rawName;
      if (!payload.first_name) payload.first_name = rawName.split(' ')[0] || rawName;
      if (!payload.last_name) payload.last_name = rawName.split(' ').slice(1).join(' ') || payload.first_name;
    }

    // Validate duplicate primary and alternate email addresses and email formats
    validateDuplicateEmails(payload);
    validateEmailFormats(payload);

    // Validate required fields based on field_definitions metadata (exempt lookup relations if null/omitted)
    for (const field of fields) {
      if (field.required && field.type !== 'lookup' && (payload[field.name] === undefined || payload[field.name] === '')) {
        throw { statusCode: 400, message: `Validation Error: Field '${field.label || field.name}' is required for ${objectKey}.` };
      }
    }

    // Execute active custom validation rules
    const vErrorsCreate = await validationRuleService.validateRecord(objectKey, payload, organizationId).catch(() => []);
    if (vErrorsCreate.length > 0) {
      throw { statusCode: 400, message: vErrorsCreate.join(' | ') };
    }

    const { name, status, owner_id, parent_id, secondary_parent_id, ...customData } = payload;

    // Object-aware canonical record name resolution
    const cleanKey = String(objectKey || '').toLowerCase();
    let resolvedName = '';

    if (cleanKey === 'company' || cleanKey === 'account' || cleanKey === 'companies' || cleanKey === 'accounts') {
      const candidate = payload.name || payload.company_name || payload.account_name || (payload.data && (payload.data.name || payload.data.company_name));
      resolvedName = (!isUuid(candidate) && String(candidate || '').trim()) ? String(candidate).trim() : '';
    } else if (cleanKey === 'contact' || cleanKey === 'person' || cleanKey === 'contacts' || cleanKey === 'people') {
      const explicitName = (!isUuid(payload.name) && String(payload.name || '').trim()) ? String(payload.name).trim() : '';
      const fn = String(payload.first_name || (payload.data && payload.data.first_name) || '').trim();
      const ln = String(payload.last_name || (payload.data && payload.data.last_name) || '').trim();
      const combined = `${fn} ${ln}`.trim();
      resolvedName = explicitName || combined || (!isUuid(payload.email) && payload.email ? String(payload.email).split('@')[0] : 'Contact');
    } else if (cleanKey === 'deal' || cleanKey === 'opportunity' || cleanKey === 'deals' || cleanKey === 'opportunities') {
      const candidate = payload.name || payload.deal_name || (payload.data && (payload.data.name || payload.data.deal_name));
      resolvedName = (!isUuid(candidate) && String(candidate || '').trim()) ? String(candidate).trim() : 'New Deal';
    } else {
      const candidate = payload.name || payload.title || payload.subject || (payload.data && payload.data.name);
      resolvedName = (!isUuid(candidate) && String(candidate || '').trim()) ? String(candidate).trim() : 'Untitled';
    }

    if (!resolvedName) {
      resolvedName = (!isUuid(name) && String(name || '').trim()) ? String(name).trim() : 'Untitled';
    }

    // Explicitly set canonical data.name field to match universal_table.name
    customData.name = resolvedName;
    if (cleanKey === 'company' || cleanKey === 'account' || cleanKey === 'companies' || cleanKey === 'accounts') {
      customData.company_name = resolvedName;
    } else if (cleanKey === 'contact' || cleanKey === 'person' || cleanKey === 'contacts' || cleanKey === 'people') {
      customData.contact_name = resolvedName;
    }

    // Bi-directional alias syncing for title/job_title and lead_source/source
    const titleVal = (payload.title || payload.job_title || '').trim();
    if (titleVal) {
      customData.title = titleVal;
      customData.job_title = titleVal;
    }
    const sourceVal = (payload.lead_source || payload.source || '').trim();
    if (sourceVal) {
      customData.lead_source = sourceVal;
      customData.source = sourceVal;
    }

    const cleanObjKey = String(objectKey || '').toLowerCase();
    const isDealKey = cleanObjKey.includes('deal') || cleanObjKey.includes('opp');
    const dealTypeCreateVal = (payload.DealType || payload.deal_type || payload.dealType || (isDealKey ? payload.type : '') || '').trim();
    if (dealTypeCreateVal) {
      customData.DealType = dealTypeCreateVal;
      customData.deal_type = dealTypeCreateVal;
      if (isDealKey) customData.type = dealTypeCreateVal;
    }

    const relRes = await resolveRecordRelationships(payload, cleanObjKey, organizationId);
    let resolvedParent = relRes.resolvedParent;
    let resolvedSecondary = relRes.resolvedSecondary;

    if (resolvedParent) {
      customData.company = resolvedParent;
      customData.company_id = resolvedParent;
      customData.Company = resolvedParent;
      customData.Company_id = resolvedParent;
      if (relRes.resolvedParentName) customData.company_name = relRes.resolvedParentName;
    } else {
      customData.company = null;
      customData.company_id = null;
      customData.Company = null;
      customData.Company_id = null;
      if (relRes.companyIdInputProvided) {
        customData.company_name = null;
      } else if (relRes.resolvedParentName) {
        customData.company_name = relRes.resolvedParentName;
        customData.company = relRes.resolvedParentName;
        customData.Company = relRes.resolvedParentName;
      } else {
        customData.company_name = null;
      }
    }

    if (resolvedSecondary) {
      customData.contact = resolvedSecondary;
      customData.contact_id = resolvedSecondary;
      customData.Contact = resolvedSecondary;
      customData.Contact_id = resolvedSecondary;
      if (relRes.resolvedSecondaryName) customData.contact_name = relRes.resolvedSecondaryName;
    } else {
      customData.contact = null;
      customData.contact_id = null;
      customData.Contact = null;
      customData.Contact_id = null;
      if (relRes.contactIdInputProvided) {
        customData.contact_name = null;
      } else if (relRes.resolvedSecondaryName) {
        customData.contact_name = relRes.resolvedSecondaryName;
        customData.contact = relRes.resolvedSecondaryName;
        customData.Contact = relRes.resolvedSecondaryName;
      } else {
        customData.contact_name = null;
      }
    }

    // Guard: object_type_id must always come from metadataService — never from a hardcoded
    // fallback UUID. A hardcoded fallback would silently create data under the wrong object
    // type in any tenant whose database uses different UUIDs (all production tenants).
    if (!objDef || !objDef.id) {
      throw {
        statusCode: 400,
        message: `Cannot create record: object type '${objectKey}' could not be resolved for this organization. Please ensure the module exists and you have access.`,
      };
    }

    const newRow = {
      organization_id: organizationId,
      object_type_id: objDef.id,
      name: resolvedName,
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

    return objectService.normalizeRecord(row);
  },

  /**
   * Update record in universal_table.
   */
  updateRecord: async (objectKey, id, payload, organizationId, userId) => {
    const existing = await objectService.getRecordById(objectKey, id, organizationId);

    const { name, status, owner_id, parent_id, secondary_parent_id, ...customData } = {
      ...existing,
      ...payload,
    };

    // Execute active custom validation rules on update
    const mergedRecord = { ...existing, ...payload };
    validateDuplicateEmails(mergedRecord);
    validateEmailFormats(mergedRecord);
    const vErrorsUpdate = await validationRuleService.validateRecord(objectKey, mergedRecord, organizationId).catch(() => []);
    if (vErrorsUpdate.length > 0) {
      throw { statusCode: 400, message: vErrorsUpdate.join(' | ') };
    }

    delete customData.id;
    delete customData.organization_id;
    delete customData.created_at;
    delete customData.updated_at;
    delete customData.created_by;
    delete customData.updated_by;
    delete customData.data;

    // Generic form edits must not overwrite or wipe out relationship data
    if (String(objectKey || '').toLowerCase().includes('segment')) {
      delete customData.contact_ids;
      delete customData._version;
      const { data: latestSeg } = await dbClient
        .from('universal_table')
        .select('data')
        .eq('id', id)
        .maybeSingle();
      if (latestSeg?.data?.contact_ids) {
        customData.contact_ids = latestSeg.data.contact_ids;
      }
      if (latestSeg?.data?._version !== undefined) {
        customData._version = latestSeg.data._version;
      }
    }

    // Bi-directional alias syncing on update (prioritize payload updates over unchanged existing values)
    let titleVal = '';
    if (payload.title !== undefined && String(payload.title).trim() !== '' && String(payload.title).trim() !== String(existing.title || '').trim()) {
      titleVal = String(payload.title).trim();
    } else if (payload.job_title !== undefined && String(payload.job_title).trim() !== '' && String(payload.job_title).trim() !== String(existing.job_title || '').trim()) {
      titleVal = String(payload.job_title).trim();
    } else {
      titleVal = (payload.title || payload.job_title || customData.title || customData.job_title || '').trim();
    }
    if (titleVal) {
      customData.title = titleVal;
      customData.job_title = titleVal;
    }

    let sourceVal = '';
    if (payload.lead_source !== undefined && String(payload.lead_source).trim() !== '' && String(payload.lead_source).trim() !== String(existing.lead_source || '').trim()) {
      sourceVal = String(payload.lead_source).trim();
    } else if (payload.source !== undefined && String(payload.source).trim() !== '' && String(payload.source).trim() !== String(existing.source || '').trim()) {
      sourceVal = String(payload.source).trim();
    } else {
      sourceVal = (payload.lead_source || payload.source || customData.lead_source || customData.source || '').trim();
    }
    if (sourceVal) {
      customData.lead_source = sourceVal;
      customData.source = sourceVal;
    }

    const cleanObjKey = String(objectKey || '').toLowerCase();
    const isDealObj = cleanObjKey.includes('deal') || cleanObjKey.includes('opp');
    let dealTypeUpdateVal = '';
    if (payload.DealType !== undefined && String(payload.DealType).trim() !== '') {
      dealTypeUpdateVal = String(payload.DealType).trim();
    } else if (payload.deal_type !== undefined && String(payload.deal_type).trim() !== '') {
      dealTypeUpdateVal = String(payload.deal_type).trim();
    } else if (payload.dealType !== undefined && String(payload.dealType).trim() !== '') {
      dealTypeUpdateVal = String(payload.dealType).trim();
    } else if (isDealObj && payload.type !== undefined && String(payload.type).trim() !== '') {
      dealTypeUpdateVal = String(payload.type).trim();
    } else {
      dealTypeUpdateVal = (payload.DealType || payload.deal_type || payload.dealType || customData.DealType || customData.deal_type || customData.dealType || (isDealObj ? (payload.type || customData.type) : '') || '').trim();
    }
    if (dealTypeUpdateVal) {
      customData.DealType = dealTypeUpdateVal;
      customData.deal_type = dealTypeUpdateVal;
      if (isDealObj) customData.type = dealTypeUpdateVal;
    } else if (payload.DealType === '' || payload.DealType === null || payload.deal_type === '' || payload.deal_type === null || (isDealObj && (payload.type === '' || payload.type === null))) {
      delete customData.DealType;
      delete customData.deal_type;
      delete customData.dealType;
      if (isDealObj) delete customData.type;
    }

    // 1. Normalize & resolve Company Relationship for Update
    const payloadCompVal = extractPayloadAliasValue(payload, COMPANY_ALIASES);

    let resolvedParent = existing.parent_id;
    let isCompTextValue = false;
    let compTextVal = null;

    if (payloadCompVal !== undefined) {
      if (payloadCompVal === null || payloadCompVal === '' || payloadCompVal === 'null') {
        resolvedParent = null;
        isCompTextValue = false;
        compTextVal = null;
      } else if (isUuid(payloadCompVal)) {
        resolvedParent = payloadCompVal;
        isCompTextValue = false;
        compTextVal = null;
      } else {
        // Non-UUID text value (e.g. Lead company name like "TechMantra")
        resolvedParent = null;
        isCompTextValue = true;
        compTextVal = String(payloadCompVal).trim();
      }
    } else if (!resolvedParent && (existing.company || existing.company_name)) {
      const extComp = existing.company || existing.company_name;
      if (extComp && !isUuid(extComp)) {
        isCompTextValue = true;
        compTextVal = String(extComp).trim();
      }
    }

    // 2. Normalize & resolve Contact Relationship for Update
    const payloadContactVal = extractPayloadAliasValue(payload, CONTACT_ALIASES);

    let resolvedSecondary = existing.secondary_parent_id;
    let isContactTextValue = false;
    let contactTextVal = null;

    if (payloadContactVal !== undefined) {
      if (payloadContactVal === null || payloadContactVal === '' || payloadContactVal === 'null') {
        resolvedSecondary = null;
        isContactTextValue = false;
        contactTextVal = null;
      } else if (isUuid(payloadContactVal)) {
        resolvedSecondary = payloadContactVal;
        isContactTextValue = false;
        contactTextVal = null;
      } else {
        // Non-UUID text value
        resolvedSecondary = null;
        isContactTextValue = true;
        contactTextVal = String(payloadContactVal).trim();
      }
    } else if (!resolvedSecondary && (existing.contact || existing.contact_name)) {
      const extCont = existing.contact || existing.contact_name;
      if (extCont && !isUuid(extCont)) {
        isContactTextValue = true;
        contactTextVal = String(extCont).trim();
      }
    }

    if (resolvedParent) {
      const expectedTarget = (cleanObjKey.includes('deal') || cleanObjKey.includes('opportunity')) ? 'company' : null;
      const parentRow = await validateParentRelationship(resolvedParent, expectedTarget, organizationId, 'Company');
      if (parentRow) {
        resolvedParent = parentRow.id;
        const compName = parentRow.name || parentRow.data?.name || parentRow.data?.company_name;
        if (compName && typeof compName === 'string' && !isUuid(compName)) {
          customData.company_name = compName;
        }
      }
    }

    if (resolvedSecondary) {
      const expectedSecondaryTarget = (cleanObjKey.includes('deal') || cleanObjKey.includes('opportunity') || cleanObjKey.includes('contact')) ? 'contact' : null;
      const secondaryRow = await validateParentRelationship(resolvedSecondary, expectedSecondaryTarget, organizationId, 'Contact');
      if (secondaryRow) {
        resolvedSecondary = secondaryRow.id;
        const contName = secondaryRow.name || secondaryRow.data?.name || secondaryRow.data?.contact_name;
        if (contName && typeof contName === 'string' && !isUuid(contName)) {
          customData.contact_name = contName;
        }
      }
    }

    if (resolvedParent) {
      customData.company = resolvedParent;
      customData.company_id = resolvedParent;
      customData.Company = resolvedParent;
      customData.Company_id = resolvedParent;
    } else if (isCompTextValue && compTextVal) {
      customData.company = compTextVal;
      customData.company_name = compTextVal;
      customData.Company = compTextVal;
      customData.company_id = null;
      customData.Company_id = null;
    } else if (payloadCompVal !== undefined) {
      customData.company = null;
      customData.company_id = null;
      customData.Company = null;
      customData.Company_id = null;
      customData.company_name = null;
    }

    if (resolvedSecondary) {
      customData.contact = resolvedSecondary;
      customData.contact_id = resolvedSecondary;
      customData.Contact = resolvedSecondary;
      customData.Contact_id = resolvedSecondary;
    } else if (isContactTextValue && contactTextVal) {
      customData.contact = contactTextVal;
      customData.contact_name = contactTextVal;
      customData.Contact = contactTextVal;
      customData.contact_id = null;
      customData.Contact_id = null;
    } else if (payloadContactVal !== undefined) {
      customData.contact = null;
      customData.contact_id = null;
      customData.Contact = null;
      customData.Contact_id = null;
      customData.contact_name = null;
    }

    const finalResolvedName = name || existing.name || customData.name || 'Untitled';
    customData.name = finalResolvedName;

    const updatePayload = {
      name: finalResolvedName,
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

    return objectService.normalizeRecord(row);
  },

  /**
   * Soft delete record in universal_table.
   */
  deleteRecord: async (objectKey, id, organizationId, userId) => {
    const cleanKey = String(objectKey || '').toLowerCase();

    // Guard: Prevent deletion of Converted Leads
    if (cleanKey === 'lead' || cleanKey === 'leads' || cleanKey.includes('lead')) {
      const existing = await objectService.getRecordById(objectKey, id, organizationId).catch(() => null);
      if (existing) {
        const statusVal = String(existing.status || existing.data?.status || existing.stage || existing.data?.stage || '').toLowerCase();
        const isConverted = statusVal === 'converted' || Boolean(existing.is_converted) || Boolean(existing.data?.is_converted);

        if (isConverted) {
          throw {
            statusCode: 400,
            message: 'Converted leads cannot be deleted because they are preserved for historical tracking and linked to active Company, Contact, and Deal records.',
          };
        }
      }
    }

    // Unlink child relationship foreign keys prior to hard delete
    await supabase
      .from('universal_table')
      .update({ parent_id: null })
      .eq('parent_id', id)
      .eq('organization_id', organizationId);

    await supabase
      .from('universal_table')
      .update({ secondary_parent_id: null })
      .eq('secondary_parent_id', id)
      .eq('organization_id', organizationId);

    const { error } = await supabase
      .from('universal_table')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      throw { statusCode: 400, message: `Failed to delete ${objectKey} record: ${error.message}` };
    }

    return { success: true, message: `Record '${id}' deleted successfully.` };
  },

  /**
   * Bulk soft-delete records in universal_table.
   * Performs 1 SELECT query for all requested IDs, in-memory validation & RBAC record scope check,
   * and 1 bulk UPDATE query for authorized records.
   */
  bulkDeleteRecords: async (objectKey, ids, organizationId, user) => {
    const uniqueIds = Array.from(new Set(ids || [])).filter(Boolean);
    if (uniqueIds.length === 0) {
      return {
        success: true,
        summary: { total: 0, deleted: 0, failed: 0 },
        deletedIds: [],
        failed: [],
      };
    }

    const cleanKey = String(objectKey || '').toLowerCase();
    const keySingular = cleanKey.endsWith('s') ? cleanKey.slice(0, -1) : cleanKey;
    const keyPlural = cleanKey.endsWith('s') ? cleanKey : `${cleanKey}s`;

    // 1. Resolve object definition and permissions
    const objDefRes = await metadataService.getObjectDefinition(objectKey, organizationId);
    const targetObjectType = objDefRes?.definition || objDefRes;
    const objectTypeId = targetObjectType?.id;

    const perms = await metadataService.getPermissions(user);
    let objPerm = perms ? (perms[cleanKey] || perms[keySingular] || perms[keyPlural]) : null;

    if (!objPerm) {
      const uRole = String(user?.role || '').toLowerCase();
      const isAdmin = uRole.includes('admin');
      const isCrmManager = uRole === 'crm manager';
      const isReadOnly = uRole.includes('read only') || uRole.includes('viewer');

      if (isReadOnly) {
        objPerm = { canDelete: false, viewAll: false, modifyAll: false };
      } else {
        objPerm = { canDelete: isAdmin || isCrmManager, viewAll: isAdmin || isCrmManager, modifyAll: isAdmin };
      }
    }

    // 2. Fetch all requested records in a SINGLE query
    let fetchQuery = supabase
      .from('universal_table')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_deleted', false)
      .in('id', uniqueIds);

    if (objectTypeId) {
      fetchQuery = fetchQuery.eq('object_type_id', objectTypeId);
    }

    const { data: dbRecords, error: fetchErr } = await fetchQuery;

    if (fetchErr) {
      throw { statusCode: 400, message: `Failed to fetch records for bulk delete: ${fetchErr.message}` };
    }

    const recordMap = new Map();
    (dbRecords || []).forEach((r) => recordMap.set(r.id, r));

    const allowedIds = [];
    const failedResults = [];

    // 3. In-memory validation & RBAC evaluation for each requested ID
    for (const id of uniqueIds) {
      const record = recordMap.get(id);

      if (!record) {
        failedResults.push({ id, reason: 'Record not found, already deleted, or belongs to another organization.' });
        continue;
      }

      // Converted lead protection
      if (keySingular === 'lead') {
        const statusVal = String(record.status || record.data?.status || record.stage || record.data?.stage || '').toLowerCase();
        const isConverted = statusVal === 'converted' || Boolean(record.is_converted) || Boolean(record.data?.is_converted);

        if (isConverted) {
          failedResults.push({ id, reason: 'Converted leads cannot be deleted because they are preserved for historical tracking.' });
          continue;
        }
      }

      // Record-level scope evaluation
      const isOwner = record.owner_id === user.id || record.created_by === user.id;
      const hasFullScope = Boolean(objPerm && (objPerm.viewAll !== false || objPerm.modifyAll !== false));

      if (!hasFullScope && !isOwner) {
        failedResults.push({ id, reason: "Access Denied: You don't have permission to delete this record." });
        continue;
      }

      allowedIds.push(id);
    }

    // 4. Unlink child relationship foreign keys & perform single bulk hard-delete query
    if (allowedIds.length > 0) {
      await supabase
        .from('universal_table')
        .update({ parent_id: null })
        .in('parent_id', allowedIds)
        .eq('organization_id', organizationId);

      await supabase
        .from('universal_table')
        .update({ secondary_parent_id: null })
        .in('secondary_parent_id', allowedIds)
        .eq('organization_id', organizationId);

      const { error: deleteErr } = await supabase
        .from('universal_table')
        .delete()
        .in('id', allowedIds)
        .eq('organization_id', organizationId);

      if (deleteErr) {
        throw { statusCode: 400, message: `Failed to delete records during bulk delete: ${deleteErr.message}` };
      }
    }

    return {
      success: true,
      summary: {
        total: uniqueIds.length,
        deleted: allowedIds.length,
        failed: failedResults.length,
      },
      deletedIds: allowedIds,
      failed: failedResults,
    };
  },

  /**
   * Bulk create records for any objectType in universal_table with pre-cached metadata,
   * bulk relationship lookups, in-memory validation, and controlled failure isolation.
   * @param {Object} [options] - Optional settings.
   * @param {boolean} [options.dryRun=false] - When true, runs full processing but skips the database INSERT.
   *   Never passed from HTTP controllers. Only used by benchmark/profiling scripts.
   */
  bulkCreateRecords: async (objectKey, recordsArray, organizationId, userId, cacheContext = null, options = {}) => {
    let resolvedUserId = userId;
    let resolvedOptions = options || {};
    if (userId && typeof userId === 'object' && !isUuid(userId)) {
      resolvedOptions = userId;
      resolvedUserId = resolvedOptions.userId || null;
    }
    const dryRun = resolvedOptions.dryRun === true;
    const importMode = String(resolvedOptions.importMode || resolvedOptions.mode || 'upsert').toLowerCase().trim();
    if (!Array.isArray(recordsArray) || recordsArray.length === 0) {
      return {
        success: true,
        totalProcessed: 0,
        createdCount: 0,
        updatedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        data: [],
        results: [],
        errors: []
      };
    }

    const cleanKey = String(objectKey || '').toLowerCase();

    // 1. Pre-fetch metadata, field definitions, object types, and validation rules (or use cacheContext)
    let objDef, fields, validationRules, companyObjectType, contactObjectType;

    if (cacheContext) {
      objDef = cacheContext.objDef;
      fields = cacheContext.fields;
      validationRules = cacheContext.validationRules;
      companyObjectType = cacheContext.companyObjectType;
      contactObjectType = cacheContext.contactObjectType;
    } else {
      const defRes = await metadataService.getObjectDefinition(objectKey, organizationId);
      objDef = defRes.definition;
      fields = defRes.fields;

      validationRules = await validationRuleService.fetchResolvedRules(organizationId, {
        objectName: objDef.api_name,
        activeOnly: true,
      }).catch(() => []);

      companyObjectType = await metadataService.getObjectTypeByApiName('companies', organizationId).catch(() => null);
      contactObjectType = await metadataService.getObjectTypeByApiName('contacts', organizationId).catch(() => null);
    }

    // 2. Extract unique Company IDs/Names and Contact IDs/Names across all rows in recordsArray
    const isCompanyObject = cleanKey.includes('company') || cleanKey.includes('companies') || cleanKey.includes('account');
    const isContactObject = cleanKey.includes('contact') || cleanKey.includes('person');

    const companyIdsSet = new Set();
    const contactIdsSet = new Set();
    const companyNamesSet = new Set();
    const contactNamesSet = new Set();

    const PLACEHOLDERS = new Set(['not found', 'n/a', 'na', 'none', 'null', '-', '--', 'undefined', 'nil']);
    const isPlaceholder = (val) => {
      if (val === null || val === undefined) return true;
      return PLACEHOLDERS.has(String(val).trim().toLowerCase());
    };

    const extractMultiTokens = (val, delimiter = ';') => {
      if (val === null || val === undefined) return [];
      if (Array.isArray(val)) {
        return val.map((v) => String(v).trim()).filter((v) => Boolean(v) && !isPlaceholder(v));
      }
      const str = String(val).trim();
      if (!str || isPlaceholder(str)) return [];
      if (str.includes(delimiter)) {
        return str.split(delimiter).map((v) => v.trim()).filter((v) => Boolean(v) && !isPlaceholder(v));
      }
      return [str];
    };

    const extractedInputs = recordsArray.map((rowPayload) => {
      let companyTokens = [];
      let contactTokens = [];

      if (!isCompanyObject) {
        const candidateCompanyKeys = [
          'company_ids', 'Company IDs', 'associated_company_ids', 'Associated Company IDs', 'assoc_company_ids',
          'company', 'company_id', 'parent_id', 'Company', 'Company_id', 'primary_company_id', 'Primary Company ID',
          'Associated Company IDs (Primary)', 'associated_company_id', 'Associated Company ID', 'assoc_company_id'
        ];
        for (const k of candidateCompanyKeys) {
          if (rowPayload[k] !== undefined && rowPayload[k] !== null) {
            const toks = extractMultiTokens(rowPayload[k]);
            if (toks.length > 0) {
              companyTokens = toks;
              break;
            }
          }
        }
        if (companyTokens.length === 0) {
          const explicitCompanyNameKeys = ['company_name', 'Company Name', 'account_name', 'organization_name'];
          for (const k of explicitCompanyNameKeys) {
            if (rowPayload[k] !== undefined && rowPayload[k] !== null) {
              const toks = extractMultiTokens(rowPayload[k]);
              if (toks.length > 0) {
                companyTokens = toks;
                break;
              }
            }
          }
        }
      } else {
        const parentCompanyIdKeys = ['parent_company_id', 'parent_id', 'parent_company_uuid', 'associated_company_id', 'Associated Company ID', 'Associated Company IDs'];
        for (const k of parentCompanyIdKeys) {
          if (rowPayload[k] !== undefined && rowPayload[k] !== null) {
            const toks = extractMultiTokens(rowPayload[k]);
            if (toks.length > 0) {
              companyTokens = toks;
              break;
            }
          }
        }
      }

      if (!isContactObject) {
        const candidateContactKeys = [
          'contact_ids', 'Contact IDs', 'associated_contact_ids', 'Associated Contact IDs', 'assoc_contact_ids',
          'contact', 'contact_id', 'secondary_parent_id', 'Contact', 'Contact_id', 'primary_contact_id', 'Primary Contact ID',
          'associated_contact_id', 'Associated Contact ID', 'assoc_contact_id'
        ];
        for (const k of candidateContactKeys) {
          if (rowPayload[k] !== undefined && rowPayload[k] !== null) {
            const toks = extractMultiTokens(rowPayload[k]);
            if (toks.length > 0) {
              contactTokens = toks;
              break;
            }
          }
        }
        if (contactTokens.length === 0) {
          const explicitContactNameKeys = ['contact_name', 'Contact Name', 'person_name'];
          for (const k of explicitContactNameKeys) {
            if (rowPayload[k] !== undefined && rowPayload[k] !== null) {
              const toks = extractMultiTokens(rowPayload[k]);
              if (toks.length > 0) {
                contactTokens = toks;
                break;
              }
            }
          }
        }
      } else {
        const secondaryContactIdKeys = ['secondary_contact_id', 'secondary_parent_id'];
        for (const k of secondaryContactIdKeys) {
          if (rowPayload[k] !== undefined && rowPayload[k] !== null) {
            const toks = extractMultiTokens(rowPayload[k]);
            if (toks.length > 0) {
              contactTokens = toks;
              break;
            }
          }
        }
      }

      companyTokens.forEach((t) => {
        if (!isPlaceholder(t)) {
          if (isUuid(t)) companyIdsSet.add(t);
          else companyNamesSet.add(t.trim().toLowerCase());
        }
      });

      contactTokens.forEach((t) => {
        if (!isPlaceholder(t)) {
          if (isUuid(t)) contactIdsSet.add(t);
          else contactNamesSet.add(t.trim().toLowerCase());
        }
      });

      const firstComp = companyTokens[0];
      const isCompUuid = isUuid(firstComp);
      const companyIdInput = isCompUuid ? firstComp : (firstComp && !isPlaceholder(firstComp) ? firstComp : undefined);
      const companyNameInput = !isCompUuid && firstComp && !isPlaceholder(firstComp) ? firstComp : undefined;

      const firstCont = contactTokens[0];
      const isContUuid = isUuid(firstCont);
      const contactIdInput = isContUuid ? firstCont : (firstCont && !isPlaceholder(firstCont) ? firstCont : undefined);
      const contactNameInput = !isContUuid && firstCont && !isPlaceholder(firstCont) ? firstCont : undefined;

      return {
        companyTokens,
        contactTokens,
        companyIdInput,
        companyNameInput,
        contactIdInput,
        contactNameInput
      };
    });

    // 3. Perform bulk DB queries for relationship lookups (parallelized)
    const companyByIdMap = new Map();
    const contactByIdMap = new Map();
    const companyByNameMap = new Map();
    const companyByExternalIdMap = new Map();
    const contactByNameMap = new Map();

    // Build all relationship lookup promises upfront, then execute in parallel
    const relationshipPromises = [];

    // Company ID lookup
    if (companyIdsSet.size > 0) {
      const validUuids = Array.from(companyIdsSet).filter(id => isUuid(id));
      if (validUuids.length > 0) {
        relationshipPromises.push(
          supabase
            .from('universal_table')
            .select('id, organization_id, object_type_id, name, data, is_deleted')
            .in('id', validUuids)
            .then(({ data: rows }) => {
              (rows || []).forEach(r => companyByIdMap.set(r.id, r));
            })
        );
      }
    }

    // Contact ID lookup
    if (contactIdsSet.size > 0) {
      const validUuids = Array.from(contactIdsSet).filter(id => isUuid(id));
      if (validUuids.length > 0) {
        relationshipPromises.push(
          supabase
            .from('universal_table')
            .select('id, organization_id, object_type_id, name, data, is_deleted')
            .in('id', validUuids)
            .then(({ data: rows }) => {
              (rows || []).forEach(r => contactByIdMap.set(r.id, r));
            })
        );
      }
    }

    // Company Name and External ID lookup
    if ((companyNamesSet.size > 0 || companyIdsSet.size > 0) && companyObjectType) {
      relationshipPromises.push(
        supabase
          .from('universal_table')
          .select('id, organization_id, object_type_id, name, data, is_deleted')
          .eq('organization_id', organizationId)
          .eq('object_type_id', companyObjectType.id)
          .eq('is_deleted', false)
          .then(({ data: rows }) => {
            (rows || []).forEach(r => {
              companyByIdMap.set(r.id, r);

              const nameVal = r.name || r.data?.name || r.data?.company_name || '';
              getNormalizedKeys(nameVal).forEach(k => {
                if (!companyByNameMap.has(k)) companyByNameMap.set(k, []);
                const list = companyByNameMap.get(k);
                if (!list.some(e => e.id === r.id)) list.push(r);
              });

              const extIdVal = r.data?.record_id__c ?? r.data?.external_id ?? '';
              getNormalizedKeys(extIdVal).forEach(k => {
                if (!companyByExternalIdMap.has(k)) companyByExternalIdMap.set(k, []);
                const list = companyByExternalIdMap.get(k);
                if (!list.some(e => e.id === r.id)) list.push(r);
              });
            });
          })
      );
    }

    // Contact Name lookup
    if (contactNamesSet.size > 0 && contactObjectType) {
      relationshipPromises.push(
        supabase
          .from('universal_table')
          .select('id, organization_id, object_type_id, name, data, is_deleted')
          .eq('organization_id', organizationId)
          .eq('object_type_id', contactObjectType.id)
          .eq('is_deleted', false)
          .then(({ data: rows }) => {
            (rows || []).forEach(r => {
              const rName = String(r.name || r.data?.name || r.data?.contact_name || '').trim().toLowerCase();
              if (contactNamesSet.has(rName)) {
                if (!contactByNameMap.has(rName)) contactByNameMap.set(rName, []);
                contactByNameMap.get(rName).push(r);
              }
            });
          })
      );
    }

    // Execute all relationship lookups concurrently
    await Promise.all(relationshipPromises);

    // 4. Candidate Existing Record Identification & Cache (for Upsert / Update / Duplicate checks)
    const isSegmentObject = cleanKey.includes('segment');
    const INTERNAL_ID_KEYS = ['id', 'ID', 'record_uuid', 'crm_record_id', 'crm_record_uuid', 'CRM Record UUID', 'crm record uuid'];
    const EXTERNAL_ID_KEYS = [
      'record_id__c', 'external_id', 'hubspot_record_id', 'hubspot_reference_id',
      'HubSpot Record ID', 'hubspot record id', 'hubspot_id',
      'record_id', 'Record ID', 'Record Id', 'recordId'
    ];

    const getRowInternalId = (r) => {
      if (!r || typeof r !== 'object') return null;
      for (const k of INTERNAL_ID_KEYS) {
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
          const val = String(r[k]).trim();
          if (isUuid(val)) return val;
        }
      }
      if (r.data && typeof r.data === 'object') {
        for (const k of INTERNAL_ID_KEYS) {
          if (r.data[k] !== undefined && r.data[k] !== null && String(r.data[k]).trim() !== '') {
            const val = String(r.data[k]).trim();
            if (isUuid(val)) return val;
          }
        }
      }
      return null;
    };

    const getRawRowInternalId = (r) => {
      if (!r || typeof r !== 'object') return null;
      for (const k of INTERNAL_ID_KEYS) {
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
          return String(r[k]).trim();
        }
      }
      if (r.data && typeof r.data === 'object') {
        for (const k of INTERNAL_ID_KEYS) {
          if (r.data[k] !== undefined && r.data[k] !== null && String(r.data[k]).trim() !== '') {
            return String(r.data[k]).trim();
          }
        }
      }
      return null;
    };

    const getRowExternalId = (r) => {
      if (!r || typeof r !== 'object') return null;
      for (const k of EXTERNAL_ID_KEYS) {
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
          const val = String(r[k]).trim();
          if (!isPlaceholder(val)) return val;
        }
      }
      if (r.data && typeof r.data === 'object') {
        for (const k of EXTERNAL_ID_KEYS) {
          if (r.data[k] !== undefined && r.data[k] !== null && String(r.data[k]).trim() !== '') {
            const val = String(r.data[k]).trim();
            if (!isPlaceholder(val)) return val;
          }
        }
      }
      return null;
    };

    const getExistingRecordExternalId = (rec) => {
      if (!rec) return '';
      const recData = rec.data && typeof rec.data === 'object' ? rec.data : {};
      for (const k of ['record_id__c', 'external_id', 'hubspot_record_id', 'hubspot_reference_id']) {
        const val = recData[k];
        if (val !== undefined && val !== null && String(val).trim() !== '' && !isPlaceholder(String(val))) {
          return String(val).trim();
        }
      }
      return '';
    };

    // Load existing records for duplicate checking and candidate matching
    const { data: allExistingObjRows } = await dbClient
      .from('universal_table')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('object_type_id', objDef.id)
      .eq('is_deleted', false);

    const existingRecordsByIdMap = new Map();
    const existingByExternalIdMap = new Map(); // normExtId -> Array<record>
    const existingBySegmentIdMap = new Map();  // normSegmentId -> Array<record>
    const existingByListIdMap = new Map();     // normListId -> Array<record>
    const existingByNameMap = new Map();       // normName -> Array<record>
    const existingDbValuesMap = new Map();     // fieldName -> Map<normVal, recordId>
    const existingDbRecordsByFieldMap = new Map(); // fieldName -> Map<normVal, Array<record>>

    const uniqueFields = (fields || []).filter(f => f.unique || f.name === 'email' || f.name === 'code');
    uniqueFields.forEach(f => {
      existingDbValuesMap.set(f.name, new Map());
      existingDbRecordsByFieldMap.set(f.name, new Map());
    });

    (allExistingObjRows || []).forEach(row => {
      existingRecordsByIdMap.set(row.id, row);

      const extVals = [
        row.data?.record_id__c,
        row.data?.external_id,
        row.data?.hubspot_reference_id,
        row.data?.hubspot_record_id,
      ];
      extVals.forEach(val => {
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const norm = String(val).trim().toLowerCase();
          if (!existingByExternalIdMap.has(norm)) existingByExternalIdMap.set(norm, []);
          const list = existingByExternalIdMap.get(norm);
          if (!list.some(e => e.id === row.id)) list.push(row);
        }
      });

      if (isSegmentObject) {
        const rSegId = String(row.data?.hubspot_segment_id ?? '').trim().toLowerCase();
        const rListId = String(row.data?.hubspot_list_id ?? '').trim().toLowerCase();
        if (rSegId) {
          if (!existingBySegmentIdMap.has(rSegId)) existingBySegmentIdMap.set(rSegId, []);
          existingBySegmentIdMap.get(rSegId).push(row);
        }
        if (rListId) {
          if (!existingByListIdMap.has(rListId)) existingByListIdMap.set(rListId, []);
          existingByListIdMap.get(rListId).push(row);
        }
      }

      if (isSegmentObject || isCompanyObject) {
        const rName = String(row.name || row.data?.name || row.data?.company_name || row.data?.segment_name || '').trim().toLowerCase();
        if (rName) {
          if (!existingByNameMap.has(rName)) existingByNameMap.set(rName, []);
          existingByNameMap.get(rName).push(row);
        }
      }

      uniqueFields.forEach(f => {
        const dbVal = row.data && row.data[f.name];
        if (dbVal !== undefined && dbVal !== null && String(dbVal).trim()) {
          const normVal = String(dbVal).trim().toLowerCase();
          existingDbValuesMap.get(f.name).set(normVal, row.id);
          if (!existingDbRecordsByFieldMap.get(f.name).has(normVal)) {
            existingDbRecordsByFieldMap.get(f.name).set(normVal, []);
          }
          existingDbRecordsByFieldMap.get(f.name).get(normVal).push(row);
        }
      });
    });

    // 5. In-CSV Duplicate detection maps
    const seenCsvValuesMap = new Map();
    uniqueFields.forEach(f => seenCsvValuesMap.set(f.name, new Map())); // Map<normVal, rowNum>
    const seenCsvSegmentIdsMap = new Map(); // Map<normVal, rowNum>
    const seenCsvListIdsMap = new Map();    // Map<normVal, rowNum>
    const seenCsvExternalIdsMap = new Map(); // Map<normVal, rowNum>

    // 6. In-Memory Validation & Payload Construction Loop
    const validNewRows = [];
    const validPayloadsToReturn = [];
    const rowResults = [];
    const errorDetails = [];
    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recordsArray.length; i++) {
      const payload = recordsArray[i];
      const rowNum = payload.__rowNum || (i + 1);
      const rowIdentifier = payload.name || payload.deal_name || payload.company_name || payload.contact_name || payload.email || `Row ${rowNum}`;
      const relInputs = extractedInputs[i];

      try {
        const rawInternalId = getRawRowInternalId(payload);
        let rowExternalId = getRowExternalId(payload);

        let candidateId = null;
        let existingRecord = null;

        if (rawInternalId) {
          if (isUuid(rawInternalId)) {
            candidateId = rawInternalId;
            existingRecord = existingRecordsByIdMap.get(candidateId) || null;
          } else {
            // rawInternalId is NOT a valid UUID
            if (importMode === 'update_only') {
              throw { statusCode: 400, message: `Validation Error: Record ID '${rawInternalId}' is not a valid UUID format.` };
            } else if (importMode === 'create_only') {
              const looksLikeUuidAttemptCO = /^[0-9a-f]{8}-/i.test(rawInternalId);
              const isDisplayName = /[@\s]/.test(rawInternalId);
              if (!looksLikeUuidAttemptCO && !isDisplayName && !rowExternalId) {
                rowExternalId = rawInternalId;
              }
            } else {
              const looksLikeUuidAttempt = /^[0-9a-f]{8}-/i.test(rawInternalId);
              if (!looksLikeUuidAttempt) {
                if (!rowExternalId) rowExternalId = rawInternalId;
              } else {
                throw { statusCode: 400, message: `Validation Error: Record ID '${rawInternalId}' is not a valid UUID format.` };
              }
            }
          }
        }

        // In-CSV duplicate detection for external record ID
        if (rowExternalId) {
          const normExt = rowExternalId.toLowerCase();
          const prevRow = seenCsvExternalIdsMap.get(normExt);
          if (prevRow !== undefined && prevRow !== rowNum) {
            throw {
              statusCode: 400,
              message: `Validation Error: Duplicate Record ID '${rowExternalId}' found within the import payload (rows ${prevRow} and ${rowNum}).`
            };
          }
          seenCsvExternalIdsMap.set(normExt, rowNum);
        }

        // External-ID resolution for Segments if no direct UUID match was found
        const rowSegId = isSegmentObject ? String(payload.hubspot_segment_id ?? (payload.data && payload.data.hubspot_segment_id) ?? '').trim() : '';
        const rowListId = isSegmentObject ? String(payload.hubspot_list_id ?? (payload.data && payload.data.hubspot_list_id) ?? '').trim() : '';

        if (!existingRecord && isSegmentObject) {
          let segMatch = null;
          let listMatch = null;

          if (rowSegId) {
            const matches = existingBySegmentIdMap.get(rowSegId.toLowerCase()) || [];
            if (matches.length > 1) {
              throw { statusCode: 400, message: `Ambiguity Error: Multiple segments found with HubSpot Segment ID '${rowSegId}'.` };
            }
            if (matches.length === 1) segMatch = matches[0];
          }

          if (rowListId) {
            const matches = existingByListIdMap.get(rowListId.toLowerCase()) || [];
            if (matches.length > 1) {
              throw { statusCode: 400, message: `Ambiguity Error: Multiple segments found with HubSpot List ID '${rowListId}'.` };
            }
            if (matches.length === 1) listMatch = matches[0];
          }

          if (segMatch && listMatch && segMatch.id !== listMatch.id) {
            throw {
              statusCode: 400,
              message: `Ambiguity Error: Conflicting identifiers. HubSpot Segment ID '${rowSegId}' identifies segment '${segMatch.id}', but HubSpot List ID '${rowListId}' identifies a different segment '${listMatch.id}'.`
            };
          }

          existingRecord = segMatch || listMatch;
        }

        // Check candidateId/segment match against rowExternalId if both present
        if (existingRecord && rowExternalId) {
          const existingExtId = getExistingRecordExternalId(existingRecord);
          if (existingExtId && existingExtId.toLowerCase() !== rowExternalId.toLowerCase()) {
            throw {
              statusCode: 409,
              message: `Conflict Error: Incoming Record ID '${rowExternalId}' conflicts with existing record '${existingRecord.id}' which has Record ID '${existingExtId}'.`
            };
          }
        }

        // External-ID resolution for non-segments
        if (!existingRecord && !isSegmentObject && rowExternalId) {
          const matches = existingByExternalIdMap.get(rowExternalId.toLowerCase()) || [];
          if (matches.length > 1) {
            throw { statusCode: 400, message: `Ambiguity Error: Multiple records found with Record ID '${rowExternalId}'.` };
          }
          if (matches.length === 1) {
            existingRecord = matches[0];
          }
        }

        // Unique fields lookup (e.g. email for contacts, or unique fields)
        if (!existingRecord) {
          for (const f of uniqueFields) {
            const rawVal = payload[f.name] !== undefined ? payload[f.name] : (payload.data && payload.data[f.name]);
            if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
              const normVal = String(rawVal).trim().toLowerCase();
              const matches = existingDbRecordsByFieldMap.get(f.name)?.get(normVal) || [];
              if (matches.length > 1) {
                throw { statusCode: 400, message: `Ambiguity Error: Multiple records found matching ${f.label || f.name} '${rawVal}'.` };
              }
              if (matches.length === 1) {
                const candidateRecord = matches[0];
                const existingExtId = getExistingRecordExternalId(candidateRecord);
                if (rowExternalId && existingExtId && existingExtId.toLowerCase() !== rowExternalId.toLowerCase()) {
                  throw {
                    statusCode: 409,
                    message: `Conflict Error: Incoming Record ID '${rowExternalId}' conflicts with existing record '${candidateRecord.id}' which has Record ID '${existingExtId}' for ${f.label || f.name} '${rawVal}'.`
                  };
                }
                existingRecord = candidateRecord;
                break;
              }
            }
          }
        }

        // Name lookup for Segments and Companies ONLY when in update / upsert mode.
        // Contacts and other objects must NEVER be matched by name.
        if (!existingRecord && (importMode === 'update_only' || importMode === 'upsert') && (isSegmentObject || isCompanyObject)) {
          const rawName = String(payload.name || payload.company_name || payload.segment_name || (payload.data && payload.data.name) || '').trim().toLowerCase();
          if (rawName && existingByNameMap.has(rawName)) {
            const matches = existingByNameMap.get(rawName) || [];
            if (matches.length > 1) {
              throw { statusCode: 400, message: `Ambiguity Error: Multiple records found with name '${rawName}'.` };
            }
            if (matches.length === 1) {
              const candidateRecord = matches[0];
              const existingExtId = getExistingRecordExternalId(candidateRecord);
              if (rowExternalId && existingExtId && existingExtId.toLowerCase() !== rowExternalId.toLowerCase()) {
                throw {
                  statusCode: 409,
                  message: `Conflict Error: Incoming Record ID '${rowExternalId}' conflicts with existing record '${candidateRecord.id}' which has Record ID '${existingExtId}' for name '${rawName}'.`
                };
              }
              existingRecord = candidateRecord;
            }
          }
        }

        const naturalIdentifier = candidateId || rowSegId || rowListId || rowExternalId || payload.email || payload.name;

        if (importMode === 'update_only') {
          if (!candidateId && !rowSegId && !rowListId && !rowExternalId && !existingRecord && !payload.email && !payload.name) {
            throw { statusCode: 400, message: 'Record ID, email, name, or external identifier is required when import mode is set to Update Only.' };
          }
          if (!existingRecord) {
            throw { statusCode: 404, message: `Record '${naturalIdentifier}' was not found in ${objectKey}.` };
          }
        } else if (importMode === 'create_only') {
          if (existingRecord) {
            throw { statusCode: 400, message: `Record with identifier '${naturalIdentifier}' already exists. Import mode is set to Create Only.` };
          }
        }

        const isUpdateRow = Boolean(existingRecord && (importMode === 'upsert' || importMode === 'update_only'));

        const cleanPayload = {};
        for (const [pk, pv] of Object.entries(payload)) {
          cleanPayload[pk] = cleanImportValue(pv);
        }
        delete cleanPayload.__rowNum;
        INTERNAL_ID_KEYS.forEach(k => delete cleanPayload[k]);
        EXTERNAL_ID_KEYS.forEach(k => delete cleanPayload[k]);

        if (isSegmentObject) {
          // Normalize and strictly validate Object Type values:
          // 0-1 -> contact, 0-2 -> company, 0-3 -> deal, or lead
          if (cleanPayload.target_object_type !== undefined && cleanPayload.target_object_type !== null && String(cleanPayload.target_object_type).trim() !== '') {
            const rawTarget = String(cleanPayload.target_object_type).trim();
            const lowerTarget = rawTarget.toLowerCase();
            if (rawTarget === '0-1' || lowerTarget === 'contact' || lowerTarget === 'contacts') {
              cleanPayload.target_object_type = 'contact';
            } else if (rawTarget === '0-2' || lowerTarget === 'company' || lowerTarget === 'companies') {
              cleanPayload.target_object_type = 'company';
            } else if (rawTarget === '0-3' || lowerTarget === 'deal' || lowerTarget === 'deals') {
              cleanPayload.target_object_type = 'deal';
            } else if (lowerTarget === 'lead' || lowerTarget === 'leads') {
              cleanPayload.target_object_type = 'lead';
            } else {
              throw { statusCode: 400, message: `Validation Error: Unrecognized target_object_type '${rawTarget}'. Allowed values are 0-1 (contact), 0-2 (company), 0-3 (deal), or lead.` };
            }
          }

          // Validate and normalize Processing Type dynamically from field metadata
          if (cleanPayload.hubspot_processing_type !== undefined && cleanPayload.hubspot_processing_type !== null && String(cleanPayload.hubspot_processing_type).trim() !== '') {
            const rawProc = String(cleanPayload.hubspot_processing_type).trim();
            const procDef = (fields || []).find((f) => (f.name || f.api_name) === 'hubspot_processing_type');
            const allowedOptions = procDef?.options || procDef?.picklist_values;

            if (!Array.isArray(allowedOptions) || allowedOptions.length === 0) {
              throw {
                statusCode: 400,
                message: `Validation Error: Picklist configuration for '${procDef?.label || 'Processing Type'}' is missing or has no configured options. Cannot accept value '${rawProc}'.`
              };
            }

            const matchedOption = allowedOptions.find((opt) => String(opt).trim().toLowerCase() === rawProc.toLowerCase());
            if (matchedOption) {
              cleanPayload.hubspot_processing_type = matchedOption;
            } else {
              throw {
                statusCode: 400,
                message: `Validation Error: Invalid value '${rawProc}' for '${procDef?.label || 'Processing Type'}'. Allowed options are: ${allowedOptions.join(', ')}.`
              };
            }
          }

          // Validate and parse source_record_count: Number; non-negative integer
          if (cleanPayload.source_record_count !== undefined && cleanPayload.source_record_count !== null && String(cleanPayload.source_record_count).trim() !== '') {
            const parsedCount = Number(cleanPayload.source_record_count);
            if (isNaN(parsedCount) || !Number.isInteger(parsedCount) || parsedCount < 0) {
              throw { statusCode: 400, message: `Validation Error: 'source_record_count' must be a non-negative integer.` };
            }
            cleanPayload.source_record_count = parsedCount;
          }

          // Validate and parse 7-Day Change: signed integer (supports negative numbers like -4)
          if (cleanPayload.seven_day_change !== undefined && cleanPayload.seven_day_change !== null && String(cleanPayload.seven_day_change).trim() !== '') {
            const parsedChange = Number(cleanPayload.seven_day_change);
            if (isNaN(parsedChange) || !Number.isInteger(parsedChange)) {
              throw { statusCode: 400, message: `Validation Error: 'seven_day_change' must be an integer.` };
            }
            cleanPayload.seven_day_change = parsedChange;
          }

          // Validate and parse decimal metric fields (percentages, similarity scores)
          ['email_click_through_rate', 'email_open_rate', 'lookalike_similarity_score'].forEach((numKey) => {
            if (cleanPayload[numKey] !== undefined && cleanPayload[numKey] !== null && String(cleanPayload[numKey]).trim() !== '') {
              const parsedVal = parseFloat(cleanPayload[numKey]);
              if (isNaN(parsedVal)) {
                throw { statusCode: 400, message: `Validation Error: '${numKey}' must be a valid number.` };
              }
              cleanPayload[numKey] = parsedVal;
            }
          });

          // Validate and parse integer counts/versions
          ['hubspot_used_in_count', 'hubspot_segment_version'].forEach((intKey) => {
            if (cleanPayload[intKey] !== undefined && cleanPayload[intKey] !== null && String(cleanPayload[intKey]).trim() !== '') {
              const parsedVal = Number(cleanPayload[intKey]);
              if (isNaN(parsedVal) || !Number.isInteger(parsedVal)) {
                throw { statusCode: 400, message: `Validation Error: '${intKey}' must be an integer.` };
              }
              cleanPayload[intKey] = parsedVal;
            }
          });

          // Handle 'Type: Active' boolean separately from processing type
          if (cleanPayload['Type: Active'] !== undefined && cleanPayload.hubspot_type_active === undefined) {
            cleanPayload.hubspot_type_active = cleanPayload['Type: Active'];
          }
          delete cleanPayload['Type: Active'];
          delete cleanPayload['type:_active'];
          delete cleanPayload['type_active'];
          delete cleanPayload['type: active'];

          // Parse boolean fields (TRUE/FALSE, 1/0, yes/no)
          ['hubspot_type_active', 'is_read_only', 'generated_with_ai'].forEach((boolKey) => {
            if (cleanPayload[boolKey] !== undefined && cleanPayload[boolKey] !== null && String(cleanPayload[boolKey]).trim() !== '') {
              const lower = String(cleanPayload[boolKey]).trim().toLowerCase();
              cleanPayload[boolKey] = (lower === 'true' || lower === '1' || lower === 'yes');
            }
          });

          // Parse datetime fields to standard ISO-8601 strings
          const dateKeys = [
            'hubspot_created_at', 'hubspot_object_created_at',
            'hubspot_updated_at', 'hubspot_object_last_modified_at',
            'last_record_added_at', 'last_record_removed_at', 'owner_assigned_date'
          ];
          dateKeys.forEach((dKey) => {
            if (cleanPayload[dKey] !== undefined && cleanPayload[dKey] !== null && String(cleanPayload[dKey]).trim() !== '') {
              const dStr = String(cleanPayload[dKey]).trim();
              const dParsed = new Date(dStr);
              if (!isNaN(dParsed.getTime())) {
                cleanPayload[dKey] = dParsed.toISOString();
              }
            }
          });

          // Preserve raw HubSpot Record ID in hubspot_record_id and block mapping to internal id
          if (cleanPayload['Record ID'] !== undefined && cleanPayload.hubspot_record_id === undefined) {
            cleanPayload.hubspot_record_id = cleanPayload['Record ID'];
          }
          delete cleanPayload['Record ID'];
          delete cleanPayload.record_id;

          // In-CSV duplicate detection for HubSpot external identifiers
          if (rowSegId) {
            const normSeg = rowSegId.toLowerCase();
            const prevRow = seenCsvSegmentIdsMap.get(normSeg);
            if (prevRow !== undefined && prevRow !== rowNum) {
              throw { statusCode: 400, message: `Validation Error: Duplicate HubSpot Segment ID '${rowSegId}' found within the import payload (rows ${prevRow} and ${rowNum}).` };
            }
            seenCsvSegmentIdsMap.set(normSeg, rowNum);
          }
          if (rowListId) {
            const normList = rowListId.toLowerCase();
            const prevRow = seenCsvListIdsMap.get(normList);
            if (prevRow !== undefined && prevRow !== rowNum) {
              throw { statusCode: 400, message: `Validation Error: Duplicate HubSpot List ID '${rowListId}' found within the import payload (rows ${prevRow} and ${rowNum}).` };
            }
            seenCsvListIdsMap.set(normList, rowNum);
          }
        }

        // Canonical name derivation (run BEFORE required-field validation)
        const fnInput = (cleanPayload.first_name || '').trim();
        const lnInput = (cleanPayload.last_name || '').trim();
        const combinedFNLN = `${fnInput} ${lnInput}`.trim();
        const rawName = (cleanPayload.name || combinedFNLN || cleanPayload.first_name || cleanPayload.title || '').trim();
        if (rawName) {
          if (!cleanPayload.name) cleanPayload.name = rawName;
          if (!cleanPayload.first_name) cleanPayload.first_name = rawName.split(' ')[0] || rawName;
          if (!cleanPayload.last_name) cleanPayload.last_name = rawName.split(' ').slice(1).join(' ') || cleanPayload.first_name;
        }

        validateDuplicateEmails(cleanPayload, fields);
        validateEmailFormats(cleanPayload, fields, { isBulkImport: true });

        // Required field validation
        if (!isUpdateRow) {
          for (const field of fields) {
            if (field.required && field.type !== 'lookup' && (cleanPayload[field.name] === undefined || cleanPayload[field.name] === '')) {
              throw { statusCode: 400, message: `Validation Error: Field '${field.label || field.name}' is required for ${objectKey}.` };
            }
          }
        } else {
          for (const field of fields) {
            const existingVal = existingRecord[field.name] !== undefined ? existingRecord[field.name] : (existingRecord.data && existingRecord.data[field.name]);
            const newVal = cleanPayload[field.name];
            const hasExisting = existingVal !== undefined && existingVal !== null && String(existingVal).trim() !== '';
            const hasNew = newVal !== undefined && newVal !== null && String(newVal).trim() !== '';
            if (field.required && field.type !== 'lookup' && !hasExisting && !hasNew) {
              throw { statusCode: 400, message: `Validation Error: Field '${field.label || field.name}' is required for ${objectKey}.` };
            }
          }
        }

        // Unique field validation (against CSV payload & DB)
        for (const f of uniqueFields) {
          const rawVal = cleanPayload[f.name];
          if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
            const normVal = String(rawVal).trim().toLowerCase();
            const seenMap = seenCsvValuesMap.get(f.name);
            const dbMap = existingDbValuesMap.get(f.name);

            const prevSeenRow = seenMap.get(normVal);
            if (prevSeenRow !== undefined && prevSeenRow !== rowNum) {
              throw { statusCode: 400, message: `Validation Error: Duplicate ${f.label || f.name} '${rawVal}' found within the import payload (rows ${prevSeenRow} and ${rowNum}).` };
            }

            const dbMatches = existingDbRecordsByFieldMap.get(f.name)?.get(normVal) || [];
            const hasOtherDbOwner = dbMatches.some(r => !isUpdateRow || r.id !== existingRecord?.id);
            if (hasOtherDbOwner) {
              throw { statusCode: 400, message: `Validation Error: ${f.label || f.name} '${rawVal}' already exists.` };
            }

            seenMap.set(normVal, rowNum);
          }
        }

        // Custom validation rules (in-memory)
        const vErrors = [];
        const payloadToValidate = isUpdateRow ? { ...(existingRecord.data || {}), ...cleanPayload } : cleanPayload;
        (validationRules || []).forEach(rule => {
          const isValid = validationRuleService.evaluateRule(rule, payloadToValidate);
          if (!isValid) {
            vErrors.push(rule.error_message || `Validation rule '${rule.rule_name}' failed.`);
          }
        });
        if (vErrors.length > 0) {
          throw { statusCode: 400, message: vErrors.join(' | ') };
        }

        const { name, status, owner_id, parent_id, secondary_parent_id, ...customData } = cleanPayload;
        INTERNAL_ID_KEYS.forEach(k => delete customData[k]);
        if (rowExternalId && !customData.record_id__c) {
          customData.record_id__c = rowExternalId;
        }

        let resolvedName = '';
        if (cleanKey === 'company' || cleanKey === 'account' || cleanKey === 'companies' || cleanKey === 'accounts') {
          const candidate = cleanPayload.name || cleanPayload.company_name || cleanPayload.account_name || (cleanPayload.data && (cleanPayload.data.name || cleanPayload.data.company_name));
          resolvedName = (!isUuid(candidate) && String(candidate || '').trim()) ? String(candidate).trim() : '';
        } else if (cleanKey === 'contact' || cleanKey === 'person' || cleanKey === 'contacts' || cleanKey === 'people') {
          const explicitName = (!isUuid(cleanPayload.name) && String(cleanPayload.name || '').trim()) ? String(cleanPayload.name).trim() : '';
          const fn = String(cleanPayload.first_name || (cleanPayload.data && cleanPayload.data.first_name) || '').trim();
          const ln = String(cleanPayload.last_name || (cleanPayload.data && cleanPayload.data.last_name) || '').trim();
          const combined = `${fn} ${ln}`.trim();
          resolvedName = explicitName || combined || (!isUuid(cleanPayload.email) && cleanPayload.email ? String(cleanPayload.email).split('@')[0] : (isUpdateRow ? existingRecord.name : 'Contact'));
        } else if (cleanKey === 'deal' || cleanKey === 'opportunity' || cleanKey === 'deals' || cleanKey === 'opportunities') {
          const candidate = cleanPayload.name || cleanPayload.deal_name || (cleanPayload.data && (cleanPayload.data.name || cleanPayload.data.deal_name));
          resolvedName = (!isUuid(candidate) && String(candidate || '').trim()) ? String(candidate).trim() : (isUpdateRow ? existingRecord.name : 'New Deal');
        } else {
          const candidate = cleanPayload.name || cleanPayload.title || cleanPayload.subject || (cleanPayload.data && cleanPayload.data.name);
          resolvedName = (!isUuid(candidate) && String(candidate || '').trim()) ? String(candidate).trim() : (isUpdateRow ? existingRecord.name : 'Untitled');
        }

        if (!resolvedName) resolvedName = (!isUuid(name) && String(name || '').trim()) ? String(name).trim() : (isUpdateRow ? existingRecord.name : 'Untitled');
        customData.name = resolvedName;

        // Bi-directional alias syncing
        const titleVal = (cleanPayload.title || cleanPayload.job_title || '').trim();
        if (titleVal) { customData.title = titleVal; customData.job_title = titleVal; }
        const sourceVal = (cleanPayload.lead_source || cleanPayload.source || '').trim();
        if (sourceVal) { customData.lead_source = sourceVal; customData.source = sourceVal; }

        // Company Relationship Resolution (supports single and multi-record associations)
        let resolvedParent = null;
        let resolvedParentName = null;
        let resolvedCompanyIds = [];

        const companyField = (fields || []).find(
          (f) => (f.name === 'company' || f.name === 'parent_id' || f.name === 'company_id') && f.type === 'lookup'
        );
        const isCompanyRequired = !!companyField?.required;

        const compTokens = (relInputs.companyTokens && relInputs.companyTokens.length > 0)
          ? relInputs.companyTokens
          : (relInputs.companyIdInput ? [relInputs.companyIdInput] : (relInputs.companyNameInput ? [relInputs.companyNameInput] : []));

        if (compTokens.length > 0) {
          for (const token of compTokens) {
            if (isPlaceholder(token)) continue;
            if (isUuid(token)) {
              const parentRow = companyByIdMap.get(token);
              if (!parentRow || parentRow.is_deleted) {
                throw { statusCode: 400, message: `Validation Error: Company ID '${token}' was not found.` };
              }
              if (parentRow.organization_id !== organizationId) {
                throw { statusCode: 403, message: `Validation Error: Company ID '${token}' does not belong to the current organization.` };
              }
              if (companyObjectType && parentRow.object_type_id !== companyObjectType.id) {
                throw { statusCode: 400, message: `Validation Error: The referenced record '${token}' is not a Company object type.` };
              }
              resolvedCompanyIds.push(parentRow.id);
              if (!resolvedParentName) {
                resolvedParentName = parentRow.name || parentRow.data?.name || parentRow.data?.company_name || 'Company';
              }
            } else {
              let extMatches = [];
              for (const k of getNormalizedKeys(token)) {
                if (companyByExternalIdMap.has(k)) {
                  extMatches = companyByExternalIdMap.get(k);
                  break;
                }
              }
              if (extMatches.length > 1) {
                throw { statusCode: 400, message: `Validation Error: Multiple Companies found with external ID '${token}'.` };
              }
              if (extMatches.length === 1) {
                resolvedCompanyIds.push(extMatches[0].id);
                if (!resolvedParentName) {
                  resolvedParentName = extMatches[0].name || extMatches[0].data?.name || extMatches[0].data?.company_name || token;
                }
              } else {
                let nameMatches = [];
                for (const k of getNormalizedKeys(token)) {
                  if (companyByNameMap.has(k)) {
                    nameMatches = companyByNameMap.get(k);
                    break;
                  }
                }
                if (nameMatches.length > 1) {
                  throw { statusCode: 400, message: `Validation Error: Multiple Companies found with the name '${token}'. Please provide Company ID.` };
                }
                if (nameMatches.length === 1) {
                  resolvedCompanyIds.push(nameMatches[0].id);
                  if (!resolvedParentName) {
                    resolvedParentName = nameMatches[0].name || nameMatches[0].data?.name || nameMatches[0].data?.company_name || token;
                  }
                } else {
                  throw { statusCode: 400, message: `Validation Error: Company reference '${token}' was not found.` };
                }
              }
            }
          }
          resolvedCompanyIds = [...new Set(resolvedCompanyIds)];
          if (resolvedCompanyIds.length > 0) {
            resolvedParent = resolvedCompanyIds[0];
          } else if (isCompanyRequired) {
            throw { statusCode: 400, message: `Validation Error: Field '${companyField?.label || 'Company'}' is required for ${objectKey}.` };
          }
        } else if (isUpdateRow) {
          resolvedParent = existingRecord.parent_id;
          resolvedParentName = existingRecord.data?.company_name || null;
          resolvedCompanyIds = Array.isArray(existingRecord.data?.company_ids)
            ? existingRecord.data.company_ids
            : (Array.isArray(existingRecord.data?.associated_company_ids)
              ? existingRecord.data.associated_company_ids
              : (existingRecord.parent_id ? [existingRecord.parent_id] : []));
        } else if (isCompanyRequired) {
          throw { statusCode: 400, message: `Validation Error: Field '${companyField?.label || 'Company'}' is required for ${objectKey}.` };
        }

        if (resolvedCompanyIds.length > 0) {
          customData.company_ids = resolvedCompanyIds;
          customData.associated_company_ids = resolvedCompanyIds;
          customData.company = resolvedParent;
          customData.company_id = resolvedParent;
          customData.Company = resolvedParent;
          customData.Company_id = resolvedParent;
          if (resolvedParentName) customData.company_name = resolvedParentName;
        } else if (!isCompanyObject) {
          if (!isUpdateRow) {
            customData.company = null; customData.company_id = null; customData.Company = null; customData.Company_id = null;
            customData.company_ids = [];
            customData.associated_company_ids = [];
            if (relInputs.companyIdInput !== undefined) customData.company_name = null;
            else customData.company_name = resolvedParentName || null;
          }
        } else {
          customData.company_name = resolvedName;
        }

        // Contact Relationship Resolution (supports single and multi-record associations)
        let resolvedSecondary = null;
        let resolvedSecondaryName = null;
        let resolvedContactIds = [];

        const contTokens = (relInputs.contactTokens && relInputs.contactTokens.length > 0)
          ? relInputs.contactTokens
          : (relInputs.contactIdInput ? [relInputs.contactIdInput] : (relInputs.contactNameInput ? [relInputs.contactNameInput] : []));

        if (contTokens.length > 0) {
          for (const token of contTokens) {
            if (isPlaceholder(token)) continue;
            if (isUuid(token)) {
              const secRow = contactByIdMap.get(token);
              if (!secRow || secRow.is_deleted) {
                throw { statusCode: 400, message: `Validation Error: Contact ID '${token}' was not found.` };
              }
              if (secRow.organization_id !== organizationId) {
                throw { statusCode: 403, message: `Validation Error: Contact ID '${token}' does not belong to the current organization.` };
              }
              if (contactObjectType && secRow.object_type_id !== contactObjectType.id) {
                throw { statusCode: 400, message: `Validation Error: The referenced record '${token}' is not a Contact object type.` };
              }
              resolvedContactIds.push(secRow.id);
              if (!resolvedSecondaryName) {
                resolvedSecondaryName = secRow.name || secRow.data?.name || secRow.data?.contact_name || 'Contact';
              }
            } else {
              const cleanContactName = token.trim().toLowerCase();
              const matches = contactByNameMap.get(cleanContactName) || [];
              if (matches.length > 1) {
                throw { statusCode: 400, message: `Validation Error: Multiple Contacts found with the name '${token}'. Please provide Contact ID.` };
              }
              if (matches.length === 1) {
                resolvedContactIds.push(matches[0].id);
                if (!resolvedSecondaryName) {
                  resolvedSecondaryName = matches[0].name || matches[0].data?.name || matches[0].data?.contact_name || token;
                }
              } else {
                if (cleanKey.includes('deal') || cleanKey.includes('opportunity')) {
                  throw { statusCode: 400, message: `Validation Error: Contact '${token}' was not found. Please provide a valid Contact Name or Contact ID.` };
                } else {
                  resolvedSecondaryName = token;
                }
              }
            }
          }
          resolvedContactIds = [...new Set(resolvedContactIds)];
          if (resolvedContactIds.length > 0) {
            resolvedSecondary = resolvedContactIds[0];
          }
        } else if (isUpdateRow) {
          resolvedSecondary = existingRecord.secondary_parent_id;
          resolvedSecondaryName = existingRecord.data?.contact_name || null;
          resolvedContactIds = Array.isArray(existingRecord.data?.contact_ids)
            ? existingRecord.data.contact_ids
            : (Array.isArray(existingRecord.data?.associated_contact_ids)
              ? existingRecord.data.associated_contact_ids
              : (existingRecord.secondary_parent_id ? [existingRecord.secondary_parent_id] : []));
        }

        if (resolvedContactIds.length > 0) {
          customData.contact_ids = resolvedContactIds;
          customData.associated_contact_ids = resolvedContactIds;
          customData.contact = resolvedSecondary;
          customData.contact_id = resolvedSecondary;
          customData.Contact = resolvedSecondary;
          customData.Contact_id = resolvedSecondary;
          if (resolvedSecondaryName) customData.contact_name = resolvedSecondaryName;
        } else if (!isContactObject) {
          if (!isUpdateRow) {
            customData.contact = null; customData.contact_id = null; customData.Contact = null; customData.Contact_id = null;
            customData.contact_ids = [];
            customData.associated_contact_ids = [];
            if (relInputs.contactIdInput !== undefined) customData.contact_name = null;
            else customData.contact_name = resolvedSecondaryName || null;
          }
        } else {
          customData.contact_name = resolvedName;
        }

        // UPDATE BRANCH: Merge non-blank values into existing record and persist
        if (isUpdateRow) {
          const existingData = (existingRecord.data && typeof existingRecord.data === 'object') ? { ...existingRecord.data } : {};
          const mergedCustomData = { ...existingData };

          // Only merge non-blank values so empty cells in CSV don't overwrite existing values
          for (const [k, v] of Object.entries(customData)) {
            if (k.startsWith('__strategy_')) continue;
            if (Array.isArray(v)) {
              if (v.length > 0) {
                const strat = cleanPayload[`__strategy_${k}`] || 'merge';
                if (strat === 'replace') {
                  mergedCustomData[k] = [...new Set(v)];
                } else {
                  const existingArr = Array.isArray(existingData[k]) ? existingData[k] : (existingData[k] ? [existingData[k]] : []);
                  mergedCustomData[k] = [...new Set([...existingArr, ...v])];
                }
              }
            } else if (v !== undefined && v !== null && String(v).trim() !== '') {
              mergedCustomData[k] = v;
            }
          }

          // Ensure incoming external ID is never silently discarded if the record didn't have one
          if (rowExternalId && (!mergedCustomData.record_id__c || String(mergedCustomData.record_id__c).trim() === '')) {
            mergedCustomData.record_id__c = rowExternalId;
          }

          // Ensure relationship contact_ids and _version are preserved and cannot be overwritten by CSV import
          if (cleanKey.includes('segment')) {
            delete customData._version;
            mergedCustomData._version = existingData._version !== undefined ? existingData._version : 1;

            const segContactTokens = extractMultiTokens(cleanPayload.contact_ids || cleanPayload.contact_id || cleanPayload['Associated Contact IDs']);
            const validIncomingUuids = segContactTokens.filter(isUuid);

            if (validIncomingUuids.length > 0) {
              const strat = cleanPayload.__strategy_contact_ids || 'merge';
              const existingIds = Array.isArray(existingData.contact_ids) ? existingData.contact_ids : [];
              if (strat === 'replace') {
                mergedCustomData.contact_ids = [...new Set(validIncomingUuids)];
              } else {
                mergedCustomData.contact_ids = [...new Set([...existingIds, ...validIncomingUuids])];
              }
            } else {
              mergedCustomData.contact_ids = Array.isArray(existingData.contact_ids) ? existingData.contact_ids : [];
            }
          }

          if (resolvedCompanyIds.length > 0) {
            const compStrat = cleanPayload.__strategy_company_ids || cleanPayload.__strategy_company || cleanPayload.__strategy_parent_id || 'merge';
            const existingCompIds = Array.isArray(existingData.company_ids)
              ? existingData.company_ids
              : (Array.isArray(existingData.associated_company_ids)
                ? existingData.associated_company_ids
                : (existingRecord.parent_id ? [existingRecord.parent_id] : []));
            if (compStrat === 'replace') {
              mergedCustomData.company_ids = resolvedCompanyIds;
              mergedCustomData.associated_company_ids = resolvedCompanyIds;
              resolvedParent = resolvedCompanyIds[0] || existingRecord.parent_id;
            } else {
              const unionList = [...new Set([...existingCompIds, ...resolvedCompanyIds])];
              mergedCustomData.company_ids = unionList;
              mergedCustomData.associated_company_ids = unionList;
              resolvedParent = existingRecord.parent_id || resolvedCompanyIds[0];
            }
          }

          if (resolvedContactIds.length > 0) {
            const contStrat = cleanPayload.__strategy_contact_ids || cleanPayload.__strategy_contact || cleanPayload.__strategy_secondary_parent_id || 'merge';
            const existingContIds = Array.isArray(existingData.contact_ids)
              ? existingData.contact_ids
              : (Array.isArray(existingData.associated_contact_ids)
                ? existingData.associated_contact_ids
                : (existingRecord.secondary_parent_id ? [existingRecord.secondary_parent_id] : []));
            if (contStrat === 'replace') {
              mergedCustomData.contact_ids = resolvedContactIds;
              mergedCustomData.associated_contact_ids = resolvedContactIds;
              resolvedSecondary = resolvedContactIds[0] || existingRecord.secondary_parent_id;
            } else {
              const unionList = [...new Set([...existingContIds, ...resolvedContactIds])];
              mergedCustomData.contact_ids = unionList;
              mergedCustomData.associated_contact_ids = unionList;
              resolvedSecondary = existingRecord.secondary_parent_id || resolvedContactIds[0];
            }
          }

          let finalName = existingRecord.name;
          if (cleanPayload.name && String(cleanPayload.name).trim() !== '') {
            finalName = String(cleanPayload.name).trim();
          } else if (cleanPayload.first_name || cleanPayload.last_name) {
            const fn = String(cleanPayload.first_name || mergedCustomData.first_name || '').trim();
            const ln = String(cleanPayload.last_name || mergedCustomData.last_name || '').trim();
            const comb = `${fn} ${ln}`.trim();
            if (comb) finalName = comb;
          }
          mergedCustomData.name = finalName;

          if (resolvedParent) {
            mergedCustomData.company = resolvedParent;
            mergedCustomData.company_id = resolvedParent;
            mergedCustomData.Company = resolvedParent;
            mergedCustomData.Company_id = resolvedParent;
            if (resolvedParentName) mergedCustomData.company_name = resolvedParentName;
          }

          if (resolvedSecondary) {
            mergedCustomData.contact = resolvedSecondary;
            mergedCustomData.contact_id = resolvedSecondary;
            mergedCustomData.Contact = resolvedSecondary;
            mergedCustomData.Contact_id = resolvedSecondary;
            if (resolvedSecondaryName) mergedCustomData.contact_name = resolvedSecondaryName;
          }

          const statusVal = (status && String(status).trim() !== '') ? status : existingRecord.status;
          const ownerVal = (owner_id && String(owner_id).trim() !== '') ? owner_id : existingRecord.owner_id;

          if (dryRun) {
            updatedCount++;
            rowResults.push({
              rowNumber: rowNum,
              identifier: String(rowIdentifier).trim(),
              status: 'dry_run',
              recordId: existingRecord.id,
              error: null
            });
          } else {
            const updatePayload = {
              name: finalName,
              status: statusVal,
              owner_id: ownerVal,
              parent_id: resolvedParent,
              secondary_parent_id: resolvedSecondary,
              data: mergedCustomData,
              updated_by: userId || null,
              updated_at: new Date().toISOString()
            };

            const { data: updatedRow, error: updateErr } = await dbClient
              .from('universal_table')
              .update(updatePayload)
              .eq('id', existingRecord.id)
              .eq('organization_id', organizationId)
              .select()
              .single();

            if (updateErr) {
              throw { statusCode: 400, message: `Failed to update record '${existingRecord.id}': ${updateErr.message}` };
            }

            const normRecord = objectService.normalizeRecord(updatedRow);
            updatedCount++;
            validPayloadsToReturn.push({ ...normRecord, __rowNum: rowNum });
            rowResults.push({
              rowNumber: rowNum,
              identifier: String(rowIdentifier).trim(),
              status: 'updated',
              recordId: normRecord.id,
              error: null
            });
          }
          continue;
        }

        if (cleanKey.includes('segment')) {
          delete customData._version;
          customData._version = 1;
          const segContactTokens = extractMultiTokens(cleanPayload.contact_ids || cleanPayload.contact_id || cleanPayload['Associated Contact IDs']);
          const validIncomingUuids = segContactTokens.filter(isUuid);
          customData.contact_ids = [...new Set(validIncomingUuids)];
        }

        const newRow = {
          organization_id: organizationId,
          object_type_id: objDef.id,
          name: resolvedName,
          status: status || 'Active',
          owner_id: owner_id || userId || null,
          parent_id: resolvedParent,
          secondary_parent_id: resolvedSecondary,
          data: customData,
          created_by: userId || null,
          created_at: new Date().toISOString(),
          __rowNum: rowNum,
          __rowIdentifier: rowIdentifier
        };

        validNewRows.push(newRow);
      } catch (err) {
        failedCount++;
        const errMsg = err.message || err.error || `Failed to process ${objectKey} record.`;
        errorDetails.push({ rowNum, identifier: String(rowIdentifier).trim(), reason: errMsg, error: errMsg });
        rowResults.push({ rowNumber: rowNum, identifier: String(rowIdentifier).trim(), status: 'failed', recordId: null, error: errMsg });
      }
    }

    // 6. Pre-insert concurrency deduplication for Segments
    if (validNewRows.length > 0 && !dryRun && isSegmentObject) {
      const segIds = validNewRows.map(r => r.data?.hubspot_segment_id).filter(Boolean);
      const listIds = validNewRows.map(r => r.data?.hubspot_list_id).filter(Boolean);
      if (segIds.length > 0 || listIds.length > 0) {
        const { data: latestRows } = await dbClient
          .from('universal_table')
          .select('id, data')
          .eq('organization_id', organizationId)
          .eq('object_type_id', objDef.id)
          .eq('is_deleted', false);

        if (latestRows && latestRows.length > 0) {
          const latestSegMap = new Map();
          const latestListMap = new Map();
          latestRows.forEach(r => {
            const sid = String(r.data?.hubspot_segment_id || '').trim().toLowerCase();
            const lid = String(r.data?.hubspot_list_id || '').trim().toLowerCase();
            if (sid) latestSegMap.set(sid, r.id);
            if (lid) latestListMap.set(lid, r.id);
          });

          for (let idx = validNewRows.length - 1; idx >= 0; idx--) {
            const r = validNewRows[idx];
            const rSeg = String(r.data?.hubspot_segment_id || '').trim().toLowerCase();
            const rList = String(r.data?.hubspot_list_id || '').trim().toLowerCase();
            const collisionId = (rSeg && latestSegMap.get(rSeg)) || (rList && latestListMap.get(rList));
            if (collisionId) {
              const collidingKey = (rSeg && latestSegMap.has(rSeg)) ? r.data.hubspot_segment_id : r.data.hubspot_list_id;
              failedCount++;
              const errMsg = `Unique Constraint Violation: Segment with external identifier '${collidingKey}' was already created concurrently.`;
              errorDetails.push({ rowNum: r.__rowNum, identifier: String(r.__rowIdentifier).trim(), reason: errMsg, error: errMsg });
              rowResults.push({
                rowNumber: r.__rowNum,
                identifier: String(r.__rowIdentifier).trim(),
                status: 'failed',
                recordId: null,
                error: errMsg
              });
              validNewRows.splice(idx, 1);
            }
          }
        }
      }
    }

    // 7. Bulk Insert Valid Rows into universal_table with Controlled Backend Isolation
    if (validNewRows.length > 0 && !dryRun) {
      const rowsToInsert = validNewRows.map(r => {
        const copy = { ...r };
        delete copy.__rowNum;
        delete copy.__rowIdentifier;
        return copy;
      });

      const { data: insertedData, error: bulkInsertErr } = await supabase
        .from('universal_table')
        .insert(rowsToInsert)
        .select();

      if (!bulkInsertErr && Array.isArray(insertedData)) {
        insertedData.forEach((row, idx) => {
          const normRecord = objectService.normalizeRecord(row);
          const origRow = validNewRows[idx];
          const rowNum = origRow.__rowNum;
          const rowIdentifier = origRow.__rowIdentifier;

          createdCount++;
          validPayloadsToReturn.push({ ...normRecord, __rowNum: rowNum });
          rowResults.push({
            rowNumber: rowNum,
            identifier: String(rowIdentifier).trim(),
            status: 'imported',
            recordId: normRecord.id,
            error: null
          });
        });
      } else {
        // Bulk INSERT failed (e.g. database constraint error).
        // Fallback: isolate rows server-side inside backend request loop
        console.warn(`Bulk insert error for ${objectKey}, isolating rows server-side:`, bulkInsertErr?.message);

        for (let i = 0; i < validNewRows.length; i++) {
          const origRow = validNewRows[i];
          const singlePayload = { ...origRow };
          const rowNum = singlePayload.__rowNum;
          const rowIdentifier = singlePayload.__rowIdentifier;
          delete singlePayload.__rowNum;
          delete singlePayload.__rowIdentifier;

          const { data: singleInserted, error: singleErr } = await supabase
            .from('universal_table')
            .insert([singlePayload])
            .select()
            .single();

          if (!singleErr && singleInserted) {
            const normRecord = objectService.normalizeRecord(singleInserted);
            createdCount++;
            validPayloadsToReturn.push({ ...normRecord, __rowNum: rowNum });
            rowResults.push({
              rowNumber: rowNum,
              identifier: String(rowIdentifier).trim(),
              status: 'imported',
              recordId: normRecord.id,
              error: null
            });
          } else {
            failedCount++;
            const errMsg = singleErr?.message || 'Database Insertion Error';
            errorDetails.push({ rowNum, identifier: String(rowIdentifier).trim(), reason: errMsg, error: errMsg });
            rowResults.push({
              rowNumber: rowNum,
              identifier: String(rowIdentifier).trim(),
              status: 'failed',
              recordId: null,
              error: errMsg
            });
          }
        }
      }
    } else if (validNewRows.length > 0 && dryRun) {
      // DRY RUN: Skip INSERT entirely. Report valid rows as dry_run status.
      validNewRows.forEach(origRow => {
        const rowNum = origRow.__rowNum;
        const rowIdentifier = origRow.__rowIdentifier;
        createdCount++;
        rowResults.push({
          rowNumber: rowNum,
          identifier: String(rowIdentifier).trim(),
          status: 'dry_run',
          recordId: null,
          error: null
        });
      });
    }

    rowResults.sort((a, b) => a.rowNumber - b.rowNumber);

    return {
      success: (createdCount > 0 || updatedCount > 0),
      totalProcessed: recordsArray.length,
      createdCount,
      updatedCount,
      failedCount,
      skippedCount: 0,
      data: validPayloadsToReturn,
      results: rowResults,
      errors: errorDetails
    };
  },
};

module.exports = objectService;

