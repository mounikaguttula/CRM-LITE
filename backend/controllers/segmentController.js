const segmentService = require('../services/segmentService');
const metadataService = require('../services/metadataService');
const objectService = require('../services/objectService');
const supabase = require('../config/supabase');
const { supabaseAdmin } = require('../config/supabase');
const dbClient = supabaseAdmin || supabase;
const { successResponse } = require('../utils/response');

const isUuid = (val) => Boolean(val && typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim()));

const segmentController = {
  /**
   * GET /api/segments
   * List all segments for current organization
   */
  listSegments: async (req, res, next) => {
    try {
      await metadataService.checkPermission(req.user, 'segment', 'read');
      const organizationId = req.user?.organization_id;

      const segments = await segmentService.listSegments(organizationId, {
        target_object_type: req.query.target_object_type,
        search: req.query.search || req.query.q,
      });

      return successResponse(res, segments, 'Segments fetched successfully.');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/segments
   * Create a new segment
   */
  createSegment: async (req, res, next) => {
    try {
      await metadataService.checkPermission(req.user, 'segment', 'create');
      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;

      const { name, description, target_object_type, type } = req.body || {};

      const created = await segmentService.createSegment({
        name,
        description,
        target_object_type,
        type,
        organization_id: organizationId,
        user_id: userId,
      });

      return res.status(201).json({
        success: true,
        data: created,
        message: 'Segment created successfully.',
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/segments/:id
   * Get single segment details
   */
  getSegmentById: async (req, res, next) => {
    try {
      await metadataService.checkPermission(req.user, 'segment', 'read');
      const organizationId = req.user?.organization_id;
      const { id } = req.params;

      const segment = await segmentService.getSegmentById(id, organizationId);
      return successResponse(res, segment, 'Segment details fetched successfully.');
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/segments/:id
   * Update segment name or description
   */
  updateSegment: async (req, res, next) => {
    try {
      await metadataService.checkPermission(req.user, 'segment', 'update');
      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;
      const { id } = req.params;

      const updated = await segmentService.updateSegment(id, organizationId, req.body, userId);
      return successResponse(res, updated, 'Segment updated successfully.');
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/segments/:id
   * Soft-delete a segment without touching member CRM records
   */
  deleteSegment: async (req, res, next) => {
    try {
      await metadataService.checkPermission(req.user, 'segment', 'delete');
      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;
      const { id } = req.params;

      const result = await segmentService.deleteSegment(id, organizationId, userId);
      return successResponse(res, result, 'Segment deleted successfully.');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/segments/:id/contacts
   * List all active Contacts associated with a Segment
   */
  getSegmentContacts: async (req, res, next) => {
    try {
      await metadataService.checkPermission(req.user, 'segment', 'read');
      await metadataService.checkPermission(req.user, 'contact', 'read');
      const organizationId = req.user?.organization_id;
      const { id } = req.params;

      const result = await segmentService.getSegmentContacts(id, organizationId);
      return successResponse(res, result, 'Segment contacts fetched successfully.');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/segments/:id/contacts
   * Associate existing Contacts with a Segment
   */
  addContactsToSegment: async (req, res, next) => {
    try {
      await metadataService.checkPermission(req.user, 'segment', 'update');
      await metadataService.checkPermission(req.user, 'contact', 'read');
      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;
      const { id } = req.params;
      const contactIds = req.body?.contactIds || req.body?.contact_ids;

      const result = await segmentService.addContactsToSegment(id, contactIds, organizationId, userId);
      return successResponse(res, result, result.message);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/segments/:id/contacts/:contactId
   * Remove a Contact association from a Segment
   */
  removeContactFromSegment: async (req, res, next) => {
    try {
      await metadataService.checkPermission(req.user, 'segment', 'update');
      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;
      const { id, contactId } = req.params;

      const result = await segmentService.removeContactFromSegment(id, contactId, organizationId, userId);
      return successResponse(res, result, result.message);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/segments/:id/contacts
   * POST /api/segments/:id/contacts/remove
   * Bulk remove Contact associations from a Segment
   */
  removeContactsFromSegment: async (req, res, next) => {
    try {
      await metadataService.checkPermission(req.user, 'segment', 'update');
      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;
      const { id } = req.params;
      const contactIds = Array.isArray(req.body?.contactIds)
        ? req.body.contactIds
        : (Array.isArray(req.body?.contacts) ? req.body.contacts : (Array.isArray(req.body) ? req.body : []));

      const result = await segmentService.removeContactsFromSegment(id, contactIds, organizationId, userId);
      return successResponse(res, result, result.message);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/segments/by-contact/:contactId
   * Reverse Lookup: Get all Segments containing a given Contact
   */
  getSegmentsForContact: async (req, res, next) => {
    try {
      await metadataService.checkPermission(req.user, 'contact', 'read');
      await metadataService.checkPermission(req.user, 'segment', 'read');
      const organizationId = req.user?.organization_id;
      const { contactId } = req.params;

      const result = await segmentService.getSegmentsForContact(contactId, organizationId);
      return successResponse(res, result, 'Associated segments fetched successfully.');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/segments/:id/members/associate
   * Associate existing CRM records with a segment (associate_only mode)
   */
  associateMembers: async (req, res, next) => {
    try {
      if (req.user) {
        await metadataService.checkPermission(req.user, 'segment', 'update');
        await metadataService.checkPermission(req.user, 'contact', 'read');
      }
      const organizationId = req.user?.organization_id || req.organizationId;
      const userId = req.user?.id || req.userId || null;
      const { id: segmentId } = req.params;
      const rawRecords = Array.isArray(req.body) ? req.body : (req.body?.records || []);

      if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
        return res.status(400).json({ success: false, message: 'No records provided for association.' });
      }

      const segment = await segmentService.getSegmentById(segmentId, organizationId);
      const existingContactIds = new Set(segment.contact_ids || []);

      const contactDefId = await segmentService.resolveContactObjectType(organizationId);

      // Fetch contacts in organization to match by external ID, internal UUID, or email
      const { data: contacts, error: cErr } = await dbClient
        .from('universal_table')
        .select('id, name, data')
        .eq('organization_id', organizationId)
        .eq('object_type_id', contactDefId)
        .eq('is_deleted', false);

      if (cErr) throw cErr;

      const contactById = new Map();
      const contactByExtId = new Map();
      const contactByEmail = new Map();

      (contacts || []).forEach((c) => {
        contactById.set(c.id, c);
        const ext = c.data?.record_id__c || c.data?.external_id || c.data?.hubspot_record_id;
        if (ext) contactByExtId.set(String(ext).trim().toLowerCase(), c);
        const em = c.data?.email || c.email;
        if (em) contactByEmail.set(String(em).trim().toLowerCase(), c);
      });

      const matchedContactIds = new Set();
      const results = [];
      let matchedCount = 0;
      let alreadyInSegmentCount = 0;
      let unmatchedCount = 0;

      rawRecords.forEach((row, idx) => {
        const rowNum = idx + 1;
        const idVal = row.id || row.ID || row.record_uuid || row.data?.id;
        const extVal = row.record_id__c || row['Record ID'] || row.external_id || row.hubspot_record_id || row.data?.record_id__c;
        const emailVal = row.email || row.Email || row.data?.email;
        const identifier = extVal || idVal || emailVal || `Row ${rowNum}`;

        let matched = null;
        if (idVal && isUuid(idVal) && contactById.has(idVal)) {
          matched = contactById.get(idVal);
        } else if (extVal && contactByExtId.has(String(extVal).trim().toLowerCase())) {
          matched = contactByExtId.get(String(extVal).trim().toLowerCase());
        } else if (emailVal && contactByEmail.has(String(emailVal).trim().toLowerCase())) {
          matched = contactByEmail.get(String(emailVal).trim().toLowerCase());
        }

        if (!matched) {
          unmatchedCount++;
          results.push({
            rowNumber: rowNum,
            identifier,
            status: 'unmatched',
            error: `Contact '${identifier}' was not found in the CRM.`,
          });
        } else if (existingContactIds.has(matched.id)) {
          alreadyInSegmentCount++;
          matchedCount++;
          results.push({
            rowNumber: rowNum,
            identifier,
            status: 'already_in_segment',
            contactId: matched.id,
            error: null,
          });
        } else {
          matchedCount++;
          matchedContactIds.add(matched.id);
          results.push({
            rowNumber: rowNum,
            identifier,
            status: 'added',
            contactId: matched.id,
            error: null,
          });
        }
      });

      let addedCount = 0;
      if (matchedContactIds.size > 0) {
        const assocRes = await segmentService.addContactsToSegment(
          segmentId,
          Array.from(matchedContactIds),
          organizationId,
          userId
        );
        addedCount = assocRes.addedCount || matchedContactIds.size;
      }

      return res.json({
        success: true,
        totalProcessed: rawRecords.length,
        matchedCount,
        addedCount,
        alreadyInSegmentCount,
        unmatchedCount,
        results,
      });
    } catch (err) {
      if (typeof next === 'function') next(err);
      else return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  },

  /**
   * POST /api/segments/:id/members/create-and-associate
   * Create or update CRM contacts and associate with segment
   */
  createAndAssociateMembers: async (req, res, next) => {
    try {
      if (req.user) {
        await metadataService.checkPermission(req.user, 'segment', 'update');
        await metadataService.checkPermission(req.user, 'contact', 'create');
      }
      const organizationId = req.user?.organization_id || req.organizationId;
      const userId = req.user?.id || req.userId || null;
      const { id: segmentId } = req.params;
      const rawRecords = Array.isArray(req.body) ? req.body : (req.body?.records || []);

      if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
        return res.status(400).json({ success: false, message: 'No records provided.' });
      }

      // Check segment exists
      await segmentService.getSegmentById(segmentId, organizationId);

      // Delegate to bulkCreateRecords with targetSegmentId option
      const bulkResult = await objectService.bulkCreateRecords(
        'contact',
        rawRecords,
        organizationId,
        userId,
        null,
        { targetSegmentId: segmentId, importMode: 'upsert' }
      );

      return res.json({
        success: bulkResult.success,
        totalProcessed: bulkResult.totalProcessed,
        createdCount: bulkResult.createdCount,
        updatedCount: bulkResult.updatedCount || 0,
        failedCount: bulkResult.failedCount,
        addedToSegmentCount: bulkResult.createdCount + (bulkResult.updatedCount || 0),
        alreadyInSegmentCount: 0,
        data: bulkResult.data || [],
        results: bulkResult.results,
      });
    } catch (err) {
      if (typeof next === 'function') next(err);
      else return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  },
};

module.exports = segmentController;
