const express = require('express');
const router = express.Router();
const { getAuthController } = require('../controllers/AuthController');
const { validate } = require('../../../middlewares/validator');
const { auth } = require('../../../middlewares/auth');
const Joi = require('joi');

const authControllerPromise = getAuthController();

// Validation schemas
const sendOTPSchema = Joi.object({
    phone: Joi.string()
        .pattern(/^[0-9]{10,15}$/)
        .required()
        .messages({
            'string.pattern.base': 'Phone number must be 10-15 digits',
            'any.required': 'Phone number is required'
        })
});

const verifyOTPSchema = Joi.object({
    phone: Joi.string()
        .pattern(/^[0-9]{10,15}$/)
        .required(),
    code: Joi.string()
        .length(4)
        .pattern(/^[0-9]{4}$/)
        .required()
        .messages({
            'string.length': 'OTP must be 4 digits',
            'string.pattern.base': 'OTP must be numeric'
        })
});

const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required()
});

// Routes
router.post('/send-otp', 
    validate(sendOTPSchema),
    async (req, res, next) => {
        const controller = await authControllerPromise;
        return controller.sendOTP(req, res, next);
    }
);

router.post('/verify-otp',
    validate(verifyOTPSchema),
    async (req, res, next) => {
        const controller = await authControllerPromise;
        return controller.verifyOTP(req, res, next);
    }
);

router.post('/refresh-token',
    validate(refreshTokenSchema),
    async (req, res, next) => {
        const controller = await authControllerPromise;
        return controller.refreshToken(req, res, next);
    }
);

router.post('/logout',
    auth,
    async (req, res, next) => {
        const controller = await authControllerPromise;
        return controller.logout(req, res, next);
    }
);

router.post('/logout-all',
    auth,
    async (req, res, next) => {
        const controller = await authControllerPromise;
        return controller.logoutAll(req, res, next);
    }
);

router.get('/me',
    auth,
    async (req, res, next) => {
        const controller = await authControllerPromise;
        return controller.getMe(req, res, next);
    }
);

router.get('/sessions',
    auth,
    async (req, res, next) => {
        const controller = await authControllerPromise;
        return controller.getSessions(req, res, next);
    }
);

module.exports = router;