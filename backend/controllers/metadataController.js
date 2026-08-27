const metadataService = require('../services/metadataService');
const auditService = require('../services/auditService');
const validationRuleService = require('../services/validationRuleService');
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
    await metadataService.checkPermission(req.user, 'object_definition', 'create');
    const organizationId = req.params.organizationId || req.user?.organization_id;
    const newObj = await metadataService.createObjectDefinition(req.body, organizationId);
    
    auditService.logSetupActivity({
      organization_id: organizationId,
      user_id: req.user?.id,
      action: 'CREATE',
      entity_type: 'module',
      entity_id: newObj?.id,
      entity_name: newObj?.label || req.body?.label || req.body?.api_name,
      module_name: newObj?.api_name || req.body?.api_name,
    }).catch(err => console.error('❌ Audit log error:', err.message));

    return res.status(201).json(newObj);
  } catch (err) {
    if (err?.statusCode === 403) return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
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
    await metadataService.checkPermission(req.user, 'object_field', 'create');
    const objectType = req.params.objectType || req.params.objectTypeId || req.body.objectType;
    const organizationId = req.params.organizationId || req.user?.organization_id;
    const newField = await metadataService.createField(objectType, req.body, organizationId);

    auditService.logSetupActivity({
      organization_id: organizationId,
      user_id: req.user?.id,
      action: 'CREATE',
      entity_type: 'field',
      entity_id: newField?.id,
      entity_name: newField?.label || req.body?.label || req.body?.api_name,
      module_name: objectType,
    }).catch(err => console.error('❌ Audit log error:', err.message));

    return res.status(201).json(newField);
  } catch (err) {
    if (err?.statusCode === 403) return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
    let errorMsg = err.message || 'Failed to create field in database.';
    if (errorMsg.includes('unique constraint') || errorMsg.includes('already exists') || errorMsg.includes('duplicate key')) {
      errorMsg = 'Field Name already exists in this module.';
    }
    return res.status(400).json({ error: errorMsg });
  }
};

const deleteObjectField = async (req, res, next) => {
  try {
    await metadataService.checkPermission(req.user, 'object_field', 'delete');
    const objectType = req.params.objectType || req.params.objectTypeId;
    const fieldId = req.params.fieldId;
    const organizationId = req.params.organizationId || req.user?.organization_id;
    await metadataService.deleteField(objectType, fieldId, organizationId);

    auditService.logSetupActivity({
      organization_id: organizationId,
      user_id: req.user?.id,
      action: 'DELETE',
      entity_type: 'field',
      entity_id: fieldId,
      entity_name: fieldId,
      module_name: objectType,
    }).catch(err => console.error('❌ Audit log error:', err.message));

    return res.status(200).json({ success: true, message: 'Field deleted successfully.' });
  } catch (err) {
    if (err?.statusCode === 403) return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
    return res.status(400).json({ error: err.message || 'Failed to delete field from database.' });
  }
};

