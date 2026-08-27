const metadataService = require('../services/metadataService');
const validationRuleService = require('../services/validationRuleService');
const auditService = require('../services/auditService');
const { successResponse } = require('../utils/response');

const listRules = async (req, res, next) => {
  try {
    await metadataService.checkPermission(req.user, 'validation_rule', 'read');
    const objectName = req.query.object_name || req.query.objectName;
    const organizationId = req.user?.organization_id;
    const rules = await validationRuleService.listRules(objectName, organizationId);
    return res.status(200).json(rules);
  } catch (err) {
    if (err?.statusCode === 403) return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
    next(err);
  }
};

const getRuleById = async (req, res, next) => {
  try {
    await metadataService.checkPermission(req.user, 'validation_rule', 'read');
    const { id } = req.params;
    const organizationId = req.user?.organization_id;
    const rule = await validationRuleService.getRuleById(id, organizationId);
    return successResponse(res, rule, 'Validation rule fetched successfully.');
  } catch (err) {
    if (err?.statusCode === 403) return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
    next(err);
  }
};

const createRule = async (req, res, next) => {
  try {
    await metadataService.checkPermission(req.user, 'validation_rule', 'create');
    const organizationId = req.user?.organization_id;
    const userId = req.user?.id;
    const rule = await validationRuleService.createRule(req.body, organizationId, userId);

    auditService.logSetupActivity({
      organization_id: organizationId,
      user_id: userId,
      action: 'CREATE',
      entity_type: 'validation_rule',
      entity_id: rule?.id,
      entity_name: rule?.name || req.body?.name,
      module_name: rule?.target_object || req.body?.target_object || 'Validation Rules',
    }).catch(err => console.error('❌ Audit log error:', err.message));

    return successResponse(res, rule, 'Validation rule created successfully.', 201);
  } catch (err) {
    if (err?.statusCode === 403) return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
    next(err);
  }
};

const updateRule = async (req, res, next) => {
  try {
    await metadataService.checkPermission(req.user, 'validation_rule', 'update');
    const { id } = req.params;
    const organizationId = req.user?.organization_id;
    const rule = await validationRuleService.updateRule(id, req.body, organizationId);

    auditService.logSetupActivity({
      organization_id: organizationId,
      user_id: req.user?.id,
      action: 'UPDATE',
      entity_type: 'validation_rule',
      entity_id: id,
      entity_name: rule?.name || req.body?.name || id,
      module_name: rule?.target_object || req.body?.target_object || 'Validation Rules',
    }).catch(err => console.error('❌ Audit log error:', err.message));

    return successResponse(res, rule, 'Validation rule updated successfully.');
  } catch (err) {
    if (err?.statusCode === 403) return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
    next(err);
  }
};

const toggleRule = async (req, res, next) => {
  try {
    await metadataService.checkPermission(req.user, 'validation_rule', 'update');
    const { id } = req.params;
    const { is_active } = req.body;
    const organizationId = req.user?.organization_id;
    const rule = await validationRuleService.toggleRule(id, is_active, organizationId);

    auditService.logSetupActivity({
      organization_id: organizationId,
      user_id: req.user?.id,
      action: 'UPDATE',
      entity_type: 'validation_rule',
      entity_id: id,
      entity_name: rule?.name || id,
      module_name: rule?.target_object || 'Validation Rules',
      metadata: { is_active },
    }).catch(err => console.error('❌ Audit log error:', err.message));

    return successResponse(res, rule, `Validation rule ${is_active ? 'activated' : 'deactivated'} successfully.`);
  } catch (err) {
    if (err?.statusCode === 403) return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
    next(err);
  }
};

const deleteRule = async (req, res, next) => {
  try {
    await metadataService.checkPermission(req.user, 'validation_rule', 'delete');
    const { id } = req.params;
    const organizationId = req.user?.organization_id;
    await validationRuleService.deleteRule(id, organizationId);

    auditService.logSetupActivity({
      organization_id: organizationId,
      user_id: req.user?.id,
      action: 'DELETE',
      entity_type: 'validation_rule',
      entity_id: id,
      entity_name: id,
      module_name: 'Validation Rules',
    }).catch(err => console.error('❌ Audit log error:', err.message));

    return successResponse(res, null, 'Validation rule deleted successfully.');
  } catch (err) {
    if (err?.statusCode === 403) return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
    next(err);
  }
};

module.exports = {
  listRules,
  getRuleById,
  createRule,
  updateRule,
  toggleRule,
  deleteRule,
};
