const crypto = require('crypto');
const objectService = require('../services/objectService');
const emailService = require('../services/emailService');
const supabase = require('../config/supabase');

// ─── Resolve Recipient Details (Contact Lookup or Email Parsing) ─────────────
function resolveRecipientDetails(recipientEmail, matchedContact) {
  let fullName = '';
  let firstName = '';
  let lastName = '';

  if (matchedContact) {
    const d = matchedContact.data || {};
    firstName = d.first_name || d.firstName || '';
    lastName = d.last_name || d.lastName || '';
    fullName = matchedContact.name || d.full_name || `${firstName} ${lastName}`.trim();
  }

  const cleanEmail = (typeof recipientEmail === 'string') ? recipientEmail.trim() : '';

  if (!fullName && cleanEmail.includes('@')) {
    const localPart = cleanEmail.split('@')[0];
    const parts = localPart.split(/[._-]/).filter(Boolean);
    if (parts.length > 0) {
      firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
      if (parts.length > 1) {
        lastName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
        fullName = `${firstName} ${lastName}`;
      } else {
        fullName = firstName;
      }
    }
  }

  if (!firstName) firstName = 'Subscriber';
  if (!fullName) fullName = firstName;

  return { fullName, firstName, lastName, email: cleanEmail };
}

// ─── Process Merge Tags (HubSpot Style) ──────────────────────────────────────
function processMergeTags(rawHtml, { recipient, formLink, subject, orgName }) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  const firstName = recipient?.firstName || 'Subscriber';
  const lastName = recipient?.lastName || '';
  const fullName = recipient?.fullName || firstName;
  const cleanEmail = recipient?.email || '';

  return String(rawHtml)
    // First Name: {{first_name}}, {{first name}}, {{firstname}}, {{firstName}}
    .replace(/\{\{\s*first[_\s-]?name\s*\}\}/gi, firstName)
    // Last Name: {{last_name}}, {{last name}}, {{lastname}}, {{lastName}}
    .replace(/\{\{\s*last[_\s-]?name\s*\}\}/gi, lastName)
    // Full Name: {{name}}, {{full_name}}, {{full name}}, {{fullname}}, {{fullName}}
    .replace(/\{\{\s*(?:full[_\s-]?)?name\s*\}\}/gi, fullName)
    // Email: {{email}}
    .replace(/\{\{\s*email\s*\}\}/gi, cleanEmail)
    // Form & RSVP links: {{form_link}}, {{form link}}, {{rsvp_link}}
    .replace(/\{\{\s*(?:form|rsvp)[_\s-]?link\s*\}\}/gi, typeof formLink === 'string' ? formLink : '#')
    // Subject: {{subject}}
    .replace(/\{\{\s*subject\s*\}\}/gi, typeof subject === 'string' ? subject : '')
    // Company & Organization: {{company}}, {{organization}}
    .replace(/\{\{\s*(?:company|organization)\s*\}\}/gi, typeof orgName === 'string' && orgName ? orgName : 'FounderCRM');
}

const metadataService = require('../services/metadataService');

// Helper to resolve campaign permissions safely
const getCampaignPermissions = async (user) => {
  if (!user) return { canRead: true, canCreate: true, canUpdate: true, canDelete: true };
  try {
    const perms = await metadataService.getPermissions(user);
    const campPerm = perms?.campaign || perms?.campaigns;
    if (!campPerm) {
      return { canRead: true, canCreate: true, canUpdate: true, canDelete: true };
    }
    return {
      canRead: campPerm.canRead !== false,
      canCreate: campPerm.canCreate !== false,
      canUpdate: campPerm.canUpdate !== false && campPerm.canEdit !== false,
      canDelete: campPerm.canDelete !== false,
    };
  } catch (err) {
    console.warn('[CampaignController] Permission check warning:', err.message);
    return { canRead: true, canCreate: true, canUpdate: true, canDelete: true };
  }
};

/**
 * Campaigns Controller using universal_table
 */
