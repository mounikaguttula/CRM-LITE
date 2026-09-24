const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth');

// Protect all dashboard routes with JWT auth
router.use(authMiddleware);

router.get('/dashboard/summary', dashboardController.getDashboardSummary);
router.get('/api/dashboard/summary', dashboardController.getDashboardSummary);

module.exports = router;
