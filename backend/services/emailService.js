'use strict';
const nodemailer = require('nodemailer');

/**
 * CRM Lite Email Service
 *
 * All icons are hosted as static SVG files at BACKEND_URL/email-assets/*
 * so they render correctly in Gmail, Outlook, and Apple Mail.
 * (Gmail blocks data: URIs — hosted URLs are the only reliable solution.)
 */

// ─── Asset URL Builder ────────────────────────────────────────────────────────
const assetUrl = (filename) => {
  const base = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
  return `${base}/email-assets/${filename}`;
};

// ─── Shared HTML Helpers ──────────────────────────────────────────────────────

/** Hosted-image <img> tag */
const img = (filename, w, h, alt = '') =>
  `<img src="${assetUrl(filename)}" width="${w}" height="${h}" alt="${alt}" border="0" style="display:block;outline:none;border:none;text-decoration:none;" />`;

/** CRM Lite logo: cube icon + "CRM Lite" text, centered */
const logoRow = () => `
  <table cellpadding="0" cellspacing="0" align="center" style="border-collapse:collapse;">
    <tr>
      <td valign="middle" align="center" style="line-height:0;padding-right:7px;">
        ${img('cube.svg', 26, 26, '')}
      </td>
      <td valign="middle" align="left">
        <b style="font-size:20px;color:#1e1b4b;font-family:Arial,Helvetica,sans-serif;font-weight:800;letter-spacing:-0.3px;line-height:1;">CRM Lite</b>
      </td>
    </tr>
  </table>`;

/**
 * Email header: 3-column table
 *   [empty spacer] | [CRM Lite logo centered] | [wave corner img]
 * waveSvg = filename of the wave SVG e.g. 'wave-purple.svg'
 */
const emailHeader = (waveSvg = 'wave-purple.svg') => `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td width="110" valign="top" align="left" style="padding:0;font-size:0;line-height:0;">&nbsp;</td>
      <td align="center" valign="bottom" style="padding:24px 0 8px;">
        ${logoRow()}
      </td>
      <td width="110" valign="top" align="right" style="padding:0;font-size:0;line-height:0;">
        ${img(waveSvg, 110, 110, '')}
      </td>
    </tr>
  </table>`;

/** Centered badge icon (68×68 SVG with colored circle + icon already drawn inside) */
const badgeRow = (badgeSvg) => `
  <table align="center" cellpadding="0" cellspacing="0" style="margin:16px auto 10px;border-collapse:collapse;">
    <tr>
      <td align="center">${img(badgeSvg, 68, 68, '')}</td>
    </tr>
  </table>`;

/** Notice / info box with icon on left */
const noticeBox = (iconSvg, text, bg = '#f0f4ff', textColor = '#334155') => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 14px;border-collapse:collapse;" bgcolor="${bg}">
    <tr>
      <td width="48" align="center" valign="middle" bgcolor="${bg}" style="padding:14px 4px 14px 14px;">
        ${img(iconSvg, 20, 20, '')}
      </td>
      <td bgcolor="${bg}" style="padding:14px 14px 14px 4px;font-size:13.5px;color:${textColor};line-height:1.55;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;">
        ${text}
      </td>
    </tr>
  </table>`;

/** Solid primary button */
const primaryBtn = (text, url, bg = '#4f46e5') => `
  <table align="center" cellpadding="0" cellspacing="0" style="margin:22px auto 14px;border-collapse:collapse;">
    <tr>
      <td align="center" bgcolor="${bg}" style="border-radius:10px;background:${bg};">
        <a href="${url}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.2px;">${text}</a>
      </td>
    </tr>
  </table>`;

/** Outline button */
const outlineBtn = (text, url, color = '#6366f1') => `
  <table align="center" cellpadding="0" cellspacing="0" style="margin:20px auto 12px;border-collapse:collapse;">
    <tr>
      <td align="center" style="border-radius:10px;border:1.5px solid ${color};">
        <a href="${url}" style="display:inline-block;background:#ffffff;color:${color};text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">${text}</a>
      </td>
    </tr>
  </table>`;

/** One info row inside the admin table */
const infoRow = (rowIconSvg, label, value, isLink = false) => `
  <tr>
    <td style="padding:11px 16px;border-bottom:1px solid #f1f0fa;">
      <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;"><tr>
        <td width="28" valign="middle" align="center" style="padding-right:4px;">${img(rowIconSvg, 16, 16, '')}</td>
        <td valign="middle" style="color:#64748b;font-size:13px;width:130px;font-family:Arial,Helvetica,sans-serif;">${label}</td>
        <td valign="middle" style="font-size:13px;font-weight:bold;color:${isLink ? '#6366f1' : '#1e293b'};font-family:Arial,Helvetica,sans-serif;">${value}</td>
      </tr></table>
    </td>
  </tr>`;

/** Clean compact "Need help?" UI component matching modern email design */
const needHelpSection = (customContactEmail = null) => {
  const rawEmail = customContactEmail || process.env.SUPPORT_EMAIL || 'mounika@csnow.io';
  const cleanEmail = rawEmail.includes('<') ? rawEmail.match(/<(.*)>/)[1].trim() : rawEmail.trim();

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 12px;border-top:1px solid #f1f5f9;padding-top:16px;border-collapse:collapse;">
    <tr>
      <td width="36" valign="middle" style="padding-right:10px;">
        <table cellpadding="0" cellspacing="0" style="width:32px;height:32px;border-radius:50%;background:#eef2ff;border-collapse:collapse;" bgcolor="#eef2ff">
          <tr>
            <td align="center" valign="middle" style="height:32px;text-align:center;font-size:15px;color:#6366f1;line-height:1;font-family:Arial,sans-serif;">
              ✉
            </td>
          </tr>
        </table>
      </td>
      <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#475569;line-height:1.5;">
        Have queries? Contact us: <a href="mailto:${cleanEmail}" style="color:#4f46e5;font-weight:700;text-decoration:none;">${cleanEmail}</a>
      </td>
    </tr>
  </table>`;
};

