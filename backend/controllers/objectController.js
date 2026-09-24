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
  const canonicalKey = metadataService.getCanonicalObjectKey ? metadataService.getCanonicalObjectKey(key) : key;
  const keySingular = canonicalKey.endsWith('ies') ? `${canonicalKey.slice(0, -3)}y` : (canonicalKey.endsWith('s') ? canonicalKey.slice(0, -1) : canonicalKey);
  const keyPlural = canonicalKey.endsWith('y') ? `${canonicalKey.slice(0, -1)}ies` : (canonicalKey.endsWith('s') ? canonicalKey : `${canonicalKey}s`);
  return perms[key] || perms[canonicalKey] || perms[keySingular] || perms[keyPlural];
};


const getRecords = async (req, res, next) => {
  try {
    const objectType = req.params.objectType || req.path.replace(/^\//, '').split('/')[0];
    const organizationId = req.user?.organization_id;

    // Enforce permission check & retrieve permissions once
    const perms = await metadataService.getPermissions(req.user);
    await metadataService.checkPermission(req.user, objectType, 'read', null, perms);

    const objPerm = getPermForObject(perms, objectType);

    const options = {};

    if (req.query.scope) {
      // Validate requested dashboard scope (individual vs group) against user's actual hierarchy & RBAC
      const ownerIds = await metadataService.getPermittedUserIdsForScope(req.user, req.query.scope, objectType);
      if (ownerIds !== null) {
        options.owner_ids = ownerIds;
      }
    } else if ((objPerm && objPerm.viewAll === false) || req.query.owner_id) {
      options.owner_id = req.user?.id;
    }

    if (req.query.page || req.query.pageSize || req.query.limit) {
      options.page = parseInt(req.query.page, 10) || 1;
      options.pageSize = parseInt(req.query.pageSize || req.query.limit, 10) || 25;
      options.paginated = true;
    }

    if (req.query.search || req.query.q) {
      options.search = String(req.query.search || req.query.q).trim();
    }

    const records = await objectService.listRecords(objectType, organizationId, options);
    return res.status(200).json(records);
  } catch (err) {
    if (err?.statusCode === 403) {
      return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
    }
    next(err);
  }
};


const getRecordById = async (req, res, next) => {
  try {
    const objectType = req.params.objectType;
    const { id } = req.params;
    const organizationId = req.user?.organization_id;

    const record = await objectService.getRecordById(objectType, id, organizationId);

    // Enforce permission and record-level scope check
    await metadataService.checkPermission(req.user, objectType, 'read', record);

    return successResponse(res, record, `${objectType} record fetched successfully.`);
  } catch (err) {
    next(err);
  }
};


const GENERIC_KEYS = new Set([
  'description',
  'custom_description',
  'notes',
  'memo',
  'comments',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'owner',
  'owner_id',
  'status',
  'is_deleted',
  'id',
  '_id',
  'organization_id',
]);

const getBackendMeaningfulKeys = (objectType) => {
  const cleanKey = String(objectType || '').toLowerCase();
  if (cleanKey.includes('contact') || cleanKey.includes('person')) {
    return ['first_name', 'last_name', 'name', 'contact_name', 'email', 'alternate_email', 'phone', 'company', 'title'];
  }
  if (cleanKey.includes('company') || cleanKey.includes('account')) {
    return ['name', 'company_name', 'account_name', 'website', 'domain', 'phone', 'industry', 'number_of_employees', 'address'];
  }
  if (cleanKey.includes('deal') || cleanKey.includes('opportunity')) {
    return ['name', 'deal_name', 'opportunity_name', 'amount', 'stage', 'expected_close_date', 'company', 'contact'];
  }
  if (cleanKey.includes('lead')) {
    return ['first_name', 'last_name', 'name', 'email', 'alternate_email', 'phone', 'company', 'title', 'lead_source'];
  }
  return [];
};

const validateMeaningfulPayload = (objectType, payload) => {
  const keys = Object.keys(payload || {}).filter(k => k !== '__rowNum');
  const meaningfulKeys = getBackendMeaningfulKeys(objectType);

  let hasMeaningful = false;
  if (meaningfulKeys.length > 0) {
    hasMeaningful = meaningfulKeys.some(mKey => {
      const val = payload[mKey];
      return val !== undefined && val !== null && String(val).trim() !== '';
    });
  } else {
    hasMeaningful = keys.some(k => {
      if (GENERIC_KEYS.has(k.toLowerCase())) return false;
      const val = payload[k];
      return val !== undefined && val !== null && String(val).trim() !== '';
    });
  }

  if (!hasMeaningful) {
    throw new Error(`Row does not contain required identity/meaningful fields for ${objectType}.`);
  }
};

const createRecord = async (req, res, next) => {
  try {
    const objectType = req.params.objectType;
    const organizationId = req.user?.organization_id;
    const userId = req.user?.id;

    // Enforce permission check
    await metadataService.checkPermission(req.user, objectType, 'create');

    if (Array.isArray(req.body)) {
      const bulkResult = await objectService.bulkCreateRecords(objectType, req.body, organizationId, userId);

      auditService.logUserActivity({
        organization_id: organizationId,
        user_id: userId,
        action: 'CREATE',
        module: objectType,
        record_id: null,
        description: `Bulk processed ${bulkResult.totalProcessed} ${objectType} record(s): ${bulkResult.createdCount} created, ${bulkResult.failedCount} failed`,
      }).catch((auditErr) => console.error('❌ Audit log error in bulk createRecord:', auditErr.message));

      const statusCode = bulkResult.createdCount > 0 ? 201 : 400;
      return res.status(statusCode).json({
        success: bulkResult.createdCount > 0,
        statusCode,
        totalProcessed: bulkResult.totalProcessed,
        createdCount: bulkResult.createdCount,
        failedCount: bulkResult.failedCount,
        skippedCount: bulkResult.skippedCount || 0,
        data: bulkResult.data,
        results: bulkResult.results,
        errors: bulkResult.errors,
        message: bulkResult.createdCount > 0
          ? `Bulk ${objectType} records processed: ${bulkResult.createdCount} created${bulkResult.failedCount > 0 ? `, ${bulkResult.failedCount} failed` : ''}.`
          : `Failed to import ${objectType} records: All ${bulkResult.failedCount} rows failed.`,
      });
    }

    validateMeaningfulPayload(objectType, req.body);
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

    // Fetch existing record first for scope check
    const existing = await objectService.getRecordById(objectType, id, organizationId);

    // Enforce permission and record-level scope check
    await metadataService.checkPermission(req.user, objectType, 'update', existing);

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

    // Fetch existing record first for scope check
    const existing = await objectService.getRecordById(objectType, id, organizationId);

    // Enforce permission and record-level scope check
    await metadataService.checkPermission(req.user, objectType, 'delete', existing);

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


const bulkDeleteRecords = async (req, res, next) => {
  try {
    const objectType = req.params.objectType;
    const { ids } = req.body;
    const organizationId = req.user?.organization_id;
    const userId = req.user?.id;

    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, 'No record IDs provided for bulk deletion.', 400);
    }

    // Enforce object-level permission check for 'delete'
    await metadataService.checkPermission(req.user, objectType, 'delete');

    const result = await objectService.bulkDeleteRecords(objectType, ids, organizationId, req.user);

    // Log audit activity if any records were deleted
    if (result.deletedIds && result.deletedIds.length > 0) {
      auditService.logUserActivity({
        organization_id: organizationId,
        user_id: userId,
        action: 'BULK_DELETE',
        module: objectType,
        record_id: result.deletedIds.join(','),
        description: `Bulk deleted ${result.deletedIds.length} ${objectType} record(s)`,
      }).catch((auditErr) => console.error('❌ Audit log error in bulkDeleteRecords:', auditErr.message));
    }

    return successResponse(res, result, `Bulk delete completed for ${objectType}.`);
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
  bulkDeleteRecords,
  getObjectFields,
  getObjectViews,
};



