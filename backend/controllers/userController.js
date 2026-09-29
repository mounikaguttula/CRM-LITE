const userService = require('../services/userService');
const metadataService = require('../services/metadataService');
const auditService = require('../services/auditService');
const emailService = require('../services/emailService');
const supabase = require('../config/supabase');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production';

// Shared in-memory invite token store (same as authController's activeResetTokens)
// We import it from authController to share the same Map instance
let activeResetTokens;
try {
  activeResetTokens = require('./authController').__resetTokens;
} catch (_) {
  activeResetTokens = new Map();
}

/**
 * User Controller
 * Handles user management HTTP requests with strict administrative authorization and self-role modification protection.
 */
const getUsers = async (req, res, next) => {
  try {
    const organizationId = req.user?.organization_id;
    const users = await userService.getUsersByOrganization(organizationId);
    return res.status(200).json(users);
  } catch (err) {
    next(err);
  }
};

const roleService = require('../services/roleService');

const inviteUser = async (req, res, next) => {
  try {
    const organizationId = req.user?.organization_id;
    const { email, first_name, last_name, role_id } = req.body;

    // Verify user role assignment authority
    await roleService.canAssignUserRole(req.user, null, role_id, organizationId);

    // Create user with no password (status: 'invited')
    const newUser = await userService.inviteUser(organizationId, {
      email,
      first_name,
      last_name,
      password: null,
      role_id,
    });

    // Generate a 72-hour invite token using the same JWT pattern as forgotPassword
    try {
      const tokenUuid = crypto.randomUUID();
      const expiresAt = Date.now() + 72 * 60 * 60 * 1000; // 72 hours

      // Store token in the shared reset tokens map
      if (activeResetTokens) {
        activeResetTokens.set(tokenUuid, { email, expiresAt, used: false });
      }

      const inviteToken = jwt.sign(
        { email, type: 'password_reset', jti: tokenUuid },
        JWT_SECRET,
        { expiresIn: '72h' }
      );

      // Fetch org name for the email
      const { data: org } = await supabase
        .from('organization')
        .select('organization_name')
        .eq('id', organizationId)
        .maybeSingle();

      const orgName = org?.organization_name || 'Your Organization';
      const inviterName = req.user?.name || `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || 'An administrator';

      await emailService.sendUserInviteEmail(email, first_name, orgName, inviterName, inviteToken);
    } catch (mailErr) {
      console.error('⚠️ Invite email could not be delivered:', mailErr.message || mailErr);
    }

    auditService.logSetupActivity({
      organization_id: organizationId,
      user_id: req.user?.id,
      action: 'CREATE',
      entity_type: 'user',
      entity_id: newUser?.id,
      entity_name: email || `${first_name || ''} ${last_name || ''}`.trim(),
      module_name: 'Users',
    }).catch(err => console.error('❌ Audit log error:', err.message));

    return res.status(201).json(newUser);
  } catch (err) {
    if (err?.statusCode === 403) return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
    next(err);
  }
};


const updateUser = async (req, res, next) => {
  try {
    const organizationId = req.user?.organization_id;
    const userId = req.params.id;
    const { first_name, last_name, email, role_id, status } = req.body;

    // Verify user role assignment authority (evaluates self-protection, target user rank, and new role rank)
    await roleService.canAssignUserRole(req.user, userId, role_id, organizationId);

    const updatedUser = await userService.updateUser(organizationId, userId, { first_name, last_name, email, role_id, status });

    auditService.logSetupActivity({
      organization_id: organizationId,
      user_id: req.user?.id,
      action: 'UPDATE',
      entity_type: 'user',
      entity_id: userId,
      entity_name: email || `${first_name || ''} ${last_name || ''}`.trim() || userId,
      module_name: 'Users',
    }).catch(err => console.error('❌ Audit log error:', err.message));

    return res.status(200).json(updatedUser);
  } catch (err) {
    if (err?.statusCode === 403) return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
    if (err?.statusCode === 404) return res.status(404).json({ statusCode: 404, error: 'Not Found', message: err.message });
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    // Require Administrator role
    await metadataService.checkAdminPermission(req.user);

    const organizationId = req.user?.organization_id;
    const userId = req.params.id;
    const currentUserId = req.user?.id;
    await userService.deleteUser(organizationId, userId, currentUserId);

    auditService.logSetupActivity({
      organization_id: organizationId,
      user_id: req.user?.id,
      action: 'DELETE',
      entity_type: 'user',
      entity_id: userId,
      entity_name: userId,
      module_name: 'Users',
    }).catch(err => console.error('❌ Audit log error:', err.message));

    return res.status(200).json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsers,
  inviteUser,
  updateUser,
  deleteUser,
};
