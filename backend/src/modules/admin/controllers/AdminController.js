const ResponseHandler = require('../../../utils/responseHandler');
const { getAdminAuthService } = require('../services/AdminAuthService');
const { getAdminUserService } = require('../services/AdminUserService');
const { getAdminGroupService } = require('../services/AdminGroupService');
const { getAdminChannelService } = require('../services/AdminChannelService');
const { getAdminFeatureService } = require('../services/AdminFeatureService');
const { getAdminReportService } = require('../services/AdminReportService');
const { getAdminAuditService } = require('../services/AdminAuditService');
const { getAdminAnalyticsService } = require('../services/AdminAnalyticsService');
const { getAdminBackupService } = require('../services/AdminBackupService');
const { getLogger } = require('../../../services/LoggerService');

class AdminController {
    constructor() {
        this.logger = null;
        this.services = {};
    }

    async initialize() {
        this.logger = getLogger();
        this.services.auth = await getAdminAuthService();
        this.services.user = await getAdminUserService();
        this.services.group = await getAdminGroupService();
        this.services.channel = await getAdminChannelService();
        this.services.feature = await getAdminFeatureService();
        this.services.report = await getAdminReportService();
        this.services.audit = await getAdminAuditService();
        this.services.analytics = await getAdminAnalyticsService();
        this.services.backup = await getAdminBackupService();
        
        this.logger.info('✅ Admin Controller initialized');
        return this;
    }

