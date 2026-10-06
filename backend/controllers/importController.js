const metadataService = require('../services/metadataService');
const supabase = require('../config/supabase');

const isUuid = (val) =>
  Boolean(val && typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim()));

// The platform user table is not an entry in object_type_definitions, so it is resolved separately.
// TODO: set USERS_TABLE / the column names below to match your schema (the same table GET /users reads).
const USER_TARGET = 'user';
const USERS_TABLE = 'users';
const PAGE_SIZE = 1000; // Supabase returns at most 1000 rows per request

/** Reads every row of a query by paging, so large tenants are not silently truncated at 1000. */
const fetchAll = async (buildQuery) => {
  const out = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return out;
};

const recordName = (row, fallback) =>
  row.name || row.data?.name || row.data?.company_name || row.data?.contact_name || fallback;

const getNormalizedKeys = (val) => {
  if (val === null || val === undefined) return [];
  let str = String(val).trim();
  if (!str) return [];
  const keys = new Set();
  const lower = str.toLowerCase();
  keys.add(lower);
  keys.add(str.toUpperCase());

  const num = Number(str);
  if (!Number.isNaN(num) && num > 0) {
    try {
      const exp5 = num.toExponential(5).toUpperCase();
      keys.add(exp5);
      keys.add(exp5.toLowerCase());
    } catch (e) {}
    try {
      if (Number.isInteger(num)) {
        const intStr = BigInt(Math.round(num)).toString().toLowerCase();
        keys.add(intStr);
      }
    } catch (e) {}
  }
  return Array.from(keys);
};

const normalizeIdentifier = (val) => getNormalizedKeys(val)[0] || '';

/**
 * Shared by every match strategy: turns "value → matching rows" into the response contract.
 */
const buildResults = (uniqueValues, matchMap, label, matchField) => {
  const results = {};
  uniqueValues.forEach((v) => {
    const keys = getNormalizedKeys(v);
    let matches = [];
    for (const k of keys) {
      if (matchMap.has(k)) {
        matches = matchMap.get(k);
        break;
      }
    }
    if (matches.length === 0) {
      results[v] = { status: 'not_found', resolvedId: null, resolvedName: null, reason: `No ${label} found with ${matchField} = '${v}'.` };
    } else if (matches.length > 1) {
      results[v] = {
        status: 'ambiguous', resolvedId: null, resolvedName: null,
        reason: `Multiple ${label}s found with ${matchField} = '${v}'. Use a unique identifier.`,
        matchCount: matches.length,
      };
    } else {
      results[v] = { status: 'resolved', resolvedId: matches[0].id, resolvedName: matches[0].displayName };
    }
  });
  return results;
};

/**
 * POST /import/resolve-relationships
 * Batched relationship resolver for CSV import validation.
 *
 * Body: { targetObjectType: string, matchField: string, values: string[] }
 * Returns: { results: { [value]: { status: 'resolved'|'not_found'|'ambiguous'|'invalid', resolvedId, resolvedName, reason? } } }
 */
