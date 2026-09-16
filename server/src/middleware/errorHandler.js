const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(err.message || 'Internal Server Error', {
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method
  });

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  res.status(statusCode).json({
    error: err.message || 'An unexpected internal error occurred.',
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV !== 'production' ? { details: err.stack } : {})
  });
}

module.exports = errorHandler;
