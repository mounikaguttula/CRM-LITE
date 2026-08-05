'use strict';
const nodemailer = require('nodemailer');

// ─── SVG → Base64 Data URI Helper ─────────────────────────────────────────────
// Uses Node.js Buffer to encode SVG strings so Gmail/Outlook render icons correctly.
const svgImg = (svgStr, w, h, alt = '') => {
  const b64 = Buffer.from(svgStr, 'utf8').toString('base64');
  return `<img src="data:image/svg+xml;base64,${b64}" width="${w}" height="${h}" alt="${alt}" border="0" style="display:block;outline:none;border:none;text-decoration:none;" />`;
};

// ─── Composite Badge: colored circle + icon, rendered as single <img> ──────────
const badgeIcon = (iconInnerSvg, circleFill, badgeSize = 68) => {
  const inner = iconInnerSvg
    .replace(/<svg[^>]*>/gi, '')
    .replace(/<\/svg>/gi, '')
    .trim();
  const scale = 2;
  const iconPx = 24 * scale; // = 48
  const offset = Math.round((badgeSize - iconPx) / 2); // = 10
  const composite = `<svg xmlns="http://www.w3.org/2000/svg" width="${badgeSize}" height="${badgeSize}" viewBox="0 0 ${badgeSize} ${badgeSize}"><circle cx="${badgeSize / 2}" cy="${badgeSize / 2}" r="${badgeSize / 2}" fill="${circleFill}"/><g transform="translate(${offset},${offset}) scale(${scale})">${inner}</g></svg>`;
  return `<table align="center" cellpadding="0" cellspacing="0" style="margin:20px auto 8px;border-collapse:collapse;"><tr><td align="center">${svgImg(composite, badgeSize, badgeSize, '')}</td></tr></table>`;
};

// Small inline badge for admin email horizontal header (icon left, title right)
const inlineBadgeIcon = (iconInnerSvg, circleFill, badgeSize = 52) => {
  const inner = iconInnerSvg
    .replace(/<svg[^>]*>/gi, '')
    .replace(/<\/svg>/gi, '')
    .trim();
  const iconPx = 28;
  const offset = Math.round((badgeSize - iconPx) / 2);
  const scale = iconPx / 24;
  const composite = `<svg xmlns="http://www.w3.org/2000/svg" width="${badgeSize}" height="${badgeSize}" viewBox="0 0 ${badgeSize} ${badgeSize}"><circle cx="${badgeSize / 2}" cy="${badgeSize / 2}" r="${badgeSize / 2}" fill="${circleFill}"/><g transform="translate(${offset},${offset}) scale(${scale})">${inner}</g></svg>`;
  return svgImg(composite, badgeSize, badgeSize, '');
};

// ─── SVG Icon Definitions ─────────────────────────────────────────────────────

const SVG_CUBE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="22.08" x2="12" y2="12" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const SVG_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#16a34a" stroke-width="2"/><polyline points="8 12 11 15 16 9" stroke="#16a34a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const SVG_XMARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/></svg>`;

const SVG_LOCK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#6366f1" stroke-width="2" fill="none"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/></svg>`;

const SVG_USER_PLUS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="7" r="4" stroke="#6366f1" stroke-width="2"/><line x1="19" y1="8" x2="19" y2="14" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="11" x2="16" y2="11" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/></svg>`;

const SVG_SHIELD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const SVG_SPARKLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M12 2v4m0 12v4M2 12h4m12 0h4m-3.8-6.2l-2.8 2.8m-6.8 6.8l-2.8 2.8m0-12.4l2.8 2.8m6.8 6.8l2.8 2.8" stroke="#16a34a" stroke-width="2" stroke-linecap="round"/></svg>`;

const SVG_INFO_BLUE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#6366f1" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1.2" fill="#6366f1"/></svg>`;

const SVG_INFO_RED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#ef4444" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1.2" fill="#ef4444"/></svg>`;

const SVG_CLOCK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#94a3b8" stroke-width="2"/><polyline points="12 6 12 12 16 14" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/></svg>`;

