const accessRequestService = require('../services/accessRequestService');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Access Request Controller
 * Handles user access request workflow and admin review actions.
 */

const createAccessRequest = async (req, res, next) => {
  try {
    const { organizationId, organization_id, organizationName, organization_name, orgName, firstName, first_name, lastName, last_name, email, password, reason } = req.body;
    const targetOrg = organizationId || organization_id || organizationName || organization_name || orgName;
    const fName = firstName || first_name;
    const lName = lastName || last_name;

    if (!targetOrg || !email || !fName) {
      return errorResponse(res, 'Organization Name/ID, first name, and email are required fields.', 400);
    }

    const requestRow = await accessRequestService.createAccessRequest({
      organizationId: targetOrg,
      organizationName: targetOrg,
      firstName: fName,
      lastName: lName,
      email,
      password,
      reason,
    });

    return successResponse(res, requestRow, 'Access request submitted successfully.', 201);
  } catch (err) {
    next(err);
  }
};

const getAccessRequests = async (req, res, next) => {
  try {
    const organizationId = req.user.organization_id;
    const { status } = req.query;

    if (!organizationId) {
      return errorResponse(res, 'Organization ID is required in user session.', 400);
    }

    const requests = await accessRequestService.getAccessRequests(organizationId, status);
    return successResponse(res, requests, 'Access requests retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

const approveAccessRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminUser = req.user;

    if (!id) {
      return errorResponse(res, 'Access request ID parameter is required.', 400);
    }

    const updatedRequest = await accessRequestService.approveAccessRequest(id, adminUser);
    return successResponse(res, updatedRequest, 'Access request approved successfully.');
  } catch (err) {
    next(err);
  }
};

const rejectAccessRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, review_reason } = req.body;
    const adminUser = req.user;

    if (!id) {
      return errorResponse(res, 'Access request ID parameter is required.', 400);
    }

    const updatedRequest = await accessRequestService.rejectAccessRequest(
      id,
      adminUser,
      reason || review_reason
    );
    return successResponse(res, updatedRequest, 'Access request rejected successfully.');
  } catch (err) {
    next(err);
  }
};

const handleActionToken = async (req, res, next) => {
  try {
    const { token, action } = req.query;

    if (!token || !action) {
      return errorResponse(res, 'Token and action query parameters are required.', 400);
    }

    const result = await accessRequestService.handleActionToken(token, action);

    // Render HTML response for browser clicks
    const isAlreadyProcessed = result.alreadyProcessed;
    const finalStatus = isAlreadyProcessed ? result.previousStatus : (action === 'approve' ? 'approved' : 'rejected');
    const isApprove = finalStatus === 'approved';

    const statusColor = isApprove ? '#16a34a' : '#dc2626';
    let title = isApprove ? 'Access Request Approved' : 'Access Request Rejected';
    if (isAlreadyProcessed) {
      title = isApprove ? 'Access Request Already Approved' : 'Access Request Already Rejected';
    }

    let description = isApprove
      ? `Access request for <strong>${result.first_name} ${result.last_name || ''}</strong> (${result.email}) has been approved and activated.`
      : `Access request for <strong>${result.first_name} ${result.last_name || ''}</strong> (${result.email}) has been rejected.`;

    if (isAlreadyProcessed) {
      description = `This access request for <strong>${result.first_name} ${result.last_name || ''}</strong> (${result.email}) was <strong>already ${isApprove ? 'approved' : 'rejected'}</strong> previously. No further action is required.`;
    }

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; max-width: 480px; border: 1px solid #e2e8f0; }
          .icon { width: 56px; height: 56px; border-radius: 50%; background: ${isApprove ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)'}; color: ${statusColor}; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin: 0 auto 1rem; }
          h1 { color: #0f172a; font-size: 1.35rem; margin-bottom: 0.5rem; }
          p { color: #475569; font-size: 0.925rem; line-height: 1.6; margin-bottom: 1.5rem; }
          a { display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 0.875rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">${isApprove ? '✓' : '✕'}</div>
          <h1>${title}</h1>
          <p>${description}</p>
          <a href="${clientUrl}/login">Return to CRM Lite</a>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createAccessRequest,
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  handleActionToken,
};
