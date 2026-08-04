const express = require('express');
const router = express.Router();
const leadScannerController = require('../controllers/leadScannerController');
const authMiddleware = require('../middleware/auth');

// Public Google reCAPTCHA Verification Endpoint
router.post('/api/verify-captcha', leadScannerController.verifyCaptcha);
router.post('/verify-captcha', leadScannerController.verifyCaptcha);

// Authenticated Lead Scanner Persistence Endpoint
router.post('/api/lead-scanner/save', authMiddleware, leadScannerController.saveScannedLead);
router.post('/lead-scanner/save', authMiddleware, leadScannerController.saveScannedLead);

module.exports = router;
