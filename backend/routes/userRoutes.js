const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

// Protect user routes
router.use(authMiddleware);

// Dedicated Users endpoints (supporting /users, /api/users, /objects/users, and direct /)
router.get('/users', userController.getUsers);
router.get('/api/users', userController.getUsers);
router.get('/objects/users', userController.getUsers);
router.get('/', userController.getUsers);

router.post('/users/invite', userController.inviteUser);
router.post('/api/users/invite', userController.inviteUser);
router.post('/invite', userController.inviteUser);

router.put('/users/:id', userController.updateUser);
router.put('/api/users/:id', userController.updateUser);
router.put('/:id', userController.updateUser);

router.delete('/users/:id', userController.deleteUser);
router.delete('/api/users/:id', userController.deleteUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
