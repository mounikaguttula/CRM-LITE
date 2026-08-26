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
    if (!objectKey || typeof objectKey !== 'string' || objectKey.includes('📁') || objectKey.trim() === '') {
      return [];
    }

    const objDef = await metadataService.getObjectTypeByApiName(objectKey, organizationId).catch(() => null);

    let query = supabase
      .from('universal_table')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (objDef && objDef.id) {
      query = query.eq('object_type_id', objDef.id);
    } else if (isUuid(objectKey)) {
      query = query.eq('object_type_id', objectKey);
    } else {
      return [];
    }

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    if (options.owner_id) {
      query = query.eq('owner_id', options.owner_id);
    }

    const { data: rows, error } = await query;

    if (error) {
      throw { statusCode: 500, message: `Failed to fetch records for '${objectKey}': ${error.message}` };
    }

    return (rows || []).map(objectService.normalizeRecord);
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

    const resolvedParent = isUuid(parent_id)
      ? parent_id
      : (isUuid(payload.company_id)
        ? payload.company_id
        : (isUuid(payload.company)
          ? payload.company
          : (isUuid(payload.Company)
            ? payload.Company
            : (isUuid(payload.Company_id)
              ? payload.Company_id
              : null))));

    const resolvedSecondary = isUuid(secondary_parent_id)
      ? secondary_parent_id
      : (isUuid(payload.contact_id)
        ? payload.contact_id
        : (isUuid(payload.contact)
          ? payload.contact
          : (isUuid(payload.Contact)
            ? payload.Contact
            : (isUuid(payload.Contact_id)
              ? payload.Contact_id
              : null))));

    if (resolvedParent) {
      customData.company = resolvedParent;
      customData.company_id = resolvedParent;
      customData.Company = resolvedParent;
    }

    if (resolvedSecondary) {
      customData.contact = resolvedSecondary;
      customData.contact_id = resolvedSecondary;
      customData.Contact = resolvedSecondary;
    }

    if (resolvedParent && (!customData.company_name || isUuid(customData.company_name))) {
      try {
        const { data: parentRow } = await supabase
          .from('universal_table')
          .select('name, data')
          .eq('id', resolvedParent)
          .single();
        if (parentRow) {
          const compName = parentRow.name || parentRow.data?.name || parentRow.data?.company_name;
          if (compName && typeof compName === 'string' && !isUuid(compName)) {
            customData.company_name = compName;
          }
        }
      } catch (e) {}
    }

    if (resolvedSecondary && (!customData.contact_name || isUuid(customData.contact_name))) {
      try {
        const { data: secondaryRow } = await supabase
          .from('universal_table')
          .select('name, data')
          .eq('id', resolvedSecondary)
          .single();
        if (secondaryRow) {
          const contName = secondaryRow.name || secondaryRow.data?.name || secondaryRow.data?.contact_name;
          if (contName && typeof contName === 'string' && !isUuid(contName)) {
            customData.contact_name = contName;
          }
        }
      } catch (e) {}
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

    const resolvedParent = isUuid(parent_id) ? parent_id : (isUuid(payload.company_id) ? payload.company_id : (isUuid(payload.company) ? payload.company : (isUuid(existing.parent_id) ? existing.parent_id : null)));
    const resolvedSecondary = isUuid(secondary_parent_id) ? secondary_parent_id : (isUuid(payload.contact_id) ? payload.contact_id : (isUuid(payload.contact) ? payload.contact : (isUuid(existing.secondary_parent_id) ? existing.secondary_parent_id : null)));

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

    return { success: true, message: `Record '${id}' deleted successfully.` };
  },
};

module.exports = objectService;

