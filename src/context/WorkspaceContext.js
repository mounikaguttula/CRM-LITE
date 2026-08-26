import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiGet } from '../api/client';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext(null);

const DEFAULT_NAVIGATION = [
  { id: 'nav_leads', displayName: 'Leads', route: '/workspace/object/lead', icon: 'target' },
  { id: 'nav_companies', displayName: 'Companies', route: '/workspace/object/company', icon: 'building' },
  { id: 'nav_contacts', displayName: 'Contacts', route: '/workspace/object/contact', icon: 'users' },
  { id: 'nav_deals', displayName: 'Deals', route: '/workspace/object/deal', icon: 'briefcase' },
  { id: 'nav_qr', displayName: 'Lead QR Scanner', route: '/workspace/object/lead_qr_scanner', icon: 'qr' },
];

export function WorkspaceProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [workspaceData, setWorkspaceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadWorkspace = useCallback(async () => {
    if (!isAuthenticated) {
      setWorkspaceData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let data = null;
      try {
        data = await apiGet('/workspace/metadata?refresh=true');
      } catch {
        data = await apiGet('/metadata?refresh=true');
      }

      const res = data?.data || data || {};

      setWorkspaceData({
        company: res.company || res.organization || { name: 'Acme Corp', code: 'ACME' },
        currentUser: res.currentUser || res.user || null,
        navigation: res.navigation || DEFAULT_NAVIGATION,
        objectTypes: res.objectTypes || {
          lead: { displayName: 'Lead', pluralDisplayName: 'Leads' },
          company: { displayName: 'Company', pluralDisplayName: 'Companies' },
          contact: { displayName: 'Contact', pluralDisplayName: 'Contacts' },
          deal: { displayName: 'Deal', pluralDisplayName: 'Deals' },
        },
        permissions: res.permissions || { canCreate: true, canEdit: true, canDelete: true },
      });
    } catch (err) {
      console.warn('Workspace metadata fetch error:', err.message);
      setError(err.message);
      // Soft fallback for smooth UI render
      setWorkspaceData({
        company: { name: 'Acme Corp', code: 'ACME' },
        currentUser: null,
        navigation: DEFAULT_NAVIGATION,
        objectTypes: {
          lead: { displayName: 'Lead', pluralDisplayName: 'Leads' },
          company: { displayName: 'Company', pluralDisplayName: 'Companies' },
          contact: { displayName: 'Contact', pluralDisplayName: 'Contacts' },
          deal: { displayName: 'Deal', pluralDisplayName: 'Deals' },
        },
        permissions: { canCreate: true, canEdit: true, canDelete: true },
      });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const pathParts = window.location.pathname.split('/');
  const objectTypeIndex = pathParts.indexOf('object');
  const objectTypeId = objectTypeIndex !== -1 ? pathParts[objectTypeIndex + 1] : null;

  const dbPerms = workspaceData?.permissions;

  let activeObjectPerm = null;
  if (objectTypeId && dbPerms) {
    const key = String(objectTypeId).toLowerCase();
    const keySingular = key.endsWith('s') ? key.slice(0, -1) : key;
    const keyPlural = key.endsWith('s') ? key : `${key}s`;
    const foundPerm = dbPerms[key] || dbPerms[keySingular] || dbPerms[keyPlural];
    activeObjectPerm = foundPerm || {
      canCreate: false,
      canRead: false,
      canUpdate: false,
      canEdit: false,
      canDelete: false,
      viewAll: false,
      modifyAll: false,
    };
  }

  const activePermissions = {
    canCreate: true,
    canEdit: true,
    canUpdate: true,
    canDelete: true,
    canRead: true,
    viewAll: true,
    modifyAll: true,
    ...dbPerms,
    ...(activeObjectPerm || {}),
  };

  const value = {
    company: isAuthenticated ? (workspaceData?.company || { name: 'Acme Corp', code: 'ACME' }) : null,
    currentUser: workspaceData?.currentUser,
    navigation: isAuthenticated ? (workspaceData?.navigation || DEFAULT_NAVIGATION) : [],
    objectTypes: workspaceData?.objectTypes || {},
    permissions: activePermissions,
    loading,
    error,
    refreshWorkspace: loadWorkspace,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used inside a <WorkspaceProvider>');
  }
  return ctx;
}

export default WorkspaceContext;
