const { getClient, isValkeyReady } = require('../config/valkey');

// ─── Cache Service for Universal Table Data ─────────────────────────────────
// Provides cache-aside operations scoped to universal_table records.
// All methods are fail-safe: if Valkey is down, they return null / do nothing.

const DEFAULT_TTL = 300; // 5 minutes in seconds

/**
 * Build a cache key for a list of records.
 * Pattern: ut:{orgId}:{objectTypeId}:list
 */
function listKey(orgId, objectTypeId) {
  return `ut:${orgId}:${objectTypeId}:list`;
}

/**
 * Build a cache key for a single record.
 * Pattern: ut:{orgId}:record:{recordId}
 */
function recordKey(orgId, recordId) {
  return `ut:${orgId}:record:${recordId}`;
}

/**
 * Build a cache key for the campaign list.
 * Pattern: ut:{orgId}:campaigns:list
 */
function campaignListKey(orgId) {
  return `ut:${orgId}:campaigns:list`;
}

/**
 * Build a cache key for campaign tracking data.
 * Pattern: ut:{orgId}:campaign:{campaignId}:tracking
 */
function campaignTrackingKey(orgId, campaignId) {
  return `ut:${orgId}:campaign:${campaignId}:tracking`;
}

const cacheService = {
  // ─── List Cache ───────────────────────────────────────────────────────────

  /**
   * Get cached list of records for a given org + objectType.
   * @returns {Array|null} Parsed array of records, or null on miss/error.
   */
  getListCache: async (orgId, objectTypeId) => {
    try {
      if (!isValkeyReady() || !orgId || !objectTypeId) return null;
      const client = getClient();
      const cached = await client.get(listKey(orgId, objectTypeId));
      if (cached) {
        console.log(`[Cache] HIT list — ${listKey(orgId, objectTypeId)}`);
        return JSON.parse(cached);
      }
      console.log(`[Cache] MISS list — ${listKey(orgId, objectTypeId)}`);
      return null;
    } catch (err) {
      console.warn(`[Cache] getListCache error: ${err.message}`);
      return null;
    }
  },

  /**
   * Store a list of records in cache with TTL.
   */
  setListCache: async (orgId, objectTypeId, data) => {
    try {
      if (!isValkeyReady() || !orgId || !objectTypeId) return;
      const client = getClient();
      await client.set(listKey(orgId, objectTypeId), JSON.stringify(data), { EX: DEFAULT_TTL });
      console.log(`[Cache] SET list — ${listKey(orgId, objectTypeId)} (TTL: ${DEFAULT_TTL}s)`);
    } catch (err) {
      console.warn(`[Cache] setListCache error: ${err.message}`);
    }
  },

  /**
   * Invalidate the list cache for a given org + objectType.
   */
  invalidateList: async (orgId, objectTypeId) => {
    try {
      if (!isValkeyReady() || !orgId || !objectTypeId) return;
      const client = getClient();
      await client.del(listKey(orgId, objectTypeId));
      console.log(`[Cache] INVALIDATED list — ${listKey(orgId, objectTypeId)}`);
    } catch (err) {
      console.warn(`[Cache] invalidateList error: ${err.message}`);
    }
  },

  // ─── Single Record Cache ──────────────────────────────────────────────────

  /**
   * Get a cached single record by org + recordId.
   * @returns {Object|null} Parsed record object, or null on miss/error.
   */
  getRecordCache: async (orgId, recordId) => {
    try {
      if (!isValkeyReady() || !orgId || !recordId) return null;
      const client = getClient();
      const cached = await client.get(recordKey(orgId, recordId));
      if (cached) {
        console.log(`[Cache] HIT record — ${recordKey(orgId, recordId)}`);
        return JSON.parse(cached);
      }
      console.log(`[Cache] MISS record — ${recordKey(orgId, recordId)}`);
      return null;
    } catch (err) {
      console.warn(`[Cache] getRecordCache error: ${err.message}`);
      return null;
    }
  },

  /**
   * Store a single record in cache with TTL.
   */
  setRecordCache: async (orgId, recordId, data) => {
    try {
      if (!isValkeyReady() || !orgId || !recordId) return;
      const client = getClient();
      await client.set(recordKey(orgId, recordId), JSON.stringify(data), { EX: DEFAULT_TTL });
      console.log(`[Cache] SET record — ${recordKey(orgId, recordId)} (TTL: ${DEFAULT_TTL}s)`);
    } catch (err) {
      console.warn(`[Cache] setRecordCache error: ${err.message}`);
    }
  },

  /**
   * Invalidate a single record cache.
   */
  invalidateRecord: async (orgId, recordId) => {
    try {
      if (!isValkeyReady() || !orgId || !recordId) return;
      const client = getClient();
      await client.del(recordKey(orgId, recordId));
      console.log(`[Cache] INVALIDATED record — ${recordKey(orgId, recordId)}`);
    } catch (err) {
      console.warn(`[Cache] invalidateRecord error: ${err.message}`);
    }
  },

  // ─── Combined Invalidation ────────────────────────────────────────────────

  /**
   * Invalidate both the list cache and a specific record cache.
   * Used after update/delete operations.
   */
  invalidateAll: async (orgId, objectTypeId, recordId) => {
    await Promise.all([
      cacheService.invalidateList(orgId, objectTypeId),
      cacheService.invalidateRecord(orgId, recordId),
    ]);
  },

  // ─── Campaign-Specific Cache ──────────────────────────────────────────────

  /**
   * Get cached campaign list for an org.
   */
  getCampaignListCache: async (orgId) => {
    try {
      if (!isValkeyReady() || !orgId) return null;
      const client = getClient();
      const cached = await client.get(campaignListKey(orgId));
      if (cached) {
        console.log(`[Cache] HIT campaign list — ${campaignListKey(orgId)}`);
        return JSON.parse(cached);
      }
      console.log(`[Cache] MISS campaign list — ${campaignListKey(orgId)}`);
      return null;
    } catch (err) {
      console.warn(`[Cache] getCampaignListCache error: ${err.message}`);
      return null;
    }
  },

  /**
   * Store campaign list in cache.
   */
  setCampaignListCache: async (orgId, data) => {
    try {
      if (!isValkeyReady() || !orgId) return;
      const client = getClient();
      await client.set(campaignListKey(orgId), JSON.stringify(data), { EX: DEFAULT_TTL });
      console.log(`[Cache] SET campaign list — ${campaignListKey(orgId)} (TTL: ${DEFAULT_TTL}s)`);
    } catch (err) {
      console.warn(`[Cache] setCampaignListCache error: ${err.message}`);
    }
  },

  /**
   * Invalidate campaign list cache for an org.
   */
  invalidateCampaignList: async (orgId) => {
    try {
      if (!isValkeyReady() || !orgId) return;
      const client = getClient();
      await client.del(campaignListKey(orgId));
      console.log(`[Cache] INVALIDATED campaign list — ${campaignListKey(orgId)}`);
    } catch (err) {
      console.warn(`[Cache] invalidateCampaignList error: ${err.message}`);
    }
  },

  /**
   * Get cached campaign tracking data.
   */
  getCampaignTrackingCache: async (orgId, campaignId) => {
    try {
      if (!isValkeyReady() || !orgId || !campaignId) return null;
      const client = getClient();
      const cached = await client.get(campaignTrackingKey(orgId, campaignId));
      if (cached) {
        console.log(`[Cache] HIT campaign tracking — ${campaignTrackingKey(orgId, campaignId)}`);
        return JSON.parse(cached);
      }
      console.log(`[Cache] MISS campaign tracking — ${campaignTrackingKey(orgId, campaignId)}`);
      return null;
    } catch (err) {
      console.warn(`[Cache] getCampaignTrackingCache error: ${err.message}`);
      return null;
    }
  },

  /**
   * Store campaign tracking data in cache.
   */
  setCampaignTrackingCache: async (orgId, campaignId, data) => {
    try {
      if (!isValkeyReady() || !orgId || !campaignId) return;
      const client = getClient();
      await client.set(campaignTrackingKey(orgId, campaignId), JSON.stringify(data), { EX: DEFAULT_TTL });
      console.log(`[Cache] SET campaign tracking — ${campaignTrackingKey(orgId, campaignId)} (TTL: ${DEFAULT_TTL}s)`);
    } catch (err) {
      console.warn(`[Cache] setCampaignTrackingCache error: ${err.message}`);
    }
  },

  /**
   * Invalidate campaign tracking + list cache.
   */
  invalidateCampaign: async (orgId, campaignId) => {
    await Promise.all([
      cacheService.invalidateCampaignList(orgId),
      (async () => {
        try {
          if (!isValkeyReady() || !orgId || !campaignId) return;
          const client = getClient();
          await client.del(campaignTrackingKey(orgId, campaignId));
          await client.del(recordKey(orgId, campaignId));
          console.log(`[Cache] INVALIDATED campaign — ${campaignId}`);
        } catch (err) {
          console.warn(`[Cache] invalidateCampaign error: ${err.message}`);
        }
      })(),
    ]);
  },
};

module.exports = cacheService;
