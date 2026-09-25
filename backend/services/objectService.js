const supabase = require('../config/supabase');
const metadataService = require('./metadataService');
const validationRuleService = require('./validationRuleService');

// Helper to validate UUID format to prevent PostgreSQL syntax errors
const isUuid = (val) => Boolean(val && typeof val === 'string' && /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.test(val.trim()));

// Helper to validate that Primary Email and Alternate Email ID are not identical
const validateDuplicateEmails = (payload) => {
  if (!payload || typeof payload !== 'object') return;

  const getEmailVal = (keys) => {
    for (const k of keys) {
      const v = payload[k] !== undefined ? payload[k] : (payload.data && typeof payload.data === 'object' ? payload.data[k] : undefined);
      if (v && typeof v === 'string' && v.trim() !== '') {
        return v.trim().toLowerCase();
      }
    }
    return '';
  };

  const primaryEmailKeys = ['email', 'work_email', 'primary_email', 'email_address'];
  const altEmailKeys = ['alternate_email', 'alternate_email_id', 'secondary_email', 'alt_email', 'other_email', 'email_2', 'email2', 'alternate_email_address'];

  const primary = getEmailVal(primaryEmailKeys);
  const alt = getEmailVal(altEmailKeys);

  if (primary && alt && primary === alt) {
    throw {
      statusCode: 400,
      message: 'Validation Error: Primary Email and Alternate Email ID cannot be the same address.'
    };
  }
};