const deleteObjectDefinition = async (req, res, next) => {
  try {
    await metadataService.checkPermission(req.user, 'object_definition', 'delete');
    const objectType = req.params.objectType || req.params.objectTypeId;
    const organizationId = req.params.organizationId || req.user?.organization_id;
    await metadataService.deleteObjectDefinition(objectType, organizationId);

    auditService.logSetupActivity({
      organization_id: organizationId,
      user_id: req.user?.id,
      action: 'DELETE',
      entity_type: 'module',
      entity_name: objectType,
      module_name: objectType,
    }).catch(err => console.error('❌ Audit log error:', err.message));

    return res.status(200).json({ success: true, message: 'Custom module deleted successfully.' });
  } catch (err) {
    if (err?.statusCode === 403) return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
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

const getRecentActivity = async (req, res, next) => {
  try {
    const organizationId = req.user?.organization_id;
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized: missing organization context.' });
    }

    const client = require('../config/supabase').supabaseAdmin || require('../config/supabase').supabase;

    const { data: logRows, error } = await client
      .from('audit_logs')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('event_type', 'SETUP_ACTIVITY')
      .order('created_at', { ascending: false })
      .limit(4);

    if (error) {
      console.error('❌ Error fetching recent setup activity:', error.message);
      return res.status(500).json({ error: 'Failed to fetch setup activity.' });
    }

    // Resolve actual person names from users table
    const userIds = [...new Set((logRows || []).map(r => r.user_id).filter(Boolean))];
    const userMap = {};
    if (userIds.length > 0) {
      const { data: usersData } = await client
        .from('users')
        .select('id, first_name, last_name, email, name')
        .in('id', userIds);

      (usersData || []).forEach((u) => {
        const fullName = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
        userMap[u.id] = fullName;
      });
    }

    const activities = (logRows || []).map((row) => {
      const d = row.details || {};
      const resolvedName = userMap[row.user_id];
      const actorName = resolvedName || (d.actor_name && !d.actor_name.startsWith('Admin Org') ? d.actor_name : (req.user?.name || req.user?.email || 'User'));

      return {
        id: row.id,
        action: d.action ? String(d.action).toLowerCase() : 'created',
        entityType: d.entity_type || 'general',
        entityName: d.entity_name || '',
        moduleName: d.module_name || '',
        actorName: actorName,
        actorEmail: d.actor_email || '',
        createdAt: row.created_at,
        metadata: d.metadata || {},
      };
    });

    return res.status(200).json({ activities });
  } catch (err) {
    next(err);
  }
};

const getConfigurationOverview = async (req, res, next) => {
  try {
    const organizationId = req.user?.organization_id;
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized: missing organization context.' });
    }

    const client = require('../config/supabase').supabaseAdmin || require('../config/supabase').supabase;

    // 1. Modules count
    const { count: modulesCount } = await client
      .from('object_type_definitions')
      .select('id', { count: 'exact', head: true })
      .or(`organization_id.eq.${organizationId},organization_id.is.null`);

    // 2. Fields count
    const { count: fieldsCount } = await client
      .from('field_definitions')
      .select('id', { count: 'exact', head: true })
      .or(`organization_id.eq.${organizationId},organization_id.is.null`);

    // 3. Record Rules count (system rules + org-specific rules)
    let recordRulesCount = 0;
    try {
      const resolvedRules = await validationRuleService.listRules(null, organizationId);
      recordRulesCount = Array.isArray(resolvedRules) ? resolvedRules.length : 0;
    } catch (ruleErr) {
      const { count } = await client
        .from('validation_rules')
        .select('id', { count: 'exact', head: true })
        .or(`organization_id.eq.${organizationId},organization_id.is.null`);
      recordRulesCount = typeof count === 'number' ? count : 0;
    }

    // 4. Automations count
    let automationsCount = 0;
    try {
      const { count: flowCount } = await client
        .from('flow_automations')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId);
      automationsCount = typeof flowCount === 'number' ? flowCount : 0;
    } catch (flowErr) {
      automationsCount = 0;
    }

    // 5. Forms count
    let formsCount = 0;
    try {
      const { data: formTypeDef } = await client
        .from('object_type_definitions')
        .select('id')
        .or('api_name.eq.form,api_name.eq.forms')
        .maybeSingle();

      if (formTypeDef) {
        const { count: fCount } = await client
          .from('universal_table')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('object_type_id', formTypeDef.id)
          .eq('is_deleted', false);
        formsCount = typeof fCount === 'number' ? fCount : 0;
      }
    } catch (formErr) {
      formsCount = 0;
    }

    return res.status(200).json({
      modules: typeof modulesCount === 'number' ? modulesCount : 0,
      fields: typeof fieldsCount === 'number' ? fieldsCount : 0,
      recordRules: typeof recordRulesCount === 'number' ? recordRulesCount : 0,
      automations: automationsCount,
      forms: formsCount,
    });
  } catch (err) {
    next(err);
  }
};

const getCurrentUserSetupProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const client = require('../config/supabase').supabaseAdmin || require('../config/supabase').supabase;
    const metadataService = require('../services/metadataService');

    // Fetch live user record joined with roles table
    const { data: user, error } = await client
      .from('users')
      .select('id, first_name, last_name, email, status, role_id, organization_id, created_at, updated_at, roles(id, role_name, description)')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
    const initials = fullName.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    const roleName = user.roles?.role_name || 'User';

    // Fetch real last login timestamp from audit_logs
    let lastLoginAt = null;
    try {
      const { data: logRow } = await client
        .from('audit_logs')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (logRow?.created_at) {
        lastLoginAt = logRow.created_at;
      } else {
        lastLoginAt = user.updated_at || user.created_at;
      }
    } catch (logErr) {
      lastLoginAt = user.updated_at || user.created_at;
    }

    // Resolve RBAC permissions map from metadataService
    let permissions = {};
    try {
      permissions = await metadataService.getPermissions({
        id: user.id,
        organization_id: user.organization_id,
        role: roleName,
        role_id: user.role_id,
      });
    } catch (permErr) {
      console.warn('Unable to resolve permissions for setup profile:', permErr.message);
    }

    // 1. Record Access: Derived from permissions viewAll flag across core CRM objects
    const mainObjects = ['lead', 'contact', 'deal', 'company'];
    const hasViewAll = mainObjects.some((objKey) => permissions[objKey]?.viewAll === true);
    const lowerRole = roleName.toLowerCase();
    const isSystemAdmin = lowerRole.includes('administrator') || lowerRole === 'admin';
    const isCrmManager = lowerRole === 'crm manager';
    const recordAccess = (hasViewAll || isSystemAdmin || isCrmManager) ? 'All Records' : 'Assigned Records';

    // 2. Configuration Access: Derived from setup/configuration permissions
    const isReadOnly = lowerRole.includes('read only') || lowerRole.includes('viewer');
    const isManagerRole = isCrmManager || lowerRole.includes('clone');

    let configurationAccess = 'Restricted';
    if (isSystemAdmin) {
      configurationAccess = 'Full Access';
    } else if (isReadOnly) {
      configurationAccess = 'View Only';
    } else if (isManagerRole) {
      configurationAccess = 'Manage Configuration';
    } else {
      configurationAccess = 'Restricted';
    }

    return res.status(200).json({
      id: user.id,
      name: fullName,
      email: user.email,
      roleName: roleName,
      roleId: user.role_id,
      status: user.status || 'active',
      recordAccess: recordAccess,
      configurationAccess: configurationAccess,
      lastLoginAt: lastLoginAt,
      avatar: initials || 'U',
    });
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
  getRecentActivity,
  getConfigurationOverview,
  getCurrentUserSetupProfile,
};
