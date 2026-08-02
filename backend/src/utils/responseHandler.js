/**
 * Standard API Response Handler
 * All responses follow the same structure
 */

class ResponseHandler {
    /**
     * Success response
     */
    static success(res, data = null, message = 'Success', statusCode = 200) {
        const response = {
            success: true,
            message,
            data,
            timestamp: new Date().toISOString(),
            requestId: res.locals.requestId || null
        };

        return res.status(statusCode).json(response);
    }

    /**
     * Paginated success response
     */
    static paginated(res, data, pagination, message = 'Success') {
        const response = {
            success: true,
            message,
            data,
            pagination: {
                page: pagination.page || 1,
                limit: pagination.limit || 20,
                total: pagination.total || data.length,
                totalPages: pagination.totalPages || 1,
                nextPage: pagination.nextPage || null,
                prevPage: pagination.prevPage || null
            },
            timestamp: new Date().toISOString(),
            requestId: res.locals.requestId || null
        };

        return res.status(200).json(response);
    }

    /**
     * Error response
     */
    static error(res, message = 'An error occurred', statusCode = 500, errors = null) {
        const response = {
            success: false,
            message,
            errors: errors || [],
            timestamp: new Date().toISOString(),
            requestId: res.locals.requestId || null
        };

        return res.status(statusCode).json(response);
    }

    /**
     * Validation error response
     */
    static validationError(res, errors) {
        return this.error(res, 'Validation failed', 400, errors);
    }

    /**
     * Unauthorized response
     */
    static unauthorized(res, message = 'Unauthorized') {
        return this.error(res, message, 401);
    }

    /**
     * Forbidden response
     */
    static forbidden(res, message = 'Forbidden') {
        return this.error(res, message, 403);
    }

    /**
     * Not found response
     */
    static notFound(res, message = 'Resource not found') {
        return this.error(res, message, 404);
    }

    /**
     * Created response
     */
    static created(res, data = null, message = 'Created successfully') {
        return this.success(res, data, message, 201);
    }

    /**
     * No content response
     */
    static noContent(res) {
        return res.status(204).send();
    }
}

module.exports = ResponseHandler;