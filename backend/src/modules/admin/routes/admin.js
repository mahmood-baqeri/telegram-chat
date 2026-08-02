const express = require('express');
const router = express.Router();
const { getAdminController } = require('../controllers/AdminController');
const { auth } = require('../../../middlewares/auth');
const { validate } = require('../../../middlewares/validator');
const Joi = require('joi');

const adminControllerPromise = getAdminController();

// Admin auth middleware
const adminAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const sessionId = req.headers['x-session-id'];

        if (!sessionId) {
            return res.status(401).json({ success: false, message: 'No session ID provided' });
        }

        const adminAuthService = await getAdminAuthService();
        const sessionData = await adminAuthService.validateSession(sessionId, token);

        req.admin = sessionData.admin;
        req.sessionId = sessionId;

        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: error.message || 'Invalid token' });
    }
};

// Admin permission middleware
const adminPermission = (permission) => {
    return async (req, res, next) => {
        try {
            const adminAuthService = await getAdminAuthService();
            const hasPermission = await adminAuthService.hasPermission(req.admin.id, permission);
            
            if (!hasPermission) {
                return res.status(403).json({ success: false, message: 'Insufficient permissions' });
            }
            next();
        } catch (error) {
            return res.status(403).json({ success: false, message: 'Permission check failed' });
        }
    };
};

// Validation schemas
const loginSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
});

const toggleFeatureSchema = Joi.object({
    enabled: Joi.boolean().required(),
    reason: Joi.string()
});

const updateRolloutSchema = Joi.object({
    percentage: Joi.number().min(0).max(100).required(),
    reason: Joi.string()
});

const resolveReportSchema = Joi.object({
    action: Joi.string().valid('warn', 'mute', 'ban', 'delete', 'ignore'),
    notes: Joi.string()
});

const updateSettingsSchema = Joi.object({
    settings: Joi.object().required()
});

// Auth routes
router.post('/auth/login',
    validate(loginSchema),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.login(req, res, next);
    }
);

router.post('/auth/logout',
    adminAuth,
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.logout(req, res, next);
    }
);

router.get('/me',
    adminAuth,
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.getMe(req, res, next);
    }
);

router.get('/sessions',
    adminAuth,
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.getSessions(req, res, next);
    }
);

// Dashboard
router.get('/dashboard',
    adminAuth,
    adminPermission('analytics.view'),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.getDashboard(req, res, next);
    }
);

// User management
router.get('/users',
    adminAuth,
    adminPermission('user.view'),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.getUsers(req, res, next);
    }
);

router.get('/users/:userId',
    adminAuth,
    adminPermission('user.view'),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.getUser(req, res, next);
    }
);

router.post('/users/:userId/suspend',
    adminAuth,
    adminPermission('user.manage'),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.suspendUser(req, res, next);
    }
);

router.post('/users/:userId/unsuspend',
    adminAuth,
    adminPermission('user.manage'),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.unsuspendUser(req, res, next);
    }
);

router.post('/users/:userId/ban',
    adminAuth,
    adminPermission('user.manage'),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.banUser(req, res, next);
    }
);

router.post('/users/:userId/unban',
    adminAuth,
    adminPermission('user.manage'),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.unbanUser(req, res, next);
    }
);

// Feature management
router.get('/features',
    adminAuth,
    adminPermission('feature.view'),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.getFeatures(req, res, next);
    }
);

router.put('/features/:featureKey/toggle',
    adminAuth,
    adminPermission('feature.toggle'),
    validate(toggleFeatureSchema),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.toggleFeature(req, res, next);
    }
);

router.put('/features/:featureKey/rollout',
    adminAuth,
    adminPermission('feature.manage'),
    validate(updateRolloutSchema),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.updateRollout(req, res, next);
    }
);

// Reports
router.get('/reports',
    adminAuth,
    adminPermission('reports.view'),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.getReports(req, res, next);
    }
);

router.put('/reports/:reportId/resolve',
    adminAuth,
    adminPermission('reports.resolve'),
    validate(resolveReportSchema),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.resolveReport(req, res, next);
    }
);

// Audit logs
router.get('/audit-logs',
    adminAuth,
    adminPermission('audit.view'),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.getAuditLogs(req, res, next);
    }
);

// System settings
router.get('/settings',
    adminAuth,
    adminPermission('config.view'),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.getSettings(req, res, next);
    }
);

router.put('/settings',
    adminAuth,
    adminPermission('config.edit'),
    validate(updateSettingsSchema),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.updateSettings(req, res, next);
    }
);

// Analytics
router.get('/analytics',
    adminAuth,
    adminPermission('analytics.view'),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.getAnalytics(req, res, next);
    }
);

// Backup
router.post('/backup',
    adminAuth,
    adminPermission('backup.create'),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.createBackup(req, res, next);
    }
);

router.post('/backup/:backupId/restore',
    adminAuth,
    adminPermission('backup.restore'),
    async (req, res, next) => {
        const controller = await adminControllerPromise;
        return controller.restoreBackup(req, res, next);
    }
);

module.exports = router;