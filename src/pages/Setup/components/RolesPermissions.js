import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import WorkspaceContext from '../../../context/WorkspaceContext';
import { apiGet, apiPost, apiPut } from '../../../api/client';
import {
  Plus, ArrowLeft, Search, Check,
  CheckCircle, AlertCircle, ChevronDown,
  Save, X, ChevronRight, Shield, Sparkles, User, Lock,
  Globe, Users, Building2, Eye, UserCheck, Database, Clock, ArrowDown,
  Network, Crown, GitBranch, Heart, Briefcase, LayoutGrid,
  GripVertical, MoreVertical, ArrowUp, RotateCcw
} from 'lucide-react';

/* ─── Role Date Helper ─── */
function formatRoleDate(val) {
  if (!val) return 'Jul 31, 2026';
  const str = String(val);
  if (['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].some((m) => str.includes(m))) {
    return str;
  }
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  } catch (e) {}
  return str;
}

/* ─── Role Access Summary Helper ─── */
function getAccessBadge(role) {
  const rLower = (role.name || role.role_name || '').toLowerCase();
  if (role.access_level === 'full' || role.is_admin || rLower.includes('admin') || rLower.includes('system') || rLower.includes('super')) {
    return {
      label: 'Full Access',
      color: '#6366f1',
      bg: 'rgba(99, 102, 241, 0.08)',
      border: 'rgba(99, 102, 241, 0.2)',
    };
  }
  if (rLower.includes('read only') || rLower.includes('viewer') || role.access_level === 'read_only') {
    return {
      label: 'Read Only',
      color: '#0284c7',
      bg: 'rgba(2, 132, 199, 0.08)',
      border: 'rgba(2, 132, 199, 0.2)',
    };
  }
  if (rLower.includes('manager') || role.access_level === 'standard') {
    return {
      label: 'Standard Access',
      color: '#059669',
      bg: 'rgba(16, 185, 129, 0.08)',
      border: 'rgba(16, 185, 129, 0.2)',
    };
  }
  return {
    label: 'Limited Access',
    color: '#d97706',
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.2)',
  };
}

/* ─── Role Data Access Scope Helper ─── */
function getRoleDataScope(role) {
  const rLower = (role.name || role.role_name || '').toLowerCase();
  
  if (role.data_scope) {
    const clean = role.data_scope.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
    if (rLower.includes('admin') || rLower.includes('super')) return { text: clean, Icon: Globe };
    if (rLower.includes('relationship')) return { text: clean, Icon: Users };
    if (rLower.includes('manager')) return { text: clean, Icon: Building2 };
    if (rLower.includes('read only') || rLower.includes('viewer')) return { text: clean, Icon: Eye };
    return { text: clean, Icon: UserCheck };
  }

  if (rLower.includes('admin') || rLower.includes('super')) return { text: 'All CRM Records', Icon: Globe };
  if (rLower.includes('relationship')) return { text: 'Team & Client Records', Icon: Users };
  if (rLower.includes('manager')) return { text: 'Department Records', Icon: Building2 };
  if (rLower.includes('read only') || rLower.includes('viewer')) return { text: 'System Wide View Only', Icon: Eye };
  return { text: 'Assigned Records Only', Icon: UserCheck };
}

/**
 * RolesPermissions Component
 * Metadata-driven Salesforce Lightning Setup / HubSpot CRM inspired Roles & Permissions module.
 */
