const express = require('express');
const router = express.Router();
const segmentController = require('../controllers/segmentController');
const authMiddleware = require('../middleware/auth');

// All segment routes require authentication
router.use(authMiddleware);

// 1. Specialized reverse-lookup MUST be registered before generic /:id route
router.get(['/api/segments/by-contact/:contactId', '/segments/by-contact/:contactId'], segmentController.getSegmentsForContact);

// 2. Segment Association Endpoints
router.get(['/api/segments/:id/contacts', '/segments/:id/contacts'], segmentController.getSegmentContacts);
router.post(['/api/segments/:id/contacts', '/segments/:id/contacts'], segmentController.addContactsToSegment);
router.delete(['/api/segments/:id/contacts/:contactId', '/segments/:id/contacts/:contactId'], segmentController.removeContactFromSegment);

// 3. Segment Entity CRUD
router.get(['/api/segments', '/segments'], segmentController.listSegments);
router.post(['/api/segments', '/segments'], segmentController.createSegment);
router.get(['/api/segments/:id', '/segments/:id'], segmentController.getSegmentById);
router.put(['/api/segments/:id', '/segments/:id'], segmentController.updateSegment);
router.delete(['/api/segments/:id', '/segments/:id'], segmentController.deleteSegment);

module.exports = router;
