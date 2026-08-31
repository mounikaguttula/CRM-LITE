const roleService = require('../services/roleService');
const metadataService = require('../services/metadataService');
const auditService = require('../services/auditService');
const { successResponse } = require('../utils/response');

/**
 * Role Controller
 * Handles role management, object permissions, and field-level security HTTP requests.
 */
const getRoles = async (req, res, next) => {
  try {
    const organizationId = req.user?.organization_id;
    const roles = await roleService.getRolesByOrganization(organizationId);
    return res.status(200).json(roles);
  } catch (err) {
    next(err);
  }
};

const getRoleDetails = async (req, res, next) => {
  try {
    const roleId = req.params.id || req.params.roleId;
    const organizationId = req.user?.organization_id;
    const details = await roleService.getRoleDetails(roleId, organizationId);
    return res.status(200).json(details);
  } catch (err) {
    next(err);
  }
};

const createRole = async (req, res, next) => {
  try {
    const organizationId = req.user?.organization_id;

    // Check authority: user must be allowed to create/manage target role
    await roleService.canManageRole(req.user, { role_name: req.body?.name || req.body?.role_name || 'Custom Role', organization_id: organizationId }, organizationId);

    const newRole = await roleService.createRole(req.body, organizationId);

    auditService.logSetupActivity({
      organization_id: organizationId,
      user_id: req.user?.id,
      action: 'CREATE',
      entity_type: 'role',
      entity_id: newRole?.id,
      entity_name: newRole?.name || req.body?.name,
      module_name: 'Roles',
    }).catch(err => console.error('❌ Audit log error:', err.message));

    return res.status(201).json(newRole);
  } catch (err) {
    if (err?.statusCode === 403) return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
    return res.status(400).json({ error: err.message || 'Failed to create role.' });
  }
};

const updateRole = async (req, res, next) => {
  try {
    const roleId = req.params.id || req.params.roleId;
    const organizationId = req.user?.organization_id;

    // Verify role management authority & self-role permission modification protection
    await roleService.canManageRole(req.user, roleId, organizationId);

    const result = await roleService.updateRole(req.body ? (req.body.id ? req.body : { ...req.body, id: roleId }) : { id: roleId }, organizationId);

    auditService.logSetupActivity({
      organization_id: organizationId,
      user_id: req.user?.id,
      action: 'UPDATE',
      entity_type: 'role',
      entity_id: roleId,
      entity_name: req.body?.name || roleId,
      module_name: 'Roles',
    }).catch(err => console.error('❌ Audit log error:', err.message));

    return res.status(200).json(result);
  } catch (err) {
    if (err?.statusCode === 403) return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
    return res.status(400).json({ error: err.message || 'Failed to update role permissions.' });
  }
};

const updateRoleHierarchy = async (req, res, next) => {
  try {
    const organizationId = req.user?.organization_id;
    const hierarchy = req.body?.hierarchy || req.body;

    if (!Array.isArray(hierarchy) || hierarchy.length === 0) {
      return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'Hierarchy array is required.' });
    }

    const result = await roleService.updateRoleHierarchy(hierarchy, organizationId, req.user);

    auditService.logSetupActivity({
      organization_id: organizationId,
      user_id: req.user?.id,
      action: 'UPDATE',
      entity_type: 'role_hierarchy',
      entity_id: 'hierarchy',
      entity_name: 'Role Hierarchy Order',
      module_name: 'Roles',
    }).catch(err => console.error('❌ Audit log error:', err.message));

    return res.status(200).json({ success: true, message: 'Role hierarchy updated successfully.', ...result });
  } catch (err) {
    if (err?.statusCode === 403) return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
    return res.status(400).json({ success: false, message: 'Unable to update role hierarchy. No changes were saved.', error: err.message });
  }
};

module.exports = {
  getRoles,
  getRoleDetails,
  createRole,
  updateRole,
  updateRoleHierarchy,
};
