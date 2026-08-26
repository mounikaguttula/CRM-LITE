const metadataService = require('../services/metadataService');
const { successResponse } = require('../utils/response');

/**
 * Metadata Controller
 * Handles all platform metadata endpoints.
 */
const getPlatformMetadata = async (req, res, next) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const data = await metadataService.getPlatformMetadata(req.user, forceRefresh);
    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

const getObjectDefinitions = async (req, res, next) => {
  try {
    const organizationId = req.params.organizationId || req.user?.organization_id;
    const objects = await metadataService.getObjectDefinitions(organizationId);
    return successResponse(res, objects, 'Object definitions retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

const createObjectDefinition = async (req, res, next) => {
  try {
    const organizationId = req.params.organizationId || req.user?.organization_id;
    const newObj = await metadataService.createObjectDefinition(req.body, organizationId);
    return res.status(201).json(newObj);
  } catch (err) {
    let errorMsg = err.message || 'Failed to create object definition.';
    if (errorMsg.includes('unique constraint') || errorMsg.includes('already exists') || errorMsg.includes('duplicate key')) {
      errorMsg = 'Module Name already exists.';
    }
    return res.status(400).json({ error: errorMsg });
  }
};

const getObjectFields = async (req, res, next) => {
  try {
    const objectType = req.params.objectType || req.params.objectTypeId;
    const organizationId = req.params.organizationId || req.user?.organization_id;
    const meta = await metadataService.getObjectDefinition(objectType, organizationId);
    return res.status(200).json(meta.fields);
  } catch (err) {
    next(err);
  }
};

const getObjectViews = async (req, res, next) => {
  try {
    const objectType = req.params.objectType || req.params.objectTypeId;
    const organizationId = req.params.organizationId || req.user?.organization_id;
    const meta = await metadataService.getObjectDefinition(objectType, organizationId);
    return res.status(200).json(meta.views);
  } catch (err) {
    next(err);
  }
};

const getNavigation = async (req, res, next) => {
  try {
    const organizationId = req.params.organizationId || req.user?.organization_id;
    const permissions = await metadataService.getPermissions(req.user);
    const nav = await metadataService.getNavigation(organizationId, null, permissions);
    return successResponse(res, nav, 'Navigation items retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

const getPermissions = async (req, res, next) => {
  try {
    const permissions = await metadataService.getPermissions(req.user);
    return successResponse(res, permissions, 'Permissions retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

const createObjectField = async (req, res, next) => {
  try {
    const objectType = req.params.objectType || req.params.objectTypeId || req.body.objectType;
    const organizationId = req.params.organizationId || req.user?.organization_id;
    const newField = await metadataService.createField(objectType, req.body, organizationId);
    return res.status(201).json(newField);
  } catch (err) {
    let errorMsg = err.message || 'Failed to create field in database.';
    if (errorMsg.includes('unique constraint') || errorMsg.includes('already exists') || errorMsg.includes('duplicate key')) {
      errorMsg = 'Field Name already exists in this module.';
    }
    return res.status(400).json({ error: errorMsg });
  }
};

const deleteObjectField = async (req, res, next) => {
  try {
    const objectType = req.params.objectType || req.params.objectTypeId;
    const fieldId = req.params.fieldId;
    const organizationId = req.params.organizationId || req.user?.organization_id;
    await metadataService.deleteField(objectType, fieldId, organizationId);
    return res.status(200).json({ success: true, message: 'Field deleted successfully.' });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to delete field from database.' });
  }
};

const deleteObjectDefinition = async (req, res, next) => {
  try {
    const objectType = req.params.objectType || req.params.objectTypeId;
    const organizationId = req.params.organizationId || req.user?.organization_id;
    await metadataService.deleteObjectDefinition(objectType, organizationId);
    return res.status(200).json({ success: true, message: 'Custom module deleted successfully.' });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to delete custom module from database.' });
  }
};

const getSetupFields = async (req, res, next) => {
  try {
    const organizationId = req.params.organizationId || req.user?.organization_id;
    const fields = await metadataService.getAllFields(organizationId);
    return res.status(200).json(fields);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPlatformMetadata,
  getObjectDefinitions,
  createObjectDefinition,
  deleteObjectDefinition,
  getObjectFields,
  getObjectViews,
  getNavigation,
  getPermissions,
  createObjectField,
  deleteObjectField,
  getSetupFields,
};
