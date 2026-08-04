const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const authMiddleware = require('../middleware/auth');

// Protect campaign endpoints with authMiddleware per route
router.get('/api/campaigns', authMiddleware, campaignController.listCampaigns);
router.post('/api/campaigns/send', authMiddleware, campaignController.sendCampaign);
router.post('/api/campaigns', authMiddleware, campaignController.sendCampaign);
router.delete('/api/campaigns/:id', authMiddleware, campaignController.deleteCampaign);
router.get('/api/campaigns/:id/tracking', authMiddleware, campaignController.getCampaignTracking);

module.exports = router;
