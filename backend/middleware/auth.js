const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/response');
const auditService = require('../services/auditService');
const supabase = require('../config/supabase');
const { supabaseAdmin } = require('../config/supabase');

const getClient = () => supabaseAdmin || supabase;

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Unauthorized: Missing or malformed Bearer token.', 401);
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production';

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;

    // Skip idle-timeout enforcement for explicit session control endpoints (/idle-timeout and /ping)
    if (req.path === '/idle-timeout' || req.path.endsWith('/idle-timeout') || req.path === '/ping' || req.path.endsWith('/ping')) {
      return next();
    }

    // Idle Timeout Enforcement
    if (req.user && req.user.id && req.user.organization_id) {
      const timeoutMs = process.env.IDLE_TIMEOUT_MS ? parseInt(process.env.IDLE_TIMEOUT_MS, 10) : 300000;
      const client = getClient();

      const { data: sessionRow } = await client
        .from('audit_logs')
        .select('*')
        .eq('organization_id', req.user.organization_id)
        .eq('user_id', req.user.id)
        .eq('event_type', 'LOGIN')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionRow) {
        const lastActivityStr = sessionRow.details?.last_activity_at || sessionRow.created_at;
        const lastActivityTime = new Date(lastActivityStr).getTime();
        const now = Date.now();

        if (now - lastActivityTime > timeoutMs) {
          await auditService.endSession({
            organization_id: req.user.organization_id,
            user_id: req.user.id,
            reason: 'SESSION_EXPIRED',
            logout_reason: 'IDLE_TIMEOUT',
          });
          return errorResponse(res, 'Session expired due to inactivity.', 401);
        }

        // Background requests MUST NOT update last_activity_at.
        // Only requests explicitly marked as user activity update it.
        if (String(req.headers['x-user-activity']) === '1') {
          auditService.updateLastActivity({
            organization_id: req.user.organization_id,
            user_id: req.user.id,
          });
        }
      }
    }

    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      try {
        const expiredPayload = jwt.decode(token);
        if (expiredPayload && expiredPayload.id && expiredPayload.organization_id) {
          auditService.endSession({
            organization_id: expiredPayload.organization_id,
            user_id: expiredPayload.id,
            reason: 'SESSION_EXPIRED',
            logout_reason: 'IDLE_TIMEOUT',
          });
        }
      } catch (auditErr) {
        console.error('❌ Audit endSession error on TokenExpiredError:', auditErr.message);
      }
      return errorResponse(res, 'Unauthorized: Session expired. Please log in again.', 401);
    }
    return errorResponse(res, 'Unauthorized: Invalid token signature.', 401);
  }
};

module.exports = authMiddleware;
