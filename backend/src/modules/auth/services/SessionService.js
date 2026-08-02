const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { Session, Device } = require('../../../database/models');
const { getCacheService } = require('../../../services/CacheService');
const { getLogger } = require('../../../services/LoggerService');
const { getEventBus } = require('../../../services/EventBus');
const JWTService = require('./JWTService');
const config = require('../../../config');

class SessionService {
    constructor() {
        this.cache = null;
        this.logger = null;
        this.eventBus = null;
        this.jwtService = new JWTService();
        this.sessionTimeout = config.security.sessionTimeout;
    }

    async initialize() {
        this.cache = await getCacheService();
        this.logger = getLogger();
        this.eventBus = await getEventBus();
        this.logger.info('✅ Session Service initialized');
        return this;
    }

    /**
     * Create new session
     */
    async createSession(userId, deviceData, ip, userAgent) {
        try {
            // Create or get device
            const device = await this.getOrCreateDevice(userId, deviceData);

            // Generate tokens
            const sessionId = uuidv4();
            const tokens = this.jwtService.generateTokens({
                userId,
                deviceId: device.id,
                sessionId
            });

            // Create session
            const session = await Session.create({
                uuid: sessionId,
                user_id: userId,
                device_id: device.id,
                session_token: this.jwtService.hashToken(tokens.accessToken),
                refresh_token: this.jwtService.hashToken(tokens.refreshToken),
                access_token: tokens.accessToken,
                push_token: deviceData.pushToken || null,
                ip,
                user_agent: userAgent,
                browser: deviceData.browser || null,
                os: deviceData.os || null,
                device_type: deviceData.deviceType || 'web',
                is_trusted: deviceData.isTrusted || false,
                is_active: true,
                expires_at: new Date(Date.now() + this.sessionTimeout * 1000),
                last_activity_at: new Date()
            });

            // Cache session
            await this.cache.set(
                `session:${session.uuid}`,
                {
                    userId,
                    deviceId: device.id,
                    isActive: true,
                    isTrusted: device.is_trusted
                },
                this.sessionTimeout
            );

            // Publish event
            await this.eventBus.publish('user.session.created', {
                userId,
                sessionId: session.uuid,
                deviceId: device.id,
                deviceType: deviceData.deviceType,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`Session created for user ${userId}`, {
                userId,
                sessionId: session.uuid,
                deviceType: deviceData.deviceType
            });

            return {
                sessionId: session.uuid,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: tokens.expiresIn,
                refreshExpiresIn: tokens.refreshExpiresIn,
                device: {
                    id: device.uuid,
                    name: device.device_name,
                    type: device.device_type
                }
            };

        } catch (error) {
            this.logger.error('Failed to create session', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Get or create device
     */
    async getOrCreateDevice(userId, deviceData) {
        // Check if device already exists
        let device = await Device.findOne({
            where: {
                user_id: userId,
                device_hash: deviceData.deviceHash
            }
        });

        if (!device) {
            device = await Device.create({
                uuid: uuidv4(),
                user_id: userId,
                device_name: deviceData.deviceName || 'Unknown Device',
                device_type: deviceData.deviceType || 'web',
                platform: deviceData.platform || 'web',
                browser: deviceData.browser || null,
                os: deviceData.os || null,
                os_version: deviceData.osVersion || null,
                app_version: deviceData.appVersion || null,
                device_model: deviceData.deviceModel || null,
                device_hash: deviceData.deviceHash || this.generateDeviceHash(deviceData),
                fingerprint: deviceData.fingerprint || null,
                ip: deviceData.ip || null,
                location: deviceData.location || null,
                is_trusted: deviceData.isTrusted || false,
                is_active: true,
                last_used_at: new Date()
            });
        } else {
            // Update device info
            device.last_used_at = new Date();
            device.ip = deviceData.ip || device.ip;
            device.location = deviceData.location || device.location;
            await device.save();
        }

        return device;
    }

    /**
     * Validate session
     */
    async validateSession(sessionId, accessToken) {
        try {
            // Check cache first
            const cached = await this.cache.get(`session:${sessionId}`);
            if (cached) {
                return cached;
            }

            // Check database
            const session = await Session.findOne({
                where: {
                    uuid: sessionId,
                    is_active: true,
                    expires_at: {
                        [Op.gt]: new Date()
                    }
                },
                include: ['user']
            });

            if (!session) {
                throw new Error('Invalid or expired session');
            }

            // Validate token
            const hashedToken = this.jwtService.hashToken(accessToken);
            if (session.session_token !== hashedToken) {
                throw new Error('Invalid access token');
            }

            // Update last activity
            session.last_activity_at = new Date();
            await session.save();

            const sessionData = {
                userId: session.user_id,
                deviceId: session.device_id,
                isActive: session.is_active,
                isTrusted: session.is_trusted,
                user: session.user
            };

            // Cache session
            await this.cache.set(
                `session:${sessionId}`,
                sessionData,
                Math.min(300, this.sessionTimeout)
            );

            return sessionData;

        } catch (error) {
            this.logger.error('Failed to validate session', { error: error.message, sessionId });
            throw error;
        }
    }

    /**
     * Refresh session
     */
    async refreshSession(refreshToken) {
        try {
            // Verify refresh token
            const decoded = this.jwtService.verifyRefreshToken(refreshToken);
            
            // Find session
            const session = await Session.findOne({
                where: {
                    uuid: decoded.sessionId,
                    is_active: true,
                    expires_at: {
                        [Op.gt]: new Date()
                    }
                }
            });

            if (!session) {
                throw new Error('Invalid refresh token');
            }

            // Generate new tokens
            const newTokens = this.jwtService.generateTokens({
                userId: decoded.userId,
                deviceId: decoded.deviceId,
                sessionId: decoded.sessionId
            });

            // Update session
            session.session_token = this.jwtService.hashToken(newTokens.accessToken);
            session.refresh_token = this.jwtService.hashToken(newTokens.refreshToken);
            session.access_token = newTokens.accessToken;
            session.last_activity_at = new Date();
            await session.save();

            // Clear cache
            await this.cache.delete(`session:${session.uuid}`);

            return {
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken,
                expiresIn: newTokens.expiresIn,
                refreshExpiresIn: newTokens.refreshExpiresIn
            };

        } catch (error) {
            this.logger.error('Failed to refresh session', { error: error.message });
            throw error;
        }
    }

    /**
     * Terminate session
     */
    async terminateSession(sessionId, userId) {
        try {
            const session = await Session.findOne({
                where: {
                    uuid: sessionId,
                    user_id: userId
                }
            });

            if (!session) {
                throw new Error('Session not found');
            }

            session.is_active = false;
            await session.save();

            // Clear cache
            await this.cache.delete(`session:${sessionId}`);

            // Publish event
            await this.eventBus.publish('user.session.terminated', {
                userId,
                sessionId,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`Session terminated: ${sessionId}`, { userId, sessionId });

            return { success: true };

        } catch (error) {
            this.logger.error('Failed to terminate session', { error: error.message, sessionId });
            throw error;
        }
    }

    /**
     * Terminate all sessions for user
     */
    async terminateAllSessions(userId, exceptSessionId = null) {
        try {
            const where = {
                user_id: userId,
                is_active: true
            };

            if (exceptSessionId) {
                where.uuid = { [Op.ne]: exceptSessionId };
            }

            const sessions = await Session.findAll({ where });
            
            for (const session of sessions) {
                session.is_active = false;
                await session.save();
                await this.cache.delete(`session:${session.uuid}`);
            }

            this.logger.info(`All sessions terminated for user ${userId}`, {
                userId,
                count: sessions.length
            });

            return { success: true, terminated: sessions.length };

        } catch (error) {
            this.logger.error('Failed to terminate all sessions', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Get user sessions
     */
    async getUserSessions(userId) {
        try {
            const sessions = await Session.findAll({
                where: {
                    user_id: userId,
                    is_active: true
                },
                include: ['user'],
                order: [['created_at', 'DESC']]
            });

            return sessions.map(session => ({
                id: session.uuid,
                deviceType: session.device_type,
                browser: session.browser,
                os: session.os,
                ip: session.ip,
                location: session.location,
                isTrusted: session.is_trusted,
                createdAt: session.created_at,
                lastActivityAt: session.last_activity_at,
                expiresAt: session.expires_at
            }));

        } catch (error) {
            this.logger.error('Failed to get user sessions', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Generate device hash
     */
    generateDeviceHash(deviceData) {
        const components = [
            deviceData.deviceName,
            deviceData.os,
            deviceData.browser,
            deviceData.platform,
            deviceData.fingerprint
        ].filter(Boolean);
        
        const str = components.join('|');
        return crypto
            .createHash('sha256')
            .update(str)
            .digest('hex')
            .substring(0, 32);
    }
}

// Singleton instance
let sessionServiceInstance = null;

const getSessionService = async () => {
    if (!sessionServiceInstance) {
        sessionServiceInstance = new SessionService();
        await sessionServiceInstance.initialize();
    }
    return sessionServiceInstance;
};

module.exports = {
    SessionService,
    getSessionService
};