exports.resolveRelationships = async (req, res) => {
  try {
    const { targetObjectType, matchField, values } = req.body;
    const organizationId = req.user?.organization_id;

    if (!targetObjectType || !matchField || !Array.isArray(values) || values.length === 0) {
      return res.status(400).json({ error: 'targetObjectType, matchField, and values[] are required.' });
    }
    if (!organizationId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const uniqueValues = [...new Set(values.filter((v) => v !== null && v !== undefined && String(v).trim() !== ''))];
    if (uniqueValues.length === 0) return res.json({ results: {} });

    const mfLower = String(matchField).toLowerCase().trim();
    const matchByInternalId = mfLower === 'id' || mfLower === '_id';
    const results = {};

    // ── Platform users (Owner and other user lookups) ────────────────────────
    if (String(targetObjectType).toLowerCase() === USER_TARGET) {
      let userRows;
      try {
        userRows = await fetchAll(() =>
          supabase.from(USERS_TABLE).select('*').eq('organization_id', organizationId)
        );
      } catch (err) {
        console.error('[importController] user lookup failed:', err.message);
        return res.status(500).json({ error: 'Failed to fetch users for relationship resolution.' });
      }

      const userName = (u) => u.name || u.full_name || u.display_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.id;
      const matchMap = new Map();
      userRows.forEach((u) => {
        const fieldValue = matchByInternalId ? u.id : (mfLower === 'name' ? userName(u) : u[matchField] ?? u[mfLower]);
        if (fieldValue === null || fieldValue === undefined) return;
        const norm = String(fieldValue).trim().toLowerCase();
        if (!norm) return;
        if (!matchMap.has(norm)) matchMap.set(norm, []);
        matchMap.get(norm).push({ id: u.id, displayName: userName(u) });
      });
      return res.json({ results: buildResults(uniqueValues, matchMap, 'user', matchField) });
    }

    // ── CRM objects ──────────────────────────────────────────────────────────
    const targetDef = await metadataService.getObjectTypeByApiName(targetObjectType, organizationId).catch(() => null);
    if (!targetDef || !targetDef.id) {
      return res.status(404).json({ error: `Object type '${targetObjectType}' not found.` });
    }

    if (matchByInternalId) {
      const validUuids = uniqueValues.filter((v) => isUuid(v));
      uniqueValues.filter((v) => !isUuid(v)).forEach((v) => {
        results[v] = { status: 'invalid', resolvedId: null, resolvedName: null, reason: 'Not a valid UUID format.' };
      });

      if (validUuids.length > 0) {
        // Chunked so the IN() list stays small. object_type_id keeps a Contact id from resolving as a Company.
        const rows = [];
        for (let i = 0; i < validUuids.length; i += 200) {
          const { data, error } = await supabase
            .from('universal_table')
            .select('id, name, data')
            .in('id', validUuids.slice(i, i + 200))
            .eq('object_type_id', targetDef.id)
            .eq('organization_id', organizationId)
            .eq('is_deleted', false);
          if (error) return res.status(500).json({ error: 'Failed to fetch target records for relationship resolution.' });
          rows.push(...(data || []));
        }
        const byId = new Map(rows.map((r) => [r.id, r]));
        validUuids.forEach((v) => {
          const row = byId.get(v);
          results[v] = row
            ? { status: 'resolved', resolvedId: row.id, resolvedName: recordName(row, v) }
            : { status: 'not_found', resolvedId: null, resolvedName: null, reason: 'Record not found.' };
        });
      }
      return res.json({ results });
    }

    // Field-based match: read all records of the target type once and match in memory
    let rows;
    try {
      rows = await fetchAll(() =>
        supabase
          .from('universal_table')
          .select('id, name, data, status')
          .eq('object_type_id', targetDef.id)
          .eq('organization_id', organizationId)
          .eq('is_deleted', false)
          .order('id')
      );
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch target records for relationship resolution.' });
    }

    const matchMap = new Map();
    rows.forEach((row) => {
      let fieldValue = null;
      if (mfLower === 'name') fieldValue = recordName(row, null);
      else if (mfLower === 'status') fieldValue = row.status ?? row.data?.status ?? null;
      else fieldValue = row.data?.[matchField] ?? row.data?.[mfLower] ?? null;

      if (fieldValue === null || fieldValue === undefined) return;
      const keys = getNormalizedKeys(fieldValue);
      keys.forEach((k) => {
        if (!matchMap.has(k)) matchMap.set(k, []);
        const existing = matchMap.get(k);
        if (!existing.some((e) => e.id === row.id)) {
          existing.push({ id: row.id, displayName: recordName(row, k) });
        }
      });
    });

    return res.json({ results: buildResults(uniqueValues, matchMap, targetObjectType, matchField) });
  } catch (err) {
    console.error('[importController] resolveRelationships error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

/**
 * GET /import/saved-mappings?objectTypeId=...
 * Saved mappings are stored client-side in localStorage.
 * This endpoint is a placeholder kept for future server-side saving.
 */
exports.getSavedMappings = async (req, res) => {
  return res.json({ mappings: [] });
};