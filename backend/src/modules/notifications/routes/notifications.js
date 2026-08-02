const express = require('express');
const router = express.Router();
const { getNotificationController } = require('../controllers/NotificationController');
const { auth } = require('../../../middlewares/auth');
const { validate } = require('../../../middlewares/validator');
const Joi = require('joi');

const notificationControllerPromise = getNotificationController();

const registerDeviceSchema = Joi.object({
    deviceUuid: Joi.string().uuid().required(),
    platform: Joi.string().valid('ios', 'android', 'web', 'desktop').required(),
    pushToken: Joi.string().required(),
    provider: Joi.string().valid('fcm', 'apns', 'huawei', 'web')
});

router.get('/',
    auth,
    async (req, res, next) => {
        const controller = await notificationControllerPromise;
        return controller.getNotifications(req, res, next);
    }
);

router.put('/:id/read',
    auth,
    async (req, res, next) => {
        const controller = await notificationControllerPromise;
        return controller.markAsRead(req, res, next);
    }
);

router.put('/read-all',
    auth,
    async (req, res, next) => {
        const controller = await notificationControllerPromise;
        return controller.markAllAsRead(req, res, next);
    }
);

router.post('/devices',
    auth,
    validate(registerDeviceSchema),
    async (req, res, next) => {
        const controller = await notificationControllerPromise;
        return controller.registerDevice(req, res, next);
    }
);

router.delete('/devices/:id',
    auth,
    async (req, res, next) => {
        const controller = await notificationControllerPromise;
        return controller.unregisterDevice(req, res, next);
    }
);

module.exports = router;