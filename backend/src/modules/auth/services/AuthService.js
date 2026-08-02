const { User } = require('../../../database/models');
const { getLogger } = require('../../../services/LoggerService');
const { getEventBus } = require('../../../services/EventBus');
const { getOTPService } = require('./OTPService');
const { getSessionService } = require('./SessionService');
const { getFeatureToggleService } = require('../../../services/FeatureToggleService');
const ResponseHandler = require('../../../utils/responseHandler');

class AuthService {
    constructor() {
        this.logger = null;
        this.eventBus = null;
        this.otpService = null;
        this.sessionService = null;
        this.featureService = null;
    }

    async initialize() {
        this.logger = getLogger();
        this.eventBus = await getEventBus();
        this.otpService = await getOTPService();
        this.sessionService = await getSessionService();
        this.featureService = await getFeatureToggleService();
        this.logger.info('✅ Auth Service initialized');
        return this;
    }

    /**
     * Send OTP for login/registration
     */
    async sendOTP(phone, deviceData, ip, userAgent) {
        // Check if registration is enabled
        const registrationEnabled = await this.featureService.isEnabled('registration.enabled');
        if (!registrationEnabled) {
            throw new Error('Registration is currently disabled');
        }

        // Send OTP
        const result = await this.otpService.sendOTP(phone);
        
        // Check if user exists
        const user = await User.findOne({ where: { phone } });
        
        return {
            ...result,
            isNewUser: !user
        };
    }

    /**
     * Verify OTP and login/register
     */
    async verifyOTP(phone, code, deviceData, ip, userAgent) {
        // Verify OTP
        await this.otpService.verifyOTP(phone, code);

        // Find or create user
        let user = await User.findOne({ where: { phone } });

        if (!user) {
            // Create new user
            user = await this.createUser(phone, deviceData);
        } else {
            // Update user status
            user.last_login_at = new Date();
            user.last_login_ip = ip;
            user.status = 'online';
            await user.save();
        }

        // Create session
        const session = await this.sessionService.createSession(
            user.id,
            deviceData,
            ip,
            userAgent
        );

        // Publish event
        await this.eventBus.publish('user.logged_in', {
            userId: user.uuid,
            phone: user.phone,
            isNew: !user.last_login_at,
            timestamp: new Date().toISOString()
        });

        return {
            user: user.toJSON(),
            ...session
        };
    }

    /**
     * Create new user
     */
    async createUser(phone, deviceData) {
        const username = this.generateUsername(phone);
        
        const user = await User.create({
            phone,
            phone_country: deviceData.country || 'IR',
            phone_verified: true,
            display_name: `User ${phone.slice(-4)}`,
            username,
            language: deviceData.language || 'fa',
            timezone: deviceData.timezone || 'Asia/Tehran',
            status: 'online',
            last_login_at: new Date(),
            last_activity_at: new Date()
        });

        // Publish event
        await this.eventBus.publish('user.registered', {
            userId: user.uuid,
            phone: user.phone,
            timestamp: new Date().toISOString()
        });

        this.logger.info(`New user registered: ${user.uuid}`, {
            userId: user.uuid,
            phone: user.phone
        });

        return user;
    }

    /**
     * Generate username from phone
     */
    generateUsername(phone) {
        const base = `user_${phone.slice(-4)}`;
        let username = base;
        let counter = 1;

        // Keep trying until unique username found
        while (true) {
            const exists = User.findOne({ where: { username } });
            if (!exists) break;
            username = `${base}_${counter}`;
            counter++;
        }

        return username;
    }

    /**
     * Logout user
     */
    async logout(userId, sessionId) {
        await this.sessionService.terminateSession(sessionId, userId);

        await this.eventBus.publish('user.logged_out', {
            userId,
            sessionId,
            timestamp: new Date().toISOString()
        });

        return { success: true };
    }

    /**
     * Logout from all devices
     */
    async logoutAll(userId, exceptSessionId = null) {
        const result = await this.sessionService.terminateAllSessions(userId, exceptSessionId);

        await this.eventBus.publish('user.logged_out_all', {
            userId,
            count: result.terminated,
            timestamp: new Date().toISOString()
        });

        return result;
    }

    /**
     * Refresh access token
     */
    async refreshToken(refreshToken) {
        return await this.sessionService.refreshSession(refreshToken);
    }

    /**
     * Get current user
     */
    async getCurrentUser(userId) {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error('User not found');
        }
        return user.toJSON();
    }

    /**
     * Validate session
     */
    async validateSession(sessionId, accessToken) {
        return await this.sessionService.validateSession(sessionId, accessToken);
    }
}

// Singleton instance
let authServiceInstance = null;

const getAuthService = async () => {
    if (!authServiceInstance) {
        authServiceInstance = new AuthService();
        await authServiceInstance.initialize();
    }
    return authServiceInstance;
};

module.exports = {
    AuthService,
    getAuthService
};