const { getLogger } = require('../services/LoggerService');
const ResponseHandler = require('../utils/responseHandler');
const { ValidationError } = require('joi');

const errorHandler = (err, req, res, next) => {
    const logger = getLogger();
    
    // Log error
    logger.error('Error occurred:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id
    });

    // Handle specific error types
    if (err instanceof ValidationError) {
        const errors = err.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        return ResponseHandler.validationError(res, errors);
    }

    if (err.name === 'SequelizeValidationError') {
        const errors = err.errors.map(e => ({
            field: e.path,
            message: e.message
        }));
        return ResponseHandler.validationError(res, errors);
    }

    if (err.name === 'SequelizeUniqueConstraintError') {
        const errors = err.errors.map(e => ({
            field: e.path,
            message: `${e.path} already exists`
        }));
        return ResponseHandler.validationError(res, errors);
    }

    if (err.name === 'JsonWebTokenError') {
        return ResponseHandler.unauthorized(res, 'Invalid token');
    }

    if (err.name === 'TokenExpiredError') {
        return ResponseHandler.unauthorized(res, 'Token expired');
    }

    // Default error
    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? 'Internal server error' : err.message;
    
    return ResponseHandler.error(res, message, statusCode);
};

const notFoundHandler = (req, res) => {
    return ResponseHandler.notFound(res, `Route ${req.method} ${req.path} not found`);
};

module.exports = {
    errorHandler,
    notFoundHandler
};