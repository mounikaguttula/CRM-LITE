const { errorResponse } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  console.error('🔥 Server Error Stack:', err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  return errorResponse(res, message, statusCode, err.errors || null);
};

module.exports = errorHandler;
