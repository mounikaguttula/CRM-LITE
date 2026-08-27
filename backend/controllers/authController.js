const authService = require('../services/authService');
const auditService = require('../services/auditService');
const { successResponse, errorResponse } = require('../utils/response');
const supabase = require('../config/supabase');
const { signToken } = require('../utils/jwt');
const emailService = require('../services/emailService');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production';

// In-memory stores for security
const activeResetTokens = new Map(); // key: jti (token UUID), value: { email, expiresAt, used }
const passwordResetLimiter = new Map(); // key: `${ip}:${email}`, value: Array of timestamps

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required fields.', 400);
    }

    const result = await authService.login(email, password);
    return successResponse(res, result, 'Login successful.');
  } catch (err) {
    next(err);
  }
};

const registerOrganization = async (req, res, next) => {
  try {
    const { orgName, domain, adminEmail, adminPassword, adminName } = req.body;

    if (!orgName || !adminEmail || !adminPassword) {
      return errorResponse(res, 'Organization name, admin email, and admin password are required.', 400);
    }

    const result = await authService.registerOrganization({ orgName, domain, adminEmail, adminPassword, adminName });
    return successResponse(res, result, 'Organization registered successfully.', 201);
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return errorResponse(res, 'Email is required.', 400);
    }

    const cleanEmail = email.toLowerCase().trim();
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';

    // 1. Rate Limiting: Max 5 requests per 15 minutes per IP + Email combination
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const maxRequests = 5;
    const limitKey = `${ip}:${cleanEmail}`;

    let requests = passwordResetLimiter.get(limitKey) || [];
    // Clean up timestamps older than the window
    requests = requests.filter(ts => now - ts < windowMs);

    if (requests.length >= maxRequests) {
      return errorResponse(res, 'Too many password reset requests. Please try again in 15 minutes.', 429);
    }

    requests.push(now);
    passwordResetLimiter.set(limitKey, requests);

    // 2. Query user from database to verify existence
    const { data: user, error } = await supabase
      .from('users')
      .select('*, organization(*)')
      .eq('email', cleanEmail)
      .maybeSingle();

    // 3. User Enumeration Prevention: If user exists, send link; if not, do nothing but return 200 OK.
    if (user && user.status === 'active') {
      const tokenUuid = crypto.randomUUID();
      const expiresAt = now + 15 * 60 * 1000; // 15 minutes

      // Store in memory map
      activeResetTokens.set(tokenUuid, {
        email: cleanEmail,
        expiresAt,
        used: false,
      });

      // Sign short-lived JWT (15 mins)
      const token = jwt.sign(
        { email: cleanEmail, type: 'password_reset', jti: tokenUuid },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      const firstName = user.first_name || 'User';
      const orgName = user.organization?.organization_name || 'CRM Platform';

      // Send password reset notification
      await emailService.sendPasswordResetEmail(cleanEmail, firstName, orgName, token);
    }

    // Always return same success message
    return successResponse(
      res,
      { message: 'If an account exists for this email, a password reset link has been sent.' },
      'Password reset request completed.'
    );
  } catch (err) {
    next(err);
  }
};

const verifyResetToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return errorResponse(res, 'Verification token is required.', 400);
    }

    // 1. Verify and decode JWT
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return errorResponse(res, 'Invalid or expired password reset link. Please request a new one.', 401);
    }

    const { email, type, jti } = decoded;

    if (type !== 'password_reset' || !jti) {
      return errorResponse(res, 'Invalid token claim details.', 401);
    }

    // 2. Look up token in activeResetTokens Map
    const storedToken = activeResetTokens.get(jti);
    if (!storedToken) {
      return errorResponse(res, 'Password reset link is invalid or has expired.', 401);
    }

    if (storedToken.used) {
      return errorResponse(res, 'This password reset link has already been used. Please request a new one.', 401);
    }

    if (Date.now() > storedToken.expiresAt) {
      activeResetTokens.delete(jti);
      return errorResponse(res, 'Password reset link has expired. Please request a new one.', 401);
    }

    // 3. Mark as used (One-Time Use constraint)
    storedToken.used = true;
    activeResetTokens.set(jti, storedToken);

    // 4. Retrieve user record
    const { data: user, error } = await supabase
      .from('users')
      .select('*, organization(*)')
      .eq('email', email)
      .maybeSingle();

    if (error || !user || user.status !== 'active') {
      return errorResponse(res, 'The user account is no longer active or could not be found.', 401);
    }

    // 5. Generate standard long-lived token (7d)
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email.split('@')[0];
    const initials = fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: fullName,
      role: user.role_id ? 'Administrator' : 'User',
      role_id: user.role_id,
      organization_id: user.organization_id,
    };

    const sessionToken = signToken(tokenPayload);

    const userProfile = {
      id: user.id,
      name: fullName,
      email: user.email,
      role: user.role_id ? 'Administrator' : 'User',
      role_id: user.role_id,
      organization_id: user.organization_id,
      avatar: initials || 'U',
      organization: user.organization ? {
        id: user.organization.id,
        name: user.organization.organization_name,
        code: user.organization.organization_code,
        plan: user.organization.subscription_plan,
      } : null,
    };

    // Start audit log session for reset token login
    try {
      await auditService.startSession({
        organization_id: user.organization_id,
        user_id: user.id,
        user_email: user.email,
        name: fullName,
      });
    } catch (auditErr) {
      console.error('❌ Audit startSession error in verifyResetToken:', auditErr.message);
    }

    return successResponse(res, { token: sessionToken, user: userProfile }, 'Password reset token verification successful.');
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const userProfile = await authService.getUserProfile(req.user.id);
    return successResponse(res, userProfile, 'User profile fetched successfully.');
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    const userId = req.user.id;

    if (!password) {
      return errorResponse(res, 'Password is required.', 400);
    }

    if (password.length < 6) {
      return errorResponse(res, 'Password must be at least 6 characters long.', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const { error } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      return errorResponse(res, `Failed to update password: ${error.message}`, 400);
    }

    return successResponse(res, null, 'Password reset successfully.');
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const user = req.user;
    if (user && user.id && user.organization_id) {
      await auditService.endSession({
        organization_id: user.organization_id,
        user_id: user.id,
        reason: 'LOGOUT',
        logout_reason: 'LOGOUT',
      });
    }
    return successResponse(res, null, 'Logged out successfully.');
  } catch (err) {
    next(err);
  }
};

const ping = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id || !user.organization_id) {
      return errorResponse(res, 'Unauthorized: User session info missing.', 401);
    }

    await auditService.updateLastActivity({
      organization_id: user.organization_id,
      user_id: user.id,
      user_email: user.email,
      name: user.name,
    });

    return successResponse(res, null, 'Session active.');
  } catch (err) {
    next(err);
  }
};

const idleTimeout = async (req, res, next) => {
  try {
    const user = req.user;
    if (user && user.id && user.organization_id) {
      await auditService.endSession({
        organization_id: user.organization_id,
        user_id: user.id,
        reason: 'SESSION_EXPIRED',
        logout_reason: 'IDLE_TIMEOUT',
      });
    }
    return successResponse(res, null, 'Session closed due to idle timeout.');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  registerOrganization,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  getMe,
  logout,
  ping,
  idleTimeout,
};
