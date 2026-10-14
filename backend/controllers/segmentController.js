const segmentService = require('../services/segmentService');
const metadataService = require('../services/metadataService');
const { successResponse } = require('../utils/response');

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
};

module.exports = segmentController;
