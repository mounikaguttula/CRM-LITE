const objectService = require('../services/objectService');
const metadataService = require('../services/metadataService');
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


    console.log(`\n------------------- 🔍 CONTROLLER CHECK: GET RECORDS -------------------`);
    console.log(`[Controller] getRecords -> objectType="${objectType}", userId=${req.user?.id}, roleId=${req.user?.role_id}, orgId=${organizationId}`);


    // Enforce permission check
    const perms = await metadataService.getPermissions(req.user);
    const objPerm = getPermForObject(perms, objectType);
    console.log(`[Controller] Read Permission resolved for [${objectType}]:`, JSON.stringify(objPerm, null, 2));


    if (objPerm && objPerm.canRead === false) {
      console.log(`[Controller] ⛔ BLOCKED read request for [${objectType}] (canRead is false)! Throwing 403 Access Denied.`);
      throw { statusCode: 403, message: 'Please check with your administrator. You do not have permissions.' };
    }


    console.log(`[Controller] ✅ ALLOWED read request for [${objectType}]. Proceeding to fetch records.`);
    console.log(`-------------------------------------------------------------------------\n`);


    const records = await objectService.listRecords(objectType, organizationId);
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


    console.log(`[Controller] getRecordById for objectType=${objectType}, recordId=${id}, userId=${req.user?.id}`);


    // Enforce permission check
    const perms = await metadataService.getPermissions(req.user);
    const objPerm = getPermForObject(perms, objectType);
    console.log(`[Controller] ReadById Permission resolved for [${objectType}]:`, JSON.stringify(objPerm));


    if (objPerm && objPerm.canRead === false) {
      console.log(`[Controller] BLOCKED readById request for [${objectType}] (canRead is false)`);
      throw { statusCode: 403, message: 'Please check with your administrator. You do not have permissions.' };
    }


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


    console.log(`[Controller] createRecord for objectType=${objectType}, userId=${userId}`);


    // Enforce permission check
    const perms = await metadataService.getPermissions(req.user);
    const objPerm = getPermForObject(perms, objectType);
    console.log(`[Controller] Create Permission resolved for [${objectType}]:`, JSON.stringify(objPerm));


    if (objPerm && objPerm.canCreate === false) {
      console.log(`[Controller] BLOCKED create request for [${objectType}] (canCreate is false)`);
      throw { statusCode: 403, message: 'Please check with your administrator. You do not have permissions.' };
    }


    const record = await objectService.createRecord(objectType, req.body, organizationId, userId);
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


    console.log(`[Controller] updateRecord for objectType=${objectType}, recordId=${id}, userId=${userId}`);


    // Enforce permission check
    const perms = await metadataService.getPermissions(req.user);
    const objPerm = getPermForObject(perms, objectType);
    console.log(`[Controller] Update/Edit Permission resolved for [${objectType}]:`, JSON.stringify(objPerm));


    if (objPerm && (objPerm.canUpdate === false || objPerm.canEdit === false)) {
      console.log(`[Controller] BLOCKED update request for [${objectType}] (canUpdate is false)`);
      throw { statusCode: 403, message: 'Please check with your administrator. You do not have permissions.' };
    }


    const record = await objectService.updateRecord(objectType, id, req.body, organizationId, userId);
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


    console.log(`[Controller] deleteRecord for objectType=${objectType}, recordId=${id}, userId=${userId}`);


    // Enforce permission check
    const perms = await metadataService.getPermissions(req.user);
    const objPerm = getPermForObject(perms, objectType);
    console.log(`[Controller] Delete Permission resolved for [${objectType}]:`, JSON.stringify(objPerm));


    if (objPerm && objPerm.canDelete === false) {
      console.log(`[Controller] BLOCKED delete request for [${objectType}] (canDelete is false)`);
      throw { statusCode: 403, message: 'Please check with your administrator. You do not have permissions.' };
    }


    await objectService.deleteRecord(objectType, id, organizationId, userId);
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



