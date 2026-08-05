const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const emailService = require('./emailService');


// Helper to validate UUID format
const isUuid = (val) => Boolean(val && typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));


const accessRequestService = {
  /**
   * Submit a new Access Request for an Organization (Stored in Supabase DB)
   */
  createAccessRequest: async ({ organizationId, organizationName, firstName, lastName, email, password, reason }) => {
    const targetOrgInput = (organizationId || organizationName || '').trim();
    if (!targetOrgInput || !email || !firstName) {
      throw { statusCode: 400, message: 'Organization ID or Name, first name, and email are required fields.' };
    }


    const cleanEmail = email.toLowerCase().trim();


    // 1. Lookup target Organization by UUID or Name
    let org = null;
    if (isUuid(targetOrgInput)) {
      const { data } = await supabase
        .from('Organization')
        .select('id, organization_name')
        .eq('id', targetOrgInput)
        .maybeSingle();
      org = data;
    } else {
      const { data } = await supabase
        .from('Organization')
        .select('id, organization_name')
        .ilike('organization_name', `%${targetOrgInput}%`)
        .limit(1)
        .maybeSingle();
      org = data;
    }


    // If not found, list available organizations in error message
    if (!org) {
      const { data: allOrgs } = await supabase
        .from('Organization')
        .select('organization_name');


      const availList = allOrgs && allOrgs.length > 0
        ? allOrgs.map((o) => o.organization_name).join(', ')
        : 'None available';


      throw {
        statusCode: 404,
        message: `Organization '${targetOrgInput}' not found in database. Available organizations: [${availList}]`,
      };
    }


    const resolvedOrgId = org.id;


    // 2. Check if user with this email already exists in database users table
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, status, organization_id')
      .eq('email', cleanEmail)
      .maybeSingle();


    if (existingUser) {
      if (existingUser.organization_id === resolvedOrgId) {
        throw { statusCode: 409, message: 'User already exists in this company with this email address. Please proceed to login.' };
      } else {
        throw { statusCode: 409, message: 'A user account with this email address is already registered in another organization.' };
      }
    }


    // 3. Check if an access request already exists in DB for this email + org (pending)
    const { data: existingRequest } = await supabase
      .from('access_requests')
      .select('id, status')
      .eq('email', cleanEmail)
      .eq('organization_id', resolvedOrgId)
      .maybeSingle();


    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        throw { statusCode: 409, message: 'An access request for this email address has already been submitted for this company and is pending admin approval.' };
      } else if (existingRequest.status === 'approved') {
        throw { statusCode: 409, message: 'User already exists and has been approved for this company. Please proceed to login.' };
      }
    }


    // Hash password if provided
    let passwordHash = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }


    // 4. Generate action token and insert request into Supabase
    const actionToken = crypto.randomBytes(24).toString('hex');


    const requestPayload = {
      organization_id: resolvedOrgId,
      organization_name: org.organization_name,
      first_name: firstName.trim(),
      last_name: (lastName || '').trim(),
      email: cleanEmail,
      password_hash: passwordHash,
      reason: reason || null,
      status: 'pending',
      action_token: actionToken,
    };


    const { data: requestRow, error: insertErr } = await supabase
      .from('access_requests')
      .insert([requestPayload])
      .select()
      .single();


    if (insertErr) {
      throw { statusCode: 500, message: `Failed to save access request: ${insertErr.message}` };
    }


    // 5. Dispatch Email Notifications asynchronously
    emailService.sendAccessRequestSubmittedEmail(requestRow.email, requestRow.first_name, org.organization_name);


    // Notify ONLY organization administrators from database users & roles table
    let adminEmails = [];
    const { data: orgAdmins } = await supabase
      .from('users')
      .select('email, roles!inner(role_name)')
      .eq('organization_id', resolvedOrgId)
      .eq('status', 'active')
      .ilike('roles.role_name', '%admin%');


    if (orgAdmins && orgAdmins.length > 0) {
      adminEmails = orgAdmins.map((a) => a.email);
    } else {
      // Fallback: Query active users in target organization with assigned role_id
      const { data: fallbackAdmins } = await supabase
        .from('users')
        .select('email')
        .eq('organization_id', resolvedOrgId)
        .eq('status', 'active')
        .not('role_id', 'is', null)
        .limit(2);


      if (fallbackAdmins && fallbackAdmins.length > 0) {
        adminEmails = fallbackAdmins.map((a) => a.email);
      }
    }


    // Deduplicate emails
    adminEmails = Array.from(new Set(adminEmails));


    adminEmails.forEach((adminEmail) => {
      emailService.sendAdminNewRequestNotification(
        adminEmail,
        `${requestRow.first_name} ${requestRow.last_name}`.trim(),
        requestRow.email,
        org.organization_name,
        actionToken
      );
    });


    return requestRow;
  },


  /**
   * Get access requests for an organization from Supabase
   */
  getAccessRequests: async (organizationId, statusFilter = null) => {
    if (!isUuid(organizationId)) {
      throw { statusCode: 400, message: 'Invalid Organization ID.' };
    }


    let query = supabase
      .from('access_requests')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });


    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }


    const { data, error } = await query;
    if (error) {
      throw { statusCode: 500, message: `Failed to retrieve access requests: ${error.message}` };
    }


    return data || [];
  },


  /**
   * Approve an Access Request: Inserts new active record into 'users' table ONLY upon admin approval.
   */
  approveAccessRequest: async (requestId, adminUser) => {
    if (!requestId) {
      throw { statusCode: 400, message: 'Access Request ID is required.' };
    }


    // 1. Retrieve request from Supabase
    const { data: requestObj, error: fetchErr } = await supabase
      .from('access_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();


    if (fetchErr || !requestObj) {
      throw { statusCode: 404, message: 'Access request not found or expired.' };
    }


    if (requestObj.status === 'approved') {
      throw { statusCode: 400, message: 'This access request has already been approved.' };
    }


    // 2. Fetch Organization details for notification
    const { data: org } = await supabase
      .from('Organization')
      .select('id, organization_name')
      .eq('id', requestObj.organization_id)
      .maybeSingle();


    // 3. Create or activate User in database 'users' table
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, status')
      .eq('organization_id', requestObj.organization_id)
      .eq('email', requestObj.email)
      .maybeSingle();


    if (!existingUser) {
      const userPayload = {
        id: crypto.randomUUID(),
        organization_id: requestObj.organization_id,
        first_name: requestObj.first_name,
        last_name: requestObj.last_name,
        email: requestObj.email,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };


      if (requestObj.password_hash) {
        userPayload.password_hash = requestObj.password_hash;
      }


      const { error: createUserErr } = await supabase
        .from('users')
        .insert([userPayload]);


      if (createUserErr) {
        throw { statusCode: 400, message: `Failed to create active user record in database: ${createUserErr.message}` };
      }
    } else if (existingUser.status !== 'active') {
      const updatePayload = { status: 'active', updated_at: new Date().toISOString() };
      if (requestObj.password_hash) {
        updatePayload.password_hash = requestObj.password_hash;
      }


      const { error: updateStatusErr } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', existingUser.id);


      if (updateStatusErr) {
        throw { statusCode: 400, message: `Failed to update user status in database: ${updateStatusErr.message}` };
      }
    }


    // 4. Update access request status in Supabase
    const now = new Date().toISOString();
    const { data: updatedRequest, error: updateErr } = await supabase
      .from('access_requests')
      .update({
        status: 'approved',
        approved_by: adminUser?.id || 'EMAIL_ACTION_LINK',
        approved_at: now,
        updated_at: now,
      })
      .eq('id', requestId)
      .select()
      .single();


    if (updateErr) {
      throw { statusCode: 500, message: `Failed to update access request status: ${updateErr.message}` };
    }


    // 5. Send Approval Notification Email
    emailService.sendAccessRequestApprovedEmail(
      requestObj.email,
      requestObj.first_name,
      org?.organization_name || 'CRM Platform'
    );


    return updatedRequest;
  },


  /**
   * Reject an Access Request (Updates status in Supabase)
   */
  rejectAccessRequest: async (requestId, adminUser, reviewReason) => {
    if (!requestId) {
      throw { statusCode: 400, message: 'Access Request ID is required.' };
    }


    // 1. Retrieve request from Supabase
    const { data: requestObj, error: fetchErr } = await supabase
      .from('access_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();


    if (fetchErr || !requestObj) {
      throw { statusCode: 404, message: 'Access request not found or expired.' };
    }


    // 2. Fetch Organization details for notification
    const { data: org } = await supabase
      .from('Organization')
      .select('id, organization_name')
      .eq('id', requestObj.organization_id)
      .maybeSingle();


    // 3. Update access request status in Supabase
    const now = new Date().toISOString();
    const { data: updatedRequest, error: updateErr } = await supabase
      .from('access_requests')
      .update({
        status: 'rejected',
        review_reason: reviewReason || 'Request rejected by organization administrator.',
        rejected_at: now,
        updated_at: now,
      })
      .eq('id', requestId)
      .select()
      .single();


    if (updateErr) {
      throw { statusCode: 500, message: `Failed to update access request status: ${updateErr.message}` };
    }


    // 4. Send Rejection Notification Email
    emailService.sendAccessRequestRejectedEmail(
      requestObj.email,
      requestObj.first_name,
      org?.organization_name || 'CRM Platform',
      reviewReason
    );


    return updatedRequest;
  },


  /**
   * Handle One-Click Email Approval/Rejection Token Action
   * Looks up the request by action_token from Supabase — survives server restarts.
   */
  handleActionToken: async (token, action) => {
    if (!token) {
      throw { statusCode: 400, message: 'Action token is required.' };
    }


    // Lookup request by action_token in Supabase DB
    const { data: targetRequest, error: lookupErr } = await supabase
      .from('access_requests')
      .select('*')
      .eq('action_token', token)
      .maybeSingle();


    if (lookupErr || !targetRequest) {
      throw { statusCode: 404, message: 'Invalid or expired action token. The request may have already been processed or the server was restarted.' };
    }


    if (action === 'approve') {
      return accessRequestService.approveAccessRequest(targetRequest.id, { id: 'EMAIL_ACTION_LINK', name: 'Email Action Token' });
    } else if (action === 'reject') {
      return accessRequestService.rejectAccessRequest(targetRequest.id, { id: 'EMAIL_ACTION_LINK', name: 'Email Action Token' }, 'Rejected via email action link.');
    } else {
      throw { statusCode: 400, message: 'Invalid action parameter. Must be "approve" or "reject".' };
    }
  },
};


module.exports = accessRequestService;



