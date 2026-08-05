const nodemailer = require('nodemailer');

/**
 * Reusable Centralized Email Service
 * Handles SMTP email notifications across the platform.
 * Built with 100% table-based HTML layouts and full XML SVG namespaces for 100% email client compatibility (Gmail, Outlook, Apple Mail).
 */

// Dynamic Transporter Factory
const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const rawPass = process.env.SMTP_PASS;
  const pass = rawPass ? rawPass.replace(/\s+/g, '') : '';

  if (!host || !user || !pass) {
    return {
      sendMail: async (options) => {
        console.log('✉️ [MOCK EMAIL DISPATCH] SMTP not configured. Email suppressed:');
        console.log(`   To: ${options.to}`);
        console.log(`   Subject: ${options.subject}`);
        return { mock: true };
      },
    };
  }

  const isGmail = host.includes('gmail.com');
  const transporterConfig = isGmail
    ? { service: 'gmail', auth: { user, pass }, tls: { rejectUnauthorized: false } }
    : { host, port, secure: port === 465 || process.env.SMTP_SECURE === 'true', auth: { user, pass }, tls: { rejectUnauthorized: false } };

  return nodemailer.createTransport(transporterConfig);
};

// ─── Shared Template Helpers ──────────────────────────────────────────────────

const LOGO_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" style="vertical-align:middle;margin-right:8px;display:inline-block;">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#6366f1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="#6366f1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="12" y1="22.08" x2="12" y2="12" stroke="#6366f1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

const emailHeader = () => `
  <table align="center" cellpadding="0" cellspacing="0" style="margin:20px auto 16px;text-align:center;">
    <tr>
      <td align="center" valign="middle">
        <span style="font-size:20px;font-weight:800;color:#1e1b4b;letter-spacing:-0.4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          ${LOGO_SVG}CRM Lite
        </span>
      </td>
    </tr>
  </table>`;

const emailFooter = () => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #f1f5f9;padding-top:18px;text-align:center;">
    <tr>
      <td align="center" style="padding-bottom:8px;">
        <p style="margin:0;font-size:12.5px;color:#94a3b8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <span style="color:#6366f1;font-weight:700;">CRM Lite</span>
          &nbsp;•&nbsp; Powered by TechMantra Now
        </p>
      </td>
    </tr>
  </table>`;

const wrapEmail = (bodyHtml, accentTopRight = '#e0e7ff', accentBottomLeft = '#ede9fe') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>CRM Lite</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;min-height:100vh;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px -10px rgba(15,23,42,0.08);border:1px solid #f1f5f9;position:relative;max-width:520px;width:100%;">
          <!-- Top-right corner accent wave blob -->
          <tr>
            <td style="padding:0;height:0;line-height:0;">
              <div style="position:relative;height:0;overflow:visible;">
                <div style="position:absolute;top:-25px;right:-25px;width:120px;height:120px;background:${accentTopRight};border-radius:50%;opacity:0.65;z-index:0;"></div>
              </div>
            </td>
          </tr>
          <!-- Main Body Container -->
          <tr>
            <td style="padding:16px 36px 12px;position:relative;z-index:1;">
              ${emailHeader()}
              ${bodyHtml}
              ${emailFooter()}
            </td>
          </tr>
          <!-- Bottom-left corner accent wave blob -->
          <tr>
            <td style="padding:0;height:0;line-height:0;">
              <div style="position:relative;height:0;overflow:visible;">
                <div style="position:absolute;bottom:-25px;left:-25px;width:100px;height:100px;background:${accentBottomLeft};border-radius:50%;opacity:0.5;z-index:0;"></div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ─── Icon Badges & SVGs (with explicit XML namespaces for Gmail compatibility) ──

const iconCircle = (svgContent, bgColor) => `
  <table align="center" cellpadding="0" cellspacing="0" style="margin:16px auto 16px;border-collapse:collapse;">
    <tr>
      <td align="center" valign="middle" style="width:64px;height:64px;border-radius:50%;background:${bgColor};text-align:center;">
        ${svgContent}
      </td>
    </tr>
  </table>`;

const USER_PLUS_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto;">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <line x1="19" y1="8" x2="19" y2="14"/>
    <line x1="22" y1="11" x2="16" y2="11"/>
  </svg>`;

