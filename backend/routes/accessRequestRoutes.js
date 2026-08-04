const express = require('express');
const router = express.Router();
const accessRequestController = require('../controllers/accessRequestController');
const authMiddleware = require('../middleware/auth');

// Public route: Submit an access request
router.post('/request-access', accessRequestController.createAccessRequest);
router.post('/request', accessRequestController.createAccessRequest);

// Public route: One-click email approval/rejection action link
router.get('/access-requests/action', accessRequestController.handleActionToken);

// Protected Admin routes: Manage access requests
router.get('/access-requests', authMiddleware, accessRequestController.getAccessRequests);
router.post('/access-requests/:id/approve', authMiddleware, accessRequestController.approveAccessRequest);
router.post('/access-requests/:id/reject', authMiddleware, accessRequestController.rejectAccessRequest);

module.exports = router;
