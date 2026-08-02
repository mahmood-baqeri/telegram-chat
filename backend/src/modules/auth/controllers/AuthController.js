const ResponseHandler = require('../../../utils/responseHandler');
const { getAuthService } = require('../services/AuthService');
const { getLogger } = require('../../../services/LoggerService');

class AuthController {
    constructor() {
        this.authService = null;
        this.logger = null;
    }

    async initialize() {
        this.authService = await getAuthService();
        this.logger = getLogger();
        return this;
    }

    /**
     * Send OTP
     * POST /api/v1/auth/send-otp
     */
    sendOTP = async (req, res, next) => {
        try {
            const { phone } = req.body;
            const { ip, userAgent } = req;
            const deviceData = {
                ip,
                country: req.headers['cf-ipcountry'],
                language: req.headers['accept-language']?.split(',')[0],
                timezone: req.headers['timezone'],
                deviceType: req.headers['device-type'] || 'web',
                browser: req.headers['browser'],
                os: req.headers['os']
            };

            const result = await this.authService.sendOTP(
                phone,
                deviceData,
                ip,
                userAgent
            );

            return ResponseHandler.success(res, result, 'OTP sent successfully');
        } catch (error) {
            this.logger.error('Send OTP error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Verify OTP
     * POST /api/v1/auth/verify-otp
     */
    verifyOTP = async (req, res, next) => {
        try {
            const { phone, code } = req.body;
            const { ip, userAgent } = req;
            const deviceData = {
                ip,
                country: req.headers['cf-ipcountry'],
                language: req.headers['accept-language']?.split(',')[0],
                timezone: req.headers['timezone'],
                deviceType: req.headers['device-type'] || 'web',
                browser: req.headers['browser'],
                os: req.headers['os'],
                deviceName: req.headers['device-name'] || 'Unknown Device',
                deviceHash: req.headers['device-hash'] || null,
                fingerprint: req.headers['fingerprint'] || null,
                pushToken: req.headers['push-token'] || null
            };

            const result = await this.authService.verifyOTP(
                phone,
                code,
                deviceData,
                ip,
                userAgent
            );

            return ResponseHandler.success(res, result, 'Authentication successful');
        } catch (error) {
            this.logger.error('Verify OTP error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Refresh token
     * POST /api/v1/auth/refresh-token
     */
    refreshToken = async (req, res, next) => {
        try {
            const { refreshToken } = req.body;
            
            if (!refreshToken) {
                return ResponseHandler.error(res, 'Refresh token required', 400);
            }

            const result = await this.authService.refreshToken(refreshToken);
            return ResponseHandler.success(res, result, 'Token refreshed successfully');
        } catch (error) {
            this.logger.error('Refresh token error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 401);
        }
    };

    /**
     * Logout
     * POST /api/v1/auth/logout
     */
    logout = async (req, res, next) => {
        try {
            const { sessionId } = req.body || {};
            const userId = req.user.id;

            await this.authService.logout(userId, sessionId || req.sessionId);
            return ResponseHandler.success(res, null, 'Logged out successfully');
        } catch (error) {
            this.logger.error('Logout error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Logout from all devices
     * POST /api/v1/auth/logout-all
     */
    logoutAll = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const { sessionId } = req;

            const result = await this.authService.logoutAll(userId, sessionId);
            return ResponseHandler.success(res, result, 'Logged out from all devices');
        } catch (error) {
            this.logger.error('Logout all error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get current user
     * GET /api/v1/auth/me
     */
    getMe = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const user = await this.authService.getCurrentUser(userId);
            return ResponseHandler.success(res, user, 'User retrieved successfully');
        } catch (error) {
            this.logger.error('Get me error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get user sessions
     * GET /api/v1/auth/sessions
     */
    getSessions = async (req, res, next) => {
        try {
            const userId = req.user.id;
            const sessions = await this.authService.sessionService.getUserSessions(userId);
            return ResponseHandler.success(res, sessions, 'Sessions retrieved successfully');
        } catch (error) {
            this.logger.error('Get sessions error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };
}

// Singleton instance
let authControllerInstance = null;

const getAuthController = async () => {
    if (!authControllerInstance) {
        authControllerInstance = new AuthController();
        await authControllerInstance.initialize();
    }
    return authControllerInstance;
};

module.exports = {
    AuthController,
    getAuthController
};