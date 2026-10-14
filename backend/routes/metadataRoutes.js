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
router.put('/metadata/fields/:fieldId', metadataController.updateObjectField);
router.patch('/metadata/fields/:fieldId', metadataController.updateObjectField);
router.get('/metadata/objects/:objectType/fields', metadataController.getObjectFields);
router.post('/metadata/objects/:objectType/fields', metadataController.createObjectField);
router.put('/metadata/objects/:objectType/fields/:fieldId', metadataController.updateObjectField);
router.patch('/metadata/objects/:objectType/fields/:fieldId', metadataController.updateObjectField);
router.delete('/metadata/objects/:objectType/fields/:fieldId/override', metadataController.resetObjectFieldOverride);
router.post('/metadata/objects/:objectType/fields/:fieldId/reset-override', metadataController.resetObjectFieldOverride);
router.delete('/metadata/fields/:fieldId/override', metadataController.resetObjectFieldOverride);
router.post('/metadata/fields/:fieldId/reset-override', metadataController.resetObjectFieldOverride);
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
router.put('/objects/:objectTypeId/fields/:fieldId', metadataController.updateObjectField);
router.patch('/objects/:objectTypeId/fields/:fieldId', metadataController.updateObjectField);
router.delete('/objects/:objectTypeId/fields/:fieldId/override', metadataController.resetObjectFieldOverride);
router.post('/objects/:objectTypeId/fields/:fieldId/reset-override', metadataController.resetObjectFieldOverride);
router.delete('/objects/:objectTypeId/fields/:fieldId', metadataController.deleteObjectField);
router.get('/objects/:objectTypeId/views', metadataController.getObjectViews);
router.get('/objects/:objectTypeId/layouts', metadataController.getObjectViews);

// Organization tenant routes
router.get('/organizations/:organizationId/objects', metadataController.getObjectDefinitions);
router.post('/organizations/:organizationId/objects', metadataController.createObjectDefinition);
router.delete('/organizations/:organizationId/objects/:objectType', metadataController.deleteObjectDefinition);
router.get('/organizations/:organizationId/objects/:objectType/fields', metadataController.getObjectFields);
router.post('/organizations/:organizationId/objects/:objectType/fields', metadataController.createObjectField);
router.put('/organizations/:organizationId/objects/:objectType/fields/:fieldId', metadataController.updateObjectField);
router.patch('/organizations/:organizationId/objects/:objectType/fields/:fieldId', metadataController.updateObjectField);
router.delete('/organizations/:organizationId/objects/:objectType/fields/:fieldId/override', metadataController.resetObjectFieldOverride);
router.post('/organizations/:organizationId/objects/:objectType/fields/:fieldId/reset-override', metadataController.resetObjectFieldOverride);
router.delete('/organizations/:organizationId/objects/:objectType/fields/:fieldId', metadataController.deleteObjectField);

module.exports = router;
