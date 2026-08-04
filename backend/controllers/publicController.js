const objectService = require('../services/objectService');
const supabase = require('../config/supabase');

/**
 * Public Controller (No authentication required)
 * Handles public campaign lead form submissions
 */
const publicController = {
  /**
   * POST /api/public/campaign-form/submit
   * Receives public form response, creates Lead record in universal_table scoped to org_id,
   * and updates recipient's campaign tracking status to 'Form Submitted'.
   */
  submitCampaignForm: async (req, res, next) => {
    try {
      const {
        org_id,
        campaign_id,
        name,
        email,
        phone,
        company,
        title,
        description
      } = req.body || {};

      if (!org_id) {
        return res.status(400).json({ message: 'Organization ID is required.' });
      }
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Full name is required.' });
      }

      console.log(`[Public Form] Received lead form submission for org_id=${org_id}, campaign_id=${campaign_id}, email=${email}`);

      const fullName = name.trim();
      const parts = fullName.split(' ');
      const firstName = parts[0] || fullName;
      const lastName = parts.slice(1).join(' ') || firstName;
      const targetEmail = email ? String(email).trim() : '';

      const leadPayload = {
        name: fullName,
        first_name: firstName,
        last_name: lastName,
        email: targetEmail,
        phone: phone ? String(phone).trim() : '',
        company: company ? String(company).trim() : '',
        title: title ? String(title).trim() : '',
        lead_source: 'Campaign Form Submission',
        description: description || `Submitted from Campaign Form (${campaign_id || 'Direct'})`,
        status: 'New',
      };

      // 1. Create Lead in universal_table scoped to the company's org_id
      const leadRecord = await objectService.createRecord('lead', leadPayload, org_id, null);

      // 2. Update Campaign status and tracking array in universal_table if campaign_id is provided
      if (campaign_id) {
        try {
          let query = supabase.from('universal_table').select('*');
          if (campaign_id.includes('-')) {
            query = query.eq('id', campaign_id);
          } else {
            query = query.ilike('data->>form_url', `%${campaign_id}%`);
          }

          const { data: campaign } = await query.maybeSingle();

          if (campaign) {
            const currentTracking = campaign.tracking || campaign.data?.tracking || [];
            const updatedTracking = currentTracking.map((item) => {
              const matchesEmail = targetEmail ? String(item.email).toLowerCase() === targetEmail.toLowerCase() : true;
              if (matchesEmail) {
                return {
                  ...item,
                  status: 'Form Submitted',
                  submitted_at: new Date().toISOString(),
                };
              }
              return item;
            });

            if (targetEmail && !updatedTracking.some((i) => String(i.email).toLowerCase() === targetEmail.toLowerCase())) {
              updatedTracking.push({
                email: targetEmail,
                status: 'Form Submitted',
                submitted_at: new Date().toISOString(),
              });
            }

            const openedCount = updatedTracking.filter((i) => {
              const st = String(i.status || '').toLowerCase();
              return st.includes('open') || st.includes('submit') || st.includes('form');
            }).length;

            await supabase
              .from('universal_table')
              .update({
                status: 'Form Submitted',
                opened_count: openedCount,
                tracking: updatedTracking,
                data: {
                  ...(campaign.data || {}),
                  status: 'Form Submitted',
                  opened_count: openedCount,
                  tracking: updatedTracking,
                },
                updated_at: new Date().toISOString(),
              })
              .eq('id', campaign.id);

            console.log(`[Public Form] Successfully updated campaign '${campaign.name}' tracking to 'Form Submitted' for ${targetEmail}`);
          }
        } catch (e) {
          console.warn('[Public Form] Note updating campaign tracking status:', e.message);
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Lead response recorded successfully!',
        data: leadRecord,
      });
    } catch (err) {
      console.error('[Public Form] Error submitting campaign form:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to submit form details.',
      });
    }
  },
};

module.exports = publicController;
