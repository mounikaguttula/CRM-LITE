const express = require('express');
const router = express.Router();
const validationRuleController = require('../controllers/validationRuleController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', validationRuleController.listRules);
router.post('/', validationRuleController.createRule);
router.get('/:id', validationRuleController.getRuleById);
router.put('/:id', validationRuleController.updateRule);
router.patch('/:id/toggle', validationRuleController.toggleRule);
router.delete('/:id', validationRuleController.deleteRule);

module.exports = router;
