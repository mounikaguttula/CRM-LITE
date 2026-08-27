const express = require('express');
const router = express.Router();
const metadataController = require('../controllers/metadataController');
const authMiddleware = require('../middleware/auth');

// Protect all metadata routes
router.use(authMiddleware);

// Clean /metadata endpoints
router.get('/metadata', metadataController.getPlatformMetadata);
router.get('/metadata/objects', metadataController.getObjectDefinitions);
router.get('/metadata/fields', metadataController.getSetupFields);
router.get('/setup/fields', metadataController.getSetupFields);
router.get('/setup/recent-activity', metadataController.getRecentActivity);
router.get('/api/setup/recent-activity', metadataController.getRecentActivity);
router.get('/setup/configuration-overview', metadataController.getConfigurationOverview);
router.get('/api/setup/configuration-overview', metadataController.getConfigurationOverview);
router.get('/setup/current-user', metadataController.getCurrentUserSetupProfile);
router.get('/api/setup/current-user', metadataController.getCurrentUserSetupProfile);
router.post('/metadata/objects', metadataController.createObjectDefinition);
router.delete('/metadata/objects/:objectType', metadataController.deleteObjectDefinition);
router.post('/metadata/fields', metadataController.createObjectField);
router.get('/metadata/objects/:objectType/fields', metadataController.getObjectFields);
router.post('/metadata/objects/:objectType/fields', metadataController.createObjectField);
router.delete('/metadata/objects/:objectType/fields/:fieldId', metadataController.deleteObjectField);
router.get('/metadata/objects/:objectType/views', metadataController.getObjectViews);
router.get('/metadata/navigation', metadataController.getNavigation);
router.get('/metadata/permissions', metadataController.getPermissions);

// Backwards compatibility & organization-based aliases
router.get('/workspace/metadata', metadataController.getPlatformMetadata);
router.post('/objects', metadataController.createObjectDefinition);
router.delete('/objects/:objectTypeId', metadataController.deleteObjectDefinition);
router.get('/objects/:objectTypeId/fields', metadataController.getObjectFields);
router.post('/objects/:objectTypeId/fields', metadataController.createObjectField);
router.delete('/objects/:objectTypeId/fields/:fieldId', metadataController.deleteObjectField);
router.get('/objects/:objectTypeId/views', metadataController.getObjectViews);
router.get('/objects/:objectTypeId/layouts', metadataController.getObjectViews);

// Organization tenant routes
router.get('/organizations/:organizationId/objects', metadataController.getObjectDefinitions);
router.post('/organizations/:organizationId/objects', metadataController.createObjectDefinition);
router.delete('/organizations/:organizationId/objects/:objectType', metadataController.deleteObjectDefinition);
router.get('/organizations/:organizationId/objects/:objectType/fields', metadataController.getObjectFields);
router.post('/organizations/:organizationId/objects/:objectType/fields', metadataController.createObjectField);
router.delete('/organizations/:organizationId/objects/:objectType/fields/:fieldId', metadataController.deleteObjectField);

module.exports = router;
