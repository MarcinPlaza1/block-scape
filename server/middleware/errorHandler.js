import config from '../config/config.js';
import logger from '../utils/logger.js';
import { trackError } from '../services/monitoring.js';

/**
 * Async handler wrapper to catch errors in async routes
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
}

/**
 * Global error handler
 */
export function errorHandler(err, req, res, next) {
  // Log error for debugging
  trackError(err);
  logger.error({
    err,
    reqId: req.id,
    path: req.path,
    method: req.method
  }, 'Unhandled error');
  
  // Default error response
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let error = err.error || 'Error';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    error = 'Validation Error';
    message = 'Invalid input data';
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    error = 'Unauthorized';
    message = 'Authentication required';
  } else if (err.name === 'PrismaClientKnownRequestError') {
    status = 400;
    error = 'Database Error';
    if (err.code === 'P2002') {
      message = 'A unique constraint would be violated';
    } else if (err.code === 'P2025') {
      status = 404;
      message = 'Record not found';
    } else {
      message = 'Database operation failed';
    }
  } else if (err.name === 'PrismaClientValidationError') {
    status = 400;
    error = 'Validation Error';
    message = 'Invalid data provided';
  }
  
  // Send error response
  res.status(status).json({
    error,
    message,
    ...(config.nodeEnv === 'development' && { 
      details: err.message,
      stack: err.stack 
    })
  });
}

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.field = field;
  }
}

/**
 * Authorization error class
 */
export class AuthorizationError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.status = 401;
  }
}

/**
 * Forbidden error class
 */
export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.status = 403;
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}
