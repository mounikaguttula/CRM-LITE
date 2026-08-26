const objectService = require('../services/objectService');
const metadataService = require('../services/metadataService');

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || '6LdcTZ8sAAAAAPSRxmKLXkzRzRn6KnLeIfvVG-fs';

/**
 * Verify Google reCAPTCHA Token via Google's API
 */
const verifyCaptchaWithGoogle = async (token) => {
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: RECAPTCHA_SECRET,
      response: token,
    }).toString(),
  });
  return response.json();
};

/**
 * POST /api/verify-captcha
 * Single verification endpoint for Google reCAPTCHA tokens.
 */
const verifyCaptcha = async (req, res, next) => {
  try {
    const token = req.body?.token;

    console.log(`[reCAPTCHA Backend] 🔑 Captcha verify request received. Token length: ${token?.length}`);
    if (!token) {
      return res.status(400).json({ success: false, error: 'Missing captcha token' });
    }

    console.log('[reCAPTCHA Backend] 📡 Sending token to Google siteverify...');
    const verifyData = await verifyCaptchaWithGoogle(token);
    console.log('[reCAPTCHA Backend] 📊 Google siteverify response:', JSON.stringify(verifyData));

    if (!verifyData || !verifyData.success) {
      console.warn('[reCAPTCHA Backend] ❌ Captcha verify failed:', verifyData);
      return res.status(400).json({ success: false, ...verifyData, error: 'Captcha verification failed' });
    }

    console.log('[reCAPTCHA Backend] 🎉 Captcha verification SUCCESS!');
    return res.status(200).json(verifyData);
  } catch (error) {
    console.error('[LeadScanner] Captcha verify error:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Server error' });
  }
};

/**
 * POST /api/lead-scanner/save
 * Saves a scanned QR lead into universal_table bound to user's Organization and Lead object_type_id.
 * Verifies reCAPTCHA token with Google exactly once per submission.
 */
const saveScannedLead = async (req, res, next) => {
  try {
    const { name, email, phone, company, title, lead_source, description, captchaToken } = req.body || {};
    const organizationId = req.user?.organization_id;
    const userId = req.user?.id;

    // Enforce Lead Create Permission for authenticated QR scan save
    await metadataService.checkPermission(req.user, 'lead', 'create');

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Lead full name is required.' });
    }

    // 1. Strict reCAPTCHA verification: token MUST be provided and verified with Google exactly once
    if (!captchaToken) {
      return res.status(400).json({ success: false, error: 'Please complete the Google reCAPTCHA check before saving.' });
    }

    console.log('[LeadScanner] 📡 Verifying reCAPTCHA token with Google API for submission...');
    const verifyRes = await verifyCaptchaWithGoogle(captchaToken);
    console.log('[LeadScanner] 📊 Google siteverify result:', JSON.stringify(verifyRes));

    // 2. Strict validation: Reject with HTTP 400 (NOT 401) if Google verification fails or returns false
    if (!verifyRes || !verifyRes.success) {
      console.error('[LeadScanner] ❌ reCAPTCHA verification failed with Google:', verifyRes);
      const errorCodes = verifyRes?.['error-codes'] || [];
      
      let userFriendlyMsg = 'reCAPTCHA verification failed. Please check the reCAPTCHA box again.';
      if (errorCodes.includes('hostname-mismatch')) {
        userFriendlyMsg = 'reCAPTCHA verification failed: Domain hostname mismatch. Please ensure crm-lite-eight.vercel.app is allowed in your Google reCAPTCHA Admin Console.';
      } else if (errorCodes.includes('timeout-or-duplicate')) {
        userFriendlyMsg = 'reCAPTCHA verification expired. Please check the reCAPTCHA box again.';
      }

      return res.status(400).json({
        success: false,
        error: userFriendlyMsg,
        details: errorCodes,
      });
    }

    console.log(`[LeadScanner] ✅ reCAPTCHA token verified successfully (hostname: ${verifyRes.hostname}). Proceeding to insert lead...`);

    const fullNameClean = (name || req.body.first_name || '').trim();
    const nameParts = fullNameClean.split(' ');
    const firstName = req.body.first_name || nameParts[0] || fullNameClean;
    const lastName = req.body.last_name || nameParts.slice(1).join(' ') || firstName;

    const rawTitle = (title || req.body?.job_title || req.body?.role || '').trim();
    const rawSource = (lead_source || req.body?.source || 'QR Scan').trim();

    const leadPayload = {
      ...req.body,
      name: fullNameClean,
      first_name: firstName,
      last_name: lastName,
      email: email ? email.trim() : '',
      phone: phone ? phone.trim() : '',
      company: company ? company.trim() : '',
      title: rawTitle,
      job_title: rawTitle,
      lead_source: rawSource,
      source: rawSource,
      description: description || '',
    };

    console.log(`[LeadScanner] Creating scanned lead for orgId=${organizationId}, userId=${userId}`);

    // 3. Insert lead into universal_table via objectService ONLY after successful CAPTCHA verification
    const record = await objectService.createRecord('lead', leadPayload, organizationId, userId);

    return res.status(201).json({
      success: true,
      message: `Lead "${record.name}" created successfully from QR Scan.`,
      data: record,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  verifyCaptcha,
  saveScannedLead,
};
