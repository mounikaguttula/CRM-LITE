const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const authMiddleware = require('../middleware/auth');

// Protect role routes
router.use(authMiddleware);

// Dedicated Roles & Permissions endpoints when mounted at /roles or /api/roles
router.put('/hierarchy', roleController.updateRoleHierarchy);
router.get('/', roleController.getRoles);
router.post('/', roleController.createRole);
router.get('/:id', roleController.getRoleDetails);
router.put('/:id', roleController.updateRole);

// Explicit paths when mounted at root /
router.put('/roles/hierarchy', roleController.updateRoleHierarchy);
router.get('/roles', roleController.getRoles);
router.post('/roles', roleController.createRole);
router.get('/roles/:id', roleController.getRoleDetails);
router.put('/roles/:id', roleController.updateRole);

// Aliases for /api prefix compatibility
router.put('/api/roles/hierarchy', roleController.updateRoleHierarchy);
router.get('/api/roles', roleController.getRoles);
router.post('/api/roles', roleController.createRole);
router.get('/api/roles/:id', roleController.getRoleDetails);
router.put('/api/roles/:id', roleController.updateRole);

module.exports = router;
