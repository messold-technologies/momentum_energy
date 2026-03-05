
import logger from '../config/logger.js';

function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // Momentum API errors (thrown from service layer)
  if (err.status && err.errorData) {
    return res.status(err.status < 600 ? err.status : 500).json({
      success: false,
      error: 'Momentum API error',
      momentumError: err.errorData,
    });
  }

  // Generic errors
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}

export default errorHandler;