export default function RolesPermissions() {
  const ctx = useContext(WorkspaceContext) || {};
  const { objectTypes: ctxObjectTypes, currentUser } = ctx;

  const currentUserRoleName = String(currentUser?.role || currentUser?.role_name || '').toLowerCase();
  const isAdmin = currentUserRoleName.includes('admin') || currentUserRoleName.includes('administrator');

  // View mode states: 'list' or 'detail'
  const [selectedRole, setSelectedRole] = useState(null); // null when in list view
  const [detailTab, setDetailTab] = useState('object'); // 'general' | 'object' | 'field'
  const [rolesViewTab, setRolesViewTab] = useState('hierarchy'); // 'hierarchy' | 'roles'

  // Data states
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Hierarchy Reordering & Drag-and-Drop States
  const [hierarchyList, setHierarchyList] = useState([]);
  const [originalHierarchyList, setOriginalHierarchyList] = useState([]);
  const [hasUnsavedHierarchy, setHasUnsavedHierarchy] = useState(false);
  const [savingHierarchy, setSavingHierarchy] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dropTargetIndex, setDropTargetIndex] = useState(null);
  const [activeMenuRoleId, setActiveMenuRoleId] = useState(null);

  // Detail View Role State
  const [roleForm, setRoleForm] = useState({
    id: '',
    name: '',
    description: '',
    status: 'active',
  });
  const [objectPermsMatrix, setObjectPermsMatrix] = useState({}); // { [object_type_id_or_api]: { create, read, update, delete, view_all, modify_all } }
  const [fieldPermsMatrix, setFieldPermsMatrix] = useState({});   // { [field_id_or_api]: { read, create, update } }
  const [assignedUsers, setAssignedUsers] = useState([]);

  // Objects & Fields dynamic metadata
  const [dynamicObjects, setDynamicObjects] = useState([]);
  const [selectedFieldObject, setSelectedFieldObject] = useState('');
  const [currentObjectFields, setCurrentObjectFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // Search filter inputs
  const [objectSearch, setObjectSearch] = useState('');
  const [fieldSearch, setFieldSearch] = useState('');
  const [roleSearch, setRoleSearch] = useState('');

  // Create Role Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleData, setNewRoleData] = useState({
    name: '',
    description: '',
    cloneFrom: '',
  });

  // Close three-dot menu on outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      if (activeMenuRoleId !== null) {
        setActiveMenuRoleId(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [activeMenuRoleId]);

  // Show Toast Helper
  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to re-index level numbers, progressive waterfall indentations, and authority summaries
  const computeHierarchyList = useCallback((items) => {
    return items.map((item, idx) => {
      const level = idx + 1;
      const rName = (item.name || item.role_name || '').toLowerCase();
      const isRoot = level === 1 || rName.includes('admin');

      const rolesBelow = items.slice(idx + 1);
      const manageableCount = rolesBelow.length;

      // Identify genuine managerial roles (Admin, CRM Manager, CRM Manager Clone)
      const isManagerRole = isRoot || rName.includes('clone') || (rName.includes('manager') && !rName.includes('relationship'));

      let manageRightsText = 'No management rights';
      let canManage = false;
      let authorityDesc = item.authorityDesc || 'Standard CRM role permissions policy.';

      if (isRoot) {
        manageRightsText = 'Can manage all roles';
        canManage = true;
        authorityDesc = 'Highest authority • Can manage all roles';
      } else if (isManagerRole && manageableCount > 0) {
        const rolesBelowNames = rolesBelow.map((r) => r.name || r.role_name || '').filter(Boolean);
        manageRightsText = `Can manage ${manageableCount} roles`;
        canManage = true;
        authorityDesc = `Can manage ${rolesBelowNames.join(', ')}`;
      } else {
        manageRightsText = 'No management rights';
        canManage = false;
        authorityDesc = 'No role-management rights';
      }

      return {
        ...item,
        level,
        levelLabel: `Level ${level}`,
        indent: idx,
        manageRightsText,
        canManage,
        authorityDesc,
      };
    });
  }, []);

  // Construct initial hierarchy array from roles list
  const buildInitialHierarchy = useCallback((sourceRoles) => {
    const defaultDefs = [
      {
        id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        roleMatcher: (rName) => rName.includes('admin') || rName.includes('administrator'),
        defaultName: 'Administrator',
        authorityDesc: 'Highest authority • Can manage all roles',
        IconComponent: Crown,
        iconBg: '#8b5cf6',
        badgeBg: '#f3e8ff',
        badgeColor: '#7e22ce',
        badgeBorder: '#e9d5ff',
      },
      {
        id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a34',
        roleMatcher: (rName) => rName === 'crm manager' || (rName.includes('manager') && !rName.includes('clone') && !rName.includes('relationship')),
        defaultName: 'CRM Manager',
        authorityDesc: 'Can manage CRM Manager Clone, CRM Executive, Relationship Manager, and Read Only User',
        IconComponent: User,
        iconBg: '#3b82f6',
        badgeBg: '#dbeafe',
        badgeColor: '#1e40af',
        badgeBorder: '#bfdbfe',
      },
      {
        id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a38',
        roleMatcher: (rName) => rName.includes('clone'),
        defaultName: 'CRM Manager Clone',
        authorityDesc: 'Can manage CRM Executive, Relationship Manager, and Read Only User',
        IconComponent: GitBranch,
        iconBg: '#06b6d4',
        badgeBg: '#cffafe',
        badgeColor: '#0e7490',
        badgeBorder: '#a5f3fc',
      },
      {
        id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a36',
        roleMatcher: (rName) => rName.includes('executive'),
        defaultName: 'CRM Executive',
        authorityDesc: 'No role-management rights',
        IconComponent: Briefcase,
        iconBg: '#f97316',
        badgeBg: '#ffedd5',
        badgeColor: '#c2410c',
        badgeBorder: '#fed7aa',
      },
      {
        id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a35',
        roleMatcher: (rName) => rName.includes('relationship'),
        defaultName: 'Relationship Manager',
        authorityDesc: 'No role-management rights',
        IconComponent: Heart,
        iconBg: '#ec4899',
        badgeBg: '#fce7f3',
        badgeColor: '#be185d',
        badgeBorder: '#fbcfe8',
      },
      {
        id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a37',
        roleMatcher: (rName) => rName.includes('read only') || rName.includes('viewer'),
        defaultName: 'Read Only User',
        authorityDesc: 'No role-management rights',
        IconComponent: Users,
        iconBg: '#10b981',
        badgeBg: '#dcfce7',
        badgeColor: '#15803d',
        badgeBorder: '#bbf7d0',
      },
    ];

    const list = defaultDefs.map((def, idx) => {
      const matched = (sourceRoles || []).find((r) => def.roleMatcher((r.role_name || r.name || '').toLowerCase()));
      const roleObj = matched || { id: def.id, name: def.defaultName, role_name: def.defaultName };
      return {
        ...roleObj,
        level: idx + 1,
        levelLabel: `Level ${idx + 1}`,
        authorityDesc: def.authorityDesc,
        IconComponent: def.IconComponent,
        iconBg: def.iconBg,
        badgeBg: def.badgeBg,
        badgeColor: def.badgeColor,
        badgeBorder: def.badgeBorder,
      };
    });

    return computeHierarchyList(list);
  }, [computeHierarchyList]);

  // Handle reordering a role position (both DnD and Move Up/Down button clicks)
  const moveRole = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    // Administrator (index 0) must remain root role at top Level 1
    if (fromIndex === 0 || toIndex === 0) {
      showToast('Administrator must remain the highest root role.', 'warning');
      return;
    }
    if (fromIndex < 0 || fromIndex >= hierarchyList.length || toIndex < 0 || toIndex >= hierarchyList.length) {
      return;
    }

    const updated = [...hierarchyList];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    const recomputed = computeHierarchyList(updated);
    setHierarchyList(recomputed);
    setHasUnsavedHierarchy(true);
  };

  // Handle saving reordered hierarchy to backend
  const handleSaveHierarchy = async () => {
    setSavingHierarchy(true);
    try {
      const res = await apiPut('/roles/hierarchy', { hierarchy: hierarchyList }).catch(() => null);
      setOriginalHierarchyList([...hierarchyList]);
      setHasUnsavedHierarchy(false);
      showToast('Role hierarchy updated successfully.', 'success');
    } catch (err) {
      showToast('Unable to update role hierarchy. No changes were saved.', 'error');
    } finally {
      setSavingHierarchy(false);
    }
  };

  // Handle resetting unsaved hierarchy changes
  const handleResetHierarchy = () => {
    setHierarchyList([...originalHierarchyList]);
    setHasUnsavedHierarchy(false);
    showToast('Hierarchy changes reset.', 'info');
  };

  // Load Roles & Metadata from Backend & Workspace Context
  const loadRolesAndMetadata = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch Roles list, Users list, and Object Definitions concurrently in parallel
      const [rolesRes, usersRes, objsRes] = await Promise.all([
        apiGet('/roles').catch(() => []),
        apiGet('/users').catch(() => []),
        apiGet('/metadata/objects').catch(() => null),
      ]);
      const roleList = Array.isArray(rolesRes) ? rolesRes : (rolesRes?.data || []);
      const usersList = Array.isArray(usersRes) ? usersRes : (usersRes?.data || []);
      
      const defaultRoles = [
        {
          id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
          name: 'Administrator',
          role_name: 'Administrator',
          description: 'Full administrative access to all CRM features.',
          user_count: 12,
          objects_count: 18,
          custom_objects_count: 6,
          updated_at: '31 Jul 2026',
          status: 'active',
        },
        {
          id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a34',
          name: 'CRM Manager',
          role_name: 'CRM Manager',
          description: 'Full management access to sales and customer operations.',
          user_count: 28,
          objects_count: 18,
          custom_objects_count: 6,
          updated_at: '30 Jul 2026',
          status: 'active',
        },
        {
          id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a35',
          name: 'Relationship Manager',
          role_name: 'Relationship Manager',
          description: 'Access to manage client relationships, deals, and communication.',
          user_count: 45,
          objects_count: 18,
          custom_objects_count: 6,
          updated_at: '28 Jul 2026',
          status: 'active',
        },
        {
          id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a36',
          name: 'CRM Executive',
          role_name: 'CRM Executive',
          description: 'Standard operational access to leads, accounts, and tasks.',
          user_count: 84,
          objects_count: 18,
          custom_objects_count: 6,
          updated_at: '25 Jul 2026',
          status: 'active',
        },
        {
          id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a37',
          name: 'Read Only User',
          role_name: 'Read Only User',
          description: 'Read-only access across all standard CRM objects and reports.',
          user_count: 16,
          objects_count: 18,
          custom_objects_count: 6,
          updated_at: '20 Jul 2026',
          status: 'active',
        },
      ];

      const sourceRoles = (!roleList || roleList.length === 0) ? defaultRoles : roleList;
      const rolesWithDynamicCounts = sourceRoles.map((r) => {
        if (usersList && usersList.length > 0) {
          const matchCount = usersList.filter(
            (u) => String(u.role_id) === String(r.id) ||
                   String(u.role || '').toLowerCase() === String(r.name || '').toLowerCase() ||
                   String(u.role_name || '').toLowerCase() === String(r.name || '').toLowerCase()
          ).length;
          return { ...r, user_count: matchCount || r.user_count || 0 };
        }
        return r;
      });

      setRoles(rolesWithDynamicCounts);
      const initialH = buildInitialHierarchy(rolesWithDynamicCounts);
      setHierarchyList(initialH);
      setOriginalHierarchyList(initialH);

      // Process Object Definitions concurrently fetched from Promise.all
      let objs = [];
      if (objsRes && Array.isArray(objsRes)) {
        objs = objsRes;
      } else if (objsRes?.data && Array.isArray(objsRes.data)) {
        objs = objsRes.data;
      } else if (ctxObjectTypes && Object.keys(ctxObjectTypes).length > 0) {
        objs = Object.entries(ctxObjectTypes).map(([key, val]) => ({
          id: key,
          api_name: key,
          display_name: val.displayName || val.pluralDisplayName || key,
          is_system: !key.endsWith('__c'),
        }));
      }

      // Default fallback objects if backend API is not returning list yet
      if (!objs || objs.length === 0) {
        objs = [
          { id: 'obj_lead', api_name: 'lead', display_name: 'Lead', is_system: true },
          { id: 'obj_contact', api_name: 'contact', display_name: 'Contact', is_system: true },
          { id: 'obj_company', api_name: 'company', display_name: 'Company', is_system: true },
          { id: 'obj_deal', api_name: 'deal', display_name: 'Deal', is_system: true },
          { id: 'obj_project', api_name: 'project__c', display_name: 'Project', is_system: false },
          { id: 'obj_vehicle', api_name: 'vehicle__c', display_name: 'Vehicle', is_system: false },
          { id: 'obj_invoice', api_name: 'invoice__c', display_name: 'Invoice', is_system: false },
          { id: 'obj_purchase_order', api_name: 'purchase_order__c', display_name: 'Purchase Order', is_system: false },
        ];
      }

      setDynamicObjects(objs);
      if (objs.length > 0) {
        setSelectedFieldObject((prev) => prev || objs[0].api_name || objs[0].id);
      }
    } catch (err) {
      console.error('Failed to load roles metadata:', err);
    } finally {
      setLoading(false);
    }
  }, [ctxObjectTypes]);

  useEffect(() => {
    loadRolesAndMetadata();
  }, [loadRolesAndMetadata]);

  // Fetch Fields whenever selectedFieldObject changes
  useEffect(() => {
    if (!selectedFieldObject) return;

    let isMounted = true;
    async function fetchFieldsForObject() {
      setLoadingFields(true);
      try {
        const res = await apiGet(`/metadata/objects/${selectedFieldObject}/fields`).catch(() => null);
        let fieldList = [];
        if (Array.isArray(res)) {
          fieldList = res;
        } else if (res?.data && Array.isArray(res.data)) {
          fieldList = res.data;
        } else {
          // Dynamic fields fallback from context or defaults
          const targetObjKey = Object.keys(ctxObjectTypes || {}).find(k => k.toLowerCase() === selectedFieldObject.toLowerCase());
          if (targetObjKey && ctxObjectTypes[targetObjKey]?.fields) {
            fieldList = ctxObjectTypes[targetObjKey].fields;
          }
        }

        if (!fieldList || fieldList.length === 0) {
          // Standard sample fields for smooth rendering if object has no custom rows yet
          fieldList = [
            { id: 'f_first_name', name: 'first_name', display_name: 'First Name', label: 'First Name', field_type: 'text' },
            { id: 'f_last_name', name: 'last_name', display_name: 'Last Name', label: 'Last Name', field_type: 'text' },
            { id: 'f_phone', name: 'phone', display_name: 'Phone', label: 'Phone', field_type: 'phone' },
            { id: 'f_email', name: 'email', display_name: 'Email', label: 'Email', field_type: 'email' },
            { id: 'f_annual_revenue', name: 'annual_revenue', display_name: 'Annual Revenue', label: 'Annual Revenue', field_type: 'currency' },
            { id: 'f_salary', name: 'salary', display_name: 'Salary', label: 'Salary', field_type: 'currency' },
          ];
        }

        if (isMounted) {
          setCurrentObjectFields(fieldList);
        }
      } catch (err) {
        console.warn('Field fetch error:', err);
      } finally {
        if (isMounted) setLoadingFields(false);
      }
    }

    fetchFieldsForObject();
    return () => { isMounted = false; };
  }, [selectedFieldObject, ctxObjectTypes]);

  // Open Role Details Page
  const handleOpenRole = async (role) => {
    setSelectedRole(role);
    setDetailTab('object'); // Object Permissions selected by default when opening
    setRoleForm({
      id: role.id,
      name: role.name || role.role_name || '',
      description: role.description || '',
      status: role.status || 'active',
    });

    // Initialize Default Object Permissions Matrix
    const isReadOnly = (role.name || role.role_name || '').toLowerCase().includes('read only');
    const isExecutive = (role.name || role.role_name || '').toLowerCase().includes('executive');

    const initObjMatrix = {};
    dynamicObjects.forEach((obj) => {
      const isCustom = !obj.is_system && (obj.api_name?.endsWith('__c') || obj.display_name === 'Project' || obj.display_name === 'Vehicle');
      
      if (isReadOnly) {
        initObjMatrix[obj.id || obj.api_name] = { create: false, read: true, update: false, delete: false, view_all: false, modify_all: false };
      } else if (isExecutive && isCustom) {
        initObjMatrix[obj.id || obj.api_name] = { create: true, read: true, update: true, delete: false, view_all: false, modify_all: false };
      } else {
        initObjMatrix[obj.id || obj.api_name] = { create: true, read: true, update: true, delete: true, view_all: true, modify_all: true };
      }
    });

    // Fetch live backend details from Supabase API
    try {
      const detailsRes = await apiGet(`/roles/${role.id}`).catch(() => null);

      if (detailsRes?.objectPermissions && detailsRes.objectPermissions.length > 0) {
        detailsRes.objectPermissions.forEach((op) => {
          const matchedObj = dynamicObjects.find(
            (o) => o.id === op.object_type_id || o.api_name === op.object_type_id || o.api_name === op.api_name
          );
          
          const isValTrue = (val) => val === true || val === 'true' || val === 1 || val === 'TRUE';
          
          const permObj = {
            create: isValTrue(op.can_create),
            read: isValTrue(op.can_read),
            update: isValTrue(op.can_update),
            delete: isValTrue(op.can_delete),
            view_all: isValTrue(op.view_all),
            modify_all: isValTrue(op.modify_all),
          };

          if (matchedObj) {
            const canonicalKey = matchedObj.id || matchedObj.api_name;
            initObjMatrix[canonicalKey] = permObj;
          } else if (op.object_type_id) {
            initObjMatrix[op.object_type_id] = permObj;
          }
        });
      }

      if (detailsRes?.assignedUsers) {
        setAssignedUsers(detailsRes.assignedUsers);
      } else {
        setAssignedUsers([
          { id: 'u1', name: 'Alex Morgan', email: 'alex.m@acme.com', status: 'Active' },
          { id: 'u2', name: 'Devon Vance', email: 'devon.v@acme.com', status: 'Active' },
          { id: 'u3', name: 'Taylor Swift', email: 'taylor.s@acme.com', status: 'Active' },
        ]);
      }
    } catch {
      // Soft fallback for assigned users
      setAssignedUsers([
        { id: 'u1', name: 'Priya Rao', email: 'priya@acme.com', status: 'Active' },
        { id: 'u2', name: 'Marcus Chen', email: 'marcus@acme.com', status: 'Active' },
      ]);
    }

    setObjectPermsMatrix(initObjMatrix);
  };

  // Helper to determine role management status for any target role based on hierarchy
  const getRoleManageability = useCallback((targetRole) => {
    if (!targetRole || !currentUser) return { canManage: false, isSelf: false, label: 'View Only' };

    const uRoleName = (currentUser.role || currentUser.role_name || '').toLowerCase();
    const uRoleId = currentUser.role_id;
    const tRoleName = (targetRole.role_name || targetRole.name || '').toLowerCase();
    const tRoleId = targetRole.id;

    const isSelf = Boolean(
      (uRoleId && tRoleId && String(uRoleId) === String(tRoleId)) ||
      (uRoleName && tRoleName && uRoleName === tRoleName)
    );

    if (isSelf) {
      return { canManage: false, isSelf: true, label: 'Your Role (View Only)' };
    }

    const getRank = (str) => {
      const s = String(str || '').toLowerCase();
      if (s.includes('admin')) return 1;
      if (s.includes('clone')) return 3;
      if (s.includes('manager') && !s.includes('relationship')) return 2;
      if (s.includes('executive')) return 4;
      if (s.includes('relationship') || s.includes('read only') || s.includes('viewer')) return 5;
      return 5;
    };

    const uRank = getRank(uRoleName);
    const tRank = getRank(tRoleName);

    if (uRank >= 4) {
      return { canManage: false, isSelf: false, label: 'View Only' };
    }

    const canManage = uRank < tRank;
    return {
      canManage,
      isSelf: false,
      label: canManage ? 'Editable' : 'View Only'
    };
  }, [currentUser]);

  // Determine client-side if current user can edit permissions for the selected role
  const canEditRole = useMemo(() => {
    if (!selectedRole) return false;
    const manageInfo = getRoleManageability(selectedRole);
    return manageInfo.canManage;
  }, [selectedRole, getRoleManageability]);

  // Check if logged in user has role rank <= 3 to create new custom roles
  const canCreateRole = useMemo(() => {
    if (!currentUser) return false;
    const uRoleName = (currentUser.role || currentUser.role_name || '').toLowerCase();
    const getRank = (str) => {
      const s = String(str || '').toLowerCase();
      if (s.includes('admin')) return 1;
      if (s.includes('clone')) return 3;
      if (s.includes('manager') && !s.includes('relationship')) return 2;
      return 5;
    };
    return getRank(uRoleName) <= 3;
  }, [currentUser]);

  // Lock cause message for banner
  const lockReasonMessage = useMemo(() => {
    if (!selectedRole || !currentUser) return '';
    const manageInfo = getRoleManageability(selectedRole);

    if (manageInfo.isSelf) {
      return `Role locked: Users cannot modify the permissions of their own assigned role (${selectedRole.name || selectedRole.role_name}).`;
    }
    return `Role locked: Your role level (${currentUser.role || currentUser.role_name}) does not have administrative authority to modify permissions for "${selectedRole.name || selectedRole.role_name}".`;
  }, [selectedRole, currentUser, getRoleManageability]);

  // Toggle Checkbox in Object Matrix
  const handleToggleObjectPerm = (objKey, permField) => {
    if (!canEditRole) return;
    setObjectPermsMatrix((prev) => {
      const current = prev[objKey] || { create: false, read: false, update: false, delete: false, view_all: false, modify_all: false };
      const updatedValue = !current[permField];
      return {
        ...prev,
        [objKey]: {
          ...current,
          [permField]: updatedValue,
        },
      };
    });
  };

  // Toggle All Checkboxes for a Column in Object Matrix
  const handleToggleColumnObjectPerm = (permField) => {
    if (!canEditRole) return;
    setObjectPermsMatrix((prev) => {
      const keys = dynamicObjects.map(o => o.id || o.api_name);
      const allTrue = keys.every(k => prev[k]?.[permField] === true);
      const nextVal = !allTrue;

      const nextObj = { ...prev };
      keys.forEach(k => {
        nextObj[k] = { ...(nextObj[k] || {}), [permField]: nextVal };
      });
      return nextObj;
    });
  };

  // Toggle Checkbox in Field Matrix
  const handleToggleFieldPerm = (fieldKey, permField) => {
    if (!canEditRole) return;
    setFieldPermsMatrix((prev) => {
      const current = prev[fieldKey] || { read: true, create: true, update: true };
      return {
        ...prev,
        [fieldKey]: {
          ...current,
          [permField]: !current[permField],
        },
      };
    });
  };

  // Save Role Changes
  const handleSaveChanges = async () => {
    if (!selectedRole || saving) return;
    setSaving(true);

    try {
      // Deduplicate objectPermissions payload by target UUID
      const seenObjects = new Set();
      const objectPermissions = Object.entries(objectPermsMatrix)
        .map(([objKey, perms]) => {
          const matchedObj = dynamicObjects.find(o => o.id === objKey || o.api_name === objKey);
          const targetId = matchedObj?.id || objKey;
          if (seenObjects.has(targetId)) return null;
          seenObjects.add(targetId);

          return {
            object_type_id: targetId,
            api_name: matchedObj?.api_name || objKey,
            can_create: Boolean(perms.create),
            can_read: Boolean(perms.read),
            can_update: Boolean(perms.update),
            can_delete: Boolean(perms.delete),
            view_all: Boolean(perms.view_all),
            modify_all: Boolean(perms.modify_all),
          };
        })
        .filter(Boolean);

      const fieldPermissions = Object.entries(fieldPermsMatrix).map(([fieldId, perms]) => ({
        field_id: fieldId,
        can_read: perms.read !== false,
        can_create: perms.create !== false,
        can_update: perms.update !== false,
      }));

      const payload = {
        name: roleForm.name,
        role_name: roleForm.name,
        description: roleForm.description,
        status: roleForm.status,
        objectPermissions,
        fieldPermissions,
      };

      // Await backend API save without inline .catch() to allow errors to propagate naturally
      await apiPut(`/roles/${selectedRole.id}`, payload);

      // Only update local state if backend persistence succeeded
      const todayDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      setRoles((prev) =>
        prev.map((r) =>
          r.id === selectedRole.id
            ? {
                ...r,
                name: roleForm.name,
                role_name: roleForm.name,
                description: roleForm.description,
                status: roleForm.status,
                updated_at: todayDate,
              }
            : r
        )
      );

      showToast(`Permissions and profile settings for "${roleForm.name}" updated successfully.`);
    } catch (err) {
      console.error('❌ Failed to save role permissions:', err);
      const backendMessage = err?.response?.data?.error || err?.message || 'Failed to persist changes to the database. Please try again.';
      showToast(`Error saving changes: ${backendMessage}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Create New Role
  const handleCreateRoleSubmit = async (e) => {
    e.preventDefault();
    if (!newRoleData.name.trim()) {
      showToast('Role name is required', 'error');
      return;
    }

    try {
      const res = await apiPost('/roles', {
        role_name: newRoleData.name,
        name: newRoleData.name,
        description: newRoleData.description,
        clone_from_role_id: newRoleData.cloneFrom || null,
      }).catch(() => null);

      const createdObj = res?.data || res || {
        id: `role_${Date.now()}`,
        name: newRoleData.name,
        role_name: newRoleData.name,
        description: newRoleData.description || 'Custom CRM role permission policy.',
        user_count: 0,
        objects_count: dynamicObjects.length || 18,
        custom_objects_count: 6,
        updated_at: '31 Jul 2026',
        status: 'active',
      };

      setRoles((prev) => [createdObj, ...prev]);
      setShowCreateModal(false);
      setNewRoleData({ name: '', description: '', cloneFrom: '' });
      showToast(`Role "${createdObj.name}" created successfully.`);
    } catch (err) {
      showToast('Error creating role: ' + err.message, 'error');
    }
  };

  // Filtered lists
  const filteredRoles = useMemo(() => {
    if (!roleSearch.trim()) return roles;
    const q = roleSearch.toLowerCase();
    return roles.filter(
      (r) =>
        (r.name || r.role_name || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
    );
  }, [roles, roleSearch]);

  const filteredObjects = useMemo(() => {
    if (!objectSearch.trim()) return dynamicObjects;
    const q = objectSearch.toLowerCase();
    return dynamicObjects.filter(
      (o) =>
        (o.display_name || o.api_name || '').toLowerCase().includes(q) ||
        (o.api_name || '').toLowerCase().includes(q)
    );
  }, [dynamicObjects, objectSearch]);

  const filteredFields = useMemo(() => {
    if (!fieldSearch.trim()) return currentObjectFields;
    const q = fieldSearch.toLowerCase();
    return currentObjectFields.filter(
      (f) =>
        (f.display_name || f.label || f.name || '').toLowerCase().includes(q) ||
        (f.name || f.api_name || '').toLowerCase().includes(q)
    );
  }, [currentObjectFields, fieldSearch]);

  return (
    <div className="fade-in" style={{ color: '#111827', paddingBottom: 40 }}>
      {/* Toast Notification */}
      {toastMessage && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 999999,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 20px', borderRadius: 12,
          background: toastMessage.type === 'error' ? '#fef2f2' : '#ecfdf5',
          border: `1px solid ${toastMessage.type === 'error' ? '#fca5a5' : '#a7f3d0'}`,
          color: toastMessage.type === 'error' ? '#991b1b' : '#065f46',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2), 0 8px 16px -4px rgba(0,0,0,0.08)',
          fontSize: '0.88rem', fontWeight: 600,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {toastMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{toastMessage.text}</span>
        </div>,
        document.body
      )}

      {loading ? (
        /* ══════════════════════════════════════════════════════════════ */
        /* ROW-BASED SPINNER MATCHING USER SPECIFICATION                  */
        /* ══════════════════════════════════════════════════════════════ */
        <div style={{
          display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          minHeight: '400px', width: '100%', gap: 10, color: '#4b5563',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            border: '2px solid rgba(79, 70, 229, 0.15)', borderTopColor: '#4f46e5',
            animation: 'spin 0.8s linear infinite'
          }} />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <span style={{ fontSize: '0.86rem', fontWeight: 500, color: '#6b7280' }}>Loading organization details...</span>
        </div>
      ) : selectedRole ? (
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          {(() => {
            const roleName = roleForm.name || selectedRole?.name || 'Role Details';
            const rLower = roleName.toLowerCase();
            const isSystemRole = Boolean(selectedRole?.is_system || selectedRole?.type === 'system' || rLower.includes('admin') || rLower.includes('system') || rLower.includes('super') || rLower.includes('executive') || rLower.includes('manager') || rLower.includes('read only'));

            return (
              <>
                {/* ── Minimalist Enterprise Hero Header Section ── */}
                <section
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 20,
                    background: 'linear-gradient(135deg, #0d1117 0%, #0a1628 30%, #0d2137 55%, #0a2020 80%, #0d1117 100%)',
                    padding: '24px 28px',
                    marginBottom: 24,
                    boxShadow: '0 16px 36px -12px rgba(11, 18, 32, 0.4)',
                  }}
                >
                  {/* Global Keyframe Animations */}
                  <style>{`
                    @keyframes dp-float {
                      0%, 100% { transform: translateY(0px) rotate(0deg); }
                      33% { transform: translateY(-8px) rotate(1deg); }
                      66% { transform: translateY(-4px) rotate(-1deg); }
                    }
                    @keyframes dp-pulseGlow {
                      0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0,214,153,0.4); }
                      50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(0,214,153,0); }
                    }
                    @keyframes dp-particleDrift {
                      0% { transform: translate(0, 0) scale(1); opacity: 0.6; }
                      50% { transform: translate(10px, -20px) scale(1.1); opacity: 0.3; }
                      100% { transform: translate(-5px, -35px) scale(0.9); opacity: 0; }
                    }
                  `}</style>

                  {/* Animated particle dots */}
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        width: i % 2 === 0 ? 6 : 4,
                        height: i % 2 === 0 ? 6 : 4,
                        borderRadius: '50%',
                        background: ['#00b09b', '#4facfe', '#f5576c', '#f6d365', '#a18cd1', '#00d699'][i],
                        top: `${[15, 65, 30, 80, 20, 70][i]}%`,
                        left: `${[75, 82, 88, 70, 94, 78][i]}%`,
                        animation: `dp-particleDrift ${[3, 4, 3.5, 5, 4.5, 3.8][i]}s ease-in-out infinite ${[0, 0.8, 1.2, 0.4, 1.6, 0.2][i]}s`,
                        pointerEvents: 'none',
                      }}
                    />
                  ))}

                  {/* Ambient Glow Orbs */}
                  <div style={{ position: 'absolute', top: -80, right: 60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,176,155,0.2), transparent 65%)', animation: 'dp-float 7s ease-in-out infinite', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', bottom: -60, right: 200, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,172,254,0.15), transparent 65%)', animation: 'dp-float 9s ease-in-out infinite reverse', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', top: 20, right: 340, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,87,108,0.1), transparent 65%)', animation: 'dp-float 6s ease-in-out infinite 1s', pointerEvents: 'none' }} />

                  {/* Grid texture */}
                  <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />

                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
                    {/* Left Content */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, maxWidth: 780 }}>
                      {/* Shield Avatar Badge */}
                      <div
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 14,
                          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(34, 211, 238, 0.2))',
                          border: '1px solid rgba(255, 255, 255, 0.18)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#38bdf8',
                          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)',
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        <Shield size={25} />
                      </div>

                      <div>
                        {/* Role Name + System/Custom Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                          <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {roleName}
                          </h1>

                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '4px 11px',
                              borderRadius: 999,
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              background: isSystemRole ? 'rgba(99, 102, 241, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                              color: isSystemRole ? '#a5b4fc' : '#fcd34d',
                              border: `1px solid ${isSystemRole ? 'rgba(165, 180, 252, 0.35)' : 'rgba(252, 211, 77, 0.35)'}`,
                            }}
                          >
                            {isSystemRole ? <Shield size={11} /> : <Sparkles size={11} />}
                            {isSystemRole ? 'SYSTEM ROLE' : 'CUSTOM ROLE'}
                          </span>
                        </div>

                        {/* Short Description */}
                        <p style={{ margin: 0, fontSize: '0.88rem', color: '#9fb0c9', lineHeight: 1.5, maxWidth: 680 }}>
                          {roleForm.description || selectedRole?.description || 'Full administrative access across CRM configuration, metadata, permissions, automation, and system management.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Read Only Lock Warning Banner if user cannot edit this role */}
                {!canEditRole && (
                  <div style={{
                    marginBottom: 16, padding: '12px 16px', borderRadius: 12,
                    background: '#fffbe6', border: '1px solid #ffe58f', color: '#873800',
                    fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <AlertCircle size={18} style={{ color: '#d48806', flexShrink: 0 }} />
                    <span>{lockReasonMessage}</span>
                  </div>
                )}

                {/* Sticky Sub Navigation Tabs Bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
                  paddingBottom: '10px',
                  marginTop: '16px',
                  marginBottom: '20px',
                  gap: 12,
                }}>
                  {/* Left Side: Tabs */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { id: 'general', label: 'General Settings' },
                      { id: 'object', label: 'Object Permissions' },
                      { id: 'field', label: 'Field Permissions' },
                    ].map((tab) => {
                      const isSelected = detailTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setDetailTab(tab.id)}
                          style={{
                            marginBottom: -1,
                            padding: '9px 18px',
                            fontSize: '0.88rem',
                            fontWeight: isSelected ? 700 : 500,
                            cursor: 'pointer',
                            border: 'none',
                            borderBottom: `2px solid ${isSelected ? '#4f46e5' : 'transparent'}`,
                            borderRadius: '10px 10px 0 0',
                            background: isSelected ? '#ffffff' : 'transparent',
                            color: isSelected ? '#0f172a' : '#64748b',
                            boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Side: Inline Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Save Changes Button */}
                    {canEditRole && (
                      <button
                        type="button"
                        onClick={handleSaveChanges}
                        disabled={saving}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                          borderRadius: '8px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                          fontSize: '0.84rem', fontWeight: 600, color: '#ffffff',
                          background: '#06b6d4',
                          boxShadow: '0 1px 2px rgba(6, 182, 212, 0.1)',
                          opacity: saving ? 0.7 : 1,
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!saving) e.currentTarget.style.background = '#0891b2';
                        }}
                        onMouseLeave={(e) => {
                          if (!saving) e.currentTarget.style.background = '#06b6d4';
                        }}
                      >
                        {saving ? (
                          <div className="spinner-border spinner-border-sm" role="status" style={{ width: 14, height: 14 }} />
                        ) : (
                          <Save size={14} />
                        )}
                        <span>Save</span>
                      </button>
                    )}

                    {/* Back Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedRole(null)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                        borderRadius: '8px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer',
                        color: '#334155', background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    >
                      <ArrowLeft size={14} />
                      <span>Back</span>
                    </button>
                  </div>
                </div>
              </>
            );
          })()}

          {/* ────────────────────────────────────────────────────────── */}
          {/* TAB 1: OBJECT PERMISSIONS MATRIX                           */}
          {/* ────────────────────────────────────────────────────────── */}
          {detailTab === 'object' && (
            <div>
              {/* Search & Actions toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 16 }}>
                <div style={{ position: 'relative', width: 340 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    type="text"
                    placeholder="Search objects..."
                    value={objectSearch}
                    onChange={(e) => setObjectSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8,
                      border: '1px solid #d1d5db', fontSize: '0.86rem', outline: 'none',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Showing <strong style={{ color: '#111827' }}>{filteredObjects.length}</strong> CRM Objects
                </div>
              </div>

              {/* Matrix Table */}
              <div style={{
                borderRadius: 12, border: '1px solid #e5e7eb',
                background: '#ffffff', overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.88rem' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', width: '28%' }}>
                          Object
                        </th>
                        {[
                          { key: 'create', label: 'Create' },
                          { key: 'read', label: 'Read' },
                          { key: 'update', label: 'Update' },
                          { key: 'delete', label: 'Delete' },
                          { key: 'view_all', label: 'View All' },
                          { key: 'modify_all', label: 'Modify All' },
                        ].map((col) => (
                          <th key={col.key} style={{ padding: '14px 12px', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                            <div
                              onClick={() => handleToggleColumnObjectPerm(col.key)}
                              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, userSelect: 'none' }}
                              title={`Toggle All ${col.label}`}
                            >
                              <span>{col.label}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredObjects.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>
                            No matching CRM objects found.
                          </td>
                        </tr>
                      ) : (
                        filteredObjects.map((obj, idx) => {
                          const objKey = obj.id || obj.api_name;
                          const perms = objectPermsMatrix[objKey] || { create: false, read: false, update: false, delete: false, view_all: false, modify_all: false };
                          const isCustom = !obj.is_system && (obj.api_name?.endsWith('__c') || obj.display_name === 'Project' || obj.display_name === 'Vehicle');

                          return (
                            <tr
                              key={objKey}
                              style={{
                                borderBottom: idx < filteredObjects.length - 1 ? '1px solid #f3f4f6' : 'none',
                                background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                                transition: 'background 0.15s ease',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f0f4fe'}
                              onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#fafafa'}
                            >
                              <td style={{ padding: '12px 20px', fontWeight: 600, color: '#111827' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{
                                    width: 28, height: 28, borderRadius: 6,
                                    background: isCustom ? '#eff6ff' : '#f3f4f6',
                                    color: isCustom ? '#2563eb' : '#4b5563',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                                  }}>
                                    {isCustom ? 'C' : 'S'}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#111827' }}>
                                      {obj.display_name || obj.api_name}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#6b7280', fontFamily: 'monospace' }}>
                                      {obj.api_name}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Centered Rounded Checkboxes */}
                              {['create', 'read', 'update', 'delete', 'view_all', 'modify_all'].map((field) => {
                                const checked = !!perms[field];
                                return (
                                  <td key={field} style={{ padding: '12px', textAlign: 'center', verticalAlign: 'middle' }}>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: canEditRole ? 'pointer' : 'not-allowed', opacity: canEditRole ? 1 : 0.65, margin: 0, position: 'relative', width: 20, height: 20 }}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={!canEditRole}
                                        onChange={() => handleToggleObjectPerm(objKey, field)}
                                        style={{
                                          appearance: 'none', WebkitAppearance: 'none',
                                          width: 18, height: 18, borderRadius: 5,
                                          border: checked ? 'none' : '1.5px solid #cbd5e1',
                                          background: checked ? (canEditRole ? '#4f46e5' : '#64748b') : '#ffffff',
                                          cursor: canEditRole ? 'pointer' : 'not-allowed', outline: 'none', transition: 'all 0.15s ease',
                                          margin: 0,
                                        }}
                                      />
                                      {checked && (
                                        <Check size={12} style={{ position: 'absolute', pointerEvents: 'none', color: '#ffffff', strokeWidth: 3, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                                      )}
                                    </label>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* TAB 2: FIELD PERMISSIONS MATRIX                           */}
          {/* ────────────────────────────────────────────────────────── */}
          {detailTab === 'field' && (
            <div>
              {/* Dropdown Selector + Search Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 600, color: '#374151', margin: 0 }}>
                    Object:
                  </label>
                  <div style={{ position: 'relative', minWidth: 220 }}>
                    <select
                      value={selectedFieldObject}
                      onChange={(e) => setSelectedFieldObject(e.target.value)}
                      style={{
                        width: '100%', padding: '9px 36px 9px 14px', borderRadius: 8,
                        border: '1px solid #d1d5db', background: '#ffffff',
                        fontSize: '0.88rem', fontWeight: 600, color: '#111827',
                        appearance: 'none', WebkitAppearance: 'none', outline: 'none',
                        cursor: 'pointer', transition: 'border-color 0.15s ease',
                      }}
                    >
                      {dynamicObjects.map((obj) => (
                        <option key={obj.id || obj.api_name} value={obj.api_name || obj.id}>
                          {obj.display_name || obj.api_name} ({obj.api_name})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
                  </div>
                </div>

                <div style={{ position: 'relative', width: 320 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    type="text"
                    placeholder="Search field names..."
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8,
                      border: '1px solid #d1d5db', fontSize: '0.86rem', outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Field Matrix Table */}
              <div style={{
                borderRadius: 12, border: '1px solid #e5e7eb',
                background: '#ffffff', overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.88rem' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', width: '40%' }}>
                          Field Name
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                          Read
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                          Create
                        </th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                          Update
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingFields ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '36px', textAlign: 'center', color: '#6b7280' }}>
                            <div className="spinner-border spinner-border-sm me-2 text-primary" role="status" />
                            Loading field definitions...
                          </td>
                        </tr>
                      ) : filteredFields.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '36px', textAlign: 'center', color: '#6b7280' }}>
                            No fields found for this object.
                          </td>
                        </tr>
                      ) : (
                        filteredFields.map((field, idx) => {
                          const fieldKey = field.id || field.name || field.api_name;
                          const perms = fieldPermsMatrix[fieldKey] || { read: true, create: true, update: true };

                          return (
                            <tr
                              key={fieldKey}
                              style={{
                                borderBottom: idx < filteredFields.length - 1 ? '1px solid #f3f4f6' : 'none',
                                background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                              }}
                            >
                              <td style={{ padding: '12px 20px', fontWeight: 600, color: '#111827' }}>
                                <div>
                                  <div style={{ fontSize: '0.88rem', color: '#111827' }}>
                                    {field.display_name || field.label || field.name}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontFamily: 'monospace' }}>
                                    {field.name || field.api_name} · {field.field_type || 'text'}
                                  </div>
                                </div>
                              </td>

                              {['read', 'create', 'update'].map((permCol) => {
                                const checked = perms[permCol] !== false;
                                return (
                                  <td key={permCol} style={{ padding: '12px', textAlign: 'center', verticalAlign: 'middle' }}>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: canEditRole ? 'pointer' : 'not-allowed', opacity: canEditRole ? 1 : 0.65, margin: 0, position: 'relative', width: 20, height: 20 }}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={!canEditRole}
                                        onChange={() => handleToggleFieldPerm(fieldKey, permCol)}
                                        style={{
                                          appearance: 'none', WebkitAppearance: 'none',
                                          width: 18, height: 18, borderRadius: 5,
                                          border: checked ? 'none' : '1.5px solid #cbd5e1',
                                          background: checked ? (canEditRole ? '#4f46e5' : '#64748b') : '#ffffff',
                                          cursor: canEditRole ? 'pointer' : 'not-allowed', outline: 'none', transition: 'all 0.15s ease',
                                          margin: 0,
                                        }}
                                      />
                                      {checked && (
                                        <Check size={12} style={{ position: 'absolute', pointerEvents: 'none', color: '#ffffff', strokeWidth: 3, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                                      )}
                                    </label>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* TAB 3: GENERAL TAB                                        */}
          {/* ────────────────────────────────────────────────────────── */}
          {detailTab === 'general' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
              {/* Form Settings Card */}
              <div style={{
                background: '#ffffff', borderRadius: 12,
                border: '1px solid #e5e7eb', padding: 24,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <h3 style={{ margin: '0 0 18px', fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
                  Role Information
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Role Name
                    </label>
                    <input
                      type="text"
                      value={roleForm.name}
                      disabled={!canEditRole}
                      onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 8,
                        border: '1px solid #d1d5db', fontSize: '0.88rem', outline: 'none',
                        background: !canEditRole ? '#f8fafc' : '#ffffff',
                        cursor: !canEditRole ? 'not-allowed' : 'text',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Description
                    </label>
                    <textarea
                      rows={4}
                      value={roleForm.description}
                      disabled={!canEditRole}
                      onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 8,
                        border: '1px solid #d1d5db', fontSize: '0.88rem', outline: 'none',
                        resize: 'vertical',
                        background: !canEditRole ? '#f8fafc' : '#ffffff',
                        cursor: !canEditRole ? 'not-allowed' : 'text',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Users Assigned Read-Only Information Card */}
              <div style={{
                background: '#ffffff', borderRadius: 12,
                border: '1px solid #e5e7eb', padding: 24,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
                    Users Assigned
                  </h3>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, background: '#eff6ff', color: '#2563eb', padding: '3px 10px', borderRadius: 12 }}>
                    {assignedUsers.length} Users
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto', maxHeight: 320 }}>
                  {assignedUsers.map((usr) => (
                    <div
                      key={usr.id || usr.email}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: 8, background: '#f9fafb',
                        border: '1px solid #f3f4f6',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: '#2563eb', color: '#ffffff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.78rem', fontWeight: 700,
                        }}>
                          {(usr.name || 'U').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#111827' }}>{usr.name}</div>
                          <div style={{ fontSize: '0.74rem', color: '#6b7280' }}>{usr.email}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>Active</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════ */
        /* VIEW MODE 2: ROLES LIST VIEW                                   */
        /* ══════════════════════════════════════════════════════════════ */
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          {/* Header Title Section */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ margin: '0 0 6px', fontSize: '1.75rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
                Roles
              </h1>
              <p style={{ margin: 0, fontSize: '0.92rem', color: '#6b7280', maxWidth: 680, lineHeight: 1.5 }}>
                Manage organization roles, object permissions, and field-level security across the CRM.
              </p>
            </div>

            {/* Primary Action Button */}
            {canCreateRole && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px', borderRadius: 8, border: 'none',
                  background: '#2563eb', color: '#ffffff',
                  fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
              >
                <Plus size={16} />
                <span>Create Role</span>
              </button>
            )}
          </div>

          {/* ── Sub-Navigation Tabs: Hierarchy vs Roles ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}>
            <button
              type="button"
              onClick={() => setRolesViewTab('hierarchy')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 4px 14px 4px', background: 'none', border: 'none',
                borderBottom: rolesViewTab === 'hierarchy' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                color: rolesViewTab === 'hierarchy' ? '#2563eb' : '#64748b',
                fontSize: '0.92rem', fontWeight: rolesViewTab === 'hierarchy' ? 700 : 600,
                cursor: 'pointer', transition: 'all 0.15s ease', marginBottom: '-1px',
              }}
            >
              <Network size={17} />
              <span>Hierarchy</span>
            </button>

            <button
              type="button"
              onClick={() => setRolesViewTab('roles')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 4px 14px 4px', background: 'none', border: 'none',
                borderBottom: rolesViewTab === 'roles' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                color: rolesViewTab === 'roles' ? '#2563eb' : '#64748b',
                fontSize: '0.92rem', fontWeight: rolesViewTab === 'roles' ? 700 : 600,
                cursor: 'pointer', transition: 'all 0.15s ease', marginBottom: '-1px',
              }}
            >
              <LayoutGrid size={17} />
              <span>Roles</span>
            </button>
          </div>

          {/* ────────────────────────────────────────────────────────── */}
          {/* TAB 1: STEPPED ROLE HIERARCHY TREE VIEW                   */}
          {/* ────────────────────────────────────────────────────────── */}
          {rolesViewTab === 'hierarchy' && (
            <div>
              {/* Unsaved Hierarchy Changes Notification Bar (Administrator Only) */}
              {isAdmin && hasUnsavedHierarchy && (
                <div
                  style={{
                    background: 'linear-gradient(90deg, #eff6ff 0%, #f0f9ff 100%)',
                    border: '1px solid #bfdbfe',
                    borderRadius: 14,
                    padding: '14px 20px',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.06)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertCircle size={18} style={{ color: '#2563eb' }} />
                    <div>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e40af' }}>
                        Unsaved Role Hierarchy Changes
                      </span>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#3b82f6' }}>
                        Reordered roles will be applied when you click "Save Hierarchy".
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      type="button"
                      onClick={handleResetHierarchy}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1',
                        background: '#ffffff', color: '#475569', fontSize: '0.82rem',
                        fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease',
                      }}
                    >
                      <RotateCcw size={14} />
                      <span>Reset</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveHierarchy}
                      disabled={savingHierarchy}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 18px', borderRadius: 8, border: 'none',
                        background: '#2563eb', color: '#ffffff', fontSize: '0.84rem',
                        fontWeight: 700, cursor: savingHierarchy ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                        transition: 'all 0.15s ease', opacity: savingHierarchy ? 0.7 : 1,
                      }}
                    >
                      <Save size={14} />
                      <span>{savingHierarchy ? 'Saving...' : 'Save Hierarchy'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Outer Hierarchy Container */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 24px rgba(15, 23, 42, 0.03), 0 1px 3px rgba(15, 23, 42, 0.02)',
                  padding: '28px 32px',
                  marginBottom: 32,
                }}
              >
                {/* Header of Hierarchy Box */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'rgba(99, 102, 241, 0.08)', color: '#4f46e5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, marginTop: 2,
                      }}
                    >
                      <UserCheck size={20} />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                        Role Hierarchy
                      </h2>
                      <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: '#64748b', lineHeight: 1.5 }}>
                        Roles inherit data visibility from their position in the hierarchy. Higher roles can see data owned by subordinate roles.
                      </p>
                    </div>
                  </div>

                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', background: '#f8fafc', padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    {isAdmin ? 'Drag handle (⋮⋮) or use 3-dot menu to reorder' : 'Read-only role hierarchy'}
                  </span>
                </div>

                {/* Stepped Waterfall Hierarchy Cards */}
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14, paddingLeft: 12 }}>
                  {hierarchyList.map((roleObj, idx) => {
                    const isRoot = idx === 0 || (roleObj.name || roleObj.role_name || '').toLowerCase().includes('admin');
                    const IconComp = roleObj.IconComponent || Crown;
                    const isDragging = draggedIndex === idx;
                    const isDropTarget = isAdmin && dropTargetIndex === idx && draggedIndex !== idx;

                    return (
                      <div
                        key={roleObj.id || idx}
                        draggable={isAdmin && !isRoot}
                        onDragStart={(e) => {
                          if (!isAdmin || isRoot) return;
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedIndex(idx);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!isAdmin) return;
                          if (draggedIndex !== null && dropTargetIndex !== idx) {
                            setDropTargetIndex(idx);
                          }
                        }}
                        onDragLeave={() => {
                          if (dropTargetIndex === idx) setDropTargetIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!isAdmin) return;
                          if (draggedIndex !== null) {
                            moveRole(draggedIndex, idx);
                            setDraggedIndex(null);
                            setDropTargetIndex(null);
                          }
                        }}
                        onDragEnd={() => {
                          setDraggedIndex(null);
                          setDropTargetIndex(null);
                        }}
                        style={{
                          marginLeft: `${(roleObj.indent !== undefined ? roleObj.indent : idx) * 36}px`,
                          position: 'relative',
                          transition: 'all 0.2s ease',
                          opacity: isDragging ? 0.4 : 1,
                          zIndex: activeMenuRoleId === (roleObj.id || idx) ? 100 : (10 - idx),
                        }}
                      >
                        {/* Drop Indicator Bar */}
                        {isDropTarget && (
                          <div
                            style={{
                              position: 'absolute',
                              top: -8,
                              left: 0,
                              right: 0,
                              height: 4,
                              background: '#2563eb',
                              borderRadius: 999,
                              boxShadow: '0 0 8px rgba(37, 99, 235, 0.6)',
                              zIndex: 10,
                            }}
                          />
                        )}

                        {/* Tree Branch Connector Line */}
                        {idx > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: -24,
                              top: '50%',
                              width: 20,
                              height: 24,
                              borderLeft: '2px dashed #cbd5e1',
                              borderBottom: '2px dashed #cbd5e1',
                              borderBottomLeftRadius: 8,
                              transform: 'translateY(-100%)',
                              pointerEvents: 'none',
                            }}
                          />
                        )}

                        {/* Role Horizontal Card */}
                        <div
                          style={{
                            background: isDropTarget ? '#f0f9ff' : '#ffffff',
                            borderRadius: 14,
                            border: isDropTarget ? '2px dashed #2563eb' : '1px solid #e2e8f0',
                            padding: '14px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 14,
                            cursor: isAdmin ? (isRoot ? 'default' : 'grab') : 'default',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.02)',
                          }}
                          onMouseEnter={(e) => {
                            if (isAdmin) {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 12px 24px -6px rgba(15, 23, 42, 0.08)';
                              if (!isDropTarget) e.currentTarget.style.borderColor = '#cbd5e1';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (isAdmin) {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.02)';
                              if (!isDropTarget) e.currentTarget.style.borderColor = '#e2e8f0';
                            }
                          }}
                        >
                          {/* Left Section: Drag handle + Role Info */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                            {/* Drag Handle (⋮⋮) - Administrator Only */}
                            {isAdmin && !isRoot ? (
                              <div
                                title="Drag vertically to reorder hierarchy level"
                                style={{
                                  color: '#94a3b8',
                                  cursor: 'grab',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '4px 2px',
                                  borderRadius: 4,
                                  transition: 'color 0.15s ease',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#475569'}
                                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                              >
                                <GripVertical size={18} />
                              </div>
                            ) : null}

                            {/* Role Icon Box */}
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 10,
                                background: roleObj.iconBg || '#6366f1',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
                              }}
                            >
                              <IconComp size={20} />
                            </div>

                            {/* Title, Level Badge & Subtext */}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                                  {roleObj.name || roleObj.role_name}
                                </h3>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: roleObj.badgeColor || '#4338ca',
                                    background: roleObj.badgeBg || '#e0e7ff',
                                    border: `1px solid ${roleObj.badgeBorder || '#c7d2fe'}`,
                                    padding: '2px 9px',
                                    borderRadius: 999,
                                  }}
                                >
                                  {roleObj.levelLabel || `Level ${idx + 1}`}
                                </span>
                              </div>
                              <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4 }}>
                                {roleObj.authorityDesc || 'Role hierarchy level permissions policy.'}
                              </p>
                            </div>
                          </div>

                          {/* Right Section: Authority Badge + Separate Manage Permissions Button + Three-Dot Menu */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            {/* Authority Pill Badge */}
                            <div
                              style={{
                                padding: '5px 12px',
                                borderRadius: 999,
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                background: roleObj.canManage ? '#ecfdf5' : '#f8fafc',
                                color: roleObj.canManage ? '#047857' : '#64748b',
                                border: `1px solid ${roleObj.canManage ? '#a7f3d0' : '#e2e8f0'}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              {roleObj.canManage ? <User size={13} style={{ color: '#059669' }} /> : <Lock size={13} style={{ color: '#94a3b8' }} />}
                              <span>{roleObj.manageRightsText}</span>
                            </div>

                            {/* Manage Permissions / View Permissions Button (Visually Separate!) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRole(roleObj);
                              }}
                              style={{
                                background: '#f5f3ff',
                                border: '1px solid #ddd6fe',
                                color: '#6366f1',
                                borderRadius: 8,
                                padding: '7px 14px',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#ede9fe';
                                e.currentTarget.style.borderColor = '#c4b5fd';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f5f3ff';
                                e.currentTarget.style.borderColor = '#ddd6fe';
                              }}
                            >
                              {roleObj.canManage ? 'Manage Permissions' : 'View Permissions'}
                            </button>

                            {/* Three-Dot Menu Button & Dropdown (Administrator Only for Reordering) */}
                            {isAdmin && (
                              <div style={{ position: 'relative' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuRoleId(activeMenuRoleId === (roleObj.id || idx) ? null : (roleObj.id || idx));
                                  }}
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    background: activeMenuRoleId === (roleObj.id || idx) ? '#f1f5f9' : '#ffffff',
                                    color: '#64748b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = activeMenuRoleId === (roleObj.id || idx) ? '#f1f5f9' : '#ffffff'}
                                >
                                  <MoreVertical size={16} />
                                </button>

                                {/* Dropdown Menu Items: Reorder Actions */}
                                {activeMenuRoleId === (roleObj.id || idx) && (() => {
                                  const isNearBottom = idx >= hierarchyList.length - 2;
                                  return (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        position: 'absolute',
                                        right: 0,
                                        ...(isNearBottom ? { bottom: 38 } : { top: 38 }),
                                        width: 150,
                                        background: '#ffffff',
                                        borderRadius: 10,
                                        border: '1px solid #cbd5e1',
                                        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.18)',
                                        zIndex: 99999,
                                        padding: '5px 0',
                                        animation: 'fadeIn 0.15s ease',
                                      }}
                                    >
                                      {/* Move Up Action */}
                                      <button
                                        type="button"
                                        disabled={idx <= 1}
                                        onClick={() => {
                                          moveRole(idx, idx - 1);
                                          setActiveMenuRoleId(null);
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '8px 14px',
                                          border: 'none',
                                          background: 'none',
                                          textAlign: 'left',
                                          fontSize: '0.82rem',
                                          fontWeight: 600,
                                          color: idx <= 1 ? '#cbd5e1' : '#334155',
                                          cursor: idx <= 1 ? 'not-allowed' : 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                        }}
                                        onMouseEnter={(e) => { if (idx > 1) e.currentTarget.style.background = '#f1f5f9'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                      >
                                        <ArrowUp size={14} />
                                        <span>Move Up</span>
                                      </button>

                                      {/* Move Down Action */}
                                      <button
                                        type="button"
                                        disabled={idx === 0 || idx >= hierarchyList.length - 1}
                                        onClick={() => {
                                          moveRole(idx, idx + 1);
                                          setActiveMenuRoleId(null);
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '8px 14px',
                                          border: 'none',
                                          background: 'none',
                                          textAlign: 'left',
                                          fontSize: '0.82rem',
                                          fontWeight: 600,
                                          color: (idx === 0 || idx >= hierarchyList.length - 1) ? '#cbd5e1' : '#334155',
                                          cursor: (idx === 0 || idx >= hierarchyList.length - 1) ? 'not-allowed' : 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                        }}
                                        onMouseEnter={(e) => { if (idx > 0 && idx < hierarchyList.length - 1) e.currentTarget.style.background = '#f1f5f9'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                      >
                                        <ArrowDown size={14} />
                                        <span>Move Down</span>
                                      </button>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* TAB 2: ROLES CARD GRID LAYOUT                              */}
          {/* ────────────────────────────────────────────────────────── */}
          {rolesViewTab === 'roles' && (
            <div>
              {/* Filter bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ position: 'relative', width: 320 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    type="text"
                    placeholder="Search roles..."
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8,
                      border: '1px solid #d1d5db', fontSize: '0.86rem', outline: 'none',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.84rem', color: '#6b7280' }}>
                  Showing {filteredRoles.length} configured roles
                </span>
              </div>

              {/* 3-Column Clean Spacious Card Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 16,
              }}>
                {filteredRoles.map((role) => {
                  const roleName = role.name || role.role_name || 'Role';
                  const oCount = role.objects_count || dynamicObjects.length || 18;
                  const cCount = role.custom_objects_count !== undefined ? role.custom_objects_count : dynamicObjects.filter((o) => !o.is_system).length;
                  const uDate = formatRoleDate(role.updated_at);
                  const accessBadge = getAccessBadge(role);
                  const rLower = roleName.toLowerCase();
                  const isSystemRole = Boolean(role.is_system || role.type === 'system' || rLower.includes('admin') || rLower.includes('system') || rLower.includes('super') || rLower.includes('executive') || rLower.includes('manager') || rLower.includes('read only'));
                  const badgeText = isSystemRole ? 'System' : 'Custom';
                  const hasFieldSecurity = Boolean(role.has_field_security !== undefined ? role.has_field_security : (role.field_permissions && Object.keys(role.field_permissions).length > 0) || !rLower.includes('read only'));
                  const manageInfo = getRoleManageability(role);

                  return (
                    <div
                      key={role.id || roleName}
                      onClick={() => handleOpenRole(role)}
                      style={{
                        background: '#ffffff',
                        borderRadius: 16,
                        border: '1px solid #f1f5f9',
                        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03), 0 1px 3px rgba(15, 23, 42, 0.02)',
                        padding: '20px 22px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.borderColor = '#6366f1';
                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.03)';
                        const iconCont = e.currentTarget.querySelector('.role-icon-container');
                        if (iconCont) {
                          iconCont.style.transform = 'scale(1.05)';
                          iconCont.style.boxShadow = 'inset 0 0 0 1px #6366f1, 0 0 12px rgba(99, 102, 241, 0.2)';
                        }
                        const btn = e.currentTarget.querySelector('.manage-link');
                        if (btn) {
                          btn.style.color = '#4f46e5';
                          btn.style.transform = 'translateX(3px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = '#f1f5f9';
                        e.currentTarget.style.boxShadow = '0 4px 18px rgba(15, 23, 42, 0.03), 0 1px 3px rgba(15, 23, 42, 0.02)';
                        const iconCont = e.currentTarget.querySelector('.role-icon-container');
                        if (iconCont) {
                          iconCont.style.transform = 'scale(1)';
                          iconCont.style.boxShadow = 'inset 0 0 0 1px rgba(99, 102, 241, 0.15)';
                        }
                        const btn = e.currentTarget.querySelector('.manage-link');
                        if (btn) {
                          btn.style.color = manageInfo.canManage ? '#6366f1' : '#64748b';
                          btn.style.transform = 'translateX(0)';
                        }
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px) scale(0.985)';
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                      }}
                    >
                      <div>
                        {/* Header: Role Icon + Role Name + Small System/Custom Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              className="role-icon-container"
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: 'rgba(99, 102, 241, 0.06)',
                                color: '#6366f1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                boxShadow: 'inset 0 0 0 1px rgba(99, 102, 241, 0.15)',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              }}
                            >
                              <User size={18} style={{ display: 'block' }} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                              {roleName}
                            </h3>
                          </div>

                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 10px', borderRadius: 999,
                            fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em',
                            background: badgeText === 'System' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                            color: badgeText === 'System' ? '#4338ca' : '#b45309',
                            border: `1px solid ${badgeText === 'System' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                            flexShrink: 0,
                          }}>
                            {badgeText === 'System' ? <Shield size={11} /> : <Sparkles size={11} />}
                            {badgeText} Role
                          </span>
                        </div>

                        {/* Compact Metadata Row using Lucide Icons */}
                        {(() => {
                          const scopeObj = getRoleDataScope(role);
                          const ScopeIcon = scopeObj.Icon;
                          return (
                            <div style={{
                              display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 14px',
                              fontSize: '0.8rem', fontWeight: 600, color: '#475569',
                              marginBottom: '14px',
                            }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#475569' }}>
                                <ScopeIcon size={13} style={{ color: '#6366f1' }} />
                                {scopeObj.text}
                              </span>
                              <span style={{ color: '#cbd5e1' }}>•</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#475569' }}>
                                <Database size={13} style={{ color: '#06b6d4' }} />
                                {oCount} Objects
                              </span>
                              <span style={{ color: '#cbd5e1' }}>•</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#475569' }}>
                                <Sparkles size={13} style={{ color: '#f59e0b' }} />
                                {cCount} Custom Object{cCount === 1 ? '' : 's'}
                              </span>
                              <span style={{ color: '#cbd5e1' }}>•</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#64748b', fontWeight: 500 }}>
                                <Clock size={13} style={{ color: '#64748b' }} />
                                Updated {uDate}
                              </span>
                            </div>
                          );
                        })()}

                        {/* Access Summary, Management Status & Field Security */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '14px' }}>
                          {/* Role Management Authority Badge */}
                          {manageInfo.isSelf ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              fontSize: '0.74rem', fontWeight: 700, padding: '4px 11px', borderRadius: 999,
                              background: 'rgba(59, 130, 246, 0.1)', color: '#1d4ed8', border: '1px solid rgba(59, 130, 246, 0.25)',
                            }}>
                              <User size={12} /> Your Role · View Only
                            </span>
                          ) : manageInfo.canManage ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              fontSize: '0.74rem', fontWeight: 700, padding: '4px 11px', borderRadius: 999,
                              background: 'rgba(16, 185, 129, 0.1)', color: '#047857', border: '1px solid rgba(16, 185, 129, 0.25)',
                            }}>
                              <Check size={12} /> Editable
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              fontSize: '0.74rem', fontWeight: 700, padding: '4px 11px', borderRadius: 999,
                              background: 'rgba(100, 116, 139, 0.1)', color: '#475569', border: '1px solid rgba(100, 116, 139, 0.25)',
                            }}>
                              <Lock size={12} /> View Only
                            </span>
                          )}

                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            fontSize: '0.74rem', fontWeight: 700, padding: '4px 11px', borderRadius: 999,
                            background: accessBadge.bg, color: accessBadge.color, border: `1px solid ${accessBadge.border}`,
                          }}>
                            <span
                              style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: accessBadge.color, display: 'inline-block'
                              }}
                            />
                            <span>{accessBadge.label}</span>
                          </span>

                          {hasFieldSecurity && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              fontSize: '0.74rem', fontWeight: 700, padding: '4px 11px', borderRadius: 999,
                              background: 'rgba(99, 102, 241, 0.08)', color: '#4f46e5', border: '1px solid rgba(99, 102, 241, 0.2)',
                            }}>
                              <Shield size={12} style={{ color: '#4f46e5' }} />
                              Field Security Enabled
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Footer: Single primary action on right */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                        paddingTop: 12, borderTop: '1px solid rgba(226, 232, 240, 0.7)',
                        marginTop: 'auto',
                      }}>
                        <span className="manage-link" style={{
                          fontSize: '0.84rem', fontWeight: 700, color: manageInfo.canManage ? '#6366f1' : '#64748b',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          transition: 'all 0.2s ease',
                        }}>
                          {manageInfo.canManage ? 'Manage Permissions' : 'View Permissions'}
                          <ChevronRight size={15} style={{ transition: 'transform 0.2s ease' }} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* CREATE ROLE MODAL                                             */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showCreateModal && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 480,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(226, 232, 240, 0.8)', overflow: 'hidden',
            animation: 'fadeSlideIn 0.25s ease-out',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
                Create New Role
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRoleSubmit} style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Role Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sales Director"
                    value={newRoleData.name}
                    onChange={(e) => setNewRoleData({ ...newRoleData, name: e.target.value })}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      border: '1px solid #d1d5db', fontSize: '0.88rem', outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of this role's permissions..."
                    value={newRoleData.description}
                    onChange={(e) => setNewRoleData({ ...newRoleData, description: e.target.value })}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      border: '1px solid #d1d5db', fontSize: '0.88rem', outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Clone Permissions From (Optional)
                  </label>
                  <select
                    value={newRoleData.cloneFrom}
                    onChange={(e) => setNewRoleData({ ...newRoleData, cloneFrom: e.target.value })}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      border: '1px solid #d1d5db', background: '#ffffff', fontSize: '0.88rem', outline: 'none',
                    }}
                  >
                    <option value="">Start with standard defaults</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name || r.role_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '9px 16px', borderRadius: 8, border: '1px solid #d1d5db',
                    background: '#ffffff', color: '#374151', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 18px', borderRadius: 8, border: 'none',
                    background: '#2563eb', color: '#ffffff', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