// Corner wave blobs rendered as positioned SVG images
const SVG_BLOB_PURPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 110"><ellipse cx="90" cy="20" rx="82" ry="72" fill="#e0e7ff" opacity="0.75"/></svg>`;
const SVG_BLOB_GREEN  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 110"><ellipse cx="90" cy="20" rx="82" ry="72" fill="#dcfce7" opacity="0.75"/></svg>`;
const SVG_BLOB_RED    = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 110"><ellipse cx="90" cy="20" rx="82" ry="72" fill="#fee2e2" opacity="0.75"/></svg>`;

// ─── Shared Layout Helpers ────────────────────────────────────────────────────

const emailLogo = () => `
  <table cellpadding="0" cellspacing="0" align="center" style="border-collapse:collapse;">
    <tr>
      <td valign="middle" align="center" style="line-height:0;padding-right:7px;">
        ${svgImg(SVG_CUBE, 26, 26, '')}
      </td>
      <td valign="middle" align="left">
        <b style="font-size:20px;color:#1e1b4b;font-family:Arial,Helvetica,sans-serif;font-weight:800;letter-spacing:-0.3px;line-height:1;">CRM Lite</b>
      </td>
    </tr>
  </table>`;

// Header row: [spacer | CRM Lite logo centered | corner blob right]
const emailHeader = (blobSvg = SVG_BLOB_PURPLE) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td width="90" valign="top" align="left" style="padding:0;font-size:0;line-height:0;">&nbsp;</td>
      <td align="center" valign="bottom" style="padding:24px 0 8px;">
        ${emailLogo()}
      </td>
      <td width="90" valign="top" align="right" style="padding:0;font-size:0;line-height:0;">
        ${svgImg(blobSvg, 90, 90, '')}
      </td>
    </tr>
  </table>`;

const emailFooter = () => `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f1f5f9;margin-top:24px;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:16px 0 10px;">
        <span style="font-size:12.5px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">
          <b style="color:#6366f1;font-family:Arial,Helvetica,sans-serif;">CRM Lite</b>
          &nbsp;•&nbsp; Powered by TechMantra Now
        </span>
      </td>
    </tr>
  </table>`;

const wrapEmail = (bodyHtml, blobSvg = SVG_BLOB_PURPLE) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CRM Lite</title>
</head>
<body style="margin:0;padding:0;background:#eef0fb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef0fb" style="padding:40px 16px;border-collapse:collapse;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#ffffff;border-radius:20px;box-shadow:0 8px 32px -8px rgba(15,23,42,0.10);max-width:520px;width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:0 36px 24px;border-radius:20px;overflow:hidden;">
              ${emailHeader(blobSvg)}
              ${bodyHtml}
              ${emailFooter()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ─── Info Row helper for Admin email table ─────────────────────────────────────
const infoRow = (iconInnerPath, label, value, isLink = false) => {
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconInnerPath}</svg>`;
  return `
  <tr>
    <td style="padding:11px 16px;border-bottom:1px solid #f1f0fa;">
      <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;"><tr>
        <td width="28" valign="middle" align="center" style="padding-right:4px;">${svgImg(iconSvg, 16, 16, '')}</td>
        <td valign="middle" style="color:#64748b;font-size:13px;width:130px;font-family:Arial,Helvetica,sans-serif;">${label}</td>
        <td valign="middle" style="font-size:13px;font-weight:bold;color:${isLink ? '#6366f1' : '#1e293b'};font-family:Arial,Helvetica,sans-serif;">${value}</td>
      </tr></table>
    </td>
  </tr>`;
};

// ─── Buttons ──────────────────────────────────────────────────────────────────
const primaryBtn = (text, url, bg = '#4f46e5') => `
  <table align="center" cellpadding="0" cellspacing="0" style="margin:22px auto 14px;border-collapse:collapse;">
    <tr>
      <td align="center" bgcolor="${bg}" style="border-radius:10px;background:${bg};">
        <a href="${url}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.2px;">${text}</a>
      </td>
    </tr>
  </table>`;

const outlineBtn = (text, url, color = '#6366f1') => `
  <table align="center" cellpadding="0" cellspacing="0" style="margin:20px auto 12px;border-collapse:collapse;">
    <tr>
      <td align="center" style="border-radius:10px;border:1.5px solid ${color};">
        <a href="${url}" style="display:inline-block;background:#ffffff;color:${color};text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">${text}</a>
      </td>
    </tr>
  </table>`;

