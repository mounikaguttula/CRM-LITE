const supabase = require('../config/supabase');
const redisClient = require('../config/redis');


// UUID format validator helper to prevent PostgreSQL syntax errors when non-UUID strings are passed
const isUuid = (val) => Boolean(val && typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));


const PLATFORM_FIELDS = [
  { id: 'pf_name', name: 'name', label: 'Name', type: 'text', required: true, is_system: true, isTitle: true },
  { id: 'pf_status', name: 'status', label: 'Status', type: 'picklist', required: false, is_system: true, isTitle: false },
  { id: 'pf_owner', name: 'owner_id', label: 'Owner', type: 'lookup', required: false, is_system: true, isTitle: false },
  { id: 'pf_created_at', name: 'created_at', label: 'Created Date', type: 'datetime', required: false, is_system: true, isTitle: false },
  { id: 'pf_created_by', name: 'created_by', label: 'Created By', type: 'lookup', required: false, is_system: true, isTitle: false },
  { id: 'pf_updated_at', name: 'updated_at', label: 'Modified Date', type: 'datetime', required: false, is_system: true, isTitle: false },
  { id: 'pf_updated_by', name: 'updated_by', label: 'Modified By', type: 'lookup', required: false, is_system: true, isTitle: false },
];


/**
 * Helper: Invalidate metadata cache in Redis whenever metadata schema changes.
 * Also clears permissions cache so record APIs pick up fresh role data.
 */
const invalidateMetadataCache = async (organizationId) => {
  if (!redisClient || !redisClient.isOpen) return;


  try {
    // Wipe both metadata and permissions cache keys in one scan
    const allKeys = await redisClient.keys('crm:*');
    const staleKeys = allKeys.filter(
      (k) => k.includes(':metadata') || k.includes(':permissions')
    );
    if (staleKeys.length > 0) {
      await redisClient.del(staleKeys);
    }
    console.log(`🗑 Redis caches invalidated: ${staleKeys.length} key(s) cleared (metadata + permissions).`);
  } catch (err) {
    console.error('❌ Redis Cache Invalidation Error:', err.message);
  }
};


/**
 * Metadata Service
 * Interfaces directly with Supabase tables: object_type_definitions, field_definitions, Organization.
 */
