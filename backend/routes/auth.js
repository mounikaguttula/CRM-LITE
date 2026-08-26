const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const accessRequestController = require('../controllers/accessRequestController');

// Public routes
router.post('/login', authController.login);
router.post('/register', authController.registerOrganization);
router.post('/register-organization', authController.registerOrganization);
router.post('/request-access', accessRequestController.createAccessRequest);
router.get('/access-requests/action', accessRequestController.handleActionToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-token', authController.verifyResetToken);

// Protected routes
router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authMiddleware, authController.logout);
router.post('/ping', authMiddleware, authController.ping);
router.post('/idle-timeout', authMiddleware, authController.idleTimeout);
router.post('/reset-password', authMiddleware, authController.resetPassword);

module.exports = router;
