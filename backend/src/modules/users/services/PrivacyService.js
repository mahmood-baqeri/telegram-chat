const { UserPrivacy } = require('../../../database/models');
const { getCacheService } = require('../../../services/CacheService');
const { getLogger } = require('../../../services/LoggerService');
const { getEventBus } = require('../../../services/EventBus');

class PrivacyService {
    constructor() {
        this.cache = null;
        this.logger = null;
        this.eventBus = null;
        this.cacheTTL = 300;
    }

    async initialize() {
        this.cache = await getCacheService();
        this.logger = getLogger();
        this.eventBus = await getEventBus();
        this.logger.info('✅ Privacy Service initialized');
        return this;
    }

    /**
     * Get privacy settings
     */
    async getPrivacySettings(userId) {
        try {
            const cacheKey = `privacy:${userId}`;
            const cached = await this.cache.get(cacheKey);
            
            if (cached) {
                return cached;
            }

            let privacy = await UserPrivacy.findOne({
                where: { user_id: userId }
            });

            if (!privacy) {
                // Create default settings
                privacy = await UserPrivacy.create({
                    user_id: userId,
                    phone: 'contacts',
                    last_seen: 'everyone',
                    online_status: 'everyone',
                    profile_photo: 'everyone',
                    bio: 'everyone',
                    username: 'everyone',
                    stories: 'everyone',
                    groups: 'everyone',
                    channels: 'everyone',
                    read_receipts: true,
                    typing_indicator: true,
                    forwarded_messages: true
                });
            }

            const result = privacy.toJSON();
            await this.cache.set(cacheKey, result, this.cacheTTL);

            return result;
        } catch (error) {
            this.logger.error('Failed to get privacy settings', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Update privacy settings
     */
    async updatePrivacySettings(userId, data) {
        try {
            let privacy = await UserPrivacy.findOne({
                where: { user_id: userId }
            });

            if (!privacy) {
                privacy = await UserPrivacy.create({ user_id: userId });
            }

            const allowedFields = [
                'phone', 'last_seen', 'online_status', 'profile_photo',
                'bio', 'username', 'stories', 'groups', 'channels',
                'read_receipts', 'typing_indicator', 'forwarded_messages',
                'exceptions'
            ];

            const updateData = {};
            for (const field of allowedFields) {
                if (data[field] !== undefined) {
                    updateData[field] = data[field];
                }
            }

            await privacy.update(updateData);

            // Clear cache
            await this.cache.delete(`privacy:${userId}`);

            // Publish event
            await this.eventBus.publish('privacy.updated', {
                userId,
                updatedFields: Object.keys(updateData),
                timestamp: new Date().toISOString()
            });

            return privacy.toJSON();
        } catch (error) {
            this.logger.error('Failed to update privacy settings', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Check if user can see field
     */
    async canSee(userId, targetUserId, field, context = {}) {
        try {
            // If user is checking their own data
            if (userId === targetUserId) {
                return true;
            }

            // Check if blocked
            const Block = require('../../../database/models').Block;
            const isBlocked = await Block.findOne({
                where: {
                    [Op.or]: [
                        { user_id: userId, blocked_user_id: targetUserId },
                        { user_id: targetUserId, blocked_user_id: userId }
                    ]
                }
            });

            if (isBlocked) {
                return false;
            }

            // Get target user's privacy settings
            const privacy = await this.getPrivacySettings(targetUserId);
            
            if (!privacy) {
                return true;
            }

            const setting = privacy[field];
            if (!setting) {
                return true;
            }

            // Check exceptions
            if (privacy.exceptions && privacy.exceptions[field]) {
                const exceptions = privacy.exceptions[field];
                if (Array.isArray(exceptions)) {
                    if (exceptions.includes(userId)) {
                        return true;
                    }
                    if (exceptions.includes('*')) {
                        return true;
                    }
                }
            }

            // Check setting
            switch (setting) {
                case 'everyone':
                    return true;
                case 'contacts':
                    // Check if user is in contacts
                    const Contact = require('../../../database/models').Contact;
                    const isContact = await Contact.findOne({
                        where: {
                            user_id: targetUserId,
                            contact_user_id: userId
                        }
                    });
                    return !!isContact;
                case 'nobody':
                    return false;
                default:
                    return true;
            }
        } catch (error) {
            this.logger.error('Failed to check privacy', { error: error.message, userId, targetUserId, field });
            return true;
        }
    }

    /**
     * Get visible fields for user
     */
    async getVisibleFields(userId, targetUserId) {
        const fields = ['phone', 'last_seen', 'online_status', 'profile_photo', 'bio', 'username'];
        const result = {};

        for (const field of fields) {
            result[field] = await this.canSee(userId, targetUserId, field);
        }

        return result;
    }
}

// Singleton instance
let privacyServiceInstance = null;

const getPrivacyService = async () => {
    if (!privacyServiceInstance) {
        privacyServiceInstance = new PrivacyService();
        await privacyServiceInstance.initialize();
    }
    return privacyServiceInstance;
};

module.exports = {
    PrivacyService,
    getPrivacyService
};