const LOCK_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto;">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>`;

const CHECK_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto;">
    <circle cx="12" cy="12" r="9" stroke="#16a34a" stroke-width="2" fill="none"/>
    <polyline points="8 12 11 15 16 9" stroke="#16a34a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

const RED_X_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto;">
    <line x1="18" y1="6" x2="6" y2="18" stroke="#ef4444"/>
    <line x1="6" y1="6" x2="18" y2="18" stroke="#ef4444"/>
  </svg>`;

const SHIELD_CHECK_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto;">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#6366f1" stroke-width="2"/>
    <path d="M9 12l2 2 4-4" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

const SPARKLE_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto;">
    <path d="M12 2v4m0 12v4M2 12h4m12 0h4m-3.8-6.2l-2.8 2.8m-6.8 6.8l-2.8 2.8m0-12.4l2.8 2.8m6.8 6.8l2.8 2.8" stroke="#16a34a" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

const INFO_ICON_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto;">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>`;

const RED_INFO_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto;">
    <circle cx="12" cy="12" r="10" stroke="#ef4444" stroke-width="2"/>
    <line x1="12" y1="8" x2="12" y2="12" stroke="#ef4444" stroke-width="2"/>
    <line x1="12" y1="16" x2="12.01" y2="16" stroke="#ef4444" stroke-width="2"/>
  </svg>`;

// ─── Info Row (used in admin notification) ────────────────────────────────────

const infoRow = (iconPath, label, value, isLink = false) => `
  <tr>
    <td style="padding:11px 16px;border-bottom:1px solid #f1f0fa;">
      <table cellpadding="0" cellspacing="0" width="100%"><tr>
        <td width="28" style="vertical-align:middle;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>
        </td>
        <td style="color:#64748b;font-size:13px;vertical-align:middle;width:130px;">${label}</td>
        <td style="font-size:13px;font-weight:600;color:${isLink ? '#6366f1' : '#1e293b'};vertical-align:middle;">${value}</td>
      </tr></table>
    </td>
  </tr>`;

// ─── Buttons ─────────────────────────────────────────────────────────────────

const primaryBtn = (text, url, bg = '#4f46e5') => `
  <table align="center" cellpadding="0" cellspacing="0" style="margin:24px auto 14px;text-align:center;">
    <tr>
      <td align="center" style="border-radius:10px;background:${bg};">
        <a href="${url}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`;

const outlineBtn = (text, url, color = '#6366f1') => `
  <table align="center" cellpadding="0" cellspacing="0" style="margin:20px auto 12px;text-align:center;">
    <tr>
      <td align="center" style="border-radius:10px;border:1.5px solid ${color};">
        <a href="${url}" style="display:inline-block;background:#ffffff;color:${color};text-decoration:none;padding:12px 30px;border-radius:10px;font-size:14px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`;

// ─── Notice Box ───────────────────────────────────────────────────────────────

const noticeBox = (svgElement, text, bg = '#f0f4ff', borderColor = '#e0e7ff') => `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:12px;border:1px solid ${borderColor};margin:22px 0 16px;border-collapse:collapse;">
    <tr>
      <td width="44" align="center" valign="middle" style="padding:14px 0 14px 16px;">
        ${svgElement}
      </td>
      <td style="padding:14px 16px 14px 4px;font-size:13.5px;color:#334155;font-weight:500;line-height:1.5;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        ${text}
      </td>
    </tr>
  </table>`;

// ─────────────────────────────────────────────────────────────────────────────

