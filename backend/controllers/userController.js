const userService = require('../services/userService');
const metadataService = require('../services/metadataService');
const auditService = require('../services/auditService');

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
    const { email, first_name, last_name, password, role_id } = req.body;

    // Verify user role assignment authority
    await roleService.canAssignUserRole(req.user, null, role_id, organizationId);

    const newUser = await userService.inviteUser(organizationId, { email, first_name, last_name, password, role_id });

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