/** Email footer */
const emailFooter = () => `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f1f5f9;margin-top:16px;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:14px 0 10px;">
        <span style="font-size:12.5px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">
          <b style="color:#6366f1;font-family:Arial,Helvetica,sans-serif;">CRM Lite</b>
          &nbsp;&bull;&nbsp; Powered by TechMantra Now
        </span>
      </td>
    </tr>
  </table>`;

/** Wraps body HTML in white card on light background */
const wrapEmail = (bodyHtml, waveSvg = 'wave-purple.svg', customContactEmail = null) => {
  const hasNeedHelp = bodyHtml.includes('Have queries?') || bodyHtml.includes('Need help?') || bodyHtml.includes('Need help') || bodyHtml.includes('mounika@csnow.io');
  const helpHtml = hasNeedHelp ? '' : needHelpSection(customContactEmail);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>CRM Lite</title>
</head>
<body style="margin:0;padding:0;background:#eef0fb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef0fb" style="padding:40px 16px;border-collapse:collapse;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#ffffff;border-radius:20px;box-shadow:0 8px 32px -8px rgba(15,23,42,0.10);max-width:520px;width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:0 36px 24px;border-radius:20px;">
              ${emailHeader(waveSvg)}
              ${bodyHtml}
              ${helpHtml}
              ${emailFooter()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// ─── SMTP / SendGrid / Resend transporter ────────────────────────────────────

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const rawPass = process.env.SMTP_PASS;
  const pass = rawPass ? rawPass.replace(/\s+/g, '') : '';

  if (!host || !user || !pass) {
    return {
      sendMail: async (opts) => {
        console.log('✉️ [MOCK EMAIL] SMTP not configured. Suppressed:');
        console.log(`   To: ${opts.to}  |  Subject: ${opts.subject}`);
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

  sendEmail: async ({ to, subject, html, text, replyTo }) => {
    try {
      const fromEmail = process.env.SMTP_FROM || 'CRM Lite <noreply@crmplatform.io>';

      // ── SendGrid ──────────────────────────────────────────────────────────
      if (process.env.SENDGRID_API_KEY) {
        let fromAddress = fromEmail, fromName = 'CRM Lite';
        const m = fromEmail.match(/(.*)<(.*)>/);
        if (m) { fromName = m[1].trim(); fromAddress = m[2].trim(); }
        const toArray = Array.isArray(to) ? to : [to];

        const sgBody = {
          personalizations: [{ to: toArray.map(e => ({ email: e.trim() })) }],
          from: { email: fromAddress, name: fromName },
          subject,
          content: [{ type: 'text/html', value: html }],
        };

        if (replyTo) {
          let rAddress = replyTo, rName = 'Support Team';
          const rm = replyTo.match(/(.*)<(.*)>/);
          if (rm) { rName = rm[1].trim(); rAddress = rm[2].trim(); }
          sgBody.reply_to = { email: rAddress, name: rName };
        }

        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.SENDGRID_API_KEY.trim()}`,
          },
          body: JSON.stringify(sgBody),
        });
        if (!res.ok) { const err = await res.text(); console.error('❌ SendGrid error:', err); return null; }
        console.log(`✅ [SENDGRID] Sent to ${to}`);
        return { success: true };
      }

      // ── Resend ────────────────────────────────────────────────────────────
      if (process.env.RESEND_API_KEY) {
        const resendPayload = {
          from: fromEmail,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
        };
        if (replyTo) {
          resendPayload.reply_to = replyTo;
        }

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
          body: JSON.stringify(resendPayload),
        });
        const data = await res.json();
        if (!res.ok) { console.error('❌ Resend error:', data); return null; }
        console.log(`✅ [RESEND] Sent to ${to}`);
        return data;
      }

      // ── SMTP ──────────────────────────────────────────────────────────────
      const transporter = getTransporter();
      const mailOpts = {
        from: fromEmail,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>?/gm, ''),
      };
      if (replyTo) {
        mailOpts.replyTo = replyTo;
      }

      const info = await transporter.sendMail(mailOpts);
      console.log(`✅ [SMTP] Sent to ${to}`);
      return info;

    } catch (err) {
      console.error('❌ Email send failed:', err.message);
      return null;
    }
  },

  // ─── 1. ACCESS REQUEST SUBMITTED → Applicant Confirmation ───────────────

  sendAccessRequestSubmittedEmail: async (toEmail, firstName, orgName) => {
    const body = `
      ${badgeRow('badge-user-plus.svg')}
      <h2 style="text-align:center;margin:12px 0 6px;font-size:24px;color:#1e1b4b;font-weight:800;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.4px;">Access Request Received</h2>
      <p style="text-align:center;margin:0 0 22px;font-size:14px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">Your request is under review by an administrator.</p>
      <p style="font-size:15px;color:#1e293b;margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;">Hi <b style="color:#6366f1;font-family:Arial,Helvetica,sans-serif;">${firstName}</b>,</p>
      <p style="font-size:14.5px;color:#475569;line-height:1.65;margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;">
        Your request to access <b>${orgName}</b> has been received and is currently pending admin review.
        You will receive an email once a decision has been made.
      </p>
      ${noticeBox('icon-info-blue.svg', 'Typical review time is within 24 hours. No action is needed from you right now.', '#f0f4ff', '#334155')}`;

    return emailService.sendEmail({
      to: toEmail,
      subject: `Access Request Received — ${orgName}`,
      html: wrapEmail(body, 'wave-purple.svg'),
    });
  },

  // ─── 2. NEW ACCESS REQUEST → Admin Action Email ──────────────────────────

  sendAdminNewRequestNotification: async (adminEmail, requesterName, requesterEmail, orgName, actionToken) => {
    const baseUrl = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const approveUrl = `${baseUrl}/auth/access-requests/action?token=${actionToken}&action=approve`;
    const rejectUrl = `${baseUrl}/auth/access-requests/action?token=${actionToken}&action=reject`;

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
            ${img('badge-user-plus.svg', 52, 52, '')}
          </td>
          <td valign="middle" style="padding-left:14px;">
            <h2 style="margin:0 0 4px;font-size:22px;color:#1e1b4b;font-weight:800;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">New Access Request</h2>
            <p style="margin:0;font-size:13.5px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">A new user has requested access to your CRM organization.</p>
          </td>
        </tr>
      </table>

      <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e8e7f5;border-radius:12px;overflow:hidden;margin-bottom:20px;border-collapse:collapse;">
        ${infoRow('row-user.svg', 'Full Name', requesterName)}
        ${infoRow('row-mail.svg', 'Email Address', `<a href="mailto:${requesterEmail}" style="color:#6366f1;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${requesterEmail}</a>`, true)}
        ${infoRow('row-monitor.svg', 'Organization', orgName)}
        ${infoRow('row-calendar.svg', 'Requested On', `${dateStr} &nbsp;&bull;&nbsp; ${timeStr}`)}
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
                <td valign="middle" style="padding-right:5px;line-height:0;">${img('row-clock.svg', 14, 14, '')}</td>
                <td valign="middle" style="font-size:12.5px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">This request will expire in 7 days.</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;

    return emailService.sendEmail({
      to: adminEmail,
      subject: `New Access Request Pending Approval — ${orgName}`,
      html: wrapEmail(body, 'wave-purple.svg'),
    });
  },

  // ─── 3. ACCESS APPROVED → Applicant Email ───────────────────────────────

  sendAccessRequestApprovedEmail: async (toEmail, firstName, orgName) => {
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const loginUrl = `${clientUrl}/login`;

    console.log('\n==================================================');
    console.log(`📧 [APPROVAL EMAIL] Sent to: ${toEmail}`);
    console.log(`🟢 LOGIN: ${loginUrl}`);
    console.log('==================================================\n');

    const body = `
      ${badgeRow('badge-check.svg')}
      <h2 style="text-align:center;margin:12px 0 16px;font-size:26px;color:#16a34a;font-weight:800;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.4px;">Account Approved!</h2>
      <p style="font-size:15px;color:#1e293b;margin:18px 0 10px;font-family:Arial,Helvetica,sans-serif;">Hi <b style="color:#6366f1;font-family:Arial,Helvetica,sans-serif;">${firstName}</b>,</p>
      <p style="font-size:14.5px;color:#475569;line-height:1.65;margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;">
        Your request for access has been approved by the administrator!<br/>
        You can now log in and access the platform using your credentials.
      </p>
      ${primaryBtn('Sign In to CRM &nbsp;&rarr;', loginUrl, '#4f46e5')}
      ${noticeBox('icon-sparkle.svg', "Welcome aboard! We're excited to have you on the team.", '#f0fdf4', '#166534')}`;

    return emailService.sendEmail({
      to: toEmail,
      subject: `Account Approved — ${orgName}`,
      html: wrapEmail(body, 'wave-green.svg'),
    });
  },

  // ─── 4. ACCESS DECLINED → Applicant Email ───────────────────────────────

  sendAccessRequestRejectedEmail: async (toEmail, firstName, orgName, reviewReason) => {
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const contactUrl = `${clientUrl}/contact`;

    const body = `
      ${badgeRow('badge-x.svg')}
      <h2 style="text-align:center;margin:12px 0 16px;font-size:24px;color:#b91c1c;font-weight:800;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.4px;">Access Request Declined</h2>
      <p style="font-size:15px;color:#1e293b;margin:18px 0 10px;font-family:Arial,Helvetica,sans-serif;">Hi <b style="color:#6366f1;font-family:Arial,Helvetica,sans-serif;">${firstName || 'User'}</b>,</p>
      <p style="font-size:14.5px;color:#475569;line-height:1.65;margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;">
        Your request to access the CRM platform has been reviewed.<br/>
        Unfortunately, your administrator did not approve the request at this time.
      </p>
      ${reviewReason ? `<p style="font-size:13.5px;background:#fff7ed;border-left:3px solid #f97316;padding:11px 14px;border-radius:0 8px 8px 0;color:#9a3412;margin:14px 0;font-family:Arial,Helvetica,sans-serif;"><b>Reason:</b> ${reviewReason}</p>` : ''}
      ${noticeBox('icon-info-red.svg', 'If you believe this was unexpected, please reach out to your CRM administrator for more information.', '#fff1f2', '#991b1b')}
      ${outlineBtn('Contact Administrator', contactUrl, '#6366f1')}`;

    return emailService.sendEmail({
      to: toEmail,
      subject: `Access Request Update — ${orgName}`,
      html: wrapEmail(body, 'wave-red.svg'),
    });
  },

  // ─── 5. PASSWORD RESET → User Email ─────────────────────────────────────

  sendPasswordResetEmail: async (toEmail, firstName, orgName, token) => {
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl = `${clientUrl}/login?resetToken=${token}`;

    console.log('\n==================================================');
    console.log(`📧 [PASSWORD RESET EMAIL] Sent to: ${toEmail}`);
    console.log(`🟢 RESET LINK: ${resetUrl}`);
    console.log('==================================================\n');

    const body = `
      ${badgeRow('badge-lock.svg')}
      <h2 style="text-align:center;margin:12px 0 6px;font-size:24px;color:#1e1b4b;font-weight:800;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.4px;">Reset Your Password</h2>
      <div style="width:36px;height:3px;background:#6366f1;border-radius:2px;margin:8px auto 20px;"></div>
      <p style="font-size:15px;color:#1e293b;margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;">Hi <b style="color:#6366f1;font-family:Arial,Helvetica,sans-serif;">${firstName || 'User'}</b>,</p>
      <p style="font-size:14.5px;color:#475569;line-height:1.65;margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;">
        We received a request to reset your password.<br/>
        Click the button below to set a new password for your CRM account.
      </p>
      ${primaryBtn('Reset Password', resetUrl, '#4f46e5')}
      <p style="text-align:center;font-size:13px;color:#64748b;margin:16px 0 20px;font-family:Arial,Helvetica,sans-serif;">
        This link will expire in <b style="color:#6366f1;">15 minutes</b>.
      </p>`;

    return emailService.sendEmail({
      to: toEmail,
      subject: `Reset Your Password — ${orgName}`,
      html: wrapEmail(body, 'wave-purple.svg'),
    });
  },

};

module.exports = emailService;
