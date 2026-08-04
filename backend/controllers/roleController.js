const roleService = require('../services/roleService');
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
    const newRole = await roleService.createRole(req.body, organizationId);
    return res.status(201).json(newRole);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to create role.' });
  }
};

const updateRole = async (req, res, next) => {
  try {
    const roleId = req.params.id || req.params.roleId;
    const organizationId = req.user?.organization_id;
    const result = await roleService.updateRole(roleId, req.body, organizationId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to update role permissions.' });
  }
};

module.exports = {
  getRoles,
  getRoleDetails,
  createRole,
  updateRole,
};