// ─── Notice / Info Box ────────────────────────────────────────────────────────
const noticeBox = (iconSvgStr, text, bg = '#f0f4ff', textColor = '#334155') => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 14px;border-collapse:collapse;" bgcolor="${bg}">
    <tr>
      <td width="48" align="center" valign="middle" bgcolor="${bg}" style="padding:14px 4px 14px 14px;border-radius:12px 0 0 12px;">
        ${svgImg(iconSvgStr, 20, 20, '')}
      </td>
      <td bgcolor="${bg}" style="padding:14px 14px 14px 4px;font-size:13.5px;color:${textColor};line-height:1.55;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;border-radius:0 12px 12px 0;">
        ${text}
      </td>
    </tr>
  </table>`;

// ─────────────────────────────────────────────────────────────────────────────

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
  const cfg = isGmail
    ? { service: 'gmail', auth: { user, pass }, tls: { rejectUnauthorized: false } }
    : { host, port, secure: port === 465 || process.env.SMTP_SECURE === 'true', auth: { user, pass }, tls: { rejectUnauthorized: false } };
  return nodemailer.createTransport(cfg);
};

// ─────────────────────────────────────────────────────────────────────────────

const emailService = {

  sendEmail: async ({ to, subject, html, text }) => {
    try {
      const fromEmail = process.env.SMTP_FROM || 'CRM Lite <noreply@crmplatform.io>';

      if (process.env.SENDGRID_API_KEY) {
        let fromAddress = fromEmail, fromName = 'CRM Lite';
        const m = fromEmail.match(/(.*)<(.*)>/);
        if (m) { fromName = m[1].trim(); fromAddress = m[2].trim(); }
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
        console.log(`✅ [SENDGRID] Sent to ${to}`);
        return { success: true };
      }

      if (process.env.RESEND_API_KEY) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
          body: JSON.stringify({ from: fromEmail, to: Array.isArray(to) ? to : [to], subject, html }),
        });
        const data = await res.json();
        if (!res.ok) { console.error('❌ Resend error:', data); return null; }
        console.log(`✅ [RESEND] Sent to ${to}`);
        return data;
      }

      const transporter = getTransporter();
      const info = await transporter.sendMail({ from: fromEmail, to, subject, html, text: text || html.replace(/<[^>]*>?/gm, '') });
      console.log(`✅ [SMTP] Sent to ${to}`);
      return info;

    } catch (err) {
      console.error('❌ Email send failed:', err.message);
      return null;
    }
  },

  // ─── 1. ACCESS REQUEST SUBMITTED → Applicant Confirmation ─────────────────

  sendAccessRequestSubmittedEmail: async (toEmail, firstName, orgName) => {
    const body = `
      ${badgeIcon(SVG_USER_PLUS, '#ede9fe')}
      <h2 style="text-align:center;margin:12px 0 6px;font-size:24px;color:#1e1b4b;font-weight:800;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.4px;">Access Request Received</h2>
      <p style="text-align:center;margin:0 0 22px;font-size:14px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">Your request is under review by an administrator.</p>
      <p style="font-size:15px;color:#1e293b;margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;">Hi <b style="color:#6366f1;font-family:Arial,Helvetica,sans-serif;">${firstName}</b>,</p>
      <p style="font-size:14.5px;color:#475569;line-height:1.65;margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;">
        Your request to access <b>${orgName}</b> has been received and is currently pending admin review.
        You will receive an email once a decision has been made.
      </p>
      ${noticeBox(SVG_INFO_BLUE, 'Typical review time is within 24 hours. No action is needed from you right now.', '#f0f4ff', '#334155')}`;

    return emailService.sendEmail({
      to: toEmail,
      subject: `Access Request Received — ${orgName}`,
      html: wrapEmail(body, SVG_BLOB_PURPLE),
    });
  },

  // ─── 2. NEW ACCESS REQUEST → Admin Action Email ────────────────────────────

  sendAdminNewRequestNotification: async (adminEmail, requesterName, requesterEmail, orgName, actionToken) => {
    const baseUrl   = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
    const clientUrl = (process.env.CLIENT_URL  || 'http://localhost:3000').replace(/\/$/, '');
    const approveUrl = `${baseUrl}/auth/access-requests/action?token=${actionToken}&action=approve`;
    const rejectUrl  = `${baseUrl}/auth/access-requests/action?token=${actionToken}&action=reject`;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    console.log('\n==================================================');
    console.log(`📧 [ADMIN EMAIL] Sent to: ${adminEmail}`);
    console.log(`🟢 APPROVE: ${approveUrl}`);
    console.log(`🔴 REJECT : ${rejectUrl}`);
    console.log('==================================================\n');

    const body = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 22px;border-collapse:collapse;">
        <tr>
          <td width="60" valign="middle" align="center">
            ${inlineBadgeIcon(SVG_USER_PLUS, '#ede9fe', 52)}
          </td>
          <td valign="middle" style="padding-left:14px;">
            <h2 style="margin:0 0 4px;font-size:22px;color:#1e1b4b;font-weight:800;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">New Access Request</h2>
            <p style="margin:0;font-size:13.5px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">A new user has requested access to your CRM organization.</p>
          </td>
        </tr>
      </table>

      <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e8e7f5;border-radius:12px;overflow:hidden;margin-bottom:20px;border-collapse:collapse;">
        ${infoRow('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', 'Full Name', requesterName)}
        ${infoRow('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>', 'Email Address', `<a href="mailto:${requesterEmail}" style="color:#6366f1;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${requesterEmail}</a>`, true)}
        ${infoRow('<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>', 'Organization', orgName)}
        ${infoRow('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', 'Requested On', `${dateStr} &nbsp;•&nbsp; ${timeStr}`)}
      </table>

      <p style="font-size:13.5px;color:#64748b;margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;">Review the request and choose an action.</p>

      <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;"><tr>
        <td align="center" width="50%" style="padding-right:6px;">
          <a href="${approveUrl}" style="display:block;background:#16a34a;color:#ffffff;text-decoration:none;padding:13px 0;border-radius:10px;font-size:14px;font-weight:bold;text-align:center;font-family:Arial,Helvetica,sans-serif;">
            &#10003;&nbsp; Approve Request
          </a>
        </td>
        <td align="center" width="50%" style="padding-left:6px;">
          <a href="${rejectUrl}" style="display:block;background:#ffffff;color:#dc2626;text-decoration:none;padding:12px 0;border-radius:10px;font-size:14px;font-weight:bold;text-align:center;border:1.5px solid #dc2626;font-family:Arial,Helvetica,sans-serif;">
            &#10005;&nbsp; Reject Request
          </a>
        </td>
      </tr></table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-collapse:collapse;">
        <tr>
          <td align="center">
            <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;" align="center">
              <tr>
                <td valign="middle" style="padding-right:5px;line-height:0;">${svgImg(SVG_CLOCK, 14, 14, '')}</td>
                <td valign="middle" style="font-size:12.5px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">This request will expire in 7 days.</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;

    return emailService.sendEmail({
      to: adminEmail,
      subject: `New Access Request Pending Approval — ${orgName}`,
      html: wrapEmail(body, SVG_BLOB_PURPLE),
    });
  },

  // ─── 3. ACCESS APPROVED → Applicant Email ─────────────────────────────────

  sendAccessRequestApprovedEmail: async (toEmail, firstName, orgName) => {
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const loginUrl  = `${clientUrl}/login`;

    console.log('\n==================================================');
    console.log(`📧 [APPROVAL EMAIL] Sent to: ${toEmail}`);
    console.log(`🟢 LOGIN: ${loginUrl}`);
    console.log('==================================================\n');

    const body = `
      ${badgeIcon(SVG_CHECK, '#dcfce7')}
      <h2 style="text-align:center;margin:12px 0 16px;font-size:26px;color:#16a34a;font-weight:800;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.4px;">Account Approved!</h2>
      <p style="font-size:15px;color:#1e293b;margin:18px 0 10px;font-family:Arial,Helvetica,sans-serif;">Hi <b style="color:#6366f1;font-family:Arial,Helvetica,sans-serif;">${firstName}</b>,</p>
      <p style="font-size:14.5px;color:#475569;line-height:1.65;margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;">
        Your request for access has been approved by the administrator!<br/>
        You can now log in and access the platform using your credentials.
      </p>
      ${primaryBtn('Sign In to CRM &nbsp;&rarr;', loginUrl, '#4f46e5')}
      ${noticeBox(SVG_SPARKLE, "Welcome aboard! We're excited to have you on the team.", '#f0fdf4', '#166534')}`;

    return emailService.sendEmail({
      to: toEmail,
      subject: `Account Approved — ${orgName}`,
      html: wrapEmail(body, SVG_BLOB_GREEN),
    });
  },

  // ─── 4. ACCESS DECLINED → Applicant Email ─────────────────────────────────

  sendAccessRequestRejectedEmail: async (toEmail, firstName, orgName, reviewReason) => {
    const clientUrl  = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const contactUrl = `${clientUrl}/contact`;

    const body = `
      ${badgeIcon(SVG_XMARK, '#fee2e2')}
      <h2 style="text-align:center;margin:12px 0 16px;font-size:24px;color:#b91c1c;font-weight:800;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.4px;">Access Request Declined</h2>
      <p style="font-size:15px;color:#1e293b;margin:18px 0 10px;font-family:Arial,Helvetica,sans-serif;">Hi <b style="color:#6366f1;font-family:Arial,Helvetica,sans-serif;">${firstName || 'User'}</b>,</p>
      <p style="font-size:14.5px;color:#475569;line-height:1.65;margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;">
        Your request to access the CRM platform has been reviewed.<br/>
        Unfortunately, your administrator did not approve the request at this time.
      </p>
      ${reviewReason ? `<p style="font-size:13.5px;background:#fff7ed;border-left:3px solid #f97316;padding:11px 14px;border-radius:0 8px 8px 0;color:#9a3412;margin:14px 0;text-align:left;font-family:Arial,Helvetica,sans-serif;"><b>Reason:</b> ${reviewReason}</p>` : ''}
      ${noticeBox(SVG_INFO_RED, 'If you believe this was unexpected, please reach out to your CRM administrator for more information.', '#fff1f2', '#991b1b')}
      ${outlineBtn('Contact Administrator', contactUrl, '#6366f1')}`;

    return emailService.sendEmail({
      to: toEmail,
      subject: `Access Request Update — ${orgName}`,
      html: wrapEmail(body, SVG_BLOB_RED),
    });
  },

  // ─── 5. PASSWORD RESET → User Email ───────────────────────────────────────

  sendPasswordResetEmail: async (toEmail, firstName, orgName, token) => {
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl  = `${clientUrl}/login?resetToken=${token}`;

    console.log('\n==================================================');
    console.log(`📧 [PASSWORD RESET EMAIL] Sent to ${toEmail}`);
    console.log(`🟢 RESET LINK: ${resetUrl}`);
    console.log('==================================================\n');

    const body = `
      ${badgeIcon(SVG_LOCK, '#ede9fe')}
      <h2 style="text-align:center;margin:12px 0 6px;font-size:24px;color:#1e1b4b;font-weight:800;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.4px;">Password Reset</h2>
      <p style="text-align:center;margin:0 0 22px;font-size:14px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">We received a request to reset your password.</p>
      <p style="font-size:15px;color:#1e293b;margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;">Hi <b style="color:#6366f1;font-family:Arial,Helvetica,sans-serif;">${firstName || 'User'}</b>,</p>
      <p style="font-size:14.5px;color:#475569;line-height:1.65;margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;">
        Click the button below to set a new password for your CRM account.<br/>
        This link will expire in <b style="color:#6366f1;font-family:Arial,Helvetica,sans-serif;">15 minutes</b>.
      </p>
      ${primaryBtn('Reset Password', resetUrl, '#4f46e5')}
      ${noticeBox(SVG_SHIELD, "If you didn't request this, you can safely ignore this email. Your password won't change.", '#f0f4ff', '#334155')}`;

    return emailService.sendEmail({
      to: toEmail,
      subject: `Reset Your Password — ${orgName}`,
      html: wrapEmail(body, SVG_BLOB_PURPLE),
    });
  },

};

module.exports = emailService;
