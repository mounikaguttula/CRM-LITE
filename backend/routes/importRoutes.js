const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');
const authMiddleware = require('../middleware/auth');

// Protect all import routes
router.use(authMiddleware);

// Generic relationship resolver (used by CSV import mapping UI for preview)
router.post('/import/resolve-relationships', importController.resolveRelationships);

// Saved mappings (future server-side; currently client-side)
router.get('/import/saved-mappings', importController.getSavedMappings);

module.exports = router;
