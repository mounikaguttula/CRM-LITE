const express = require('express');
const router = express.Router();
const formController = require('../controllers/formController');
const authMiddleware = require('../middleware/auth');

// Specific media & static endpoints MUST come before parameterized /api/forms/:id
router.get('/api/forms/org-media', authMiddleware, formController.listOrgMedia);
router.post('/api/forms/upload-media', authMiddleware, formController.uploadMedia);
router.post('/api/forms/delete-media', authMiddleware, formController.deleteMedia);

// All forms endpoints require JWT auth middleware
router.get('/api/forms', authMiddleware, formController.listForms);
router.post('/api/forms', authMiddleware, formController.createForm);
router.get('/api/forms/:id', authMiddleware, formController.getFormById);
router.put('/api/forms/:id', authMiddleware, formController.updateForm);
router.delete('/api/forms/:id', authMiddleware, formController.deleteForm);

// Form Submissions & Email Registrants
router.get('/api/forms/:id/submissions', authMiddleware, formController.listSubmissions);
router.delete('/api/forms/:id/submissions/:submissionId', authMiddleware, formController.deleteSubmission);
router.patch('/api/forms/:id/submissions/attendance', authMiddleware, formController.updateSubmissionAttendance);
router.post('/api/forms/:id/email-registrants', authMiddleware, formController.sendEmailRegistrants);

module.exports = router;

