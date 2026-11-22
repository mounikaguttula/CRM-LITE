/**
 * FounderCRM Email Template Library
 * Production-ready, responsive, cross-client HTML email templates.
 * Supports merge tags: {{first_name}}, {{name}}, {{company}}, {{email}}, {{form_link}}
 */

/**
 * Builds a complete responsive HTML email string from a template ID and user-customized field values.
 */
export function buildTemplateHtml(templateId, fields = {}) {
  const {
    headline = '',
    subheadline = '',
    body = '',
    buttonText = 'Get Started Now &rarr;',
    buttonUrl = '{{form_link}}',
    promoCode = 'SAVE40',
    footerSignoff = 'The {{company}} Team',
  } = fields;

  // Format body newlines to paragraphs or break tags safely
  const formattedBody = String(body || '')
    .split(/\n\s*\n/)
    .map(p => String(p || '').trim())
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.75;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  if (templateId === 'welcome_email') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Welcome to {{company}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px -5px rgba(15,23,42,0.06), 0 8px 10px -6px rgba(15,23,42,0.04);border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:40px 40px 24px 40px;border-bottom:1px solid #f1f5f9;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display:inline-block;padding:6px 14px;background-color:#eef2ff;border-radius:9999px;border:1px solid #e0e7ff;">
                      <span style="color:#4f46e5;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">{{company}}</span>
                    </div>
                  </td>
                  <td align="right">
                    <span style="font-size:13px;color:#94a3b8;font-weight:500;">Welcome Experience</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:24px 0 8px;color:#0f172a;font-size:26px;font-weight:800;letter-spacing:-0.5px;line-height:1.25;">${headline || 'Welcome to the community, {{first_name}}!'}</h1>
              ${subheadline ? `<p style="margin:0;color:#64748b;font-size:15px;line-height:1.5;">${subheadline}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px 40px 40px;">
              <div style="margin-bottom:28px;">
                ${formattedBody || '<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.75;">Thank you for joining us. Our platform is built to help you accelerate customer relationships, pipeline management, and team collaboration with ease.</p>'}
              </div>
              
              <!-- Clean Highlight Row -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td width="31%" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
                    <div style="font-size:18px;margin-bottom:6px;color:#4f46e5;font-weight:bold;">01</div>
                    <p style="margin:0;color:#0f172a;font-size:12.5px;font-weight:700;">Fast Setup</p>
                    <p style="margin:3px 0 0;color:#64748b;font-size:11px;">Under 2 minutes</p>
                  </td>
                  <td width="3.5%"></td>
                  <td width="31%" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
                    <div style="font-size:18px;margin-bottom:6px;color:#059669;font-weight:bold;">02</div>
                    <p style="margin:0;color:#0f172a;font-size:12.5px;font-weight:700;">Secure Cloud</p>
                    <p style="margin:3px 0 0;color:#64748b;font-size:11px;">Encrypted storage</p>
                  </td>
                  <td width="3.5%"></td>
                  <td width="31%" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
                    <div style="font-size:18px;margin-bottom:6px;color:#0284c7;font-weight:bold;">03</div>
                    <p style="margin:0;color:#0f172a;font-size:12.5px;font-weight:700;">Full Support</p>
                    <p style="margin:3px 0 0;color:#64748b;font-size:11px;">24/7 assistance</p>
                  </td>
                </tr>
              </table>

              ${buttonText ? `
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${buttonUrl || '{{form_link}}'}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.2px;box-shadow:0 4px 14px rgba(79,70,229,0.35);">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>` : ''}

              <div style="height:1px;background-color:#f1f5f9;margin:32px 0 24px;"></div>
              <p style="margin:0;color:#64748b;font-size:13.5px;line-height:1.6;">
                Warm regards,<br/>
                <strong style="color:#0f172a;">${footerSignoff || 'The {{company}} Team'}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #f1f5f9;">
              <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">You received this email because you are a registered user of {{company}}.</p>
              <p style="margin:0;color:#cbd5e1;font-size:11.5px;">&copy; 2026 {{company}} &bull; All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  if (templateId === 'product_promo') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Special Offer from {{company}}</title>
</head>
<body style="margin:0;padding:0;background-color:#faf5ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf5ff;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px -5px rgba(124,58,237,0.08), 0 8px 10px -6px rgba(124,58,237,0.04);border:1px solid #f3e8ff;">
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#9333ea 100%);padding:44px 40px;text-align:center;">
              <div style="display:inline-block;padding:5px 14px;background-color:rgba(255,255,255,0.2);border-radius:9999px;margin-bottom:16px;">
                <span style="color:#ffffff;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">EXCLUSIVE ANNOUNCEMENT</span>
              </div>
              <h1 style="margin:0 0 10px;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;line-height:1.2;">${headline || 'Special Offer for {{first_name}}'}</h1>
              ${subheadline ? `<p style="margin:0;color:#e9d5ff;font-size:15px;font-weight:500;">${subheadline}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 40px 40px;">
              <div style="margin-bottom:28px;">
                ${formattedBody || '<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.75;">We are excited to offer you a special 40% discount on all premium plans. Unlock advanced automation, CRM analytics, and dedicated support today!</p>'}
              </div>
              
              <!-- Voucher Container -->
              ${promoCode ? `
              <div style="background-color:#faf5ff;border:2px dashed #c084fc;border-radius:14px;padding:24px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 6px;color:#7c3aed;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">PROMO CODE AT CHECKOUT</p>
                <div style="font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:900;letter-spacing:5px;color:#581c87;margin:6px 0;">${promoCode}</div>
                <p style="margin:4px 0 0;color:#6b21a8;font-size:12px;">Use this voucher to claim your promotional discount</p>
              </div>` : ''}

              ${buttonText ? `
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${buttonUrl || '{{form_link}}'}" style="display:inline-block;background-color:#7c3aed;color:#ffffff;text-decoration:none;padding:14px 44px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.2px;box-shadow:0 4px 14px rgba(124,58,237,0.35);">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>` : ''}

              <div style="height:1px;background-color:#f1f5f9;margin:32px 0 24px;"></div>
              <p style="margin:0;color:#64748b;font-size:13.5px;line-height:1.6;">
                Best regards,<br/>
                <strong style="color:#0f172a;">${footerSignoff || 'The {{company}} Product Team'}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #f1f5f9;">
              <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">Limited time offer valid while promotional capacity lasts.</p>
              <p style="margin:0;color:#cbd5e1;font-size:11.5px;">&copy; 2026 {{company}} &bull; All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  if (templateId === 'newsletter') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>{{company}} Monthly Briefing</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px -5px rgba(15,23,42,0.06), 0 8px 10px -6px rgba(15,23,42,0.04);border:1px solid #e2e8f0;">
          <tr>
            <td style="background-color:#0f172a;padding:20px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#ffffff;font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">{{company}} BRIEFING</td>
                  <td align="right" style="color:#94a3b8;font-size:12px;font-weight:500;">Monthly Digest</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 24px 40px;border-bottom:1px solid #f1f5f9;">
              <h1 style="margin:0 0 10px;color:#0f172a;font-size:24px;font-weight:800;letter-spacing:-0.5px;line-height:1.3;">${headline || 'Product Milestones & Community Highlights'}</h1>
              ${subheadline ? `<p style="margin:0;color:#64748b;font-size:14px;">${subheadline}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px 40px 40px;">
              <div style="border-left:3px solid #3b82f6;padding-left:18px;margin-bottom:28px;">
                <p style="margin:0 0 6px;color:#3b82f6;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">EXECUTIVE SUMMARY</p>
                <div style="color:#334155;font-size:15px;line-height:1.75;">
                  ${formattedBody || 'We have rolled out faster bulk imports, redesigned email campaign tools, and enhanced real-time open tracking to make your workflows smoother.'}
                </div>
              </div>

              ${buttonText ? `
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${buttonUrl || '{{form_link}}'}" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;padding:13px 36px;border-radius:10px;font-size:14.5px;font-weight:700;letter-spacing:0.2px;">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>` : ''}

              <div style="height:1px;background-color:#f1f5f9;margin:32px 0 24px;"></div>
              <p style="margin:0;color:#64748b;font-size:13.5px;line-height:1.6;">
                Stay updated,<br/>
                <strong style="color:#0f172a;">${footerSignoff || 'The Editorial Team &bull; {{company}}'}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #f1f5f9;">
              <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">Curated for product innovators and modern growth teams.</p>
              <p style="margin:0;color:#cbd5e1;font-size:11.5px;">&copy; 2026 {{company}} &bull; All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  if (templateId === 'event_invitation') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>VIP Invitation</title>
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:Georgia,serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background-color:#18181b;border-radius:18px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);border:1px solid #27272a;">
          <tr>
            <td style="padding:48px 44px 28px 44px;text-align:center;border-bottom:1px solid #27272a;">
              <div style="display:inline-block;padding:5px 16px;border:1px solid #3f3f46;border-radius:9999px;margin-bottom:20px;">
                <span style="color:#a1a1aa;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;font-weight:600;">CORDIALLY INVITED</span>
              </div>
              <h1 style="margin:0 0 12px;color:#ffffff;font-size:28px;font-weight:400;letter-spacing:-0.3px;line-height:1.35;font-style:italic;">
                ${headline || 'Annual Executive Leadership Summit'}
              </h1>
              ${subheadline ? `<p style="margin:0;color:#a1a1aa;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;">${subheadline}</p>` : ''}
              <div style="width:40px;height:2px;background-color:#d97706;margin:20px auto 0;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 44px 44px 44px;">
              <p style="margin:0 0 16px;color:#d4d4d8;font-size:16px;font-style:italic;text-align:center;">
                Dear {{first_name}},
              </p>
              <div style="margin-bottom:32px;color:#a1a1aa;font-size:14.5px;line-height:1.8;text-align:center;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;">
                ${formattedBody || '<p style="margin:0 0 16px;">You are cordially invited to attend the Annual VIP Leadership Summit. We will explore market expansion, AI automation strategies, and enterprise deal scaling alongside top founders and industry innovators.</p>'}
              </div>

              ${buttonText ? `
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${buttonUrl || '{{form_link}}'}" style="display:inline-block;background-color:#ffffff;color:#09090b;text-decoration:none;padding:15px 44px;border-radius:10px;font-size:14.5px;font-weight:700;letter-spacing:0.3px;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>` : ''}

              <div style="height:1px;background-color:#27272a;margin:36px 0 24px;"></div>
              <p style="margin:0;color:#71717a;font-size:13px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;">
                We look forward to hosting you.<br/>
                <strong style="color:#d4d4d8;">${footerSignoff || '{{company}} Executive Relations'}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0f0f11;padding:18px 40px;text-align:center;border-top:1px solid #27272a;">
              <p style="margin:0;color:#52525b;font-size:11.5px;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;">Private Executive Invitation &bull; &copy; 2026 {{company}}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // Fallback / Custom HTML template
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{company}} Update</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(15,23,42,0.06); }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 36px 32px; line-height: 1.75; font-size: 15px; color: #334155; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; margin: 20px 0 16px; box-shadow: 0 4px 14px rgba(79,70,229,0.35); }
    .footer { background-color: #f8fafc; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${headline || 'Hello, {{first_name}} 👋'}</h1>
      ${subheadline ? `<p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">${subheadline}</p>` : ''}
    </div>
    <div class="content">
      ${formattedBody || '<p>We are thrilled to connect with you today from <strong>{{company}}</strong>.</p>'}
      ${buttonText ? `
      <div style="text-align: center;">
        <a href="${buttonUrl || '{{form_link}}'}" class="btn">${buttonText}</a>
      </div>` : ''}
      <p style="margin:28px 0 0;color:#64748b;font-size:13.5px;">
        Warm regards,<br/>
        <strong style="color:#0f172a;">${footerSignoff || 'The {{company}} Team'}</strong>
      </p>
    </div>
    <div class="footer">
      <p>&copy; 2026 {{company}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

export const EMAIL_TEMPLATES = [
  {
    id: 'welcome_email',
    title: 'Welcome Email',
    category: 'Onboarding',
    emoji: '👋',
    accent: '#4f46e5',
    bg: 'linear-gradient(140deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)',
    headerText: 'Welcome aboard!',
    headerSub: "We're thrilled to have you",
    subject: 'Welcome to Our Community!',
    defaultFields: {
      headline: 'Welcome to the community, {{first_name}}!',
      subheadline: "We're thrilled to have you with us on {{company}}.",
      body: 'Thank you for joining us. Our platform is built to help you accelerate customer relationships, pipeline management, and team collaboration with ease.\n\nEverything you need to scale your sales cycles is right at your fingertips.',
      buttonText: 'Get Started Now →',
      buttonUrl: '{{form_link}}',
      footerSignoff: 'The {{company}} Team',
    },
    get html() {
      return buildTemplateHtml('welcome_email', this.defaultFields);
    }
  },
  {
    id: 'product_promo',
    title: 'Product Promotion',
    category: 'Special Offer',
    emoji: '🔥',
    accent: '#7c3aed',
    bg: 'linear-gradient(140deg, #581c87 0%, #7c3aed 55%, #9333ea 100%)',
    headerText: 'LIMITED OFFER 40% OFF',
    headerSub: 'Exclusive deal — code SAVE40',
    subject: 'Special Offer: 40% Discount on {{company}}!',
    defaultFields: {
      headline: 'Special Offer for {{first_name}}',
      subheadline: 'Exclusive discount tailored for your workspace',
      body: 'We are excited to offer you a special 40% discount on all premium plans. Unlock advanced automation, CRM analytics, and dedicated support today!',
      promoCode: 'SAVE40',
      buttonText: 'Claim Offer Now →',
      buttonUrl: '{{form_link}}',
      footerSignoff: 'The {{company}} Product Team',
    },
    get html() {
      return buildTemplateHtml('product_promo', this.defaultFields);
    }
  },
  {
    id: 'newsletter',
    title: 'Monthly Newsletter',
    category: 'Update',
    emoji: '📰',
    accent: '#0f172a',
    bg: 'linear-gradient(140deg, #020617 0%, #0f172a 55%, #1e293b 100%)',
    headerText: 'MONTHLY BRIEFING',
    headerSub: 'Product milestones & highlights',
    subject: 'Monthly Updates from {{company}}',
    defaultFields: {
      headline: 'Product Milestones & Community Highlights',
      subheadline: 'Hi {{first_name}}, here are the latest platform updates and upcoming features.',
      body: 'We have rolled out faster bulk imports, redesigned email campaign tools, and enhanced real-time open tracking to make your daily workflows smoother than ever.',
      buttonText: 'Read Full Article & Share Feedback →',
      buttonUrl: '{{form_link}}',
      footerSignoff: 'The Editorial Team • {{company}}',
    },
    get html() {
      return buildTemplateHtml('newsletter', this.defaultFields);
    }
  },
  {
    id: 'event_invitation',
    title: 'Event Invitation',
    category: 'VIP Event',
    emoji: '🎟️',
    accent: '#d97706',
    bg: 'linear-gradient(140deg, #09090b 0%, #18181b 55%, #27272a 100%)',
    headerText: 'EXECUTIVE SUMMIT',
    headerSub: 'Annual invite-only dinner & keynote',
    subject: 'Exclusive Invitation: Leadership Summit 2026',
    defaultFields: {
      headline: 'Annual Executive Leadership Summit',
      subheadline: 'Join founders, operators, and thought leaders for an exclusive summit',
      body: 'You are cordially invited to attend the Annual VIP Leadership Summit. We will explore market expansion, AI automation strategies, and enterprise deal scaling alongside top founders and industry innovators.',
      buttonText: 'Confirm Attendance / RSVP →',
      buttonUrl: '{{form_link}}',
      footerSignoff: '{{company}} Executive Relations',
    },
    get html() {
      return buildTemplateHtml('event_invitation', this.defaultFields);
    }
  },
  {
    id: 'custom_html',
    title: 'Custom HTML / Developer',
    category: 'Vibe Coder / Dev',
    emoji: '💻',
    accent: '#0f172a',
    bg: 'linear-gradient(140deg, #090d16 0%, #1e293b 55%, #334155 100%)',
    headerText: 'CODE YOUR OWN HTML',
    headerSub: 'HubSpot-style full HTML & CSS control',
    subject: 'Special Update for {{first_name}}',
    defaultFields: {
      headline: 'Hello, {{first_name}} 👋',
      subheadline: 'Custom announcement from {{company}}',
      body: 'We are thrilled to connect with you today. This is your custom email template where you have full control over layout, styling, and messaging.',
      buttonText: 'Take Action →',
      buttonUrl: '{{form_link}}',
      footerSignoff: 'The {{company}} Team',
    },
    get html() {
      return buildTemplateHtml('custom_html', this.defaultFields);
    }
  },
];
