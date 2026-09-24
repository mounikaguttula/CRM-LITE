const dashboardService = require('../services/dashboardService');
const { successResponse } = require('../utils/response');

/**
 * Dashboard Controller
 * Serves dashboard aggregate metrics endpoint /api/dashboard/summary
 */
const getDashboardSummary = async (req, res, next) => {
  try {
    const scope = req.query.scope || 'individual';
    const result = await dashboardService.getDashboardSummary(req.user, scope);
    return successResponse(res, result, 'Dashboard summary metrics fetched successfully.');
  } catch (err) {
    if (err?.statusCode === 403) {
      return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: err.message });
    }
    next(err);
  }
};

module.exports = {
  getDashboardSummary,
};
