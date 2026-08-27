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
    // Require Administrator role
    await metadataService.checkAdminPermission(req.user);

    const organizationId = req.user?.organization_id;
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
    // Require Administrator role
    await metadataService.checkAdminPermission(req.user);

    const roleId = req.params.id || req.params.roleId;
    const organizationId = req.user?.organization_id;
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

module.exports = {
  getRoles,
  getRoleDetails,
  createRole,
  updateRole,
};
