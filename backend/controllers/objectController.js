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

    const perms = await metadataService.getPermissions(req.user);
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
      const createdRecords = [];
      const errorDetails = [];
      const rowResults = [];

      for (let i = 0; i < req.body.length; i++) {
        const itemPayload = req.body[i];
        const rowNum = itemPayload.__rowNum || (i + 1);
        const rowIdentifier = itemPayload.name || itemPayload.deal_name || itemPayload.company_name || itemPayload.contact_name || itemPayload.email || `Row ${rowNum}`;

        try {
          const cleanPayload = { ...itemPayload };
          delete cleanPayload.__rowNum;

          validateMeaningfulPayload(objectType, cleanPayload);

          const record = await objectService.createRecord(objectType, cleanPayload, organizationId, userId);
          if (record) {
            createdRecords.push({ ...record, __rowNum: rowNum });
            rowResults.push({
              rowNumber: rowNum,
              identifier: String(rowIdentifier).trim(),
              status: 'imported',
              recordId: record.id,
              error: null,
            });
          }
        } catch (err) {
          const errMsg = err.message || err.error || `Failed to create ${objectType} record.`;
          console.error(`Error creating row ${rowNum} in bulk import for ${objectType}:`, errMsg);
          errorDetails.push({
            rowNum,
            identifier: String(rowIdentifier).trim(),
            reason: errMsg,
          });
          rowResults.push({
            rowNumber: rowNum,
            identifier: String(rowIdentifier).trim(),
            status: 'failed',
            recordId: null,
            error: errMsg,
          });
        }
      }

      auditService.logUserActivity({
        organization_id: organizationId,
        user_id: userId,
        action: 'CREATE',
        module: objectType,
        record_id: null,
        description: `Bulk created ${createdRecords.length} ${objectType} record(s)${errorDetails.length > 0 ? `, ${errorDetails.length} failed` : ''}`,
      }).catch((auditErr) => console.error('❌ Audit log error in bulk createRecord:', auditErr.message));

      const statusCode = createdRecords.length > 0 ? 201 : 400;
      return res.status(statusCode).json({
        success: createdRecords.length > 0,
        statusCode,
        totalProcessed: req.body.length,
        createdCount: createdRecords.length,
        failedCount: errorDetails.length,
        data: createdRecords,
        results: rowResults,
        message: createdRecords.length > 0
          ? `Bulk ${objectType} records processed: ${createdRecords.length} created${errorDetails.length > 0 ? `, ${errorDetails.length} failed` : ''}.`
          : `Failed to import ${objectType} records: All ${errorDetails.length} rows failed.`,
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



