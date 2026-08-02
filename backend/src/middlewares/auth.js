const { getCacheService } = require('../services/CacheService');
const { getLogger } = require('../services/LoggerService');
const { getAuthService } = require('../modules/auth/services/AuthService');
const ResponseHandler = require('../utils/responseHandler');
const config = require('../config');

const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return ResponseHandler.unauthorized(res, 'No token provided');
        }

        const token = authHeader.substring(7);
        const sessionId = req.headers['x-session-id'];

        if (!sessionId) {
            return ResponseHandler.unauthorized(res, 'No session ID provided');
        }

        const cache = await getCacheService();
        const logger = getLogger();
        const authService = await getAuthService();

        // Check blacklist
        const isBlacklisted = await cache.get(`blacklist:token:${token}`);
        if (isBlacklisted) {
            return ResponseHandler.unauthorized(res, 'Token has been revoked');
        }

        // Validate session
        const sessionData = await authService.validateSession(sessionId, token);
        
        // Attach user and session to request
        req.user = sessionData.user;
        req.sessionId = sessionId;
        req.deviceId = sessionData.deviceId;
        req.isTrusted = sessionData.isTrusted;

        // Update user status if online
        if (req.user && req.user.status !== 'online') {
            req.user.status = 'online';
            await req.user.save();
        }

        next();
    } catch (error) {
        const logger = getLogger();
        logger.error('Auth middleware error:', { error: error.message });
        return ResponseHandler.unauthorized(res, error.message || 'Invalid token');
    }
};

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const sessionId = req.headers['x-session-id'];

            if (sessionId) {
                const authService = await getAuthService();
                const sessionData = await authService.validateSession(sessionId, token);
                req.user = sessionData.user;
                req.sessionId = sessionId;
                req.deviceId = sessionData.deviceId;
                req.isTrusted = sessionData.isTrusted;
            }
        }
        next();
    } catch (error) {
        // Ignore errors for optional auth
        next();
    }
};

module.exports = {
    auth,
    optionalAuth
};