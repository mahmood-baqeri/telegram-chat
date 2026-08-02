const ResponseHandler = require('../utils/responseHandler');

const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, {
            abortEarly: false,
            allowUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));
            return ResponseHandler.validationError(res, errors);
        }

        next();
    };
};

const validateParams = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.params, {
            abortEarly: false
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));
            return ResponseHandler.validationError(res, errors);
        }

        next();
    };
};

const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.query, {
            abortEarly: false
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));
            return ResponseHandler.validationError(res, errors);
        }

        next();
    };
};

module.exports = {
    validate,
    validateParams,
    validateQuery
};