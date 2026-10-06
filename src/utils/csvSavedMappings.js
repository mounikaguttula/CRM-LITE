/**
 * csvSavedMappings.js
 * Client-side localStorage utility for saving and loading CSV field mappings.
 * Mappings are keyed by organization + objectTypeId, and matched by header signature.
 * Follow-up: move storage server-side so mappings are shared across the team.
 */

const STORAGE_KEY = 'crm_csv_saved_mappings';
const MATCH_THRESHOLD = 0.8; // share of headers that must overlap to suggest a saved mapping

/** Normalized, sorted header list joined into a stable signature. */
function buildHeaderSignature(headers) {
  return [...headers]
    .map((h) => String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
    .sort()
    .join('|');
}

/** Full IDs: prefixes can collide (e.g. time-ordered UUIDs). */
function buildStorageKey(orgId, objectTypeId) {
  return `${orgId || ''}_${objectTypeId || ''}`;
}

function overlap(sigA, sigB) {
  const A = new Set(sigA.split('|'));
  const B = new Set(sigB.split('|'));
  let shared = 0;
  A.forEach((x) => { if (B.has(x)) shared++; });
  return shared / Math.max(A.size, B.size, 1);
}

/**
 * Returns all saved mappings for the given org + objectType, newest first:
 * [{ id, name, headerSignature, mappingConfig, savedAt }]
 */
export function listSavedMappings(orgId, objectTypeId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    const key = buildStorageKey(orgId, objectTypeId);
    return (all[key] || []).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  } catch {
    return [];
  }
}

/**
 * Best saved mapping whose headers overlap the CSV's headers by >= 80%, or null.
 * An exact match scores 1 and always wins.
 */
export function findMatchingMapping(orgId, objectTypeId, headers) {
  const sig = buildHeaderSignature(headers);
  let best = null;
  let bestScore = 0;
  for (const m of listSavedMappings(orgId, objectTypeId)) {
    const score = overlap(sig, m.headerSignature);
    if (score >= MATCH_THRESHOLD && score > bestScore) {
      best = m;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Saves a mapping configuration (max 10 per org + object).
 */
export function saveMapping(orgId, objectTypeId, name, headers, mappingConfig) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const key = buildStorageKey(orgId, objectTypeId);
    if (!all[key]) all[key] = [];

    const sig = buildHeaderSignature(headers);
    const cleanName = String(name || 'Saved Mapping').trim();

    // Replace any mapping with the same name or same header signature
    all[key] = all[key].filter((m) => m.name !== cleanName && m.headerSignature !== sig);

    all[key].unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: cleanName,
      headerSignature: sig,
      mappingConfig,
      savedAt: new Date().toISOString(),
    });

    all[key] = all[key].slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

/**
 * Deletes a saved mapping by ID.
 */
export function deleteMapping(orgId, objectTypeId, mappingId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const all = JSON.parse(raw);
    const key = buildStorageKey(orgId, objectTypeId);
    if (all[key]) {
      all[key] = all[key].filter((m) => m.id !== mappingId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    }
  } catch {
    // silent
  }
}