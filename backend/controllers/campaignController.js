const crypto = require('crypto');
const objectService = require('../services/objectService');
const emailService = require('../services/emailService');
const supabase = require('../config/supabase');

// ─── TEMPLATE 1: Welcome Email ───────────────────────────────────────────────
const welcomeTemplate = (name, body, formLink) => `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${name}</title></head>
<body style="margin:0;padding:0;background:#0f0c29;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(160deg,#1a1040,#0f0c29 50%,#1a0a2e);padding:48px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
      <tr>
        <td style="background:linear-gradient(135deg,#7c4dff,#e040fb 60%,#ff6090);padding:48px 40px 40px;text-align:center;">
          <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:8px 20px;margin-bottom:24px;">
            <span style="color:#fff;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">CRM Lite</span>
          </div>
          <h1 style="margin:0;color:#fff;font-size:30px;font-weight:800;line-height:1.2;">Welcome aboard!</h1>
          <p style="margin:14px 0 0;color:rgba(255,255,255,0.8);font-size:15px;">${name}</p>
        </td>
      </tr>
      <tr>
        <td style="background:#16112b;padding:40px;">
          <p style="margin:0 0 10px;color:rgba(240,234,255,0.6);font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Hello there,</p>
          <p style="margin:0 0 28px;color:#e8e0ff;font-size:16px;line-height:1.8;">${body.replace(/\n/g, '<br/>')}</p>
          <div style="height:1px;background:rgba(255,255,255,0.08);margin:0 0 28px;"></div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr>
              <td width="31%" style="background:rgba(124,77,255,0.12);border:1px solid rgba(124,77,255,0.25);border-radius:12px;padding:18px 12px;text-align:center;">
                <div style="font-size:24px;margin-bottom:8px;">⏱️</div>
                <p style="margin:0;color:#c4b5fd;font-size:12px;font-weight:600;">2 min to fill</p>
              </td>
              <td width="4%"></td>
              <td width="31%" style="background:rgba(224,64,251,0.12);border:1px solid rgba(224,64,251,0.25);border-radius:12px;padding:18px 12px;text-align:center;">
                <div style="font-size:24px;margin-bottom:8px;">🔒</div>
                <p style="margin:0;color:#f0abfc;font-size:12px;font-weight:600;">Data secure</p>
              </td>
              <td width="4%"></td>
              <td width="31%" style="background:rgba(255,96,144,0.12);border:1px solid rgba(255,96,144,0.25);border-radius:12px;padding:18px 12px;text-align:center;">
                <div style="font-size:24px;margin-bottom:8px;">✅</div>
                <p style="margin:0;color:#fda4af;font-size:12px;font-weight:600;">100% free</p>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center">
                <a href="${formLink}" style="display:inline-block;background:linear-gradient(135deg,#7c4dff,#e040fb);color:#fff;text-decoration:none;padding:16px 48px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.3px;">
                  Get Started →
                </a>
              </td>
            </tr>
          </table>
          <div style="height:1px;background:rgba(255,255,255,0.08);margin:32px 0 28px;"></div>
          <p style="margin:0;color:rgba(240,234,255,0.5);font-size:14px;">Thank you,<br/><strong style="color:#c4b5fd;">The CRM Lite Team</strong></p>
        </td>
      </tr>
      <tr>
        <td style="background:#0d0a1f;padding:24px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0 0 6px;color:rgba(255,255,255,0.3);font-size:12px;">© 2026 CRM Lite. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;

// ─── TEMPLATE 2: Product Promotion ───────────────────────────────────────────
const promotionTemplate = (name, body, formLink) => `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${name}</title></head>
<body style="margin:0;padding:0;background:#fff8f0;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0;padding:48px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border-radius:20px;overflow:hidden;border:1px solid #ffe0cc;">
      <tr>
        <td style="background:linear-gradient(135deg,#ff6b35,#f7931e);padding:48px 40px;text-align:center;position:relative;overflow:hidden;">
          <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:20px;padding:6px 18px;margin-bottom:20px;">
            <span style="color:#fff;font-size:13px;font-weight:700;letter-spacing:1px;">⚡ LIMITED TIME OFFER</span>
          </div>
          <div style="background:#fff;display:inline-block;border-radius:14px;padding:10px 28px;margin-bottom:16px;">
            <span style="font-size:36px;font-weight:900;color:#ff6b35;">40% OFF</span>
          </div>
          <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">${name}</h1>
        </td>
      </tr>
      <tr>
        <td style="background:#fff;padding:40px;">
          <p style="margin:0 0 24px;color:#555;font-size:16px;line-height:1.8;">${body.replace(/\n/g, '<br/>')}</p>
          <div style="background:#fff8f0;border:2px dashed #ffd4b3;border-radius:14px;padding:20px;text-align:center;margin-bottom:28px;">
            <p style="margin:0 0 6px;color:#ff6b35;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Use code at checkout</p>
            <p style="margin:0;color:#333;font-size:28px;font-weight:900;letter-spacing:6px;">SAVE40</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center">
                <a href="${formLink}" style="display:inline-block;background:linear-gradient(135deg,#ff6b35,#f7931e);color:#fff;text-decoration:none;padding:16px 48px;border-radius:12px;font-size:16px;font-weight:700;box-shadow:0 8px 24px rgba(255,107,53,0.4);">
                  Claim Your Offer →
                </a>
              </td>
            </tr>
          </table>
          <div style="height:1px;background:#f0f0f0;margin:32px 0 24px;"></div>
          <p style="margin:0;color:#999;font-size:14px;">Best regards,<br/><strong style="color:#ff6b35;">The CRM Lite Team</strong></p>
        </td>
      </tr>
      <tr>
        <td style="background:#fff8f0;padding:20px 40px;text-align:center;border-top:1px solid #ffe0cc;">
          <p style="margin:0 0 6px;color:#ccc;font-size:12px;">© 2026 CRM Lite. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;

