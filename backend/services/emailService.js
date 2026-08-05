const nodemailer = require('nodemailer');

/**
 * Reusable Centralized Email Service
 * Handles SMTP email notifications across the platform.
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
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:6px;">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="12" y1="22.08" x2="12" y2="12" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

const emailHeader = () => `
  <div style="text-align:center;padding:28px 0 18px;">
    <span style="font-size:17px;font-weight:700;color:#1e1b4b;letter-spacing:-0.3px;">
      ${LOGO_SVG}CRM Lite
    </span>
  </div>`;

const emailFooter = () => `
  <div style="text-align:center;padding:24px 0 8px;border-top:1px solid #e8e7f5;margin-top:24px;">
    <p style="margin:0;font-size:12px;color:#94a3b8;">
      <span style="color:#4f46e5;font-weight:600;">CRM Lite</span>
      &nbsp;•&nbsp; Powered by TechMantra Now
    </p>
  </div>`;

const wrapEmail = (bodyHtml, accentTopRight = '#c7d2fe', accentBottomLeft = '#ddd6fe') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>CRM Lite</title>
</head>
<body style="margin:0;padding:0;background:#eef0fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef0fb;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(79,70,229,0.08);position:relative;max-width:520px;width:100%;">
          <!-- Top-right accent blob -->
          <tr><td style="padding:0;height:0;line-height:0;">
            <div style="position:relative;height:0;">
              <div style="position:absolute;top:-20px;right:-20px;width:110px;height:110px;background:${accentTopRight};border-radius:50%;opacity:0.5;z-index:0;"></div>
            </div>
          </td></tr>
          <!-- Body -->
          <tr>
            <td style="padding:0 36px 8px;position:relative;z-index:1;">
              ${emailHeader()}
              ${bodyHtml}
              ${emailFooter()}
            </td>
          </tr>
          <!-- Bottom-left accent blob -->
          <tr><td style="padding:0;height:24px;line-height:0;">
            <div style="position:relative;height:0;">
              <div style="position:absolute;bottom:-30px;left:-30px;width:90px;height:90px;background:${accentBottomLeft};border-radius:50%;opacity:0.4;z-index:0;"></div>
            </div>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ─── Icon Circles ─────────────────────────────────────────────────────────────

const iconCircle = (svgPath, bgColor, iconColor) => `
  <div style="text-align:center;margin:8px 0 20px;">
    <div style="display:inline-flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:50%;background:${bgColor};">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${svgPath}
      </svg>
    </div>
  </div>`;

const USER_PLUS_ICON = `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>`;
const LOCK_ICON    = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`;
const CHECK_ICON   = `<circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>`;
const X_ICON       = `<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>`;

// ─── Info Row (used in admin notification) ────────────────────────────────────

const infoRow = (iconPath, label, value, isLink = false) => `
  <tr>
    <td style="padding:11px 16px;border-bottom:1px solid #f1f0fa;">
      <table cellpadding="0" cellspacing="0" width="100%"><tr>
        <td width="28" style="vertical-align:middle;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>
        </td>
        <td style="color:#64748b;font-size:13px;vertical-align:middle;width:130px;">${label}</td>
        <td style="font-size:13px;font-weight:600;color:${isLink ? '#4f46e5' : '#1e293b'};vertical-align:middle;">${value}</td>
      </tr></table>
    </td>
  </tr>`;

// ─── Primary Button ───────────────────────────────────────────────────────────

const primaryBtn = (text, url, bg = '#4f46e5') => `
  <div style="text-align:center;margin:24px 0 8px;">
    <a href="${url}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.2px;">
      ${text}
    </a>
  </div>`;

const outlineBtn = (text, url, color = '#4f46e5') => `
  <div style="text-align:center;margin:12px 0 8px;">
    <a href="${url}" style="display:inline-block;background:#ffffff;color:${color};text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;border:1.5px solid ${color};">
      ${text}
    </a>
  </div>`;

// ─── Notice Box ───────────────────────────────────────────────────────────────

const noticeBox = (iconPath, text, bg = '#f0f0ff', iconColor = '#4f46e5') => `
  <div style="background:${bg};border-radius:8px;padding:14px 16px;margin:20px 0 8px;display:flex;">
    <table cellpadding="0" cellspacing="0" width="100%"><tr>
      <td width="28" style="vertical-align:middle;padding-right:10px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>
      </td>
      <td style="font-size:13px;color:#475569;vertical-align:middle;line-height:1.55;">${text}</td>
    </tr></table>
  </div>`;

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

  // ─── 1. NEW ACCESS REQUEST → Admin Notification ────────────────────────────

  sendAccessRequestSubmittedEmail: async (toEmail, firstName, orgName) => {
    const body = `
      ${iconCircle(USER_PLUS_ICON, '#ede9fe', '#4f46e5')}
      <h2 style="text-align:center;margin:0 0 6px;font-size:20px;color:#1e1b4b;font-weight:700;">Access Request Received</h2>
      <p style="text-align:center;margin:0 0 20px;font-size:14px;color:#64748b;">Your request is under review by an administrator.</p>
      <p style="font-size:14px;color:#1e293b;margin:0 0 8px;">Hi <strong>${firstName}</strong>,</p>
      <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px;">
        Your request to access <strong>${orgName}</strong> has been received and is currently pending admin review.
        You will receive an email once a decision has been made.
      </p>
      ${noticeBox(
        '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
        'Typical review time is within 24 hours. No action is needed from you right now.',
        '#f0f0ff', '#4f46e5'
      )}`;
    return emailService.sendEmail({
      to: toEmail,
      subject: `Access Request Received — ${orgName}`,
      html: wrapEmail(body),
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
      ${iconCircle(USER_PLUS_ICON, '#ede9fe', '#4f46e5')}
      <h2 style="text-align:center;margin:0 0 6px;font-size:20px;color:#1e1b4b;font-weight:700;">New Access Request</h2>
      <p style="text-align:center;margin:0 0 20px;font-size:13px;color:#64748b;">A new user has requested access to your CRM organization.</p>

      <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e8e7f5;border-radius:10px;overflow:hidden;margin-bottom:20px;">
        ${infoRow('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', 'Full Name', requesterName)}
        ${infoRow('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>', 'Email Address', `<a href="mailto:${requesterEmail}" style="color:#4f46e5;text-decoration:none;">${requesterEmail}</a>`, true)}
        ${infoRow('<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>', 'Organization', orgName)}
        ${infoRow('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', 'Requested On', `${dateStr} &nbsp;•&nbsp; ${timeStr}`)}
      </table>

      <p style="font-size:13px;color:#64748b;margin:0 0 14px;">Review the request and choose an action.</p>

      <table cellpadding="0" cellspacing="0" width="100%"><tr>
        <td align="center" width="50%" style="padding-right:6px;">
          <a href="${approveUrl}" style="display:block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 0;border-radius:8px;font-size:14px;font-weight:600;text-align:center;">
            ✓ &nbsp;Review Request
          </a>
        </td>
        <td align="center" width="50%" style="padding-left:6px;">
          <a href="${crmUrl}" style="display:block;background:#ffffff;color:#4f46e5;text-decoration:none;padding:12px 0;border-radius:8px;font-size:14px;font-weight:600;text-align:center;border:1.5px solid #4f46e5;">
            View in CRM
          </a>
        </td>
      </tr></table>

      <p style="text-align:center;font-size:12px;color:#94a3b8;margin:14px 0 0;">
        ⏱ This request will expire in 7 days.
      </p>`;

    return emailService.sendEmail({
      to: adminEmail,
      subject: `New Access Request Pending Approval — ${orgName}`,
      html: wrapEmail(body, '#c7d2fe', '#ddd6fe'),
    });
  },

  // ─── 3. ACCESS APPROVED → Applicant Email ─────────────────────────────────

  sendAccessRequestApprovedEmail: async (toEmail, firstName, orgName) => {
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const loginUrl  = `${clientUrl}/login`;

    console.log('\n==================================================');
    console.log(`📧 [APPROVAL EMAIL] Sent to: ${toEmail}`);
    console.log(`🟢 LOGIN LINK: ${loginUrl}`);
    console.log('==================================================\n');

    const body = `
      ${iconCircle(CHECK_ICON, '#dcfce7', '#16a34a')}
      <h2 style="text-align:center;margin:0 0 6px;font-size:22px;color:#15803d;font-weight:700;">Account Approved!</h2>
      <p style="font-size:14px;color:#1e293b;margin:16px 0 8px;">Hi <strong>${firstName}</strong>,</p>
      <p style="font-size:14px;color:#475569;line-height:1.65;margin:0 0 8px;">
        Your request for access has been approved by the administrator!<br/>
        You can now log in and access the platform using your credentials.
      </p>
      ${primaryBtn(`Sign In to ${orgName} &nbsp;→`, loginUrl, '#4f46e5')}
      ${noticeBox(
        '<polyline points="23 7 13.5 15.5 8.5 10.5 1 17"/><polyline points="17 7 23 7 23 13"/>',
        "Welcome aboard! We're excited to have you on the team.",
        '#f0fdf4', '#16a34a'
      )}`;

    return emailService.sendEmail({
      to: toEmail,
      subject: `Account Approved — ${orgName}`,
      html: wrapEmail(body, '#bbf7d0', '#a7f3d0'),
    });
  },

  // ─── 4. ACCESS REJECTED → Applicant Email ─────────────────────────────────

  sendAccessRequestRejectedEmail: async (toEmail, firstName, orgName, reviewReason) => {
    const clientUrl   = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const contactUrl  = `${clientUrl}/contact`;

    const body = `
      ${iconCircle(X_ICON, '#fee2e2', '#dc2626')}
      <h2 style="text-align:center;margin:0 0 6px;font-size:20px;color:#b91c1c;font-weight:700;">Access Request Declined</h2>
      <p style="font-size:14px;color:#1e293b;margin:16px 0 8px;">Hi <strong>${firstName}</strong>,</p>
      <p style="font-size:14px;color:#475569;line-height:1.65;margin:0 0 8px;">
        Your request to access the CRM platform has been reviewed.<br/>
        Unfortunately, your administrator did not approve the request at this time.
      </p>
      ${reviewReason ? `<p style="font-size:13px;background:#fff7ed;border-left:3px solid #f97316;padding:10px 14px;border-radius:0 6px 6px 0;color:#9a3412;margin:12px 0;"><strong>Reason:</strong> ${reviewReason}</p>` : ''}
      ${noticeBox(
        '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
        'If you believe this was unexpected, please reach out to your CRM administrator for more information.',
        '#fff1f2', '#dc2626'
      )}
      ${outlineBtn('Contact Administrator', contactUrl, '#4f46e5')}`;

    return emailService.sendEmail({
      to: toEmail,
      subject: `Access Request Update — ${orgName}`,
      html: wrapEmail(body, '#fecaca', '#fca5a5'),
    });
  },

  // ─── 5. PASSWORD RESET → User Email ───────────────────────────────────────

  sendPasswordResetEmail: async (toEmail, firstName, orgName, token) => {
    const clientUrl  = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl   = `${clientUrl}/login?resetToken=${token}`;

    console.log('\n==================================================');
    console.log(`📧 [PASSWORD RESET EMAIL] Sent to ${toEmail}`);
    console.log(`🟢 RESET LINK: ${resetUrl}`);
    console.log('==================================================\n');

    const body = `
      ${iconCircle(LOCK_ICON, '#ede9fe', '#4f46e5')}
      <h2 style="text-align:center;margin:0 0 6px;font-size:20px;color:#1e1b4b;font-weight:700;">Password Reset</h2>
      <p style="text-align:center;margin:0 0 20px;font-size:13px;color:#64748b;">We received a request to reset your password.</p>
      <p style="font-size:14px;color:#1e293b;margin:0 0 6px;">Hi <strong>${firstName}</strong>,</p>
      <p style="font-size:14px;color:#475569;line-height:1.65;margin:0 0 20px;">
        Click the button below to set a new password for your CRM account.<br/>
        This link will expire in <strong style="color:#dc2626;">15 minutes</strong>.
      </p>
      ${primaryBtn('Reset Password', resetUrl, '#4f46e5')}
      ${noticeBox(
        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
        "If you didn't request this, you can safely ignore this email. Your password won't change.",
        '#f0f0ff', '#4f46e5'
      )}`;

    return emailService.sendEmail({
      to: toEmail,
      subject: `Reset Your Password — ${orgName}`,
      html: wrapEmail(body, '#c7d2fe', '#ddd6fe'),
    });
  },

};

module.exports = emailService;
