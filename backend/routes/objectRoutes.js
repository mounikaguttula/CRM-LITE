const express = require('express');
const router = express.Router();
const objectController = require('../controllers/objectController');
const authMiddleware = require('../middleware/auth');

// Protect all object platform routes
router.use(authMiddleware);

// Generic CRUD API routes: /objects/:objectType
router.get('/objects/:objectType', objectController.getRecords);
router.get('/objects/:objectType/:id', objectController.getRecordById);
router.post('/objects/:objectType', objectController.createRecord);
router.put('/objects/:objectType/:id', objectController.updateRecord);
router.delete('/objects/:objectType/:id', objectController.deleteRecord);

// Route alias for /records/:objectType
router.get('/records/:objectType', objectController.getRecords);
router.get('/records/:objectType/:id', objectController.getRecordById);
router.post('/records/:objectType', objectController.createRecord);

// Direct route aliases (e.g. GET /leads, POST /leads, GET /contacts, etc.)
const EXCLUDED_PREFIXES = ['auth', 'workspace', 'health', 'objects', 'users', 'roles', 'records', 'company', 'metadata', 'validation-rules', 'api', 'setup'];

router.get('/:objectType', (req, res, next) => {
  if (EXCLUDED_PREFIXES.includes(req.params.objectType)) return next('route');
  return objectController.getRecords(req, res, next);
});
router.get('/:objectType/:id', (req, res, next) => {
  if (EXCLUDED_PREFIXES.includes(req.params.objectType)) return next('route');
  return objectController.getRecordById(req, res, next);
});
router.post('/:objectType', (req, res, next) => {
  if (EXCLUDED_PREFIXES.includes(req.params.objectType)) return next('route');
  return objectController.createRecord(req, res, next);
});
router.put('/:objectType/:id', (req, res, next) => {
  if (EXCLUDED_PREFIXES.includes(req.params.objectType)) return next('route');
  return objectController.updateRecord(req, res, next);
});
router.delete('/:objectType/:id', (req, res, next) => {
  if (EXCLUDED_PREFIXES.includes(req.params.objectType)) return next('route');
  return objectController.deleteRecord(req, res, next);
});

module.exports = router;
