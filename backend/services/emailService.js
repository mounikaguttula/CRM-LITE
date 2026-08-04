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
    // If SMTP is unconfigured, return mock transport logger
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
    ? {
        service: 'gmail',
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      }
    : {
        host,
        port,
        secure: port === 465 || process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      };

  return nodemailer.createTransport(transporterConfig);
};

const emailService = {
  /**
   * Generic Send Email Method
   * Supports both HTTPS API (Resend) to bypass ISP port blocks and standard Nodemailer SMTP.
   */
  sendEmail: async ({ to, subject, html, text }) => {
    try {
      const fromEmail = process.env.SMTP_FROM || 'CRM Platform <onboarding@resend.dev>';

      // 1. If SENDGRID_API_KEY is present, use SendGrid HTTP API
      if (process.env.SENDGRID_API_KEY) {
        let fromAddress = fromEmail;
        let fromName = 'CRM Platform';
        const match = fromEmail.match(/(.*)<(.*)>/);
        if (match) {
          fromName = match[1].trim();
          fromAddress = match[2].trim();
        }

        const toArray = Array.isArray(to) ? to : [to];
        const personalizations = [
          {
            to: toArray.map(email => ({ email: email.trim() }))
          }
        ];

        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          },
          body: JSON.stringify({
            personalizations,
            from: {
              email: fromAddress,
              name: fromName,
            },
            subject,
            content: [
              {
                type: 'text/html',
                value: html,
              }
            ],
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error('❌ SendGrid API dispatch error:', errText);
          return null;
        }
        console.log(`✅ [SENDGRID EMAIL DISPATCH SUCCESS] Sent to ${to}`);
        return { success: true };
      }

      // 2. If RESEND_API_KEY is present, use HTTPS API (Port 443 - Never blocked by ISP)
      if (process.env.RESEND_API_KEY) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
            text: text || html.replace(/<[^>]*>?/gm, ''),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          console.error('❌ Resend API dispatch error:', data);
          return null;
        }
        console.log(`✅ [RESEND EMAIL DISPATCH SUCCESS] Sent to ${to} (ID: ${data.id})`);
        return data;
      }

      // 2. Fallback to Nodemailer SMTP Transporter
      const transporter = getTransporter();
      const info = await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        text: text || html.replace(/<[^>]*>?/gm, ''),
        html,
      });
      console.log(`✅ [SMTP EMAIL DISPATCH SUCCESS] Sent to ${to}`);
      return info;
    } catch (err) {
      console.error('❌ Failed to dispatch email notification:', err.message);
      return null;
    }
  },

  /**
   * Send Access Request Submitted Notification to Requester
   */
  sendAccessRequestSubmittedEmail: async (toEmail, firstName, orgName) => {
    return emailService.sendEmail({
      to: toEmail,
      subject: `Access Request Received — ${orgName}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Access Request Received</h2>
          <p>Hello ${firstName},</p>
          <p>Your request to access <strong>${orgName}</strong> has been received and is currently under review by an administrator.</p>
          <p>You will receive an email notification once your request has been reviewed.</p>
          <br/>
          <p>Best regards,<br/>The ${orgName} Team</p>
        </div>
      `,
    });
  },

  /**
   * Send New Access Request Alert to Organization Admins with One-Click Action Links
   */
  sendAdminNewRequestNotification: async (adminEmail, requesterName, requesterEmail, orgName, actionToken) => {
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const approveUrl = `${baseUrl}/auth/access-requests/action?token=${actionToken}&action=approve`;
    const rejectUrl = `${baseUrl}/auth/access-requests/action?token=${actionToken}&action=reject`;

    console.log('\n==================================================');
    console.log(`📧 [EMAIL NOTIFICATION] Sent to Admin: ${adminEmail}`);
    console.log(`Subject: [CRM Access Request] New user ${requesterName} requested access to ${orgName}`);
    console.log('--------------------------------------------------');
    console.log(`🟢 APPROVE LINK: ${approveUrl}`);
    console.log(`🔴 REJECT LINK : ${rejectUrl}`);
    console.log('==================================================\n');

    return emailService.sendEmail({
      to: adminEmail,
      subject: `New Access Request Pending Approval — ${orgName}`,
      html: `
        <div style="font-family: sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-top: 0;">New Access Request Pending</h2>
          <p>A new user has requested access to <strong>${orgName}</strong>:</p>
          <ul style="line-height: 1.6;">
            <li><strong>Applicant Name:</strong> ${requesterName}</li>
            <li><strong>Applicant Email:</strong> ${requesterEmail}</li>
          </ul>
          <p>Click below to approve or reject this request instantly:</p>
          <div style="margin: 20px 0; display: flex; gap: 12px;">
            <a href="${approveUrl}" style="background-color: #16a34a; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              🟢 Approve Request
            </a>
            <a href="${rejectUrl}" style="background-color: #dc2626; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              🔴 Reject Request
            </a>
          </div>
          <p style="font-size: 0.825rem; color: #64748b; margin-top: 24px;">Or log into your Admin Console to review pending access requests.</p>
        </div>
      `,
    });
  },

  /**
   * Send Access Request Approval Email to Requester
   */
  sendAccessRequestApprovedEmail: async (toEmail, firstName, orgName) => {
    console.log('\n==================================================');
    console.log(`📧 [APPROVAL EMAIL] Sent to Applicant (${toEmail}) — Status: APPROVED`);
    console.log(`Subject: Access Request Approved — ${orgName}`);
    console.log(`Message: Hello ${firstName}, your account has been approved and activated! You can now log in.`);
    console.log('==================================================\n');

    return emailService.sendEmail({
      to: toEmail,
      subject: `Access Request Approved — ${orgName}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #16a34a;">Access Request Approved!</h2>
          <p>Hello ${firstName},</p>
          <p>Great news! Your access request to join <strong>${orgName}</strong> has been approved by an administrator.</p>
          <p>You can now log into your account using your registered email address.</p>
          <br/>
          <p>Best regards,<br/>The ${orgName} Team</p>
        </div>
      `,
    });
  },

  /**
   * Send Access Request Rejection Email to Requester
   */
  sendAccessRequestRejectedEmail: async (toEmail, firstName, orgName, reviewReason) => {
    return emailService.sendEmail({
      to: toEmail,
      subject: `Access Request Update — ${orgName}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Access Request Update</h2>
          <p>Hello ${firstName},</p>
          <p>Thank you for your interest in joining <strong>${orgName}</strong>. Regrettably, your access request could not be approved at this time.</p>
          ${reviewReason ? `<p><strong>Reason:</strong> ${reviewReason}</p>` : ''}
          <br/>
          <p>Best regards,<br/>The ${orgName} Team</p>
        </div>
      `,
    });
  },

  /**
   * Send Password Reset Link Email to User
   */
  sendPasswordResetEmail: async (toEmail, firstName, orgName, token) => {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const resetLinkUrl = `${clientUrl}/login?resetToken=${token}`;

    console.log('\n==================================================');
    console.log(`📧 [PASSWORD RESET EMAIL] Sent to ${toEmail}`);
    console.log(`Subject: Reset Your Password — ${orgName}`);
    console.log(`🟢 RESET LINK: ${resetLinkUrl}`);
    console.log('==================================================\n');

    return emailService.sendEmail({
      to: toEmail,
      subject: `Reset Your Password — ${orgName}`,
      html: `
        <div style="font-family: sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-top: 0;">Password Reset Request</h2>
          <p>Hello ${firstName},</p>
          <p>We received a request to reset the password for your account at <strong>${orgName}</strong>.</p>
          <p>Click the button below to reset your password:</p>
          <div style="margin: 20px 0;">
            <a href="${resetLinkUrl}" style="background-color: #6366f1; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="font-size: 0.825rem; color: #64748b; margin-top: 24px;">This link will expire in 15 minutes. If you did not request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  },
};

module.exports = emailService;
