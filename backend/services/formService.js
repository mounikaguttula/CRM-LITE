const crypto = require('crypto');
const supabase = require('../config/supabase');
const { supabaseAdmin } = require('../config/supabase');
const objectService = require('./objectService');
const emailService = require('./emailService');

// Helper to validate UUID
const isUuid = (val) => Boolean(val && typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

const formService = {
  /**
   * Ensures `form` and `form_submission` object types exist in object_type_definitions
   */
  ensureFormObjectTypes: async (organizationId) => {
    let formDefId = null;
    let submissionDefId = null;

    try {
      const { data: defs, error: fetchErr } = await supabase
        .from('object_type_definitions')
        .select('id, api_name, organization_id')
        .or(`organization_id.eq.${organizationId},organization_id.is.null`);

      if (fetchErr) {
        console.error('[FormService] Error fetching object_type_definitions:', fetchErr.message);
      }

      const formDef = (defs || []).find((d) => (d.api_name === 'form' || d.api_name === 'forms') && d.organization_id === null);
      const submissionDef = (defs || []).find((d) => (d.api_name === 'form_submission' || d.api_name === 'form_submissions') && d.organization_id === null);

      if (formDef) {
        formDefId = formDef.id;
      } else {
        const { data: newFormDef, error: formInsertErr } = await supabase
          .from('object_type_definitions')
          .upsert([{
            id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a45',
            organization_id: null,
            api_name: 'form',
            display_name: 'Forms',
            description: 'Dynamic Lead Capture & Feedback Forms',
            is_system: true,
          }], { onConflict: 'id' })
          .select('id')
          .single();

        if (formInsertErr) {
          console.error('[FormService] Failed to create canonical form object type:', formInsertErr.message);
        } else if (newFormDef) {
          formDefId = newFormDef.id;
        }
      }

      if (submissionDef) {
        submissionDefId = submissionDef.id;
      } else {
        const { data: newSubDef, error: subInsertErr } = await supabase
          .from('object_type_definitions')
          .upsert([{
            id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a46',
            organization_id: null,
            api_name: 'form_submission',
            display_name: 'Form Submissions',
            description: 'Form submission snapshots and responses',
            is_system: true,
          }], { onConflict: 'id' })
          .select('id')
          .single();

        if (subInsertErr) {
          console.error('[FormService] Failed to create canonical form_submission object type:', subInsertErr.message);
        } else if (newSubDef) {
          submissionDefId = newSubDef.id;
        }
      }
    } catch (err) {
      console.error('[FormService] Unexpected error ensuring form object types:', err.message);
    }

    if (!formDefId || !submissionDefId) {
      throw new Error(`Failed to resolve canonical form object types (form: ${formDefId || 'unresolved'}, submission: ${submissionDefId || 'unresolved'}).`);
    }

    return {
      formDefId,
      submissionDefId,
    };
  },

  /**
   * List all forms for an organization from universal_table
   */
  /**
   * Helper: Sync live total_submissions count on a form record in universal_table
   */
  syncFormSubmissionCount: async (formId, organizationId) => {
    try {
      const { submissionDefId } = await formService.ensureFormObjectTypes(organizationId);
      const { count } = await supabase
        .from('universal_table')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('object_type_id', submissionDefId)
        .eq('parent_id', formId)
        .eq('is_deleted', false);

      const liveCount = typeof count === 'number' ? count : 0;

      const { data: formRow } = await supabase
        .from('universal_table')
        .select('data')
        .eq('id', formId)
        .single();

      if (formRow) {
        await supabase
          .from('universal_table')
          .update({
            data: {
              ...(formRow.data || {}),
              total_submissions: liveCount,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', formId);
      }

      return liveCount;
    } catch (err) {
      console.warn('[FormService] Error syncing submission count:', err.message);
      return 0;
    }
  },

  /**
   * List all forms for an organization from universal_table
   */
  listForms: async (organizationId) => {
    const { formDefId, submissionDefId } = await formService.ensureFormObjectTypes(organizationId);

    // Fetch form records
    const { data: formRows, error } = await supabase
      .from('universal_table')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('object_type_id', formDefId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[FormService] Error fetching forms:', error.message);
      throw new Error(`Failed to fetch forms: ${error.message}`);
    }

    // Fetch submission counts grouped by parent_id
    const { data: subRows } = await supabase
      .from('universal_table')
      .select('parent_id, data')
      .eq('organization_id', organizationId)
      .eq('object_type_id', submissionDefId)
      .eq('is_deleted', false);

    const countsMap = {};
    (subRows || []).forEach((sub) => {
      const fId = sub.parent_id || sub.data?.form_id;
      if (fId) {
        countsMap[fId] = (countsMap[fId] || 0) + 1;
      }
    });

    return (formRows || []).map((row) => {
      const normalized = objectService.normalizeRecord(row);
      // Strictly compute live count from active non-deleted submissions.
      // Do NOT fall back to stale stored row.data.total_submissions if live count is 0!
      const liveCount = typeof countsMap[row.id] === 'number' ? countsMap[row.id] : 0;

      const presetLayout = (row.data?.appearance?.preset_layout || '').toLowerCase();
      const formTypeVal = (normalized.form_type || row.data?.form_type || '').toLowerCase();
      const isWebinar = formTypeVal === 'webinar_registration' || presetLayout === 'event_registration';
      const formTypeResolved = isWebinar ? 'webinar_registration' : 'lead_capture';

      return {
        ...normalized,
        total_submissions: liveCount,
        slug: normalized.slug || row.data?.slug || '',
        status: normalized.status || row.status || 'Draft',
        description: normalized.description || row.data?.description || '',
        form_type: formTypeResolved,
        fields_config: normalized.fields_config || row.data?.fields_config || [],
        appearance: normalized.appearance || row.data?.appearance || {},
        header_content: normalized.header_content || row.data?.header_content || {},
        lead_mapping: normalized.lead_mapping || row.data?.lead_mapping || {},
      };
    });
  },

  /**
   * Get single form by ID for an organization
   */
  getFormById: async (formId, organizationId) => {
    const { data: row, error } = await supabase
      .from('universal_table')
      .select('*')
      .eq('id', formId)
      .eq('organization_id', organizationId)
      .eq('is_deleted', false)
      .single();

    if (error || !row) {
      throw new Error(`Form '${formId}' not found.`);
    }

    const normalized = objectService.normalizeRecord(row);

    // Get live submission count strictly from active non-deleted submissions
    const { submissionDefId } = await formService.ensureFormObjectTypes(organizationId);
    const { count } = await supabase
      .from('universal_table')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('parent_id', formId)
      .eq('object_type_id', submissionDefId)
      .eq('is_deleted', false);

    const liveCount = typeof count === 'number' ? count : 0;

    const presetLayout = (row.data?.appearance?.preset_layout || '').toLowerCase();
    const formTypeVal = (normalized.form_type || row.data?.form_type || '').toLowerCase();
    const isWebinar = formTypeVal === 'webinar_registration' || presetLayout === 'event_registration';
    const formTypeResolved = isWebinar ? 'webinar_registration' : 'lead_capture';

    return {
      ...normalized,
      total_submissions: liveCount,
      slug: normalized.slug || row.data?.slug || '',
      status: normalized.status || row.status || 'Draft',
      description: normalized.description || row.data?.description || '',
      form_type: formTypeResolved,
      fields_config: normalized.fields_config || row.data?.fields_config || [],
      appearance: normalized.appearance || row.data?.appearance || {},
      header_content: normalized.header_content || row.data?.header_content || {},
      lead_mapping: normalized.lead_mapping || row.data?.lead_mapping || {},
    };
  },

  /**
   * Public lookup: Get active form by slug (unauthenticated)
   */
  getFormBySlug: async (slug) => {
    if (!slug || typeof slug !== 'string') return null;

    const cleanSlug = slug.trim().toLowerCase();

    // Query universal_table where data->>'slug' equals cleanSlug
    const { data: rows, error } = await supabase
      .from('universal_table')
      .select('*')
      .eq('is_deleted', false)
      .ilike('data->>slug', cleanSlug);

    if (error || !rows || rows.length === 0) {
      return null;
    }

    const activeForm = rows.find((r) => {
      const status = (r.status || r.data?.status || '').toLowerCase();
      return status === 'active';
    });

    if (!activeForm) {
      return null;
    }

    const normalized = objectService.normalizeRecord(activeForm);
    return {
      id: activeForm.id,
      organization_id: activeForm.organization_id,
      name: normalized.name || activeForm.name,
      slug: normalized.slug || activeForm.data?.slug,
      status: normalized.status || activeForm.status,
      description: normalized.description || activeForm.data?.description || '',
      form_type: normalized.form_type || activeForm.data?.form_type || null,
      header_content: normalized.header_content || activeForm.data?.header_content || {},
      appearance: normalized.appearance || activeForm.data?.appearance || {},
      fields_config: normalized.fields_config || activeForm.data?.fields_config || [],
      lead_mapping: normalized.lead_mapping || activeForm.data?.lead_mapping || {},
    };
  },

  /**
   * Create a new form
   */
  createForm: async (payload, organizationId, userId) => {
    const { formDefId } = await formService.ensureFormObjectTypes(organizationId);

    const name = (payload.name || 'Untitled Form').trim();
    let slug = (payload.slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-')).replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!slug) slug = `form-${Date.now()}`;

    // Check slug uniqueness within organization
    const { data: existingSlug } = await supabase
      .from('universal_table')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('object_type_id', formDefId)
      .eq('is_deleted', false)
      .ilike('data->>slug', slug);

    if (existingSlug && existingSlug.length > 0) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const formId = (payload.id && isUuid(payload.id)) ? payload.id : crypto.randomUUID();
    const status = payload.status || 'Active';

    // Standard default fields if none provided
    const fieldsConfig = Array.isArray(payload.fields_config) && payload.fields_config.length > 0
      ? payload.fields_config
      : [
        { id: 'f_first_name', api_name: 'first_name', label: 'First Name', type: 'text', required: true, placeholder: 'Enter first name' },
        { id: 'f_last_name', api_name: 'last_name', label: 'Last Name', type: 'text', required: true, placeholder: 'Enter last name' },
        { id: 'f_email', api_name: 'email', label: 'Business Email', type: 'email', required: true, placeholder: 'john@company.com' },
        { id: 'f_company', api_name: 'company', label: 'Company Name', type: 'text', required: false, placeholder: 'Acme Corp' },
        { id: 'f_phone', api_name: 'phone', label: 'Phone Number', type: 'phone', required: false, placeholder: '+1 (555) 000-0000' },
        { id: 'f_job_title', api_name: 'job_title', label: 'Job Title', type: 'text', required: false, placeholder: 'Manager' },
      ];

    const dataPayload = {
      id: formId,
      name,
      slug,
      status,
      form_type: payload.form_type || null,
      description: payload.description || '',
      header_content: payload.header_content || {
        title: name,
        subtitle: payload.description || 'Fill out the form below to get started.',
        logo_url: payload.header_content?.logo_url || '',
        cover_image_url: payload.header_content?.cover_image_url || '',
      },
      appearance: payload.appearance || {
        primary_color: '#4f46e5',
        theme: 'light',
        submit_button_text: 'Submit Request',
        success_message: 'Thank you! Your submission has been received successfully.',
      },
      fields_config: fieldsConfig,
      lead_mapping: payload.lead_mapping || {
        first_name: 'first_name',
        last_name: 'last_name',
        email: 'email',
        company: 'company',
        phone: 'phone',
        job_title: 'job_title',
      },
      total_submissions: 0,
    };

    const newRow = {
      id: formId,
      organization_id: organizationId,
      object_type_id: formDefId,
      name,
      status,
      owner_id: userId || null,
      data: dataPayload,
      created_by: userId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabase
      .from('universal_table')
      .insert([newRow])
      .select()
      .single();

    if (error) {
      console.error('[FormService] Error inserting form:', error.message);
      throw new Error(`Failed to create form: ${error.message}`);
    }

    return objectService.normalizeRecord(inserted);
  },

  /**
   * Update an existing form
   */
  updateForm: async (formId, payload, organizationId, userId) => {
    const existing = await formService.getFormById(formId, organizationId);

    const name = payload.name !== undefined ? payload.name.trim() : existing.name;
    const status = payload.status !== undefined ? payload.status : existing.status;
    let slug = payload.slug !== undefined ? payload.slug.trim().toLowerCase() : existing.slug;

    if (slug !== existing.slug) {
      const { formDefId } = await formService.ensureFormObjectTypes(organizationId);
      const { data: existingSlug } = await supabase
        .from('universal_table')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('object_type_id', formDefId)
        .neq('id', formId)
        .eq('is_deleted', false)
        .ilike('data->>slug', slug);

      if (existingSlug && existingSlug.length > 0) {
        throw new Error(`Public URL slug '${slug}' is already in use by another form in your organization.`);
      }
    }

    const updatedData = {
      ...existing,
      ...payload,
      name,
      status,
      slug,
      description: payload.description !== undefined ? payload.description : existing.description,
      header_content: payload.header_content || existing.header_content,
      appearance: payload.appearance || existing.appearance,
      fields_config: payload.fields_config || existing.fields_config,
      lead_mapping: payload.lead_mapping || existing.lead_mapping,
    };

    const { data: updated, error } = await supabase
      .from('universal_table')
      .update({
        name,
        status,
        data: updatedData,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', formId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('[FormService] Error updating form:', error.message);
      throw new Error(`Failed to update form: ${error.message}`);
    }

    return objectService.normalizeRecord(updated);
  },

  /**
   * Soft delete a form
   */
  deleteForm: async (formId, organizationId, userId) => {
    const { error } = await supabase
      .from('universal_table')
      .update({
        is_deleted: true,
        deleted_by: userId || null,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', formId)
      .eq('organization_id', organizationId);

    if (error) {
      throw new Error(`Failed to delete form: ${error.message}`);
    }

    return { success: true, message: 'Form deleted successfully.' };
  },

  /**
   * Public Submission Handler:
   * 1. Resolves form by slug
   * 2. Extracts organization_id strictly from form DB record
   * 3. Validates required fields
   * 4. Creates Lead in universal_table under form's organization_id
   * 5. Creates form_submission snapshot record in universal_table linking form & lead
   */
  submitPublicForm: async (slug, submissionPayload, metaParams = {}) => {
    const form = await formService.getFormBySlug(slug);
    if (!form) {
      throw { statusCode: 404, message: 'Form not found or is currently inactive.' };
    }

    const organizationId = form.organization_id;
    if (!organizationId) {
      throw { statusCode: 400, message: 'Invalid form configuration: missing organization owner.' };
    }

    const submittedFields = submissionPayload || {};
    const fieldsConfig = form.fields_config || [];

    // Validate required fields
    for (const field of fieldsConfig) {
      if (field.required) {
        const val = submittedFields[field.api_name];
        if (val === undefined || val === null || String(val).trim() === '') {
          throw { statusCode: 400, message: `Field '${field.label || field.api_name}' is required.` };
        }
      }
    }

    // Intelligent Lead attribute extraction
    const extractedTargets = {};

    // 1. Process explicit lead_target mappings from form's fields_config
    for (const field of fieldsConfig) {
      if (field.lead_target && field.lead_target !== 'none') {
        const val = submittedFields[field.api_name];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const fNameLower = (field.api_name || '').toLowerCase();
          const fLabelLower = (field.label || '').toLowerCase();
          const isAddressOrCountry = fNameLower.includes('country') || fNameLower.includes('address') || fNameLower.includes('location') || fLabelLower.includes('country') || fLabelLower.includes('address');

          if (field.lead_target === 'company' && isAddressOrCountry) {
            extractedTargets.address = String(val).trim();
            extractedTargets.country = String(val).trim();
          } else {
            extractedTargets[field.lead_target] = String(val).trim();
          }
        }
      }
    }

    // 2. Intelligent fuzzy fallback extraction for all standard Lead CRM attributes
    const getValueForKeys = (keys) => {
      for (const k of keys) {
        if (submittedFields[k] !== undefined && submittedFields[k] !== null && String(submittedFields[k]).trim() !== '') {
          return String(submittedFields[k]).trim();
        }
      }
      return '';
    };

    const mapping = form.lead_mapping || {};
    const firstName = extractedTargets.first_name || String(submittedFields[mapping.first_name] || getValueForKeys(['first_name', 'fname', 'name'])).trim();
    const lastName = extractedTargets.last_name || String(submittedFields[mapping.last_name] || getValueForKeys(['last_name', 'lname'])).trim();
    const email = extractedTargets.email || String(submittedFields[mapping.email] || getValueForKeys(['email', 'work_email', 'email_address'])).trim();

    // Guard: Validate Email Format, Typos, and Disposable Domains
    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!EMAIL_REGEX.test(cleanEmail)) {
        throw { statusCode: 400, message: 'Please enter a valid email address (e.g. name@company.com).' };
      }
      const parts = cleanEmail.split('@');
      if (parts.length === 2) {
        const [username, domain] = parts;
        const TYPO_MAP = {
          'gmil.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmai.com': 'gmail.com',
          'gmial.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gmeil.com': 'gmail.com',
          'gmail.c': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.comm': 'gmail.com',
          'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yaho.co': 'yahoo.com',
          'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
          'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outloook.com': 'outlook.com',
          'redifmail.com': 'rediffmail.com', 'redif.com': 'rediffmail.com'
        };
        if (TYPO_MAP[domain]) {
          throw { statusCode: 400, message: `Invalid email domain. Did you mean @${TYPO_MAP[domain]}?` };
        }
        const DISPOSABLE_DOMAINS = new Set([
          'yopmail.com', 'mailinator.com', 'tempmail.com', 'dispostable.com',
          'guerrillamail.com', '10minutemail.com', 'trashmail.com', 'sharklasers.com',
          'getnada.com', 'binkmail.com', 'safetymail.info', 'maildrop.cc',
          'temp-mail.org', 'fakeinbox.com', 'throwawaymail.com', 'generator.email',
          'example.com', 'test.com', 'fake.com', 'dummy.com', 'invalid.com',
          'sample.com', 'asdf.com', 'qwerty.com'
        ]);
        if (DISPOSABLE_DOMAINS.has(domain)) {
          throw { statusCode: 400, message: 'Disposable or temporary email addresses are not allowed.' };
        }
        const DUMMY_USERNAMES = new Set(['test', 'asdf', 'qwer', '123', '1234', 'dummy', 'fake', 'noemail', 'abc', 'xyz', 'none', 'testing']);
        if (DUMMY_USERNAMES.has(username)) {
          throw { statusCode: 400, message: 'Please enter a genuine, active email address.' };
        }
      }
    }

    // Guard: Prevent Duplicate Submissions for the Same Form by Email
    if (email) {
      const emailLower = email.toLowerCase().trim();
      const { submissionDefId } = await formService.ensureFormObjectTypes(organizationId);

      const { data: existingSubs } = await supabase
        .from('universal_table')
        .select('id, data')
        .eq('organization_id', organizationId)
        .eq('object_type_id', submissionDefId)
        .eq('is_deleted', false)
        .or(`parent_id.eq.${form.id},data->>form_id.eq.${form.id}`);

      const duplicate = (existingSubs || []).find((sub) => {
        const subEmail = String(
          sub.data?.registrant_email ||
          sub.data?.email ||
          sub.data?.submitted_fields?.email ||
          sub.data?.submitted_fields?.work_email ||
          sub.data?.submitted_fields?.email_address ||
          ''
        ).toLowerCase().trim();
        return subEmail === emailLower;
      });

      if (duplicate) {
        throw {
          statusCode: 400,
          message: `The email address '${email}' is already registered for this form. Multiple submissions with the same email are not allowed.`,
        };
      }
    }

    const address = extractedTargets.address || extractedTargets.country || String(submittedFields[mapping.address] || getValueForKeys(['country', 'address', 'location', 'city', 'state'])).trim();
    let company = extractedTargets.company || String(submittedFields[mapping.company] || getValueForKeys(['company', 'company_name', 'organization'])).trim();

    // Prevent company from being assigned the country string if field was misconfigured
    if (company && address && company.toLowerCase() === address.toLowerCase()) {
      const explicitCompany = String(submittedFields.company || submittedFields.company_name || submittedFields.organization || '').trim();
      company = explicitCompany || '—';
    }

    const phone = extractedTargets.phone || String(submittedFields[mapping.phone] || getValueForKeys(['phone', 'work_phone', 'phone_number', 'mobile', 'tel'])).trim();
    const roleVal = extractedTargets.designation || extractedTargets.role || String(getValueForKeys(['role', 'designation'])).trim();
    const titleVal = extractedTargets.job_title || String(submittedFields[mapping.job_title] || getValueForKeys(['job_title', 'title', 'position'])).trim();

    const jobTitle = titleVal || roleVal;
    const designation = roleVal || titleVal;

    const numberOfEmployees = extractedTargets.number_of_employees || String(submittedFields[mapping.number_of_employees] || getValueForKeys(['company_size', 'number_of_employees', 'employee_count', 'employees'])).trim();
    const industry = extractedTargets.industry || String(submittedFields[mapping.industry] || getValueForKeys(['industry', 'sector'])).trim();
    const description = extractedTargets.description || String(submittedFields[mapping.description] || getValueForKeys(['message', 'description', 'notes', 'inquiry'])).trim();

    const fullName = [firstName, lastName].filter(Boolean).join(' ') || email || 'Form Registrant';

    // Source & UTM info
    const utmSource = metaParams.utm_source || metaParams.source || submittedFields.utm_source || 'Direct Public Form';
    const utmMedium = metaParams.utm_medium || submittedFields.utm_medium || 'Web Form';
    const utmCampaign = metaParams.utm_campaign || submittedFields.utm_campaign || form.name;
    const referrer = metaParams.referrer || submittedFields.referrer || '';

    // 1. Create Lead record in universal_table
    const leadPayload = {
      name: fullName,
      first_name: firstName || fullName.split(' ')[0],
      last_name: lastName || fullName.split(' ').slice(1).join(' ') || firstName,
      email: email,
      phone: phone,
      company: company,
      title: jobTitle,
      job_title: jobTitle,
      designation: designation,
      role: designation,
      address: address,
      country: address,
      number_of_employees: numberOfEmployees,
      company_size: numberOfEmployees,
      industry: industry,
      lead_source: `Public Form: ${form.name} (${utmSource})`,
      description: description || null,
      status: 'New',
    };

    let leadRecord = null;
    try {
      leadRecord = await objectService.createRecord('lead', leadPayload, organizationId, null);
    } catch (err) {
      console.warn('[FormService] Lead creation note:', err.message);
    }

    const { submissionDefId } = await formService.ensureFormObjectTypes(organizationId);
    const submissionId = crypto.randomUUID();

    // Determine if this is a webinar/event registration form based on template selection
    const formTypeLower = (form.form_type || '').toLowerCase();
    const presetLayoutLower = (form.appearance?.preset_layout || '').toLowerCase();
    const isWebinarForm = formTypeLower === 'webinar_registration' || presetLayoutLower === 'event_registration';

    const submissionData = {
      id: submissionId,
      form_id: form.id,
      form_name: form.name,
      form_slug: form.slug,
      lead_id: leadRecord ? leadRecord.id : null,
      submitted_fields: submittedFields,
      registrant_name: fullName,
      registrant_email: email,
      registrant_phone: phone,
      registrant_company: company,
      source: utmSource,
      utm: {
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        referrer,
      },
      submitted_at: new Date().toISOString(),
      // Only set attendance_status for webinar registration forms
      ...(isWebinarForm ? { attendance_status: 'Registered' } : {}),
    };

    const newSubRow = {
      id: submissionId,
      organization_id: organizationId,
      object_type_id: submissionDefId,
      name: `${fullName} - ${form.name}`,
      status: 'Submitted',
      parent_id: form.id,
      secondary_parent_id: leadRecord ? leadRecord.id : null,
      data: submissionData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: insertedSub, error: subErr } = await supabase
      .from('universal_table')
      .insert([newSubRow])
      .select()
      .single();

    if (subErr) {
      console.error('[FormService] Error creating form_submission record:', subErr.message);
      throw { statusCode: 500, message: `Failed to record submission: ${subErr.message}` };
    }

    // Update total_submissions on form record asynchronously
    try {
      const { count } = await supabase
        .from('universal_table')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', form.id)
        .eq('object_type_id', submissionDefId)
        .eq('is_deleted', false);

      await supabase
        .from('universal_table')
        .update({
          data: {
            ...form,
            total_submissions: count || 1,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', form.id);
    } catch (cErr) {
      console.warn('[FormService] Submission count update note:', cErr.message);
    }

    return {
      success: true,
      message: form.appearance?.success_message || 'Thank you! Your submission has been received successfully.',
      submission_id: submissionId,
      lead_id: leadRecord ? leadRecord.id : null,
    };
  },

  /**
   * List all submissions for a given form inside an organization
   */
  listSubmissions: async (formId, organizationId) => {
    const { submissionDefId } = await formService.ensureFormObjectTypes(organizationId);

    const { data: rows, error } = await supabase
      .from('universal_table')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('object_type_id', submissionDefId)
      .eq('parent_id', formId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[FormService] Error fetching submissions:', error.message);
      throw new Error(`Failed to fetch form submissions: ${error.message}`);
    }

    return (rows || []).map((row) => {
      const normalized = objectService.normalizeRecord(row);
      return {
        id: row.id,
        form_id: row.parent_id || normalized.form_id,
        lead_id: row.secondary_parent_id || normalized.lead_id,
        name: normalized.registrant_name || row.name,
        email: normalized.registrant_email || row.data?.registrant_email || '',
        phone: normalized.registrant_phone || row.data?.registrant_phone || '',
        company: normalized.registrant_company || row.data?.registrant_company || '',
        submitted_fields: normalized.submitted_fields || row.data?.submitted_fields || {},
        source: normalized.source || row.data?.source || 'Direct',
        utm: normalized.utm || row.data?.utm || {},
        email_sent: Boolean(row.data?.email_sent || row.email_sent || normalized.email_sent),
        last_email_sent_at: row.data?.last_email_sent_at || row.last_email_sent_at || normalized.last_email_sent_at || null,
        last_email_subject: row.data?.last_email_subject || row.last_email_subject || normalized.last_email_subject || null,
        attendance_status: normalized.attendance_status || row.data?.attendance_status || null,
        submitted_at: normalized.submitted_at || row.created_at,
        created_at: row.created_at,
      };
    });
  },

  /**
   * Delete a single form submission record
   */
  deleteSubmission: async (formId, submissionId, organizationId, userId) => {
    const { submissionDefId } = await formService.ensureFormObjectTypes(organizationId);

    const { error } = await supabase
      .from('universal_table')
      .update({
        is_deleted: true,
        deleted_by: userId || null,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .eq('organization_id', organizationId)
      .eq('object_type_id', submissionDefId);

    if (error) {
      console.error('[FormService] Error deleting submission:', error.message);
      throw new Error(`Failed to delete submission: ${error.message}`);
    }

    // Sync live total_submissions count on form record
    await formService.syncFormSubmissionCount(formId, organizationId);

    return {
      success: true,
      message: 'Submission deleted successfully.',
    };
  },

  /**
   * Update attendance_status for one or more form submissions.
   * Validates: allowed status values, submission ownership (form + org).
   */
  updateSubmissionAttendance: async (formId, submissionIds, attendanceStatus, organizationId) => {
    const VALID_STATUSES = ['Registered', 'Attended', 'Not Attended', 'No Show'];
    if (!VALID_STATUSES.includes(attendanceStatus)) {
      throw new Error(`Invalid attendance_status '${attendanceStatus}'. Allowed values: ${VALID_STATUSES.join(', ')}`);
    }

    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      throw new Error('At least one submission_id is required.');
    }

    const { submissionDefId } = await formService.ensureFormObjectTypes(organizationId);

    // Verify all submission IDs belong to this form and organization
    const { data: validRows, error: fetchErr } = await supabase
      .from('universal_table')
      .select('id, data')
      .eq('organization_id', organizationId)
      .eq('object_type_id', submissionDefId)
      .eq('parent_id', formId)
      .eq('is_deleted', false)
      .in('id', submissionIds);

    if (fetchErr) {
      console.error('[FormService] Error verifying submission ownership:', fetchErr.message);
      throw new Error(`Failed to verify submissions: ${fetchErr.message}`);
    }

    const validIds = new Set((validRows || []).map((r) => r.id));
    const invalidIds = submissionIds.filter((sid) => !validIds.has(sid));
    if (invalidIds.length > 0) {
      throw new Error(`The following submission IDs do not belong to this form or organization: ${invalidIds.join(', ')}`);
    }

    // Update each submission's attendance_status in the data JSONB column
    let updatedCount = 0;
    for (const row of validRows) {
      try {
        const updatedData = {
          ...(row.data || {}),
          attendance_status: attendanceStatus,
        };

        const { error: updateErr } = await supabase
          .from('universal_table')
          .update({
            data: updatedData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);

        if (updateErr) {
          console.warn(`[FormService] Error updating attendance for submission ${row.id}:`, updateErr.message);
        } else {
          updatedCount++;
        }
      } catch (e) {
        console.warn(`[FormService] Exception updating attendance for submission ${row.id}:`, e.message);
      }
    }

    return {
      success: true,
      updated: updatedCount,
      total: submissionIds.length,
      attendance_status: attendanceStatus,
      message: `Updated attendance status to '${attendanceStatus}' for ${updatedCount} submission(s).`,
    };
  },

  /**
   * Email Registrants Feature:
   * Dispatches personalized emails to all valid registered email addresses for a form
   */
  /**
   * Email Registrants Feature:
   * Dispatches personalized emails to form registrants with audience targeting ('unsent' | 'all')
   * Tracks email_sent and last_email_sent_at per submission to prevent duplicate spamming
   */
  sendFormRegistrantsEmail: async (formId, { subject, body, targetAudience = 'unsent', attendanceFilter = null, submission_ids = null }, organizationId) => {
    if (!subject || !subject.trim()) {
      throw new Error('Email subject is required.');
    }
    if (!body || !body.trim()) {
      throw new Error('Email message body is required.');
    }
    if (!['unsent', 'all'].includes(targetAudience)) {
      throw new Error("Invalid targetAudience parameter. Must be 'unsent' or 'all'.");
    }

    const VALID_ATTENDANCE_VALUES = ['Registered', 'Attended', 'Not Attended'];
    if (attendanceFilter && !VALID_ATTENDANCE_VALUES.includes(attendanceFilter)) {
      throw new Error(`Invalid attendanceFilter. Must be one of: ${VALID_ATTENDANCE_VALUES.join(', ')}`);
    }

    const form = await formService.getFormById(formId, organizationId);
    const allSubmissions = await formService.listSubmissions(formId, organizationId);

    if (allSubmissions.length === 0) {
      throw new Error('No registrants/submissions found for this form.');
    }

    let targetSubmissions = allSubmissions;
    let skippedCount = 0;

    // Filter to specific submission IDs if provided (for "Email Selected" feature)
    if (Array.isArray(submission_ids) && submission_ids.length > 0) {
      const idsSet = new Set(submission_ids);
      targetSubmissions = targetSubmissions.filter((sub) => idsSet.has(sub.id));
      if (targetSubmissions.length === 0) {
        throw new Error('None of the selected submissions were found.');
      }
    }

    // Apply attendance_status filter first (if specified)
    if (attendanceFilter) {
      targetSubmissions = targetSubmissions.filter((sub) => {
        const subAttendance = sub.attendance_status || sub.data?.attendance_status || null;
        return subAttendance === attendanceFilter;
      });
    }

    // Then apply email-sent filter
    if (targetAudience === 'unsent') {
      targetSubmissions = targetSubmissions.filter((sub) => sub.email_sent !== true && sub.data?.email_sent !== true);
      skippedCount = allSubmissions.length - targetSubmissions.length;

      if (targetSubmissions.length === 0) {
        const filterNote = attendanceFilter ? ` with attendance status '${attendanceFilter}'` : '';
        throw new Error(`No unsent registrants found${filterNote}. All matching registrants have already received an email update. Select "All Registrants" if you wish to re-send.`);
      }
    }

    // Extract & deduplicate recipient list (grouping all matching submission IDs per email)
    const validRecipients = [];
    let invalidCount = 0;

    for (const sub of targetSubmissions) {
      const email = (sub.email || '').trim();
      if (email && email.includes('@')) {
        const lowerEmail = email.toLowerCase();
        let recipient = validRecipients.find((r) => r.email.toLowerCase() === lowerEmail);
        if (!recipient) {
          const fullName = sub.name || 'Registrant';
          const firstName = fullName.split(' ')[0] || fullName;
          const lastName = fullName.split(' ').slice(1).join(' ') || '';
          recipient = {
            subIds: [sub.id],
            email,
            firstName,
            lastName,
            fullName,
          };
          validRecipients.push(recipient);
        } else {
          recipient.subIds.push(sub.id);
        }
      } else {
        invalidCount++;
      }
    }

    if (validRecipients.length === 0) {
      throw new Error('No valid email addresses found among the selected registrants.');
    }

    let sentCount = 0;
    let failedCount = 0;

    const contactEmail = form.header_content?.webinar_contact_email || form.data?.header_content?.webinar_contact_email || form.webinar_contact_email || form.data?.webinar_contact_email || 'mounika@csnow.io';

    // Send emails individually to avoid exposing CC
    for (const recipient of validRecipients) {
      // Personalize placeholders {{FirstName}}, {{LastName}}, {{FullName}}, {{FormName}}, {{ContactEmail}}
      let personalizedBody = body
        .replace(/\{\{\s*FirstName\s*\}\}/gi, recipient.firstName)
        .replace(/\{\{\s*LastName\s*\}\}/gi, recipient.lastName)
        .replace(/\{\{\s*FullName\s*\}\}/gi, recipient.fullName)
        .replace(/\{\{\s*FormName\s*\}\}/gi, form.name)
        .replace(/\{\{\s*ContactEmail\s*\}\}/gi, contactEmail);

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"/></head>
        <body style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:32px;margin:0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center">
                <table width="580" style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                  <tr>
                    <td>
                      <div style="font-size:13px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
                        ${form.name}
                      </div>
                      <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">${subject}</h2>
                      <div style="width:36px;height:3px;background:#6366f1;border-radius:2px;margin-bottom:20px;"></div>
                      <div style="color:#334155;font-size:15px;line-height:1.7;white-space:pre-wrap;">${personalizedBody}</div>
                      
                      <!-- Clean Compact Need help? Section -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 12px;border-top:1px solid #f1f5f9;padding-top:16px;border-collapse:collapse;">
                        <tr>
                          <td width="36" valign="middle" style="padding-right:10px;">
                            <table cellpadding="0" cellspacing="0" style="width:32px;height:32px;border-radius:50%;background:#eef2ff;border-collapse:collapse;" bgcolor="#eef2ff">
                              <tr>
                                <td align="center" valign="middle" style="height:32px;text-align:center;font-size:15px;color:#6366f1;line-height:1;font-family:Arial,sans-serif;">
                                  ✉
                                </td>
                              </tr>
                            </table>
                          </td>
                          <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#475569;">
                            Have queries? Contact us: <a href="mailto:${contactEmail}" style="color:#4f46e5;font-weight:700;text-decoration:none;">${contactEmail}</a>
                          </td>
                        </tr>
                      </table>

                      <hr style="border:none;border-top:1px solid #f1f5f9;margin:20px 0 16px;"/>
                      <p style="margin:0;color:#94a3b8;font-size:12px;">Sent via CRM Lite Forms Engine</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const dispatchResult = await emailService.sendEmail({
        to: recipient.email,
        subject: subject.trim(),
        html: emailHtml,
        text: personalizedBody,
        replyTo: contactEmail,
      });

      if (dispatchResult) {
        sentCount++;
        // Update all form submission records for this email in universal_table to mark email_sent = true
        if (recipient.subIds && recipient.subIds.length > 0) {
          for (const sId of recipient.subIds) {
            try {
              const { data: currentSubRow } = await supabase
                .from('universal_table')
                .select('data')
                .eq('id', sId)
                .single();

              await supabase
                .from('universal_table')
                .update({
                  data: {
                    ...(currentSubRow?.data || {}),
                    email_sent: true,
                    last_email_sent_at: new Date().toISOString(),
                    last_email_subject: subject.trim(),
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq('id', sId);
            } catch (e) {
              console.warn('[FormService] Note updating email_sent status for submission:', sId, e.message);
            }
          }
        }
      } else {
        failedCount++;
      }
    }

    return {
      success: true,
      targetAudience,
      total: allSubmissions.length,
      sent: sentCount,
      failed: failedCount,
      skipped: skippedCount,
      invalid: invalidCount,
      message: `Emails dispatched to ${sentCount} registrant(s). (${failedCount} failed, ${skippedCount} skipped, ${invalidCount} invalid)`,
    };
  },

  /**
   * List all media files for an organization from Supabase Storage 'media' bucket
   * Scoped strictly by organizationId prefix: <organization_id>/
   */
  listOrgMedia: async (organizationId) => {
    const bucketName = 'media';
    const storageClient = supabaseAdmin || supabase;

    try {
      const { data: formFolders, error: folderErr } = await storageClient.storage
        .from(bucketName)
        .list(`${organizationId}/forms`, { limit: 100 });

      if (folderErr || !formFolders) {
        console.warn('[FormService] List org media warning:', folderErr?.message);
        return [];
      }

      const mediaList = [];

      for (const item of formFolders) {
        // If it's a subfolder (form_id directory)
        if (item.name && !item.id) {
          const { data: files } = await storageClient.storage
            .from(bucketName)
            .list(`${organizationId}/forms/${item.name}`, { limit: 100 });

          for (const file of files || []) {
            if (file.name && !file.name.startsWith('.')) {
              const filePath = `${organizationId}/forms/${item.name}/${file.name}`;
              const { data: pubUrlData } = storageClient.storage
                .from(bucketName)
                .getPublicUrl(filePath);

              mediaList.push({
                id: file.id || filePath,
                name: file.name,
                url: pubUrlData?.publicUrl || filePath,
                created_at: file.created_at || new Date().toISOString(),
              });
            }
          }
        } else if (item.name && !item.name.startsWith('.')) {
          // Direct file in <organization_id>/forms/
          const filePath = `${organizationId}/forms/${item.name}`;
          const { data: pubUrlData } = storageClient.storage
            .from(bucketName)
            .getPublicUrl(filePath);

          mediaList.push({
            id: item.id || filePath,
            name: item.name,
            url: pubUrlData?.publicUrl || filePath,
            created_at: item.created_at || new Date().toISOString(),
          });
        }
      }

      return mediaList;
    } catch (err) {
      console.error('[FormService] listOrgMedia error:', err.message);
      return [];
    }
  },

  /**
   * Upload image file to Supabase Storage bucket 'media'
   * Path convention: <company_id>/forms/<form_id>/<filename>
   */
  uploadMediaFile: async (fileBuffer, fileName, mimeType, organizationId, formId = 'general') => {
    const bucketName = 'media';
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    // Enforce MIME type validation (JPEG, PNG, WebP)
    const resolvedMime = (mimeType || '').toLowerCase();
    if (resolvedMime && !allowedMimeTypes.includes(resolvedMime)) {
      throw new Error(`Unsupported file type: ${mimeType}. Allowed formats are JPEG, PNG, and WebP.`);
    }

    // Use admin client if available to bypass potential storage RLS blocks
    const storageClient = supabaseAdmin || supabase;

    // Enforce 2 MB maximum file size limit
    if (fileBuffer.length > 2 * 1024 * 1024) {
      throw new Error('File size exceeds maximum limit of 2 MB.');
    }

    const fileExt = (fileName || 'image.png').split('.').pop().toLowerCase() || 'png';
    const cleanFileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${fileExt}`;
    const filePath = `${organizationId}/forms/${formId}/${cleanFileName}`;

    const { data, error } = await storageClient.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType: resolvedMime || `image/${fileExt}`,
        upsert: true,
      });

    if (error) {
      console.error('[FormService] Supabase Storage upload error:', error.message);
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    const { data: publicUrlData } = storageClient.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return {
      url: publicUrlData?.publicUrl || filePath,
      path: filePath,
    };
  },

  /**
   * Delete image file from Supabase Storage bucket 'media'
   * Path must start with <organization_id>/ for multi-tenant security
   */
  deleteMediaFile: async (filePath, organizationId) => {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path is required.');
    }

    const cleanPath = filePath.replace(/^\/+/, '');
    if (!cleanPath.startsWith(`${organizationId}/`)) {
      throw new Error('Unauthorized: Cannot delete media assets belonging to another organization.');
    }

    const bucketName = 'media';
    const storageClient = supabaseAdmin || supabase;

    const { data, error } = await storageClient.storage
      .from(bucketName)
      .remove([cleanPath]);

    if (error) {
      console.error('[FormService] Supabase Storage delete error:', error.message);
      throw new Error(`Storage delete failed: ${error.message}`);
    }

    return {
      success: true,
      message: 'Media asset deleted successfully.',
    };
  },

};

module.exports = formService;