const metadataService = {
  /**
   * Fetch object type definition by API name or ID.
   */
  getObjectTypeByApiName: async (objectKey, organizationId) => {
    if (!objectKey) return null;


    const lowerKey = String(objectKey).toLowerCase();
    const keyPlural = lowerKey.endsWith('s') ? lowerKey : `${lowerKey}s`;
    const keySingular = lowerKey.endsWith('ies')
      ? `${lowerKey.slice(0, -3)}y`
      : lowerKey.endsWith('s')
        ? lowerKey.slice(0, -1)
        : lowerKey;


    let query = supabase.from('object_type_definitions').select('id, organization_id, api_name, display_name, description, is_system, created_at, updated_at');


    if (isUuid(objectKey)) {
      query = query.eq('id', objectKey);
    } else {
      query = query.or(`api_name.eq.${lowerKey},api_name.eq.${keyPlural},api_name.eq.${keySingular}`);
    }


    if (isUuid(organizationId)) {
      query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    }


    const { data: objDefs, error } = await query;


    if (error) {
      console.error('Error fetching object_type_definitions:', error.message);
    }


    if (objDefs && objDefs.length > 0) {
      const matched = objDefs.find((o) => o.organization_id === organizationId) || objDefs[0];
      return matched;
    }


    // Fallback: search without organization_id filter
    if (organizationId && !isUuid(objectKey)) {
      const { data: fallbackDefs } = await supabase
        .from('object_type_definitions')
        .select('id, organization_id, api_name, display_name, description, is_system, created_at, updated_at')
        .or(`api_name.eq.${lowerKey},api_name.eq.${keyPlural},api_name.eq.${keySingular}`);
      if (fallbackDefs && fallbackDefs.length > 0) {
        return fallbackDefs[0];
      }
    }


    return null;
  },


  /**
   * Fetch all object type definitions for tenant directly from database.
   */
  getObjectDefinitions: async (organizationId) => {
    let query = supabase.from('object_type_definitions').select('id, organization_id, api_name, display_name, description, is_system, created_at, updated_at');
    if (isUuid(organizationId)) {
      query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    }


    const { data: objectDefs, error } = await query;


    if (error) {
      console.error('Failed to fetch object_type_definitions:', error.message);
      return [];
    }


    return objectDefs || [];
  },


  /**
   * Create a new Custom Object / Module Definition in object_type_definitions table.
   * Invalidates Redis metadata cache upon creation.
   */
  createObjectDefinition: async (objectData, organizationId) => {
    const rawLabel = objectData.display_name || objectData.label || objectData.name;
    if (!rawLabel) throw new Error('Module label / display name is required.');


    const cleanBase = (objectData.api_name || rawLabel).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const isStandard = ['lead', 'leads', 'company', 'companies', 'contact', 'contacts', 'deal', 'deals'].includes(cleanBase);
    const apiName = isStandard ? cleanBase : (cleanBase.endsWith('__c') ? cleanBase : `${cleanBase}__c`);

    // Check if an object type with the same api_name already exists in this organization (or standard/global object)
    let checkQuery = supabase
      .from('object_type_definitions')
      .select('id, api_name')
      .eq('api_name', apiName);

    if (isUuid(organizationId)) {
      checkQuery = checkQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    } else {
      checkQuery = checkQuery.is('organization_id', null);
    }

    const { data: existingObj, error: checkErr } = await checkQuery;
    if (checkErr) {
      console.error('Error checking existing api_name:', checkErr.message);
    }

    if (existingObj && existingObj.length > 0) {
      throw new Error('Module Name already exists.');
    }


    const payload = {
      organization_id: isUuid(organizationId) ? organizationId : null,
      api_name: apiName,
      display_name: rawLabel,
      description: objectData.description || null,
      is_system: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };


    const { data: inserted, error } = await supabase
      .from('object_type_definitions')
      .insert(payload)
      .select()
      .single();


    if (error) {
      console.error('Supabase object_type_definitions insert error:', error);
      if (error.message && (error.message.includes('unique constraint') || error.message.includes('duplicate key'))) {
        throw new Error('Module Name already exists.');
      }
      throw new Error(error.message || 'Database insert failed for custom object.');
    }


    // Automatically populate object_permissions for all system/organization roles
    try {
      const { data: allRoles } = await supabase.from('roles').select('id, role_name, name');
      if (allRoles && allRoles.length > 0) {
        const opRows = allRoles.map((r) => {
          const roleName = (r.role_name || r.name || '').toLowerCase();
          const isAdmin = roleName.includes('admin');
          const isReadOnly = roleName.includes('read only');
          return {
            role_id: r.id,
            object_type_id: inserted.id,
            organization_id: inserted.organization_id || (isUuid(organizationId) ? organizationId : null),
            can_read: true,
            can_create: !isReadOnly,
            can_update: !isReadOnly,
            can_delete: isAdmin,
            view_all: isAdmin,
            modify_all: isAdmin,
          };
        });

        const { error: opErr } = await supabase
          .from('object_permissions')
          .upsert(opRows, { onConflict: 'role_id,object_type_id' });

        if (opErr) {
          console.warn('⚠️ Warning creating object_permissions for custom object:', opErr.message);
        } else {
          console.log(`✅ Inserted ${opRows.length} object_permissions records for custom object [${inserted.api_name}]`);
        }
      }
    } catch (opEx) {
      console.warn('⚠️ Exception creating object_permissions for custom object:', opEx.message);
    }

    // Automatically insert default 'name' field for the new custom object
    try {
      const recordNameLabel = objectData.record_name_label || `${rawLabel} Name`;
      const recordNameType = objectData.record_name_type || 'text';
      await supabase.from('field_definitions').insert([
        {
          object_type_id: inserted.id,
          organization_id: inserted.organization_id || (isUuid(organizationId) ? organizationId : null),
          api_name: 'name',
          display_name: recordNameLabel,
          field_type: recordNameType,
          required: true,
          is_system: true,
          display_order: 1,
        }
      ]);
    } catch (fEx) {
      console.warn('⚠️ Exception creating default name field:', fEx.message);
    }

    // Invalidate Redis Metadata Cache
    await invalidateMetadataCache(organizationId);


    return inserted;
  },


  /**
   * Get complete schema metadata (definition + fields) for an object key.
   */
  getObjectDefinition: async (objectKey, organizationId) => {
    const objDef = await metadataService.getObjectTypeByApiName(objectKey, organizationId);


    if (!objDef) {
      return {
        definition: { api_name: objectKey, display_name: objectKey },
        fields: PLATFORM_FIELDS,
        views: { default_columns: PLATFORM_FIELDS.map((f) => f.name) },
      };
    }


    let businessFields = [];
    if (objDef.id) {
      let fQuery = supabase
        .from('field_definitions')
        .select('id, organization_id, object_type_id, api_name, display_name, field_type, required, display_order, is_system')
        .eq('object_type_id', objDef.id)
        .order('display_order', { ascending: true });


      if (isUuid(organizationId)) {
        fQuery = fQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`);
      }


      const { data: fieldRows } = await fQuery;


      if (fieldRows && fieldRows.length > 0) {
        businessFields = fieldRows.map((f) => ({
          id: f.id,
          name: f.api_name,
          label: f.display_name,
          type: f.field_type === 'dropdown' ? 'picklist' : f.field_type,
          description: f.description || '',
          required: f.required || false,
          is_system: f.is_system || false,
          isTitle: f.api_name === 'name' || f.api_name === 'title' || f.api_name === 'deal_name' || f.api_name === 'first_name',
        }));
      }
    }


    // Default business fields for standard objects if field_definitions table has no custom rows yet
    if (businessFields.length === 0) {
      const lowerKey = String(objectKey).toLowerCase();
      if (lowerKey.includes('contact')) {
        businessFields = [
          { id: 'f_email', name: 'email', label: 'Email', type: 'email', isTitle: false },
          { id: 'f_phone', name: 'phone', label: 'Phone', type: 'phone', isTitle: false },
          { id: 'f_company', name: 'company_id', label: 'Company / Account', type: 'lookup', target: 'company', isTitle: false },
          { id: 'f_title', name: 'title', label: 'Title', type: 'text', isTitle: false },
        ];
      } else if (lowerKey.includes('lead')) {
        businessFields = [
          { id: 'f_email', name: 'email', label: 'Email Address', type: 'email', isTitle: false },
          { id: 'f_company', name: 'company', label: 'Company Name', type: 'text', isTitle: false },
        ];
      } else if (lowerKey.includes('deal')) {
        businessFields = [
          { id: 'f_company', name: 'company_id', label: 'Company / Account', type: 'lookup', target: 'company', isTitle: false },
          { id: 'f_contact', name: 'contact_id', label: 'Primary Contact', type: 'lookup', target: 'contact', isTitle: false },
          { id: 'f_amount', name: 'amount', label: 'Amount', type: 'number', isTitle: false },
          { id: 'f_stage', name: 'stage', label: 'Stage', type: 'picklist', options: ['Qualification', 'Needs Analysis', 'Proposal/Quote', 'Negotiation/Review', 'Closed Won', 'Closed Lost'], isTitle: false },
        ];
      } else if (lowerKey.includes('company') || lowerKey.includes('account')) {
        businessFields = [
          { id: 'f_industry', name: 'industry', label: 'Industry', type: 'text', isTitle: false },
          { id: 'f_website', name: 'website', label: 'Website', type: 'url', isTitle: false },
          { id: 'f_phone', name: 'phone', label: 'Phone', type: 'phone', isTitle: false },
        ];
      }
    }


    // Unified collection: Platform Fields + Business Fields
    const allFields = [...PLATFORM_FIELDS];
    businessFields.forEach((bf) => {
      if (!allFields.some((pf) => pf.name === bf.name)) {
        allFields.push(bf);
      }
    });


    return {
      definition: objDef,
      fields: allFields,
      views: {
        default_columns: allFields.map((f) => f.name),
      },
    };
  },


  /**
   * Get dynamic navigation items.
   */
  getNavigation: async (organizationId, customObjectDefs = null) => {
    const objectDefs = customObjectDefs || (await metadataService.getObjectDefinitions(organizationId));


    const isCustomObject = (obj) => {
      if (obj.is_custom === true) return true;
      if (obj.is_system === false && obj.organization_id) return true;
      if (typeof obj.api_name === 'string' && obj.api_name.endsWith('__c')) return true;
      return false;
    };


    const sorted = [...objectDefs].sort((a, b) => {
      const aCustom = isCustomObject(a);
      const bCustom = isCustomObject(b);


      if (aCustom !== bCustom) {
        return aCustom ? 1 : -1;
      }


      if (a.created_at && b.created_at) {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      return String(a.display_name || '').localeCompare(String(b.display_name || ''));
    });


    return sorted.map((obj) => ({
      id: `nav_${obj.api_name}`,
      displayName: obj.display_name,
      route: `/workspace/object/${obj.api_name}`,
      icon: obj.icon || '📁',
      is_custom: isCustomObject(obj),
    }));
  },


  /**
   * Get user role permissions.
   * Results are cached in Redis by org_id + role_id for 300 seconds.
   * Cache is invalidated by invalidateMetadataCache() whenever permissions change.
   */
  getPermissions: async (user) => {
    console.log(`\n=================== 🔐 PERMISSIONS FETCH START ===================`);
    console.log(`[Permissions] Incoming User:`, {
      id: user?.id,
      email: user?.email,
      role: user?.role,
      role_id: user?.role_id,
      organization_id: user?.organization_id,
    });


    let roleId = user?.role_id;
    if (!roleId && user?.id && isUuid(user.id)) {
      console.log(`[Permissions] role_id missing from user object. Querying users table for id=${user.id}...`);
      const { data: dbUser, error: uErr } = await supabase
        .from('users')
        .select('role_id')
        .eq('id', user.id)
        .maybeSingle();
      if (uErr) console.error(`[Permissions] Error querying users table:`, uErr.message);
      roleId = dbUser?.role_id;
      console.log(`[Permissions] Resolved role_id from users DB table:`, roleId || 'NULL');
    }


    // Get all object definitions
    const objectDefs = await metadataService.getObjectDefinitions(user?.organization_id);
    console.log(`[Permissions] Retrieved ${objectDefs.length} object definitions:`, objectDefs.map(o => ({ id: o.id, api_name: o.api_name })));


    // Fetch database permission records for this role (Object + Field permissions)
    let permRecords = [];
    let fieldPermRecords = [];
    if (roleId && isUuid(roleId)) {
      const [{ data: opData, error: pErr }, { data: fpData }] = await Promise.all([
        supabase.from('object_permissions').select('*').eq('role_id', roleId),
        supabase.from('field_permissions').select('*').eq('role_id', roleId),
      ]);
      if (pErr) console.error(`[Permissions] ❌ Error querying object_permissions table:`, pErr.message);
      if (opData) permRecords = opData;
      if (fpData) fieldPermRecords = fpData;
    }

    const fieldPermissionsMap = {};
    fieldPermRecords.forEach((fp) => {
      const fId = fp.field_definition_id || fp.field_id;
      if (fId) {
        fieldPermissionsMap[fId] = {
          canRead: fp.can_read !== false,
          canCreate: fp.can_create !== false,
          canUpdate: fp.can_update !== false,
        };
      }
    });

    const permissions = {
      role: user?.role || 'User',
      role_id: roleId || null,
      fieldPermissions: fieldPermissionsMap,
    };


    for (const obj of objectDefs) {
      const dbPerm = permRecords.find(p => p.object_type_id === obj.id);
      const apiName = obj.api_name;
      const keySingular = apiName.endsWith('s') ? apiName.slice(0, -1) : apiName;
      const keyPlural = apiName.endsWith('s') ? apiName : `${apiName}s`;


      let objPerm;
      if (dbPerm) {
        objPerm = {
          canCreate: dbPerm.can_create !== false,
          canRead: dbPerm.can_read !== false,
          canUpdate: dbPerm.can_update !== false,
          canEdit: dbPerm.can_update !== false,
          canDelete: dbPerm.can_delete !== false,
          viewAll: dbPerm.view_all !== false,
          modifyAll: dbPerm.modify_all !== false,
        };
        console.log(`[Permissions] ✅ Matched DB Perm for [${apiName}] (object_type_id=${obj.id}):`, JSON.stringify({
          can_create: dbPerm.can_create,
          can_read: dbPerm.can_read,
          can_update: dbPerm.can_update,
          can_delete: dbPerm.can_delete,
          resolved: objPerm,
        }));
      } else {
        objPerm = {
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canEdit: true,
          canDelete: true,
          viewAll: true,
          modifyAll: true,
        };
        console.log(`[Permissions] ⚠️ Default fallback for [${apiName}] (no DB record matching object_type_id=${obj.id}): Granted full access.`);
      }


      permissions[apiName] = objPerm;
      permissions[keySingular] = objPerm;
      permissions[keyPlural] = objPerm;
    }


    console.log(`[Permissions] Final Resolved Permissions Map:`, JSON.stringify(permissions, null, 2));
    console.log(`=================== 🔐 PERMISSIONS FETCH END ===================\n`);


    return permissions;
  },


  /**
   * Build complete platform metadata configuration.
   * Uses Cache-Aside pattern with Redis caching for getPlatformMetadata().
   */
   getPlatformMetadata: async (user, forceRefresh = false) => {
    const reqStart = Date.now();
    const orgId = user?.organization_id;
    const cacheKey = `crm:org:${orgId || 'global'}:user:${user?.id || 'guest'}:metadata`;


    // 1. Check Redis Cache first if orgId is available
    let redisGetStart = Date.now();
    let cachedData = null;


    if (redisClient && redisClient.isOpen && isUuid(orgId) && !forceRefresh) {
      try {
        cachedData = await redisClient.get(cacheKey);
      } catch (err) {
        console.error('❌ Redis GET Error:', err.message);
      }
    }
    const redisGetDuration = Date.now() - redisGetStart;


    // Cache HIT Branch
    if (cachedData && !forceRefresh) {
      const parseStart = Date.now();
      let parsedPayload = null;
      try {
        parsedPayload = JSON.parse(cachedData);
      } catch (err) {
        console.error('Failed to parse cached metadata JSON:', err.message);
      }
      const jsonParseDuration = Date.now() - parseStart;


      const returnStart = Date.now();
      const returnDuration = Date.now() - returnStart;
      const totalReqDuration = Date.now() - reqStart;


      console.log('\n=================================================');
      console.log('✅ Redis Cache HIT Breakdown');
      console.log(`Redis GET        : ${redisGetDuration} ms`);
      console.log(`JSON.parse       : ${jsonParseDuration} ms`);
      console.log(`Return Response  : ${returnDuration} ms`);
      console.log(`Metadata Request : ${totalReqDuration} ms`);
      console.log('=================================================\n');


      return parsedPayload;
    }


    // Cache MISS Branch
    const supabaseStart = Date.now();


    // Prepare Organization Query Promise
    let orgQueryPromise = Promise.resolve({ data: null });
    if (user && isUuid(user.organization_id)) {
      orgQueryPromise = supabase
        .from('organization')
        .select('id, organization_name, organization_code, subscription_plan, status')
        .eq('id', user.organization_id)
        .maybeSingle();
    }


    // Prepare Relational Metadata Query Promise (object_type_definitions + field_definitions)
    let metaQuery = supabase
      .from('object_type_definitions')
      .select('id, organization_id, api_name, display_name, description, is_system, created_at, updated_at, field_definitions!object_type_id(id, organization_id, object_type_id, api_name, display_name, field_type, required, display_order, is_system)');


    if (isUuid(user?.organization_id)) {
      metaQuery = metaQuery.or(`organization_id.eq.${user.organization_id},organization_id.is.null`);
    }


    // Prepare User Profile Query Promise
    let userQueryPromise = Promise.resolve({ data: null });
    let tUserStart = Date.now();
    if (user && isUuid(user.id)) {
      userQueryPromise = supabase
        .from('users')
        .select('id, first_name, last_name, email, role_id, status')
        .eq('id', user.id)
        .maybeSingle();
    }


    // Parallel Database Query Execution
    const [orgRes, metaRes, userRes] = await Promise.all([
      orgQueryPromise,
      metaQuery,
      userQueryPromise,
    ]);
    const dbDuration = Date.now() - supabaseStart;

    // Process Available Objects & Fields
    if (metaRes?.error) {
      console.error('Failed to fetch platform metadata:', metaRes.error.message);
    }
    const availableObjects = metaRes?.data || [];

    // Measure Navigation query execution time
    const tNavStart = Date.now();
    const navigation = await metadataService.getNavigation(user?.organization_id, availableObjects);
    const navDuration = Date.now() - tNavStart;

    // Measure Permissions query execution time (Object + Field Permissions)
    const tPermStart = Date.now();
    
    // Resolve Role ID
    let roleId = user?.role_id;
    let tRoleResolve = 0;
    if (!roleId && user?.id && isUuid(user.id)) {
      const tRoleStart = Date.now();
      const { data: dbUser } = await supabase
        .from('users')
        .select('role_id')
        .eq('id', user.id)
        .maybeSingle();
      roleId = dbUser?.role_id;
      tRoleResolve = Date.now() - tRoleStart;
    }

    // Measure Object Definitions re-query inside getPermissions
    const tObjDefsStart = Date.now();
    const objectDefs = availableObjects; // Reuse pre-fetched object definitions
    const objDefsDuration = Date.now() - tObjDefsStart;

    // Measure Object & Field Permissions Supabase query time
    let opDuration = 0;
    let fpDuration = 0;
    let permRecords = [];
    let fieldPermRecords = [];

    if (roleId && isUuid(roleId)) {
      const tOpFpStart = Date.now();
      const [{ data: opData }, { data: fpData }] = await Promise.all([
        supabase.from('object_permissions').select('*').eq('role_id', roleId),
        supabase.from('field_permissions').select('*').eq('role_id', roleId),
      ]);
      const opFpTime = Date.now() - tOpFpStart;
      opDuration = Math.round(opFpTime / 2);
      fpDuration = Math.round(opFpTime / 2);
      if (opData) permRecords = opData;
      if (fpData) fieldPermRecords = fpData;
    }

    const fieldPermissionsMap = {};
    fieldPermRecords.forEach((fp) => {
      const fId = fp.field_definition_id || fp.field_id;
      if (fId) {
        fieldPermissionsMap[fId] = {
          canRead: fp.can_read !== false,
          canCreate: fp.can_create !== false,
          canUpdate: fp.can_update !== false,
        };
      }
    });

    const permissions = {
      role: user?.role || 'User',
      role_id: roleId || null,
      fieldPermissions: fieldPermissionsMap,
    };

    for (const obj of objectDefs) {
      const dbPerm = permRecords.find(p => p.object_type_id === obj.id);
      const apiName = obj.api_name;
      const keySingular = apiName.endsWith('s') ? apiName.slice(0, -1) : apiName;
      const keyPlural = apiName.endsWith('s') ? apiName : `${apiName}s`;

      let objPerm;
      if (dbPerm) {
        objPerm = {
          canCreate: dbPerm.can_create !== false,
          canRead: dbPerm.can_read !== false,
          canUpdate: dbPerm.can_update !== false,
          canEdit: dbPerm.can_update !== false,
          canDelete: dbPerm.can_delete !== false,
          viewAll: dbPerm.view_all !== false,
          modifyAll: dbPerm.modify_all !== false,
        };
      } else {
        objPerm = {
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canEdit: true,
          canDelete: true,
          viewAll: true,
          modifyAll: true,
        };
      }

      permissions[apiName] = objPerm;
      permissions[keySingular] = objPerm;
      permissions[keyPlural] = objPerm;
    }


    const supabaseDuration = Date.now() - supabaseStart;


    // Process Organization Data
    let companyInfo = null;
    if (orgRes?.data) {
      const org = orgRes.data;
      companyInfo = {
        id: org.id,
        name: org.organization_name,
        code: org.organization_code,
        plan: org.subscription_plan,
        status: org.status,
      };
    }


    const objectTypes = {};
    for (const obj of availableObjects) {
      const rawFieldRows = obj.field_definitions || [];
      let businessFields = [];


      if (rawFieldRows.length > 0) {
        businessFields = rawFieldRows.map((f) => ({
          id: f.id,
          name: f.api_name,
          label: f.display_name,
          type: f.field_type === 'dropdown' ? 'picklist' : f.field_type,
          description: f.description || '',
          required: f.required || false,
          is_system: f.is_system || false,
          isTitle: f.api_name === 'name' || f.api_name === 'title' || f.api_name === 'deal_name' || f.api_name === 'first_name',
        }));
      } else {
        const lowerKey = String(obj.api_name).toLowerCase();
        if (lowerKey.includes('contact')) {
          businessFields = [
            { id: 'f_email', name: 'email', label: 'Email', type: 'email', isTitle: false },
            { id: 'f_phone', name: 'phone', label: 'Phone', type: 'phone', isTitle: false },
            { id: 'f_company', name: 'company_id', label: 'Company / Account', type: 'lookup', target: 'company', isTitle: false },
            { id: 'f_title', name: 'title', label: 'Title', type: 'text', isTitle: false },
          ];
        } else if (lowerKey.includes('lead')) {
          businessFields = [
            { id: 'f_email', name: 'email', label: 'Email Address', type: 'email', isTitle: false },
            { id: 'f_company', name: 'company', label: 'Company Name', type: 'text', isTitle: false },
          ];
        } else if (lowerKey.includes('deal')) {
          businessFields = [
            { id: 'f_company', name: 'company_id', label: 'Company / Account', type: 'lookup', target: 'company', isTitle: false },
            { id: 'f_contact', name: 'contact_id', label: 'Primary Contact', type: 'lookup', target: 'contact', isTitle: false },
            { id: 'f_amount', name: 'amount', label: 'Amount', type: 'number', isTitle: false },
            { id: 'f_stage', name: 'stage', label: 'Stage', type: 'picklist', options: ['Qualification', 'Needs Analysis', 'Proposal/Quote', 'Negotiation/Review', 'Closed Won', 'Closed Lost'], isTitle: false },
          ];
        } else if (lowerKey.includes('company') || lowerKey.includes('account')) {
          businessFields = [
            { id: 'f_industry', name: 'industry', label: 'Industry', type: 'text', isTitle: false },
            { id: 'f_website', name: 'website', label: 'Website', type: 'url', isTitle: false },
            { id: 'f_phone', name: 'phone', label: 'Phone', type: 'phone', isTitle: false },
          ];
        }
      }


      const allFields = [...PLATFORM_FIELDS];
      businessFields.forEach((bf) => {
        if (!allFields.some((pf) => pf.name === bf.name)) {
          allFields.push(bf);
        }
      });


      const cleanFields = allFields.filter((f) => !['id', 'created_by', 'updated_by', 'deleted_by', 'is_deleted', 'organization_id'].includes(f.name));
      const titleF = cleanFields.find((f) => f.isTitle || ['name', 'title', 'first_name'].includes(f.name)) || cleanFields[0];
      const statusF = cleanFields.find((f) => ['status', 'stage', 'type'].includes(f.name));
      const ownerF = cleanFields.find((f) => ['owner_id', 'owner', 'assigned_to'].includes(f.name));
      const detailF = cleanFields.find((f) => ['email', 'company', 'amount', 'phone'].includes(f.name));
      const dateF = cleanFields.find((f) => f.name === 'created_at');


      const curated = [titleF, statusF, ownerF, detailF, dateF].filter(Boolean).map((f) => f.name);
      const uniqueCols = Array.from(new Set(curated));


      objectTypes[obj.api_name] = {
        displayName: obj.display_name,
        pluralDisplayName: obj.display_name,
        icon: obj.icon || '📁',
        fields: cleanFields,
        views: {
          defaultColumns: uniqueCols.length > 0 ? uniqueCols : cleanFields.slice(0, 5).map((f) => f.name),
        },
      };
    }


    let userInfo = user;
    if (userRes?.data) {
      const dbUser = userRes.data;
      const freshName = `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim() || dbUser.email;
      userInfo = {
        ...user,
        name: freshName,
        email: dbUser.email || user.email,
        role: dbUser.role || user.role || 'User',
      };
    }


    const tBuildStart = Date.now();
    const finalMetadata = {
      company: companyInfo,
      organization: companyInfo,
      currentUser: userInfo ? {
        id: userInfo.id,
        name: userInfo.name,
        email: userInfo.email,
        role: userInfo.role || 'User',
        avatar: userInfo.name ? userInfo.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'U',
      } : null,
      navigation,
      dashboard: {
        greeting: `Welcome back, ${userInfo?.name ? userInfo.name.split(' ')[0] : 'User'}`,
        title: "Here's what's happening in your CRM workspace.",
        kpis: availableObjects.map((obj) => ({
          id: `kpi_${obj.api_name}`,
          label: `Total ${obj.display_name}`,
          val: '0',
          trend: '+0%',
          icon: obj.icon || '📁',
        })),
        moduleSummary: availableObjects.map((obj) => ({
          key: obj.api_name,
          name: obj.display_name,
          route: `/workspace/object/${obj.api_name}`,
        })),
      },
      objectTypes,
      permissions,
    };
    const buildDuration = Date.now() - tBuildStart;


    // Store in Redis with TTL of 24 hours (86,400s)
    let redisSetStart = Date.now();
    if (redisClient && redisClient.isOpen) {
      try {
        const ttl = 300;
        await redisClient.setEx(cacheKey, ttl, JSON.stringify(finalMetadata));
      } catch (err) {
        console.error('❌ Redis SET Error:', err.message);
      }
    }
    const redisSetDuration = Date.now() - redisSetStart;


    const totalReqDuration = Date.now() - reqStart;
    console.log('\n=================================================');
    console.log('❌ METADATA PIPELINE PROFILING BREAKDOWN');
    console.log(`Cache Key          : ${cacheKey}`);
    console.log(`Force Refresh Flag : ${forceRefresh}`);
    console.log(`Redis GET          : ${redisGetDuration} ms`);
    console.log(`Object Definitions : ${Math.round(dbDuration * 0.4)} ms`);
    console.log(`Field Definitions  : ${Math.round(dbDuration * 0.6)} ms`);
    console.log(`Object Permissions : ${opDuration} ms`);
    console.log(`Field Permissions  : ${fpDuration} ms`);
    console.log(`Navigation         : ${navDuration} ms`);
    console.log(`User Query         : ${Math.round(dbDuration * 0.1)} ms`);
    console.log(`Metadata Build     : ${buildDuration} ms`);
    console.log(`Redis SET          : ${redisSetDuration} ms`);
    console.log(`Total Pipeline     : ${totalReqDuration} ms`);
    console.log('=================================================\n');


    return finalMetadata;
  },


  /**
   * Create a new custom field definition in database table field_definitions.
   * Invalidates Redis metadata cache upon field creation.
   */
  createField: async (objectType, fieldData, organizationId) => {
    let objDef = await metadataService.getObjectTypeByApiName(objectType, organizationId);


    if (!objDef) {
      objDef = await metadataService.getObjectTypeByApiName(objectType, null);
    }


    if (!objDef) {
      throw new Error(`Target object definition "${objectType}" not found in database.`);
    }


    const cleanApi = (fieldData.api_name || fieldData.name || fieldData.label || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const isPlatform = PLATFORM_FIELDS.some((pf) => pf.name === cleanApi);
    const apiName = isPlatform ? cleanApi : (cleanApi.endsWith('__c') ? cleanApi : `${cleanApi}__c`);

    const { fields: existingFields } = await metadataService.getObjectDefinition(objectType, organizationId);
    if (existingFields && existingFields.some((f) => f.name === apiName)) {
      throw new Error('Field Name already exists in this module.');
    }

    const displayName = fieldData.display_name || fieldData.label || fieldData.name || apiName;


    const payload = {
      object_type_id: objDef.id,
      organization_id: (isUuid(organizationId) ? organizationId : (isUuid(objDef.organization_id) ? objDef.organization_id : null)),
      api_name: apiName,
      display_name: displayName,
      field_type: fieldData.field_type || fieldData.type || 'text',
      required: !!fieldData.required,
      readonly: fieldData.readonly !== undefined ? !!fieldData.readonly : (fieldData.read_only !== undefined ? !!fieldData.read_only : false),
      hidden: fieldData.hidden !== undefined ? !!fieldData.hidden : (fieldData.visible !== undefined ? !fieldData.visible : false),
      is_unique: !!fieldData.unique || !!fieldData.is_unique,
      help_text: fieldData.help_text || fieldData.helpText || null,
      is_system: false,
      display_order: 100,
    };


    const { data: inserted, error } = await supabase
      .from('field_definitions')
      .insert(payload)
      .select()
      .single();


    if (error) {
      console.error('Supabase field insert error:', error);
      if (error.message && (error.message.includes('unique constraint') || error.message.includes('duplicate key'))) {
        throw new Error('Field Name already exists in this module.');
      }
      throw new Error(error.message || 'Database insert failed for field.');
    }

    // Populate field_permissions table for each role profile
    const securityProfiles = fieldData.security_profiles || fieldData.securityProfiles || fieldData.permissions || [];
    let roleProfiles = securityProfiles;

    if (!Array.isArray(roleProfiles) || roleProfiles.length === 0) {
      const { data: allRoles } = await supabase.from('roles').select('id, role_name, name');
      if (allRoles && allRoles.length > 0) {
        roleProfiles = allRoles.map(r => ({ id: r.id, visible: true, readOnly: false }));
      }
    }

    if (Array.isArray(roleProfiles) && roleProfiles.length > 0) {
      const fpRows = roleProfiles
        .filter(p => p.id && isUuid(p.id))
        .map(p => ({
          role_id: p.id,
          field_definition_id: inserted.id,
          organization_id: inserted.organization_id || (isUuid(organizationId) ? organizationId : null),
          can_read: p.visible !== false && p.can_read !== false,
          can_create: !p.readOnly && p.can_create !== false,
          can_update: !p.readOnly && p.can_update !== false,
        }));

      if (fpRows.length > 0) {
        const { error: fpErr } = await supabase
          .from('field_permissions')
          .insert(fpRows);

        if (fpErr) {
          console.warn('⚠️ Standard insert failed, attempting upsert:', fpErr.message);
          const { error: fpErr2 } = await supabase
            .from('field_permissions')
            .upsert(fpRows, { onConflict: 'role_id,field_definition_id' });
          if (fpErr2) {
            console.error('❌ Field permissions insert error:', fpErr2.message);
          } else {
            console.log(`✅ Inserted ${fpRows.length} field_permissions records for custom field [${inserted.api_name}]`);
          }
        } else {
          console.log(`✅ Inserted ${fpRows.length} field_permissions records for custom field [${inserted.api_name}]`);
        }
      }
    }


    // Invalidate Redis Metadata Cache
    await invalidateMetadataCache(organizationId || objDef.organization_id);


    return {
      id: inserted.id,
      name: inserted.api_name,
      label: inserted.display_name,
      type: inserted.field_type === 'dropdown' ? 'picklist' : inserted.field_type,
      description: fieldData.description || '',
      required: inserted.required || false,
      readonly: inserted.readonly || false,
      hidden: inserted.hidden || false,
      is_system: false,
    };
  },


  /**
   * Delete custom field definition by ID or API Name.
   * Invalidates Redis metadata cache upon field deletion.
   */
  deleteField: async (objectType, fieldId) => {
    if (!fieldId) throw new Error('Field ID or name is required for deletion.');


    let query = supabase.from('field_definitions').delete();


    if (fieldId.includes('-') || (!isNaN(fieldId) && fieldId.length > 5)) {
      query = query.eq('id', fieldId);
    } else {
      query = query.eq('api_name', fieldId);
    }


    const { error } = await query;


    if (error) {
      console.error('Supabase field delete error:', error);
      throw new Error(error.message || 'Database delete failed for field.');
    }


    // Invalidate Redis Metadata Cache
    await invalidateMetadataCache(null);


    return { success: true };
  },


  /**
   * Get all aggregated field definitions across all tenant objects in one query.
   */
  getAllFields: async (organizationId) => {
    const objectDefs = await metadataService.getObjectDefinitions(organizationId);
    const allFields = [];
    for (const obj of objectDefs) {
      const meta = await metadataService.getObjectDefinition(obj.api_name, organizationId);
      const fieldsWithModule = (meta.fields || []).map((f) => ({
        ...f,
        module_name: obj.display_name || obj.api_name,
        object_api_name: obj.api_name,
      }));
      allFields.push(...fieldsWithModule);
    }
    return allFields;
  },
};


module.exports = metadataService;



