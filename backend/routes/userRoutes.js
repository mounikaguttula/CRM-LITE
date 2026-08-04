const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

// Protect user routes
router.use(authMiddleware);

// Dedicated Users endpoints
router.get('/users', userController.getUsers);
router.get('/objects/users', userController.getUsers);
router.post('/users/invite', userController.inviteUser);

module.exports = router;