const campaignController = {
  /**
   * GET /api/campaigns
   * Fetch all campaigns for the current organization from universal_table
   */
  listCampaigns: async (req, res, next) => {
    try {
      await metadataService.checkPermission(req.user, 'campaign', 'read');

      const organizationId = req.user?.organization_id;

      // 1. Resolve object_type_id for 'campaign'
      const { data: defs } = await supabase
        .from('object_type_definitions')
        .select('id, api_name')
        .or(`organization_id.eq.${organizationId},organization_id.is.null`);

      const campaignDef = defs?.find((d) => d.api_name === 'campaign' || d.api_name === 'campaigns');

      // 2. Query universal_table strictly for campaign records
      let query = supabase
        .from('universal_table')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_deleted', false);

      if (campaignDef?.id) {
        query = query.or(`object_type_id.eq.${campaignDef.id},template_id.neq.null,data->template_id.neq.null`);
      } else {
        query = query.or(`template_id.neq.null,data->template_id.neq.null`);
      }

      const { data: rows } = await query.order('created_at', { ascending: false });

      const records = (rows || []).map((r) => ({
        ...objectService.normalizeRecord(r),
        subject: r.subject || r.data?.subject || '',
        template_id: r.template_id || r.data?.template_id || '',
        target_emails: r.target_emails || r.data?.target_emails || [],
        total_sent: r.total_sent || r.data?.total_sent || 0,
        opened_count: r.opened_count || r.data?.opened_count || 0,
        tracking: r.tracking || r.data?.tracking || [],
      }));

      return res.status(200).json(records);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/campaigns/send
   * Send campaign emails to target recipients with Organization-scoped Form Link
   */
  sendCampaign: async (req, res, next) => {
    try {
      await metadataService.checkPermission(req.user, 'campaign', 'create');

      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;
      const { name, subject, body, html, template_id, template_name, target_emails, type, custom_html } = req.body || {};

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Campaign name is required.' });
      }
      if (!subject || !subject.trim()) {
        return res.status(400).json({ message: 'Email subject is required.' });
      }

      // Parse target emails into clean array
      let recipientList = [];
      if (Array.isArray(target_emails)) {
        recipientList = target_emails.map((e) => String(e).trim()).filter(Boolean);
      } else if (typeof target_emails === 'string') {
        recipientList = target_emails
          .split(/[,;\n]/)
          .map((e) => e.trim())
          .filter((e) => e.length > 0 && e.includes('@'));
      }

      if (recipientList.length === 0) {
        return res.status(400).json({ message: 'Please enter at least one valid target email address.' });
      }

      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

      // Generate valid UUID for campaign ID so Postgres primary key matches cleanly
      const campaignId = crypto.randomUUID();

      // Look up existing contacts/leads to resolve recipient names accurately
      const contactMap = new Map();
      try {
        const { data: matchedContacts } = await supabase
          .from('universal_table')
          .select('id, name, data')
          .eq('organization_id', organizationId)
          .eq('is_deleted', false);

        if (Array.isArray(matchedContacts)) {
          for (const c of matchedContacts) {
            const cEmail = (c.data?.email || c.data?.email_address || c.email || '').trim().toLowerCase();
            if (cEmail) contactMap.set(cEmail, c);
          }
        }
      } catch (cErr) {
        console.warn('[CampaignController] Contact lookup warning:', cErr.message);
      }

      // Dispatch emails
      const trackingRecords = [];
      let successCount = 0;
      let failureCount = 0;
      let lastErrorMessage = '';

      for (const recipient of recipientList) {
        const cleanRecipientEmail = recipient.trim().toLowerCase();
        const matchedContact = contactMap.get(cleanRecipientEmail);
        const recipientDetails = resolveRecipientDetails(recipient, matchedContact);

        const recipientFormLink = `${clientUrl}/public/campaign-form?campaign_id=${campaignId}&org_id=${organizationId}&email=${encodeURIComponent(recipient)}`;
        
        const rawContent = (typeof html === 'string' && html.trim())
          ? html
          : ((typeof custom_html === 'string' && custom_html.trim()) ? custom_html : (typeof body === 'string' && body.trim() ? body : `<html><body><h1>${subject}</h1><p>${name}</p><a href="${recipientFormLink}">Get Started &rarr;</a></body></html>`));

        // Personalize HTML body with recipient details (First Name, Last Name, Full Name, Email, etc.)
        const emailHtml = processMergeTags(rawContent, {
          recipient: recipientDetails,
          formLink: recipientFormLink,
          subject,
          orgName: req.user?.organization_name,
        });

        // Personalize Subject Line with recipient details (e.g. "Welcome, Bhanu!")
        const personalizedSubject = processMergeTags(subject, {
          recipient: recipientDetails,
          formLink: recipientFormLink,
          subject,
          orgName: req.user?.organization_name,
        });

        const trackingPixel = `<img src="${backendUrl}/api/public/track/open?campaign_id=${campaignId}&email=${encodeURIComponent(recipient)}" width="1" height="1" style="display:none;" />`;
        
        let finalHtml = emailHtml || '';
        if (typeof emailHtml === 'string' && emailHtml.includes('</body>')) {
          finalHtml = emailHtml.replace('</body>', `${trackingPixel}\n</body>`);
        } else {
          finalHtml = String(emailHtml || '') + trackingPixel;
        }

        try {
          const dispatchResult = await emailService.sendEmail({
            to: recipient,
            subject: personalizedSubject,
            html: finalHtml,
          });

          if (dispatchResult?.success) {
            successCount++;
            trackingRecords.push({
              email: recipient,
              status: 'sent',
              provider: dispatchResult.provider || 'sendgrid',
              sent_at: new Date().toISOString(),
              opened_at: null,
            });
          } else {
            failureCount++;
            lastErrorMessage = dispatchResult?.error || 'Unknown send failure';
            trackingRecords.push({
              email: recipient,
              status: 'failed',
              provider: 'sendgrid',
              error: lastErrorMessage,
              failed_at: new Date().toISOString(),
              opened_at: null,
            });
          }
        } catch (dispatchErr) {
          failureCount++;
          lastErrorMessage = dispatchErr.message || 'SendGrid dispatch failed';
          console.error(`❌ [sendCampaign] Failed to dispatch to ${recipient}:`, lastErrorMessage);
          trackingRecords.push({
            email: recipient,
            status: 'failed',
            provider: 'sendgrid',
            error: lastErrorMessage,
            failed_at: new Date().toISOString(),
            opened_at: null,
          });
        }
      }

      const baseFormLink = `${clientUrl}/public/campaign-form?campaign_id=${campaignId}&org_id=${organizationId}`;

      const templateTypeMap = {
        welcome_email: 'Welcome Email',
        product_promo: 'Product Promotion',
        newsletter: 'Monthly Newsletter',
        event_invitation: 'Event Invitation',
        custom_html: 'Custom HTML',
      };
      const campaignType = type || templateTypeMap[template_id] || (template_name ? (templateTypeMap[String(template_name).toLowerCase()] || template_name) : 'Welcome Email');

      // Resolve valid campaign status
      let overallStatus = 'Sent';
      if (successCount === 0) {
        overallStatus = 'Failed';
      } else if (failureCount > 0) {
        overallStatus = 'Partially Sent';
      }

      // Create payload for universal_table JSONB data column
      const campaignPayload = {
        id: campaignId,
        name: name.trim(),
        status: overallStatus,
        failure_reason: failureCount > 0 ? lastErrorMessage : null,
        type: campaignType,
        template_id: template_id || (html || custom_html ? 'custom_html' : 'welcome_email'),
        template_name: template_name || (template_id === 'custom_html' ? 'Custom HTML' : 'Campaign Email'),
        subject: subject.trim(),
        html: html || custom_html || body || '',
        target_emails: recipientList,
        total_sent: successCount,
        total_failed: failureCount,
        opened_count: 0,
        sent_at: successCount > 0 ? new Date().toISOString() : null,
        tracking: trackingRecords,
        form_url: baseFormLink,
      };

      console.log(`[Campaigns] Dispatched campaign '${name}' (ID: ${campaignId}) for orgId=${organizationId}: ${successCount} sent, ${failureCount} failed`);

      // Resolve valid object_type_id from object_type_definitions table to satisfy FK constraint
      let validObjectTypeId = null;
      const { data: existingDefs } = await supabase
        .from('object_type_definitions')
        .select('id, api_name')
        .or(`organization_id.eq.${organizationId},organization_id.is.null`);

      if (existingDefs && existingDefs.length > 0) {
        const campaignDef = existingDefs.find((d) => d.api_name === 'campaign' || d.api_name === 'campaigns');
        if (campaignDef) {
          validObjectTypeId = campaignDef.id;
        } else {
          const { data: newDef } = await supabase
            .from('object_type_definitions')
            .insert([{
              organization_id: organizationId,
              api_name: 'campaign',
              display_name: 'Campaigns',
              description: 'Email Marketing Campaigns',
              is_system: true,
            }])
            .select('id')
            .single();

          validObjectTypeId = newDef ? newDef.id : existingDefs[0].id;
        }
      }

      // Restrict newRow strictly to valid columns of public.universal_table
      const newRow = {
        id: campaignId,
        organization_id: organizationId,
        object_type_id: validObjectTypeId,
        name: name.trim(),
        status: overallStatus,
        owner_id: userId || null,
        data: campaignPayload,
        created_by: userId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: row, error: insErr } = await supabase
        .from('universal_table')
        .insert([newRow])
        .select()
        .single();

      if (insErr) {
        console.error('Campaign insert error:', insErr);
        throw new Error(insErr.message);
      }

      const record = objectService.normalizeRecord(row);

      if (overallStatus === 'Failed') {
        return res.status(400).json({
          success: false,
          message: `Failed to dispatch campaign: ${lastErrorMessage || 'SendGrid failed to deliver the email.'}`,
          data: record,
        });
      }

      if (overallStatus === 'Partially Sent') {
        return res.status(200).json({
          success: true,
          message: `Campaign "${name}" partially sent: ${successCount} delivered, ${failureCount} failed (${lastErrorMessage}).`,
          data: record,
        });
      }

      return res.status(201).json({
        success: true,
        message: `Campaign "${name}" sent successfully to ${recipientList.length} recipient(s).`,
        data: record,
      });
    } catch (err) {
      console.error('❌ [sendCampaign Error]:', err.stack || err);
      return res.status(err.statusCode || err.status || 500).json({
        success: false,
        message: err.message || 'Failed to dispatch campaign.',
      });
    }
  },

  /**
   * DELETE /api/campaigns/:id
   * Delete campaign from universal_table
   */
  deleteCampaign: async (req, res, next) => {
    try {
      await metadataService.checkPermission(req.user, 'campaign', 'delete');

      const { id } = req.params;
      const organizationId = req.user?.organization_id;

      const { error } = await supabase
        .from('universal_table')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) {
        return res.status(500).json({ message: `Failed to delete campaign: ${error.message}` });
      }

      return res.status(200).json({ success: true, message: 'Campaign deleted successfully.' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/campaigns/:id/tracking
   * Get email tracking stats for a campaign
   */
  getCampaignTracking: async (req, res, next) => {
    try {
      await metadataService.checkPermission(req.user, 'campaign', 'read');

      const { id } = req.params;
      const organizationId = req.user?.organization_id;

      const { data: row } = await supabase
        .from('universal_table')
        .select('*')
        .eq('id', id)
        .eq('organization_id', organizationId)
        .single();

      if (!row) {
        return res.status(404).json({ message: 'Campaign not found.' });
      }

      const campaign = objectService.normalizeRecord(row);

      return res.status(200).json({
        campaign_name: campaign.name,
        status: campaign.status || row.status || 'Sent',
        total_sent: campaign.total_sent || row.total_sent || campaign.target_emails?.length || 0,
        opened_count: campaign.opened_count || row.opened_count || 0,
        tracking: campaign.tracking || row.tracking || row.data?.tracking || [],
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/public/track/open
   * Open tracking pixel & form link view handler
   */
  trackOpen: async (req, res, next) => {
    try {
      const campaign_id = req.query.campaign_id;
      const email = req.query.email;
      console.log(`[Tracking Pixel] Open ping for campaign_id=${campaign_id}, email=${email}`);

      if (campaign_id) {
        // Query campaign row safely by ID or form_url
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
            const matchesEmail = email ? String(item.email).toLowerCase() === String(email).toLowerCase() : true;
            if (matchesEmail) {
              const currentStatus = String(item.status || '').toLowerCase();
              const isSubmitted = currentStatus.includes('submit') || currentStatus.includes('form');
              return {
                ...item,
                status: isSubmitted ? 'Form Submitted' : 'Opened',
                opened_at: item.opened_at || new Date().toISOString(),
              };
            }
            return item;
          });

          if (email && !updatedTracking.some((i) => String(i.email).toLowerCase() === String(email).toLowerCase())) {
            updatedTracking.push({
              email,
              status: 'Opened',
              opened_at: new Date().toISOString(),
            });
          }

          const openedCount = updatedTracking.filter((i) => {
            const st = String(i.status || '').toLowerCase();
            return st.includes('open') || st.includes('submit') || st.includes('form');
          }).length;

          const currentCampStatus = String(campaign.status || '').toLowerCase();
          const newStatus = currentCampStatus.includes('submit') ? 'Form Submitted' : 'Opened';

          await supabase
            .from('universal_table')
            .update({
              status: newStatus,
              data: {
                ...(campaign.data || {}),
                status: newStatus,
                opened_count: openedCount,
                tracking: updatedTracking,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', campaign.id);

          console.log(`[Tracking Pixel] Updated campaign '${campaign.name}' status to '${newStatus}', opened_count=${openedCount}`);
        }
      }

      const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': transparentGif.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      });
      return res.end(transparentGif);
    } catch (err) {
      console.error('[Tracking] Open tracking error:', err);
      const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.writeHead(200, { 'Content-Type': 'image/gif' });
      return res.end(transparentGif);
    }
  },
};

module.exports = campaignController;
