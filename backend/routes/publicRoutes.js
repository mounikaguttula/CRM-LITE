const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const campaignController = require('../controllers/campaignController');

// Public endpoints (No JWT authentication middleware)
router.post('/campaign-form/submit', publicController.submitCampaignForm);
router.get('/track/open', campaignController.trackOpen);

module.exports = router;
