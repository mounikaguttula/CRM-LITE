import { apiGet, apiPost } from '../api/client';

const STORAGE_PREFIX = 'crm_page_layout_';

export function normalizeObjectKey(rawKey) {
  if (!rawKey) return 'default';
  const clean = String(rawKey).trim().toLowerCase();
  if (clean.endsWith('ies')) return `${clean.slice(0, -3)}y`;
  if (clean.endsWith('s') && !clean.endsWith('ss')) return clean.slice(0, -1);
  return clean;
}

/**
 * Retrieve saved layout configuration from localStorage
 */
export function getStoredLayout(objectTypeId) {
  if (!objectTypeId) return null;
  const key = `${STORAGE_PREFIX}${normalizeObjectKey(objectTypeId)}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to parse page layout from localStorage:', err);
  }
  return null;
}

/**
 * Async fetch saved page layout from backend database table page_layouts
 */
export async function fetchPageLayout(objectTypeId) {
  if (!objectTypeId) return null;
  const normalizedKey = normalizeObjectKey(objectTypeId);
  try {
    const res = await apiGet(`/metadata/page-layout/${normalizedKey}`);
    if (res && res.layout) {
      const key = `${STORAGE_PREFIX}${normalizedKey}`;
      localStorage.setItem(key, JSON.stringify(res.layout));
      return res.layout;
    }
  } catch (err) {
    console.warn('Unable to fetch remote page layout from server:', err.message);
  }
  return getStoredLayout(objectTypeId);
}

/**
 * Save layout configuration to localStorage and backend database API
 */
export function saveStoredLayout(objectTypeId, layoutConfig) {
  if (!objectTypeId || !layoutConfig) return;
  const normalizedKey = normalizeObjectKey(objectTypeId);
  const key = `${STORAGE_PREFIX}${normalizedKey}`;
  const fullConfig = {
    ...layoutConfig,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(key, JSON.stringify(fullConfig));
    window.dispatchEvent(new CustomEvent('crm-page-layout-changed', {
      detail: { objectTypeId: normalizedKey, layoutConfig: fullConfig }
    }));
  } catch (err) {
    console.error('Failed to save page layout to localStorage:', err);
  }

  // Asynchronously sync page layout with PostgreSQL database backend
  apiPost(`/metadata/page-layout/${normalizedKey}`, fullConfig)
    .catch((err) => console.warn('Failed to sync page layout with backend API:', err.message));
}

/**
 * Remove saved layout and reset to default
 */
export function resetStoredLayout(objectTypeId) {
  if (!objectTypeId) return;
  const normalizedKey = normalizeObjectKey(objectTypeId);
  const key = `${STORAGE_PREFIX}${normalizedKey}`;
  try {
    localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent('crm-page-layout-changed', {
      detail: { objectTypeId: normalizedKey, layoutConfig: null }
    }));
  } catch (err) {
    console.error('Failed to reset page layout in localStorage:', err);
  }

  // Asynchronously reset page layout in backend database
  apiPost(`/metadata/page-layout/${normalizedKey}`, { fields: [] })
    .catch((err) => console.warn('Failed to reset backend page layout:', err.message));
}

const DEFAULT_MAIN_FIELD_NAMES = [
  'name', 'title', 'status', 'owner_id', 'owner', 'first_name', 'last_name',
  'email', 'phone', 'company', 'company_id', 'contact_id', 'amount', 'stage', 'type'
];

/**
 * Merge available schema fields with saved page layout settings
 * Returns an ordered array of layout field items with section assignment:
 * [{ name, label, type, required, visible, is_system, section: 'details' | 'additional' }, ...]
 */
export function buildLayoutFieldList(objectTypeId, availableFields = []) {
  const saved = getStoredLayout(objectTypeId);
  const fields = Array.isArray(availableFields) ? availableFields : [];

  if (!saved || !Array.isArray(saved.fields) || saved.fields.length === 0) {
    // Return default layout: first 15 fields in details section, remaining in additional section
    return fields.map((f, index) => {
      const defaultSec = index < 15 ? 'details' : 'additional';
      return {
        name: f.name || f.api_name,
        label: f.label || f.display_name || f.name,
        type: f.type || f.field_type || 'text',
        required: Boolean(f.required),
        visible: true,
        section: defaultSec,
        is_system: Boolean(f.is_system),
        rawField: f,
      };
    });
  }

  const savedMap = new Map();
  saved.fields.forEach((item, index) => {
    if (item && item.name) {
      savedMap.set(String(item.name).toLowerCase(), {
        order: index,
        visible: item.visible !== false,
        section: item.section || 'details',
      });
    }
  });

  // Map available fields with saved visibility, section, and order
  const result = [];
  const unmapped = [];

  fields.forEach((f, idx) => {
    const fNameLower = String(f.name || f.api_name || '').toLowerCase();
    const savedInfo = savedMap.get(fNameLower);

    const defaultSec = idx < 15 ? 'details' : 'additional';

    const fieldObj = {
      name: f.name || f.api_name,
      label: f.label || f.display_name || f.name,
      type: f.type || f.field_type || 'text',
      required: Boolean(f.required),
      visible: savedInfo ? savedInfo.visible : true,
      section: savedInfo ? savedInfo.section : defaultSec,
      is_system: Boolean(f.is_system),
      rawField: f,
    };

    if (savedInfo) {
      result[savedInfo.order] = fieldObj;
    } else {
      unmapped.push(fieldObj);
    }
  });

  // Compact array to remove empty holes and append unmapped fields at the end
  const ordered = result.filter(Boolean);
  return [...ordered, ...unmapped];
}

/**
 * Filter and order raw fields for View mode based on saved Page Layout
 */
export function getVisibleViewFields(objectTypeId, availableFields = []) {
  const layoutList = buildLayoutFieldList(objectTypeId, availableFields);
  const visibleItems = layoutList.filter((item) => item.visible);

  return visibleItems.map((item) => item.rawField || {
    name: item.name,
    label: item.label,
    type: item.type,
    required: item.required,
    is_system: item.is_system,
  });
}

/**
 * Filter fields separated by tab sections:
 * { detailsFields: [...], additionalFields: [...] }
 */
export function getFieldsBySection(objectTypeId, availableFields = []) {
  const layoutList = buildLayoutFieldList(objectTypeId, availableFields);
  const visibleItems = layoutList.filter((item) => item.visible);

  const detailsFields = visibleItems
    .filter((item) => item.section === 'details' || !item.section)
    .map((item) => item.rawField || item);

  const additionalFields = visibleItems
    .filter((item) => item.section === 'additional')
    .map((item) => item.rawField || item);

  return { detailsFields, additionalFields, allVisibleFields: visibleItems };
}