    /**
     * Admin login
     * POST /api/v1/admin/auth/login
     */
    login = async (req, res, next) => {
        try {
            const { username, password } = req.body;
            const { ip, userAgent } = req;

            const result = await this.services.auth.login(
                username,
                password,
                ip,
                userAgent
            );

            return ResponseHandler.success(res, result, 'Admin login successful');
        } catch (error) {
            this.logger.error('Admin login error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 401);
        }
    };

    /**
     * Admin logout
     * POST /api/v1/admin/auth/logout
     */
    logout = async (req, res, next) => {
        try {
            const { sessionId } = req;
            const adminId = req.admin.id;

            await this.services.auth.logout(sessionId, adminId);
            return ResponseHandler.success(res, null, 'Logged out successfully');
        } catch (error) {
            this.logger.error('Admin logout error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get current admin
     * GET /api/v1/admin/me
     */
    getMe = async (req, res, next) => {
        try {
            const admin = await this.services.auth.getAdminById(req.admin.id);
            return ResponseHandler.success(res, admin, 'Admin retrieved successfully');
        } catch (error) {
            this.logger.error('Get me error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get admin sessions
     * GET /api/v1/admin/sessions
     */
    getSessions = async (req, res, next) => {
        try {
            const sessions = await this.services.auth.getAdminSessions(req.admin.id);
            return ResponseHandler.success(res, sessions, 'Sessions retrieved successfully');
        } catch (error) {
            this.logger.error('Get sessions error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get dashboard stats
     * GET /api/v1/admin/dashboard
     */
    getDashboard = async (req, res, next) => {
        try {
            const stats = await this.services.analytics.getDashboardStats();
            return ResponseHandler.success(res, stats, 'Dashboard stats retrieved');
        } catch (error) {
            this.logger.error('Get dashboard error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    // User management
    getUsers = async (req, res, next) => {
        try {
            const { page = 1, limit = 20, ...filters } = req.query;
            const result = await this.services.user.getUsers(filters, { page, limit });
            return ResponseHandler.paginated(res, result.users, result.pagination, 'Users retrieved');
        } catch (error) {
            this.logger.error('Get users error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    getUser = async (req, res, next) => {
        try {
            const { userId } = req.params;
            const user = await this.services.user.getUser(userId);
            if (!user) {
                return ResponseHandler.notFound(res, 'User not found');
            }
            return ResponseHandler.success(res, user, 'User retrieved');
        } catch (error) {
            this.logger.error('Get user error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    suspendUser = async (req, res, next) => {
        try {
            const { userId } = req.params;
            const { reason } = req.body;
            const result = await this.services.user.suspendUser(userId, req.admin.id, reason);
            return ResponseHandler.success(res, result, 'User suspended');
        } catch (error) {
            this.logger.error('Suspend user error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    unsuspendUser = async (req, res, next) => {
        try {
            const { userId } = req.params;
            const result = await this.services.user.unsuspendUser(userId, req.admin.id);
            return ResponseHandler.success(res, result, 'User unsuspended');
        } catch (error) {
            this.logger.error('Unsuspend user error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    banUser = async (req, res, next) => {
        try {
            const { userId } = req.params;
            const { reason } = req.body;
            const result = await this.services.user.banUser(userId, req.admin.id, reason);
            return ResponseHandler.success(res, result, 'User banned');
        } catch (error) {
            this.logger.error('Ban user error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    unbanUser = async (req, res, next) => {
        try {
            const { userId } = req.params;
            const result = await this.services.user.unbanUser(userId, req.admin.id);
            return ResponseHandler.success(res, result, 'User unbanned');
        } catch (error) {
            this.logger.error('Unban user error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    // Feature management
    getFeatures = async (req, res, next) => {
        try {
            const features = await this.services.feature.getAllFeatures();
            return ResponseHandler.success(res, features, 'Features retrieved');
        } catch (error) {
            this.logger.error('Get features error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    toggleFeature = async (req, res, next) => {
        try {
            const { featureKey } = req.params;
            const { enabled, reason } = req.body;
            const result = await this.services.feature.toggleFeature(
                featureKey,
                enabled,
                req.admin.id,
                reason
            );
            return ResponseHandler.success(res, result, 'Feature toggled');
        } catch (error) {
            this.logger.error('Toggle feature error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    updateRollout = async (req, res, next) => {
        try {
            const { featureKey } = req.params;
            const { percentage, reason } = req.body;
            const result = await this.services.feature.updateRollout(
                featureKey,
                percentage,
                req.admin.id,
                reason
            );
            return ResponseHandler.success(res, result, 'Rollout updated');
        } catch (error) {
            this.logger.error('Update rollout error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    // Reports
    getReports = async (req, res, next) => {
        try {
            const { page = 1, limit = 20, ...filters } = req.query;
            const result = await this.services.report.getReports(filters, { page, limit });
            return ResponseHandler.paginated(res, result.reports, result.pagination, 'Reports retrieved');
        } catch (error) {
            this.logger.error('Get reports error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    resolveReport = async (req, res, next) => {
        try {
            const { reportId } = req.params;
            const { action, notes } = req.body;
            const result = await this.services.report.resolveReport(
                reportId,
                req.admin.id,
                action,
                notes
            );
            return ResponseHandler.success(res, result, 'Report resolved');
        } catch (error) {
            this.logger.error('Resolve report error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    // Audit logs
    getAuditLogs = async (req, res, next) => {
        try {
            const { page = 1, limit = 20, ...filters } = req.query;
            const result = await this.services.audit.getLogs(filters, { page, limit });
            return ResponseHandler.paginated(res, result.logs, result.pagination, 'Audit logs retrieved');
        } catch (error) {
            this.logger.error('Get audit logs error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    // System settings
    getSettings = async (req, res, next) => {
        try {
            const { category } = req.query;
            const settings = await this.services.audit.getSettings(category);
            return ResponseHandler.success(res, settings, 'Settings retrieved');
        } catch (error) {
            this.logger.error('Get settings error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    updateSettings = async (req, res, next) => {
        try {
            const result = await this.services.audit.updateSettings(req.body, req.admin.id);
            return ResponseHandler.success(res, result, 'Settings updated');
        } catch (error) {
            this.logger.error('Update settings error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    // Analytics
    getAnalytics = async (req, res, next) => {
        try {
            const { type, period, dateFrom, dateTo } = req.query;
            const data = await this.services.analytics.getAnalytics(
                type,
                period,
                dateFrom,
                dateTo
            );
            return ResponseHandler.success(res, data, 'Analytics retrieved');
        } catch (error) {
            this.logger.error('Get analytics error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    // Backup
    createBackup = async (req, res, next) => {
        try {
            const { type } = req.body;
            const result = await this.services.backup.createBackup(type || 'full', req.admin.id);
            return ResponseHandler.success(res, result, 'Backup started');
        } catch (error) {
            this.logger.error('Create backup error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    restoreBackup = async (req, res, next) => {
        try {
            const { backupId } = req.params;
            const result = await this.services.backup.restoreBackup(backupId, req.admin.id);
            return ResponseHandler.success(res, result, 'Restore started');
        } catch (error) {
            this.logger.error('Restore backup error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };
}

// Singleton instance
let adminControllerInstance = null;

const getAdminController = async () => {
    if (!adminControllerInstance) {
        adminControllerInstance = new AdminController();
        await adminControllerInstance.initialize();
    }
    return adminControllerInstance;
};

module.exports = {
    AdminController,
    getAdminController
};