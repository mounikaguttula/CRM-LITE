const validationRuleService = require('../services/validationRuleService');
const { successResponse } = require('../utils/response');

const listRules = async (req, res, next) => {
  try {
    const objectName = req.query.object_name || req.query.objectName;
    const organizationId = req.user?.organization_id;
    const rules = await validationRuleService.listRules(objectName, organizationId);
    return res.status(200).json(rules);
  } catch (err) {
    next(err);
  }
};

const getRuleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id;
    const rule = await validationRuleService.getRuleById(id, organizationId);
    return successResponse(res, rule, 'Validation rule fetched successfully.');
  } catch (err) {
    next(err);
  }
};

const createRule = async (req, res, next) => {
  try {
    const organizationId = req.user?.organization_id;
    const userId = req.user?.id;
    const rule = await validationRuleService.createRule(req.body, organizationId, userId);
    return successResponse(res, rule, 'Validation rule created successfully.', 201);
  } catch (err) {
    next(err);
  }
};

const updateRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id;
    const rule = await validationRuleService.updateRule(id, req.body, organizationId);
    return successResponse(res, rule, 'Validation rule updated successfully.');
  } catch (err) {
    next(err);
  }
};

const toggleRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const organizationId = req.user?.organization_id;
    const rule = await validationRuleService.toggleRule(id, is_active, organizationId);
    return successResponse(res, rule, `Validation rule ${is_active ? 'activated' : 'deactivated'} successfully.`);
  } catch (err) {
    next(err);
  }
};

const deleteRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id;
    await validationRuleService.deleteRule(id, organizationId);
    return successResponse(res, null, 'Validation rule deleted successfully.');
  } catch (err) {
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