const emailService = {

  /**
   * Generic Send Email Method
   */
  sendEmail: async ({ to, subject, html, text }) => {
    try {
      const fromEmail = process.env.SMTP_FROM || 'CRM Lite <noreply@crmplatform.io>';

      // 1. SendGrid HTTP API
      if (process.env.SENDGRID_API_KEY) {
        let fromAddress = fromEmail;
        let fromName = 'CRM Lite';
        const match = fromEmail.match(/(.*)<(.*)>/);
        if (match) { fromName = match[1].trim(); fromAddress = match[2].trim(); }

        const toArray = Array.isArray(to) ? to : [to];
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.SENDGRID_API_KEY.trim()}` },
          body: JSON.stringify({
            personalizations: [{ to: toArray.map(e => ({ email: e.trim() })) }],
            from: { email: fromAddress, name: fromName },
            subject,
            content: [{ type: 'text/html', value: html }],
          }),
        });
        if (!res.ok) { const err = await res.text(); console.error('❌ SendGrid error:', err); return null; }
        console.log(`✅ [SENDGRID EMAIL DISPATCH SUCCESS] Sent to ${to}`);
        return { success: true };
      }

      // 2. Resend HTTP API
      if (process.env.RESEND_API_KEY) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
          body: JSON.stringify({ from: fromEmail, to: Array.isArray(to) ? to : [to], subject, html }),
        });
        const data = await res.json();
        if (!res.ok) { console.error('❌ Resend error:', data); return null; }
        console.log(`✅ [RESEND EMAIL DISPATCH SUCCESS] Sent to ${to}`);
        return data;
      }

      // 3. Nodemailer SMTP fallback
      const transporter = getTransporter();
      const info = await transporter.sendMail({ from: fromEmail, to, subject, html, text: text || html.replace(/<[^>]*>?/gm, '') });
      console.log(`✅ [SMTP EMAIL DISPATCH SUCCESS] Sent to ${to}`);
      return info;

    } catch (err) {
      console.error('❌ Failed to dispatch email:', err.message);
      return null;
    }
  },

  // ─── 1. NEW ACCESS REQUEST → Applicant Confirmation ─────────────────────────

  sendAccessRequestSubmittedEmail: async (toEmail, firstName, orgName) => {
    const body = `
      ${iconCircle(USER_PLUS_SVG, '#ede9fe')}
      <h2 style="text-align:center;margin:12px 0 16px;font-size:24px;color:#1e1b4b;font-weight:800;letter-spacing:-0.4px;">Access Request Received</h2>
      <p style="text-align:center;margin:0 0 20px;font-size:14px;color:#64748b;">Your request is under review by an administrator.</p>
      <p style="font-size:15px;color:#1e293b;margin:0 0 10px;text-align:left;">Hi <strong style="color:#6366f1;">${firstName}</strong>,</p>
      <p style="font-size:14.5px;color:#475569;line-height:1.65;margin:0 0 20px;text-align:left;">
        Your request to access <strong>${orgName}</strong> has been received and is currently pending admin review.
        You will receive an email once a decision has been made.
      </p>
      ${noticeBox(
        INFO_ICON_SVG,
        'Typical review time is within 24 hours. No action is needed from you right now.',
        '#f0f4ff', '#e0e7ff'
      )}`;
    return emailService.sendEmail({
      to: toEmail,
      subject: `Access Request Received — ${orgName}`,
      html: wrapEmail(body, '#c7d2fe', '#ddd6fe'),
    });
  },

  // ─── 2. NEW ACCESS REQUEST → Admin Action Email ────────────────────────────

  sendAdminNewRequestNotification: async (adminEmail, requesterName, requesterEmail, orgName, actionToken) => {
    const baseUrl = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const approveUrl = `${baseUrl}/auth/access-requests/action?token=${actionToken}&action=approve`;
    const rejectUrl  = `${baseUrl}/auth/access-requests/action?token=${actionToken}&action=reject`;
    const crmUrl     = `${clientUrl}/login`;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    console.log('\n==================================================');
    console.log(`📧 [EMAIL NOTIFICATION] Sent to Admin: ${adminEmail}`);
    console.log(`🟢 APPROVE LINK: ${approveUrl}`);
    console.log(`🔴 REJECT LINK : ${rejectUrl}`);
    console.log('==================================================\n');

    const body = `
      ${iconCircle(USER_PLUS_SVG, '#ede9fe')}
      <h2 style="text-align:center;margin:12px 0 16px;font-size:24px;color:#1e1b4b;font-weight:800;letter-spacing:-0.4px;">New Access Request</h2>
      <p style="text-align:center;margin:0 0 20px;font-size:13.5px;color:#64748b;">A new user has requested access to your CRM organization.</p>

      <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e8e7f5;border-radius:12px;overflow:hidden;margin-bottom:20px;">
        ${infoRow('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', 'Full Name', requesterName)}
        ${infoRow('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>', 'Email Address', `<a href="mailto:${requesterEmail}" style="color:#6366f1;text-decoration:none;">${requesterEmail}</a>`, true)}
        ${infoRow('<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>', 'Organization', orgName)}
        ${infoRow('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', 'Requested On', `${dateStr} &nbsp;•&nbsp; ${timeStr}`)}
      </table>

      <p style="font-size:13.5px;color:#64748b;margin:0 0 14px;text-align:left;">Review the request and choose an action.</p>

      <table cellpadding="0" cellspacing="0" width="100%"><tr>
        <td align="center" width="50%" style="padding-right:6px;">
          <a href="${approveUrl}" style="display:block;background:#16a34a;color:#ffffff;text-decoration:none;padding:13px 0;border-radius:10px;font-size:14px;font-weight:700;text-align:center;box-shadow:0 4px 12px rgba(22,163,74,0.25);">
            ✓ &nbsp;Approve Request
          </a>
        </td>
        <td align="center" width="50%" style="padding-left:6px;">
          <a href="${rejectUrl}" style="display:block;background:#ffffff;color:#dc2626;text-decoration:none;padding:12px 0;border-radius:10px;font-size:14px;font-weight:700;text-align:center;border:1.5px solid #dc2626;">
            ✕ &nbsp;Reject Request
          </a>
        </td>
      </tr></table>

      <p style="text-align:center;font-size:12.5px;color:#94a3b8;margin:16px 0 0;">
        ⏱ This request will expire in 7 days.
      </p>`;

    return emailService.sendEmail({
      to: adminEmail,
      subject: `New Access Request Pending Approval — ${orgName}`,
      html: wrapEmail(body, '#c7d2fe', '#ddd6fe'),
    });
  },

  // ─── 3. ACCESS APPROVED → Applicant Email (Matches Approved Design) ─────────

  sendAccessRequestApprovedEmail: async (toEmail, firstName, orgName) => {
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const loginUrl  = `${clientUrl}/login`;

    console.log('\n==================================================');
    console.log(`📧 [APPROVAL EMAIL] Sent to: ${toEmail}`);
    console.log(`🟢 LOGIN LINK: ${loginUrl}`);
    console.log('==================================================\n');

    const body = `
      ${iconCircle(CHECK_SVG, '#e6f4ea')}
      <h2 style="text-align:center;margin:12px 0 16px;font-size:24px;color:#047857;font-weight:800;letter-spacing:-0.4px;">Account Approved!</h2>
      <p style="font-size:15px;color:#1e293b;margin:18px 0 10px;text-align:left;">Hi <strong style="color:#6366f1;">${firstName}</strong>,</p>
      <p style="font-size:14.5px;color:#475569;line-height:1.65;margin:0 0 14px;text-align:left;">
        Your request for access has been approved by the administrator!<br/>
        You can now log in and access the platform using your credentials.
      </p>
      ${primaryBtn(`Sign In to CRM &nbsp;→`, loginUrl, '#4f46e5')}
      ${noticeBox(
        SPARKLE_SVG,
        "Welcome aboard! We're excited to have you on the team.",
        '#f0fdf4', '#dcfce7'
      )}`;

    return emailService.sendEmail({
      to: toEmail,
      subject: `Account Approved — ${orgName}`,
      html: wrapEmail(body, '#dcfce7', '#e0e7ff'),
    });
  },

  // ─── 4. ACCESS REJECTED → Applicant Email (Matches Declined Design Image) ──

  sendAccessRequestRejectedEmail: async (toEmail, firstName, orgName, reviewReason) => {
    const clientUrl   = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const contactUrl  = `${clientUrl}/contact`;

    const body = `
      ${iconCircle(RED_X_SVG, '#ffe4e6')}
      <h2 style="text-align:center;margin:12px 0 16px;font-size:24px;color:#b91c1c;font-weight:800;letter-spacing:-0.4px;">Access Request Declined</h2>
      <p style="font-size:15px;color:#1e293b;margin:18px 0 10px;text-align:left;">Hi <strong style="color:#6366f1;">${firstName || 'User'}</strong>,</p>
      <p style="font-size:14.5px;color:#475569;line-height:1.65;margin:0 0 14px;text-align:left;">
        Your request to access the CRM platform has been reviewed.<br/>
        Unfortunately, your administrator did not approve the request at this time.
      </p>
      ${reviewReason ? `<p style="font-size:13.5px;background:#fff7ed;border-left:3px solid #f97316;padding:11px 14px;border-radius:0 8px 8px 0;color:#9a3412;margin:14px 0;text-align:left;"><strong>Reason:</strong> ${reviewReason}</p>` : ''}
      ${noticeBox(
        RED_INFO_SVG,
        'If you believe this was unexpected, please reach out to your CRM administrator for more information.',
        '#fff1f2', '#ffe4e6'
      )}
      ${outlineBtn('Contact Administrator', contactUrl, '#6366f1')}`;

    return emailService.sendEmail({
      to: toEmail,
      subject: `Access Request Update — ${orgName}`,
      html: wrapEmail(body, '#ffe4e6', '#fee2e2'),
    });
  },

  // ─── 5. PASSWORD RESET → User Email (Matches Password Reset Design) ─────────

  sendPasswordResetEmail: async (toEmail, firstName, orgName, token) => {
    const clientUrl  = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl   = `${clientUrl}/login?resetToken=${token}`;

    console.log('\n==================================================');
    console.log(`📧 [PASSWORD RESET EMAIL] Sent to ${toEmail}`);
    console.log(`🟢 RESET LINK: ${resetUrl}`);
    console.log('==================================================\n');

    const body = `
      ${iconCircle(LOCK_SVG, '#ede9fe')}
      <h2 style="text-align:center;margin:12px 0 6px;font-size:24px;color:#1e1b4b;font-weight:800;letter-spacing:-0.4px;">Password Reset</h2>
      <p style="text-align:center;margin:0 0 22px;font-size:14px;color:#64748b;">We received a request to reset your password.</p>
      <p style="font-size:15px;color:#1e293b;margin:0 0 10px;text-align:left;">Hi <strong style="color:#6366f1;">${firstName || 'User'}</strong>,</p>
      <p style="font-size:14.5px;color:#475569;line-height:1.65;margin:0 0 20px;text-align:left;">
        Click the button below to set a new password for your CRM account.<br/>
        This link will expire in <strong style="color:#6366f1;">15 minutes</strong>.
      </p>
      ${primaryBtn('Reset Password', resetUrl, '#4f46e5')}
      ${noticeBox(
        SHIELD_CHECK_SVG,
        "If you didn't request this, you can safely ignore this email. Your password won't change.",
        '#f0f4ff', '#e0e7ff'
      )}`;

    return emailService.sendEmail({
      to: toEmail,
      subject: `Reset Your Password — ${orgName}`,
      html: wrapEmail(body, '#e0e7ff', '#ede9fe'),
    });
  },

};

module.exports = emailService;
