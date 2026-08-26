const objectService = require('../services/objectService');
const metadataService = require('../services/metadataService');
const auditService = require('../services/auditService');
const { successResponse } = require('../utils/response');


/**
 * Generic Object Controller
 * Serves all CRM objects (Leads, Deals, Contacts, Employees, Students, Invoices, Assets, etc.)
 * driven purely by URL parameter :objectType.
 */


// Helper to look up object permissions with case-insensitivity and singular/plural fallbacks
const getPermForObject = (perms, objectType) => {
  if (!perms || !objectType) return null;
  const key = String(objectType).toLowerCase();
  const keySingular = key.endsWith('s') ? key.slice(0, -1) : key;
  const keyPlural = key.endsWith('s') ? key : `${key}s`;
  return perms[key] || perms[keySingular] || perms[keyPlural];
};


const getRecords = async (req, res, next) => {
  try {
    const objectType = req.params.objectType || req.path.replace(/^\//, '').split('/')[0];
    const organizationId = req.user?.organization_id;

    // Enforce permission check
    await metadataService.checkPermission(req.user, objectType, 'read');

    const options = {};
    if (req.query.scope === 'user' || req.query.owner_id) {
      // Security enforcement: Always use authenticated user's ID from req.user
      options.owner_id = req.user?.id;
    }

    const records = await objectService.listRecords(objectType, organizationId, options);
    return res.status(200).json(records);
  } catch (err) {
    next(err);
  }
};


const getRecordById = async (req, res, next) => {
  try {
    const objectType = req.params.objectType;
    const { id } = req.params;
    const organizationId = req.user?.organization_id;

    // Enforce permission check
    await metadataService.checkPermission(req.user, objectType, 'read');

    const record = await objectService.getRecordById(objectType, id, organizationId);
    return successResponse(res, record, `${objectType} record fetched successfully.`);
  } catch (err) {
    next(err);
  }
};


const createRecord = async (req, res, next) => {
  try {
    const objectType = req.params.objectType;
    const organizationId = req.user?.organization_id;
    const userId = req.user?.id;

    // Enforce permission check
    await metadataService.checkPermission(req.user, objectType, 'create');

    const record = await objectService.createRecord(objectType, req.body, organizationId, userId);

    // Log audit activity after successful creation
    auditService.logUserActivity({
      organization_id: organizationId,
      user_id: userId,
      action: 'CREATE',
      module: objectType,
      record_id: record?.id || null,
      description: `Created ${objectType}`,
    }).catch((auditErr) => console.error('❌ Audit log error in createRecord:', auditErr.message));

    return successResponse(res, record, `${objectType} record created successfully.`, 201);
  } catch (err) {
    next(err);
  }
};


const updateRecord = async (req, res, next) => {
  try {
    const objectType = req.params.objectType;
    const { id } = req.params;
    const organizationId = req.user?.organization_id;
    const userId = req.user?.id;

    // Enforce permission check
    await metadataService.checkPermission(req.user, objectType, 'update');

    const record = await objectService.updateRecord(objectType, id, req.body, organizationId, userId);

    // Log audit activity after successful update
    auditService.logUserActivity({
      organization_id: organizationId,
      user_id: userId,
      action: 'UPDATE',
      module: objectType,
      record_id: id,
      description: `Updated ${objectType}`,
    }).catch((auditErr) => console.error('❌ Audit log error in updateRecord:', auditErr.message));

    return successResponse(res, record, `${objectType} record updated successfully.`);
  } catch (err) {
    next(err);
  }
};


const deleteRecord = async (req, res, next) => {
  try {
    const objectType = req.params.objectType;
    const { id } = req.params;
    const organizationId = req.user?.organization_id;
    const userId = req.user?.id;

    // Enforce permission check
    await metadataService.checkPermission(req.user, objectType, 'delete');

    await objectService.deleteRecord(objectType, id, organizationId, userId);

    // Log audit activity after successful deletion
    auditService.logUserActivity({
      organization_id: organizationId,
      user_id: userId,
      action: 'DELETE',
      module: objectType,
      record_id: id,
      description: `Deleted ${objectType}`,
    }).catch((auditErr) => console.error('❌ Audit log error in deleteRecord:', auditErr.message));

    return successResponse(res, null, `${objectType} record deleted successfully.`);
  } catch (err) {
    next(err);
  }
};


const getObjectFields = async (req, res, next) => {
  try {
    const objectType = req.params.objectType || req.params.objectTypeId;
    const organizationId = req.user?.organization_id;
    const { fields } = await objectService.getObjectMetadata(objectType, organizationId);
    return res.status(200).json(fields);
  } catch (err) {
    next(err);
  }
};


const getObjectViews = async (req, res, next) => {
  try {
    const objectType = req.params.objectType || req.params.objectTypeId;
    const organizationId = req.user?.organization_id;
    const { definition, fields } = await objectService.getObjectMetadata(objectType, organizationId);
    const viewConfig = {
      defaultColumns: fields.map((f) => f.name).slice(0, 5),
      displayName: definition.display_name,
    };
    return res.status(200).json(viewConfig);
  } catch (err) {
    next(err);
  }
};


module.exports = {
  getRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  getObjectFields,
  getObjectViews,
};



