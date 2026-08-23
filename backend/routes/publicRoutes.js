const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const campaignController = require('../controllers/campaignController');
const publicFormController = require('../controllers/publicFormController');

// Public endpoints (No JWT authentication middleware)
router.post('/campaign-form/submit', publicController.submitCampaignForm);
router.get('/track/open', campaignController.trackOpen);

// Public Forms Engine endpoints
router.get('/forms/:slug', publicFormController.getPublicFormBySlug);
router.post('/forms/:slug/submit', publicFormController.submitPublicForm);
router.post('/forms/:slug/inquiries', publicFormController.submitPublicInquiry);

module.exports = router;