// Helper to validate email format for all primary and alternate email fields
const validateEmailFormats = (payload) => {
  if (!payload || typeof payload !== 'object') return;

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;
  const emailKeys = [
    'email', 'work_email', 'primary_email', 'email_address',
    'alternate_email', 'alternate_email_id', 'secondary_email', 'alt_email', 'other_email', 'email_2', 'email2', 'alternate_email_address'
  ];

  for (const [key, rawVal] of Object.entries(payload)) {
    if (rawVal === undefined || rawVal === null || key === 'data') continue;
    const val = String(rawVal).trim();
    if (!val) continue;

    const lowerKey = key.toLowerCase();
    const isEmailField = emailKeys.includes(lowerKey) || lowerKey.includes('email');

    if (isEmailField && !emailRegex.test(val)) {
      const fieldLabel = (lowerKey.includes('alternate') || lowerKey.includes('secondary') || lowerKey.includes('alt') || lowerKey.includes('other') || lowerKey.includes('2'))
        ? 'Alternate Email ID'
        : 'Email Address';
      throw {
        statusCode: 400,
        message: `Validation Error: Please enter a valid email address for ${fieldLabel} (e.g. user@company.com).`
      };
    }
  }

  if (payload.data && typeof payload.data === 'object') {
    validateEmailFormats(payload.data);
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
 * Normalizes incoming payload to extract the canonical alias value for Company or Contact.
 * Follows ID precedence order. Returns undefined if no relationship alias is present in payload.
 */
const extractPayloadAliasValue = (payload, aliases) => {
  for (const key of aliases) {
    if (payload[key] !== undefined) {
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

    // Harmonize alias fields for Job Title, Designation/Role, Address/Country, Employees, Lead Source
    const titleVal = dataObj.title || dataObj.job_title || '';
    const designationVal = dataObj.designation || dataObj.role || '';
    const addressVal = dataObj.address || dataObj.country || '';
    const employeesVal = dataObj.number_of_employees || dataObj.company_size || '';
    const sourceVal = dataObj.lead_source || dataObj.source || '';
    const stageVal = dataObj.stage || dataObj.Stage || null;

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

      query = query.order('created_at', { ascending: false });
      query = query.range((reqPage - 1) * reqPageSize, reqPage * reqPageSize - 1);

      const { data: rows, count, error } = await query;

      if (error) {
        if ((error.code === 'PGRST103' || (error.message && error.message.includes('range not satisfiable'))) && reqPage > 1) {
          return objectService.listRecords(objectKey, organizationId, { ...options, page: 1 });
        }
        console.error(`Supabase ERROR for '${objectKey}':`, error.message, error.code, error.details);
        throw { statusCode: 500, message: `Failed to fetch records for '${objectKey}': ${error.message}` };
      }

      const normalizedData = (rows || []).map(objectService.normalizeRecord);
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
    const rawName = (payload.name || payload.first_name || payload.title || '').trim();
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

    const newRow = {
      organization_id: organizationId,
      object_type_id: objDef.id || 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41',
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
    const dryRun = options.dryRun === true;
    if (!Array.isArray(recordsArray) || recordsArray.length === 0) {
      return {
        success: true,
        totalProcessed: 0,
        createdCount: 0,
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
    const companyIdsSet = new Set();
    const contactIdsSet = new Set();
    const companyNamesSet = new Set();
    const contactNamesSet = new Set();

    const extractedInputs = recordsArray.map((rowPayload) => {
      let companyIdInput = undefined;
      let companyNameInput = undefined;
      let contactIdInput = undefined;
      let contactNameInput = undefined;

      const explicitCompanyIdKeys = ['company_id', 'Company ID', 'CompanyId', 'Company_id', 'company_uuid', 'parent_id'];
      for (const k of explicitCompanyIdKeys) {
        if (rowPayload[k] !== undefined && rowPayload[k] !== null && String(rowPayload[k]).trim() !== '') {
          companyIdInput = String(rowPayload[k]).trim();
          break;
        }
      }
      if (companyIdInput === undefined) {
        const rawComp = rowPayload.company !== undefined ? rowPayload.company : rowPayload.Company;
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
          if (rowPayload[k] !== undefined && rowPayload[k] !== null && String(rowPayload[k]).trim() !== '') {
            const nameStr = String(rowPayload[k]).trim();
            if (!isUuid(nameStr)) {
              companyNameInput = nameStr;
              break;
            }
          }
        }
      }

      const explicitContactIdKeys = ['contact_id', 'Contact ID', 'ContactId', 'Contact_id', 'contact_uuid', 'secondary_parent_id'];
      for (const k of explicitContactIdKeys) {
        if (rowPayload[k] !== undefined && rowPayload[k] !== null && String(rowPayload[k]).trim() !== '') {
          contactIdInput = String(rowPayload[k]).trim();
          break;
        }
      }
      if (contactIdInput === undefined) {
        const rawCont = rowPayload.contact !== undefined ? rowPayload.contact : rowPayload.Contact;
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
          if (rowPayload[k] !== undefined && rowPayload[k] !== null && String(rowPayload[k]).trim() !== '') {
            const nameStr = String(rowPayload[k]).trim();
            if (!isUuid(nameStr)) {
              contactNameInput = nameStr;
              break;
            }
          }
        }
      }

      if (companyIdInput && companyIdInput !== 'null') companyIdsSet.add(companyIdInput);
      if (contactIdInput && contactIdInput !== 'null') contactIdsSet.add(contactIdInput);
      if (companyNameInput) companyNamesSet.add(companyNameInput.trim().toLowerCase());
      if (contactNameInput) contactNamesSet.add(contactNameInput.trim().toLowerCase());

      return {
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

    // Company Name lookup
    if (companyNamesSet.size > 0 && companyObjectType) {
      relationshipPromises.push(
        supabase
          .from('universal_table')
          .select('id, organization_id, object_type_id, name, data, is_deleted')
          .eq('organization_id', organizationId)
          .eq('object_type_id', companyObjectType.id)
          .eq('is_deleted', false)
          .then(({ data: rows }) => {
            (rows || []).forEach(r => {
              const rName = String(r.name || r.data?.name || r.data?.company_name || '').trim().toLowerCase();
              if (companyNamesSet.has(rName)) {
                if (!companyByNameMap.has(rName)) companyByNameMap.set(rName, []);
                companyByNameMap.get(rName).push(r);
              }
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

    // 4. Duplicate checks (in-CSV + existing DB)
    // Option C: Fetch existing records ONCE and reuse for all unique fields.
    // Previously each unique field triggered a separate full-table scan.
    const uniqueFields = (fields || []).filter(f => f.unique || f.name === 'email' || f.name === 'code');
    const seenCsvValuesMap = new Map();
    uniqueFields.forEach(f => seenCsvValuesMap.set(f.name, new Set()));

    const existingDbValuesMap = new Map();
    uniqueFields.forEach(f => existingDbValuesMap.set(f.name, new Set()));

    if (uniqueFields.length > 0) {
      // Check if ANY unique field has values in the current batch
      const anyBatchHasValues = uniqueFields.some(f => {
        return recordsArray.some(r => {
          const v = r[f.name] !== undefined ? r[f.name] : (r.data && r.data[f.name]);
          return v !== undefined && v !== null && String(v).trim() !== '';
        });
      });

      if (anyBatchHasValues) {
        // Single fetch: retrieve existing records ONCE for this object type
        const { data: allExistingRows } = await supabase
          .from('universal_table')
          .select('data')
          .eq('organization_id', organizationId)
          .eq('object_type_id', objDef.id)
          .eq('is_deleted', false);

        // Extract values for ALL unique fields from the single result set
        if (allExistingRows && allExistingRows.length > 0) {
          for (const f of uniqueFields) {
            const dbSet = existingDbValuesMap.get(f.name);
            allExistingRows.forEach(d => {
              const dbVal = d.data && d.data[f.name];
              if (dbVal && String(dbVal).trim()) {
                dbSet.add(String(dbVal).trim().toLowerCase());
              }
            });
          }
        }
      }
    }

    // 5. In-Memory Validation & Payload Construction Loop
    const validNewRows = [];
    const validPayloadsToReturn = [];
    const rowResults = [];
    const errorDetails = [];
    let createdCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recordsArray.length; i++) {
      const payload = recordsArray[i];
      const rowNum = payload.__rowNum || (i + 1);
      const rowIdentifier = payload.name || payload.deal_name || payload.company_name || payload.contact_name || payload.email || `Row ${rowNum}`;
      const relInputs = extractedInputs[i];

      try {
        const cleanPayload = { ...payload };
        delete cleanPayload.__rowNum;

        validateDuplicateEmails(cleanPayload);
        validateEmailFormats(cleanPayload);

        // Required field validation
        for (const field of fields) {
          if (field.required && field.type !== 'lookup' && (cleanPayload[field.name] === undefined || cleanPayload[field.name] === '')) {
            throw { statusCode: 400, message: `Validation Error: Field '${field.label || field.name}' is required for ${objectKey}.` };
          }
        }

        // Unique field validation (against CSV payload & DB)
        for (const f of uniqueFields) {
          const rawVal = cleanPayload[f.name];
          if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
            const normVal = String(rawVal).trim().toLowerCase();
            const seenSet = seenCsvValuesMap.get(f.name);
            const dbSet = existingDbValuesMap.get(f.name);

            if (seenSet.has(normVal)) {
              throw { statusCode: 400, message: `Validation Error: Duplicate ${f.label || f.name} '${rawVal}' found within the import payload.` };
            }
            if (dbSet.has(normVal)) {
              throw { statusCode: 400, message: `Validation Error: ${f.label || f.name} '${rawVal}' already exists.` };
            }
            seenSet.add(normVal);
          }
        }

        // Custom validation rules (in-memory)
        const vErrors = [];
        (validationRules || []).forEach(rule => {
          const isValid = validationRuleService.evaluateRule(rule, cleanPayload);
          if (!isValid) {
            vErrors.push(rule.error_message || `Validation rule '${rule.rule_name}' failed.`);
          }
        });
        if (vErrors.length > 0) {
          throw { statusCode: 400, message: vErrors.join(' | ') };
        }

        // Canonical name resolution
        const rawName = (cleanPayload.name || cleanPayload.first_name || cleanPayload.title || '').trim();
        if (rawName) {
          if (!cleanPayload.name) cleanPayload.name = rawName;
          if (!cleanPayload.first_name) cleanPayload.first_name = rawName.split(' ')[0] || rawName;
          if (!cleanPayload.last_name) cleanPayload.last_name = rawName.split(' ').slice(1).join(' ') || cleanPayload.first_name;
        }

        const { name, status, owner_id, parent_id, secondary_parent_id, ...customData } = cleanPayload;
        let resolvedName = '';
        if (cleanKey === 'company' || cleanKey === 'account' || cleanKey === 'companies' || cleanKey === 'accounts') {
          const candidate = cleanPayload.name || cleanPayload.company_name || cleanPayload.account_name || (cleanPayload.data && (cleanPayload.data.name || cleanPayload.data.company_name));
          resolvedName = (!isUuid(candidate) && String(candidate || '').trim()) ? String(candidate).trim() : '';
        } else if (cleanKey === 'contact' || cleanKey === 'person' || cleanKey === 'contacts' || cleanKey === 'people') {
          const explicitName = (!isUuid(cleanPayload.name) && String(cleanPayload.name || '').trim()) ? String(cleanPayload.name).trim() : '';
          const fn = String(cleanPayload.first_name || (cleanPayload.data && cleanPayload.data.first_name) || '').trim();
          const ln = String(cleanPayload.last_name || (cleanPayload.data && cleanPayload.data.last_name) || '').trim();
          const combined = `${fn} ${ln}`.trim();
          resolvedName = explicitName || combined || (!isUuid(cleanPayload.email) && cleanPayload.email ? String(cleanPayload.email).split('@')[0] : 'Contact');
        } else if (cleanKey === 'deal' || cleanKey === 'opportunity' || cleanKey === 'deals' || cleanKey === 'opportunities') {
          const candidate = cleanPayload.name || cleanPayload.deal_name || (cleanPayload.data && (cleanPayload.data.name || cleanPayload.data.deal_name));
          resolvedName = (!isUuid(candidate) && String(candidate || '').trim()) ? String(candidate).trim() : 'New Deal';
        } else {
          const candidate = cleanPayload.name || cleanPayload.title || cleanPayload.subject || (cleanPayload.data && cleanPayload.data.name);
          resolvedName = (!isUuid(candidate) && String(candidate || '').trim()) ? String(candidate).trim() : 'Untitled';
        }

        if (!resolvedName) resolvedName = (!isUuid(name) && String(name || '').trim()) ? String(name).trim() : 'Untitled';
        customData.name = resolvedName;

        // Bi-directional alias syncing
        const titleVal = (cleanPayload.title || cleanPayload.job_title || '').trim();
        if (titleVal) { customData.title = titleVal; customData.job_title = titleVal; }
        const sourceVal = (cleanPayload.lead_source || cleanPayload.source || '').trim();
        if (sourceVal) { customData.lead_source = sourceVal; customData.source = sourceVal; }

        // Company Relationship Resolution
        let resolvedParent = null;
        let resolvedParentName = null;

        if (relInputs.companyIdInput !== undefined) {
          if (relInputs.companyIdInput && relInputs.companyIdInput !== 'null') {
            if (!isUuid(relInputs.companyIdInput)) {
              throw { statusCode: 400, message: `Validation Error: Company ID '${relInputs.companyIdInput}' is not a valid UUID format.` };
            }
            const parentRow = companyByIdMap.get(relInputs.companyIdInput);
            if (!parentRow || parentRow.is_deleted) {
              throw { statusCode: 400, message: `Validation Error: Company ID '${relInputs.companyIdInput}' was not found.` };
            }
            if (parentRow.organization_id !== organizationId) {
              throw { statusCode: 403, message: `Validation Error: Company ID '${relInputs.companyIdInput}' does not belong to the current organization.` };
            }
            if (companyObjectType && parentRow.object_type_id !== companyObjectType.id) {
              throw { statusCode: 400, message: `Validation Error: The referenced record '${relInputs.companyIdInput}' is not a Company object type.` };
            }
            resolvedParent = parentRow.id;
            resolvedParentName = parentRow.name || parentRow.data?.name || parentRow.data?.company_name || 'Company';
          }
        } else if (relInputs.companyNameInput) {
          const cleanName = relInputs.companyNameInput.trim().toLowerCase();
          const matches = companyByNameMap.get(cleanName) || [];
          if (matches.length > 1) {
            throw { statusCode: 400, message: `Validation Error: Multiple Companies found with the name '${relInputs.companyNameInput}'. Please provide Company ID.` };
          }
          if (matches.length === 1) {
            resolvedParent = matches[0].id;
            resolvedParentName = matches[0].name || matches[0].data?.name || matches[0].data?.company_name || relInputs.companyNameInput;
          } else {
            throw { statusCode: 400, message: `Validation Error: Company '${relInputs.companyNameInput}' was not found. Please provide a valid Company Name or Company ID.` };
          }
        }

        if (resolvedParent) {
          customData.company = resolvedParent;
          customData.company_id = resolvedParent;
          customData.Company = resolvedParent;
          customData.Company_id = resolvedParent;
          if (resolvedParentName) customData.company_name = resolvedParentName;
        } else {
          customData.company = null; customData.company_id = null; customData.Company = null; customData.Company_id = null;
          if (relInputs.companyIdInput !== undefined) customData.company_name = null;
          else customData.company_name = resolvedParentName || null;
        }

        // Contact Relationship Resolution
        let resolvedSecondary = null;
        let resolvedSecondaryName = null;

        if (relInputs.contactIdInput !== undefined) {
          if (relInputs.contactIdInput && relInputs.contactIdInput !== 'null') {
            if (!isUuid(relInputs.contactIdInput)) {
              throw { statusCode: 400, message: `Validation Error: Contact ID '${relInputs.contactIdInput}' is not a valid UUID format.` };
            }
            const secRow = contactByIdMap.get(relInputs.contactIdInput);
            if (!secRow || secRow.is_deleted) {
              throw { statusCode: 400, message: `Validation Error: Contact ID '${relInputs.contactIdInput}' was not found.` };
            }
            if (secRow.organization_id !== organizationId) {
              throw { statusCode: 403, message: `Validation Error: Contact ID '${relInputs.contactIdInput}' does not belong to the current organization.` };
            }
            if (contactObjectType && secRow.object_type_id !== contactObjectType.id) {
              throw { statusCode: 400, message: `Validation Error: The referenced record '${relInputs.contactIdInput}' is not a Contact object type.` };
            }
            resolvedSecondary = secRow.id;
            resolvedSecondaryName = secRow.name || secRow.data?.name || secRow.data?.contact_name || 'Contact';
          }
        } else if (relInputs.contactNameInput) {
          const cleanName = relInputs.contactNameInput.trim().toLowerCase();
          const matches = contactByNameMap.get(cleanName) || [];
          if (matches.length > 1) {
            throw { statusCode: 400, message: `Validation Error: Multiple Contacts found with the name '${relInputs.contactNameInput}'. Please provide Contact ID.` };
          }
          if (matches.length === 1) {
            resolvedSecondary = matches[0].id;
            resolvedSecondaryName = matches[0].name || matches[0].data?.name || matches[0].data?.contact_name || relInputs.contactNameInput;
          } else {
            throw { statusCode: 400, message: `Validation Error: Contact '${relInputs.contactNameInput}' was not found. Please provide a valid Contact Name or Contact ID.` };
          }
        }

        if (resolvedSecondary) {
          customData.contact = resolvedSecondary;
          customData.contact_id = resolvedSecondary;
          customData.Contact = resolvedSecondary;
          customData.Contact_id = resolvedSecondary;
          if (resolvedSecondaryName) customData.contact_name = resolvedSecondaryName;
        } else {
          customData.contact = null; customData.contact_id = null; customData.Contact = null; customData.Contact_id = null;
          if (relInputs.contactIdInput !== undefined) customData.contact_name = null;
          else customData.contact_name = resolvedSecondaryName || null;
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
          __rowNum: rowNum,
          __rowIdentifier: rowIdentifier
        };

        validNewRows.push(newRow);
      } catch (err) {
        failedCount++;
        const errMsg = err.message || err.error || `Failed to create ${objectKey} record.`;
        errorDetails.push({ rowNum, identifier: String(rowIdentifier).trim(), reason: errMsg });
        rowResults.push({ rowNumber: rowNum, identifier: String(rowIdentifier).trim(), status: 'failed', recordId: null, error: errMsg });
      }
    }

    // 6. Bulk Insert Valid Rows into universal_table with Controlled Backend Isolation
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
            errorDetails.push({ rowNum, identifier: String(rowIdentifier).trim(), reason: errMsg });
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
      success: createdCount > 0,
      totalProcessed: recordsArray.length,
      createdCount,
      failedCount,
      skippedCount: 0,
      data: validPayloadsToReturn,
      results: rowResults,
      errors: errorDetails
    };
  },
};

module.exports = objectService;