// ─── TEMPLATE 3: Newsletter ───────────────────────────────────────────────────
const newsletterTemplate = (name, body, formLink) => `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${name}</title></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:48px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border-radius:20px;overflow:hidden;border:1px solid #dce3ea;">
      <tr>
        <td style="background:#0d1b2a;padding:16px 32px;">
          <table width="100%"><tr>
            <td style="color:#fff;font-size:14px;font-weight:700;letter-spacing:2px;">CRM LITE</td>
            <td align="right" style="color:#64b5f6;font-size:13px;">${name}</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="background:#1565c0;padding:32px;">
          <h1 style="margin:0 0 8px;color:#fff;font-size:26px;font-weight:800;">Monthly Newsletter</h1>
          <p style="margin:0;color:#90caf9;font-size:14px;">Your latest updates, news & highlights</p>
        </td>
      </tr>
      <tr>
        <td style="background:#fff;padding:40px;">
          <div style="border-left:4px solid #1565c0;padding-left:20px;margin-bottom:28px;">
            <p style="margin:0 0 6px;color:#1565c0;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">This Month</p>
            <p style="margin:0;color:#333;font-size:16px;line-height:1.8;">${body.replace(/\n/g, '<br/>')}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center">
                <a href="${formLink}" style="display:inline-block;background:#1565c0;color:#fff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:15px;font-weight:700;">
                  Submit Interest Form →
                </a>
              </td>
            </tr>
          </table>
          <div style="height:1px;background:#f0f0f0;margin:28px 0 20px;"></div>
          <p style="margin:0;color:#999;font-size:14px;">Best regards,<br/><strong style="color:#1565c0;">The CRM Lite Team</strong></p>
        </td>
      </tr>
      <tr>
        <td style="background:#0d1b2a;padding:20px 40px;text-align:center;">
          <p style="margin:0 0 6px;color:rgba(255,255,255,0.3);font-size:12px;">© 2026 CRM Lite. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;

// ─── TEMPLATE 4: Event Invitation ────────────────────────────────────────────
const eventTemplate = (name, body, formLink) => `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${name}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(160deg,#0a0a0a,#1a1a2e);padding:48px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border-radius:20px;overflow:hidden;border:1px solid #222;">
      <tr>
        <td style="background:linear-gradient(160deg,#0a0a0a,#1a1a2e);padding:48px 40px;text-align:center;">
          <div style="display:inline-block;border:1px solid #333;border-radius:4px;padding:6px 18px;margin-bottom:28px;">
            <span style="color:#888;font-size:11px;letter-spacing:3px;font-family:Arial;">YOU ARE INVITED</span>
          </div>
          <h1 style="margin:0 0 12px;color:#f0e8d0;font-size:28px;font-weight:normal;font-style:italic;">${name}</h1>
          <div style="width:80px;height:1px;background:linear-gradient(to right,transparent,#c9a84c,transparent);margin:0 auto 28px;"></div>
        </td>
      </tr>
      <tr>
        <td style="background:#111;padding:40px;border-top:1px solid #222;">
          <p style="margin:0 0 28px;color:#aaa;font-size:15px;line-height:1.8;text-align:center;">${body.replace(/\n/g, '<br/>')}</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center">
                <a href="${formLink}" style="display:inline-block;border:1px solid #c9a84c;color:#c9a84c;text-decoration:none;padding:14px 48px;border-radius:4px;font-size:14px;letter-spacing:2px;font-family:Arial;">
                  RSVP NOW →
                </a>
              </td>
            </tr>
          </table>
          <div style="height:1px;background:#222;margin:32px 0 24px;"></div>
          <p style="margin:0;color:#555;font-size:13px;text-align:center;">We look forward to seeing you there.<br/><span style="color:#c9a84c;">— The CRM Lite Team</span></p>
        </td>
      </tr>
      <tr>
        <td style="background:#0a0a0a;padding:20px 40px;text-align:center;border-top:1px solid #1a1a1a;">
          <p style="margin:0 0 6px;color:#444;font-size:12px;font-family:Arial;">© 2026 CRM Lite. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;

// ─── Template Selector Helper ───
function buildEmailHtml(templateId, name, body, formLink) {
  switch (templateId) {
    case 'product_promo':
    case 'promotion':
      return promotionTemplate(name, body, formLink);
    case 'newsletter':
      return newsletterTemplate(name, body, formLink);
    case 'event_invitation':
    case 'event':
      return eventTemplate(name, body, formLink);
    case 'welcome_email':
    case 'welcome':
    default:
      return welcomeTemplate(name, body, formLink);
  }
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
      const { canRead } = await getCampaignPermissions(req.user);
      if (!canRead) {
        throw { statusCode: 403, message: 'Please check with your administrator. You do not have permissions.' };
      }

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
      const { canCreate, canUpdate } = await getCampaignPermissions(req.user);
      if (!canCreate || !canUpdate) {
        throw { statusCode: 403, message: 'Please check with your administrator. You do not have permissions.' };
      }

      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;
      const { name, subject, body, template_id, template_name, target_emails } = req.body || {};

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

      // Dispatch emails in parallel
      const trackingRecords = [];
      let successCount = 0;

      for (const recipient of recipientList) {
        const recipientFormLink = `${clientUrl}/public/campaign-form?campaign_id=${campaignId}&org_id=${organizationId}&email=${encodeURIComponent(recipient)}`;
        const emailHtml = buildEmailHtml(template_id, name, body, recipientFormLink);
        const trackingPixel = `<img src="${backendUrl}/api/public/track/open?campaign_id=${campaignId}&email=${encodeURIComponent(recipient)}" width="1" height="1" style="display:none;" />`;
        const finalHtml = emailHtml + trackingPixel;

        const dispatchResult = await emailService.sendEmail({
          to: recipient,
          subject: subject,
          html: finalHtml,
        });

        if (dispatchResult) successCount++;

        trackingRecords.push({
          email: recipient,
          status: 'sent',
          sent_at: new Date().toISOString(),
          opened_at: null,
        });
      }

      const baseFormLink = `${clientUrl}/public/campaign-form?campaign_id=${campaignId}&org_id=${organizationId}`;

      // Create payload for universal_table
      const campaignPayload = {
        id: campaignId,
        name: name.trim(),
        status: 'Sent',
        template_id: template_id || 'welcome_email',
        template_name: template_name || 'Welcome Email',
        subject: subject.trim(),
        body: body || '',
        target_emails: recipientList,
        total_sent: recipientList.length,
        opened_count: 0,
        sent_at: new Date().toISOString(),
        tracking: trackingRecords,
        form_url: baseFormLink,
      };

      console.log(`[Campaigns] Dispatched campaign '${name}' (ID: ${campaignId}) for orgId=${organizationId} to ${recipientList.length} recipients`);

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

      const newRow = {
        id: campaignId,
        organization_id: organizationId,
        object_type_id: validObjectTypeId,
        name: name.trim(),
        status: 'Sent',
        owner_id: userId || null,
        template_id: template_id || 'welcome_email',
        template_name: template_name || 'Welcome Email',
        subject: subject.trim(),
        body: body || '',
        target_emails: recipientList,
        total_sent: recipientList.length,
        opened_count: 0,
        sent_at: new Date().toISOString(),
        tracking: trackingRecords,
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

      return res.status(201).json({
        success: true,
        message: `Campaign "${name}" sent to ${recipientList.length} recipient(s).`,
        data: record,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/campaigns/:id
   * Delete campaign from universal_table
   */
  deleteCampaign: async (req, res, next) => {
    try {
      const { canDelete } = await getCampaignPermissions(req.user);
      if (!canDelete) {
        throw { statusCode: 403, message: 'Please check with your administrator. You do not have permissions.' };
      }

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
      const { canRead } = await getCampaignPermissions(req.user);
      if (!canRead) {
        throw { statusCode: 403, message: 'Please check with your administrator. You do not have permissions.' };
      }

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
          const newStatus = currentCampStatus.includes('submit') ? 'Form Submitted' : 'Open';

          await supabase
            .from('universal_table')
            .update({
              status: newStatus,
              opened_count: openedCount,
              tracking: updatedTracking,
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
