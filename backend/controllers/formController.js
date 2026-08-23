const supabase = require('../config/supabase');
const formService = require('../services/formService');

const formController = {
  /**
   * GET /api/forms
   * List all forms for current user's organization
   */
  listForms: async (req, res, next) => {
    try {
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required.' });
      }
      const forms = await formService.listForms(organizationId);
      return res.status(200).json(forms);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/forms/:id
   * Get single form details
   */
  getFormById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      const form = await formService.getFormById(id, organizationId);
      return res.status(200).json(form);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/forms
   * Create a new form
   */
  createForm: async (req, res, next) => {
    try {
      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required.' });
      }
      const form = await formService.createForm(req.body, organizationId, userId);
      return res.status(201).json({
        success: true,
        message: 'Form created successfully.',
        data: form,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/forms/:id
   * Update an existing form
   */
  updateForm: async (req, res, next) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;
      const updatedForm = await formService.updateForm(id, req.body, organizationId, userId);
      return res.status(200).json({
        success: true,
        message: 'Form updated successfully.',
        data: updatedForm,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/forms/:id
   * Soft-delete a form
   */
  deleteForm: async (req, res, next) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;
      const result = await formService.deleteForm(id, organizationId, userId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/forms/:id/submissions
   * List all submissions for a given form
   */
  listSubmissions: async (req, res, next) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      const submissions = await formService.listSubmissions(id, organizationId);
      return res.status(200).json(submissions);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/forms/:id/submissions/:submissionId
   * Delete a single submission record
   */
  deleteSubmission: async (req, res, next) => {
    try {
      const { id, submissionId } = req.params;
      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;
      const result = await formService.deleteSubmission(id, submissionId, organizationId, userId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/forms/:id/submissions/attendance
   * Update attendance_status for one or more form submissions
   */
  updateSubmissionAttendance: async (req, res, next) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      const { submission_ids, attendance_status } = req.body || {};

      if (!submission_ids || !Array.isArray(submission_ids) || submission_ids.length === 0) {
        return res.status(400).json({ success: false, message: 'submission_ids array is required.' });
      }
      if (!attendance_status) {
        return res.status(400).json({ success: false, message: 'attendance_status is required.' });
      }

      const result = await formService.updateSubmissionAttendance(id, submission_ids, attendance_status, organizationId);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to update attendance status.',
      });
    }
  },

  /**
   * POST /api/forms/:id/email-registrants
   * Send email campaign to form registrants
   */
  sendEmailRegistrants: async (req, res, next) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      const { subject, body, targetAudience, attendanceFilter, submission_ids } = req.body || {};

      const result = await formService.sendFormRegistrantsEmail(id, { subject, body, targetAudience, attendanceFilter, submission_ids }, organizationId);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to send email to form registrants.',
      });
    }
  },

  /**
   * GET /api/forms/org-media
   * List all media files for the authenticated user's organization
   */
  listOrgMedia: async (req, res, next) => {
    try {
      const organizationId = req.user?.organization_id || req.user?.company_id;
      if (!organizationId) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Company identification missing from user session.' });
      }

      const media = await formService.listOrgMedia(organizationId);
      return res.status(200).json({
        success: true,
        data: media,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/forms/upload-media
   * Upload image to Supabase storage bucket 'media'
   */
  uploadMedia: async (req, res, next) => {
    try {
      const organizationId = req.user?.organization_id || req.user?.company_id;
      if (!organizationId) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Company identification missing from user session.' });
      }

      const { file_name, file_data, mime_type, form_id } = req.body || {};
      if (!file_data) {
        return res.status(400).json({ success: false, message: 'file_data is required.' });
      }

      let targetFormId = form_id || 'general';
      if (targetFormId === 'new') {
        return res.status(400).json({ success: false, message: 'Invalid form_id: Cannot upload media under temporary target "new".' });
      }

      // Check if form exists in DB across all tenants to prevent cross-company form uploads
      if (targetFormId && targetFormId !== 'general') {
        const { data: rawForm } = await supabase
          .from('universal_table')
          .select('id, organization_id')
          .eq('id', targetFormId)
          .eq('is_deleted', false)
          .maybeSingle();

        if (rawForm && rawForm.organization_id !== organizationId) {
          return res.status(403).json({ success: false, message: 'Unauthorized: Form belongs to another company.' });
        }
      }

      // Convert base64 string to buffer
      const base64Clean = file_data.replace(/^data:[^;]+;base64,/, '');
      const fileBuffer = Buffer.from(base64Clean, 'base64');

      if (fileBuffer.length > 2 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: 'File size exceeds maximum allowed limit of 2 MB.' });
      }

      const uploadRes = await formService.uploadMediaFile(fileBuffer, file_name, mime_type, organizationId, targetFormId);
      return res.status(200).json({
        success: true,
        ...uploadRes,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to upload media asset.',
      });
    }
  },

  /**
   * POST /api/forms/delete-media
   * Delete image asset from Supabase storage bucket 'media'
   */
  deleteMedia: async (req, res, next) => {
    try {
      const organizationId = req.user?.organization_id || req.user?.company_id;
      if (!organizationId) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Company identification missing from user session.' });
      }

      const { file_path } = req.body || {};
      if (!file_path) {
        return res.status(400).json({ success: false, message: 'file_path is required.' });
      }

      const result = await formService.deleteMediaFile(file_path, organizationId);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to delete media asset.',
      });
    }
  },

  /**
   * GET /api/forms/:id/inquiries
   * List all visitor question inquiries for a form
   */
  listInquiries: async (req, res, next) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required.' });
      }
      const inquiries = await formService.listInquiries(id, organizationId);
      return res.status(200).json(inquiries);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/forms/:id/inquiries/:inquiryId/reply
   * Send admin reply email to a visitor inquiry
   */
  replyToInquiry: async (req, res, next) => {
    try {
      const { id, inquiryId } = req.params;
      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;
      const { message, replyTo } = req.body || {};

      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required.' });
      }

      const result = await formService.replyToInquiry(id, inquiryId, { message, replyTo }, organizationId, userId);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to send reply to inquiry.',
      });
    }
  },
};

module.exports = formController;

