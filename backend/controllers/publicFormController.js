const formService = require('../services/formService');

const publicFormController = {
  /**
   * GET /api/public/forms/:slug
   * Unauthenticated endpoint to fetch active public form layout
   */
  getPublicFormBySlug: async (req, res) => {
    try {
      const { slug } = req.params;
      const form = await formService.getFormBySlug(slug);

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found or is currently inactive.',
        });
      }

      // Return public-safe payload (exclude organization credentials)
      return res.status(200).json({
        success: true,
        data: {
          id: form.id,
          name: form.name,
          slug: form.slug,
          description: form.description,
          header_content: form.header_content,
          appearance: form.appearance,
          fields_config: form.fields_config,
        },
      });
    } catch (err) {
      console.error('[PublicFormController] Get error:', err);
      return res.status(500).json({
        success: false,
        message: 'Unable to load public form at this time.',
      });
    }
  },

  /**
   * POST /api/public/forms/:slug/submit
   * Unauthenticated endpoint to process form response submission
   */
  submitPublicForm: async (req, res) => {
    try {
      const { slug } = req.params;
      const { submitted_fields, utm_source, utm_medium, utm_campaign, referrer } = req.body || {};

      // Fallback: payload might be flat object or nested in submitted_fields
      const payload = submitted_fields || req.body || {};

      const metaParams = {
        utm_source,
        utm_medium,
        utm_campaign,
        referrer,
      };

      const result = await formService.submitPublicForm(slug, payload, metaParams);

      return res.status(200).json(result);
    } catch (err) {
      console.error('[PublicFormController] Submit error:', err.message || err);
      const statusCode = err.statusCode || 400;
      return res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to submit form.',
      });
    }
  },

  /**
   * POST /api/public/forms/:slug/inquiries
   * Unauthenticated endpoint to submit a webinar question inquiry
   */
  submitPublicInquiry: async (req, res) => {
    try {
      const { slug } = req.params;
      const { name, email, question } = req.body || {};

      const result = await formService.submitPublicInquiry(slug, { name, email, question });
      return res.status(200).json(result);
    } catch (err) {
      console.error('[PublicFormController] Submit inquiry error:', err.message || err);
      const statusCode = err.statusCode || 400;
      return res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to submit question.',
      });
    }
  },
};

module.exports = publicFormController;
