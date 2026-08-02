const crypto = require('crypto');
const { Op } = require('sequelize');
const { OTP } = require('../../../database/models');
const { getCacheService } = require('../../../services/CacheService');
const { getLogger } = require('../../../services/LoggerService');
const { getEventBus } = require('../../../services/EventBus');
const config = require('../../../config');

class OTPService {
    constructor() {
        this.cache = null;
        this.logger = null;
        this.eventBus = null;
        this.otpLength = config.otp.length;
        this.otpExpiration = config.otp.expiration;
        this.maxAttempts = config.otp.maxAttempts;
        this.resendDelay = config.otp.resendDelay;
        this.dailyLimit = config.otp.dailyLimit;
    }

    async initialize() {
        this.cache = await getCacheService();
        this.logger = getLogger();
        this.eventBus = await getEventBus();
        this.logger.info('✅ OTP Service initialized');
        return this;
    }

    /**
     * Generate OTP code
     */
    generateOTP() {
        const digits = '0123456789';
        let otp = '';
        for (let i = 0; i < this.otpLength; i++) {
            otp += digits[Math.floor(Math.random() * 10)];
        }
        return otp;
    }

    /**
     * Send OTP to phone
     */
    async sendOTP(phone, provider = 'sms') {
        try {
            // Validate phone
            if (!this.validatePhone(phone)) {
                throw new Error('Invalid phone number format');
            }

            // Check daily limit
            const dailyCount = await this.getDailyCount(phone);
            if (dailyCount >= this.dailyLimit) {
                throw new Error('Daily OTP limit exceeded');
            }

            // Check resend delay
            const lastOTP = await OTP.findOne({
                where: {
                    phone,
                    is_verified: false,
                    created_at: {
                        [Op.gt]: new Date(Date.now() - this.resendDelay * 1000)
                    }
                },
                order: [['created_at', 'DESC']]
            });

            if (lastOTP) {
                throw new Error(`Please wait ${this.resendDelay} seconds before requesting another OTP`);
            }

            // Generate OTP
            const code = this.generateOTP();
            const expiresAt = new Date(Date.now() + this.otpExpiration * 1000);

            // Store OTP in database
            const otp = await OTP.create({
                phone,
                code,
                expires_at: expiresAt,
                max_attempts: this.maxAttempts
            });

            // Store in cache for faster verification
            await this.cache.set(
                `otp:${phone}:${code}`,
                { code, expiresAt, attempts: 0 },
                this.otpExpiration
            );

            // Increment daily count
            await this.incrementDailyCount(phone);

            // Send OTP via provider (SMS, WhatsApp, etc.)
            await this.sendViaProvider(phone, code, provider);

            // Publish event
            await this.eventBus.publish('user.otp.requested', {
                phone,
                provider,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`OTP sent to ${phone}`, { phone, provider });

            return {
                success: true,
                message: 'OTP sent successfully',
                expiresIn: this.otpExpiration,
                resendAfter: this.resendDelay
            };

        } catch (error) {
            this.logger.error('Failed to send OTP', { error: error.message, phone });
            throw error;
        }
    }

    /**
     * Verify OTP code
     */
    async verifyOTP(phone, code) {
        try {
            // Find OTP in database
            const otp = await OTP.findOne({
                where: {
                    phone,
                    code,
                    is_verified: false,
                    expires_at: {
                        [Op.gt]: new Date()
                    }
                }
            });

            if (!otp) {
                // Check if OTP exists but expired
                const expiredOTP = await OTP.findOne({
                    where: {
                        phone,
                        code,
                        is_verified: false,
                        expires_at: {
                            [Op.lte]: new Date()
                        }
                    }
                });

                if (expiredOTP) {
                    throw new Error('OTP has expired. Please request a new one.');
                }

                // Increment attempts for existing OTP
                const existingOTP = await OTP.findOne({
                    where: {
                        phone,
                        code
                    }
                });

                if (existingOTP) {
                    existingOTP.attempts += 1;
                    await existingOTP.save();

                    if (existingOTP.attempts >= existingOTP.max_attempts) {
                        throw new Error('Too many failed attempts. Please request a new OTP.');
                    }
                }

                throw new Error('Invalid OTP code');
            }

            // Check attempts
            if (otp.attempts >= otp.max_attempts) {
                throw new Error('Too many failed attempts. Please request a new OTP.');
            }

            // Mark as verified
            await otp.markVerified();

            // Clear cache
            await this.cache.delete(`otp:${phone}:${code}`);

            // Publish event
            await this.eventBus.publish('user.otp.verified', {
                phone,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`OTP verified for ${phone}`);

            return {
                success: true,
                message: 'OTP verified successfully',
                phone
            };

        } catch (error) {
            this.logger.error('Failed to verify OTP', { error: error.message, phone });
            throw error;
        }
    }

    /**
     * Resend OTP
     */
    async resendOTP(phone) {
        // Invalidate existing OTPs
        await OTP.update(
            { is_verified: true },
            {
                where: {
                    phone,
                    is_verified: false
                }
            }
        );

        // Send new OTP
        return await this.sendOTP(phone);
    }

    /**
     * Validate phone number format
     */
    validatePhone(phone) {
        // Simple validation - can be extended with country-specific rules
        const phoneRegex = /^[0-9]{10,15}$/;
        return phoneRegex.test(phone);
    }

    /**
     * Get daily OTP count for phone
     */
    async getDailyCount(phone) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const count = await OTP.count({
            where: {
                phone,
                created_at: {
                    [Op.gte]: today
                }
            }
        });

        return count;
    }

    /**
     * Increment daily OTP count
     */
    async incrementDailyCount(phone) {
        const today = new Date().toISOString().split('T')[0];
        const key = `otp:daily:${phone}:${today}`;
        
        await this.cache.increment(key);
        await this.cache.expire(key, 86400); // 24 hours
    }

    /**
     * Send OTP via provider (SMS, WhatsApp, etc.)
     */
    async sendViaProvider(phone, code, provider) {
        // This is a placeholder - integrate with actual SMS providers
        this.logger.info(`[${provider}] OTP for ${phone}: ${code}`);
        
        // In production, use actual SMS provider
        // Example with Twilio:
        // const client = require('twilio')(accountSid, authToken);
        // await client.messages.create({
        //     body: `Your verification code is: ${code}`,
        //     to: phone,
        //     from: twilioPhoneNumber
        // });

        return true;
    }
}

// Singleton instance
let otpServiceInstance = null;

const getOTPService = async () => {
    if (!otpServiceInstance) {
        otpServiceInstance = new OTPService();
        await otpServiceInstance.initialize();
    }
    return otpServiceInstance;
};

module.exports = {
    OTPService,
    getOTPService
};