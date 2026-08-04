const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const emailService = require('./emailService');

// Helper to validate UUID format
const isUuid = (val) => Boolean(val && typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

/**
 * In-Memory Access Requests Store
 * Stores pending/historical requests without needing a persistent database table.
 * Key: requestId (UUID)
 * Value: AccessRequest Object
 */
const memoryRequests = new Map();

const accessRequestService = {
  /**
   * Submit a new Access Request for an Organization (Stored in memory)
   */
  /**
   * Submit a new Access Request for an Organization (Stored in memory)
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
        .from('organization')
        .select('id, organization_name')
        .eq('id', targetOrgInput)
        .maybeSingle();
      org = data;
    } else {
      const { data } = await supabase
        .from('organization')
        .select('id, organization_name')
        .ilike('organization_name', `%${targetOrgInput}%`)
        .limit(1)
        .maybeSingle();
      org = data;
    }

    // If not found, list available organizations in error message
    if (!org) {
      const { data: allOrgs } = await supabase
        .from('organization')
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

    // 3. Check if an access request already exists in memory for this email address and organization
    for (const req of memoryRequests.values()) {
      if (req.email === cleanEmail && req.organization_id === resolvedOrgId) {
        if (req.status === 'pending') {
          throw { statusCode: 409, message: 'An access request for this email address has already been submitted for this company and is pending admin approval.' };
        } else if (req.status === 'approved') {
          throw { statusCode: 409, message: 'User already exists and has been approved for this company. Please proceed to login.' };
        }
      }
    }

    // Hash password if provided
    let passwordHash = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }

    // 4. Generate in-memory request record + Action Token
    const requestId = crypto.randomUUID();
    const actionToken = crypto.randomBytes(24).toString('hex');
    const now = new Date().toISOString();

    const requestObj = {
      id: requestId,
      action_token: actionToken,
      organization_id: resolvedOrgId,
      organization_name: org.organization_name,
      first_name: firstName.trim(),
      last_name: (lastName || '').trim(),
      email: cleanEmail,
      password_hash: passwordHash,
      reason: reason || null,
      status: 'pending',
      approved_by: null,
      approved_at: null,
      rejected_at: null,
      review_reason: null,
      created_at: now,
      updated_at: now,
    };

    memoryRequests.set(requestId, requestObj);

    // 5. Dispatch Email Notifications asynchronously
    emailService.sendAccessRequestSubmittedEmail(requestObj.email, requestObj.first_name, org.organization_name);

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
        `${requestObj.first_name} ${requestObj.last_name}`.trim(),
        requestObj.email,
        org.organization_name,
        actionToken
      );
    });

    return requestObj;
  },

  /**
   * Get access requests for an organization from memoryRequests
   */
  getAccessRequests: async (organizationId, statusFilter = null) => {
    if (!isUuid(organizationId)) {
      throw { statusCode: 400, message: 'Invalid Organization ID.' };
    }

    const results = [];
    for (const req of memoryRequests.values()) {
      if (req.organization_id === organizationId) {
        if (!statusFilter || req.status === statusFilter) {
          results.push(req);
        }
      }
    }

    // Sort by created_at descending
    return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  /**
   * Approve an Access Request:
   * Inserts new active record into 'users' table ONLY upon admin approval.
   */
  approveAccessRequest: async (requestId, adminUser) => {
    if (!requestId) {
      throw { statusCode: 400, message: 'Access Request ID is required.' };
    }

    // 1. Retrieve request from memoryRequests
    const requestObj = memoryRequests.get(requestId);

    if (!requestObj) {
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

    let createdUserId = null;

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

      const { data: newUser, error: createUserErr } = await supabase
        .from('users')
        .insert([userPayload])
        .select('id')
        .single();

      if (createUserErr) {
        throw { statusCode: 400, message: `Failed to create active user record in database: ${createUserErr.message}` };
      }
      createdUserId = newUser?.id;
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

    // 4. Update in-memory request object status & audit trail
    const now = new Date().toISOString();
    requestObj.status = 'approved';
    requestObj.approved_by = adminUser?.id || null;
    requestObj.approved_at = now;
    requestObj.updated_at = now;

    memoryRequests.set(requestId, requestObj);

    // 5. Send Approval Notification Email
    emailService.sendAccessRequestApprovedEmail(
      requestObj.email,
      requestObj.first_name,
      org?.organization_name || 'CRM Platform'
    );

    return requestObj;
  },

  /**
   * Reject an Access Request (Updates status in memoryRequests)
   */
  rejectAccessRequest: async (requestId, adminUser, reviewReason) => {
    if (!requestId) {
      throw { statusCode: 400, message: 'Access Request ID is required.' };
    }

    // 1. Retrieve request from memoryRequests
    const requestObj = memoryRequests.get(requestId);

    if (!requestObj) {
      throw { statusCode: 404, message: 'Access request not found or expired.' };
    }

    // 2. Fetch Organization details for notification
    const { data: org } = await supabase
      .from('Organization')
      .select('id, organization_name')
      .eq('id', requestObj.organization_id)
      .maybeSingle();

    // 3. Update in-memory request status & audit fields
    const now = new Date().toISOString();
    requestObj.status = 'rejected';
    requestObj.rejected_at = now;
    requestObj.review_reason = reviewReason || 'Request rejected by organization administrator.';
    requestObj.updated_at = now;

    memoryRequests.set(requestId, requestObj);

    // 4. Send Rejection Notification Email
    emailService.sendAccessRequestRejectedEmail(
      requestObj.email,
      requestObj.first_name,
      org?.organization_name || 'CRM Platform',
      reviewReason
    );

    return requestObj;
  },

  /**
   * Handle One-Click Email Approval/Rejection Token Action
   */
  handleActionToken: async (token, action) => {
    if (!token) {
      throw { statusCode: 400, message: 'Action token is required.' };
    }

    let targetRequest = null;
    for (const req of memoryRequests.values()) {
      if (req.action_token === token) {
        targetRequest = req;
        break;
      }
    }

    if (!targetRequest) {
      throw { statusCode: 404, message: 'Invalid or expired action token.' };
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
