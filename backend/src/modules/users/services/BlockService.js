const { Op } = require('sequelize');
const { Block, User } = require('../../../database/models');
const { getCacheService } = require('../../../services/CacheService');
const { getLogger } = require('../../../services/LoggerService');
const { getEventBus } = require('../../../services/EventBus');
const { getFeatureToggleService } = require('../../../services/FeatureToggleService');

class BlockService {
    constructor() {
        this.cache = null;
        this.logger = null;
        this.eventBus = null;
        this.featureService = null;
        this.cacheTTL = 300;
    }

    async initialize() {
        this.cache = await getCacheService();
        this.logger = getLogger();
        this.eventBus = await getEventBus();
        this.featureService = await getFeatureToggleService();
        this.logger.info('✅ Block Service initialized');
        return this;
    }

    /**
     * Block a user
     */
    async blockUser(userId, blockedUserId, reason = '') {
        try {
            const blockEnabled = await this.featureService.isEnabled('user.block');
            if (!blockEnabled) {
                throw new Error('Block feature is disabled');
            }

            // Check if user exists
            const blockedUser = await User.findByPk(blockedUserId);
            if (!blockedUser) {
                throw new Error('User not found');
            }

            // Check if already blocked
            const existing = await Block.findOne({
                where: {
                    user_id: userId,
                    blocked_user_id: blockedUserId
                }
            });

            if (existing) {
                throw new Error('User already blocked');
            }

            // Create block
            const block = await Block.create({
                user_id: userId,
                blocked_user_id: blockedUserId,
                reason
            });

            // Remove from contacts if exists
            const Contact = require('../../../database/models').Contact;
            await Contact.destroy({
                where: {
                    [Op.or]: [
                        { user_id: userId, contact_user_id: blockedUserId },
                        { user_id: blockedUserId, contact_user_id: userId }
                    ]
                }
            });

            // Clear cache
            await this.cache.delete(`blocks:${userId}`);
            await this.cache.delete(`is-blocked:${userId}:${blockedUserId}`);

            // Publish event
            await this.eventBus.publish('user.blocked', {
                userId,
                blockedUserId,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`User blocked: ${blockedUserId}`, { userId, blockedUserId });

            return {
                id: block.uuid,
                userId: block.user_id,
                blockedUserId: block.blocked_user_id,
                reason: block.reason,
                createdAt: block.created_at
            };
        } catch (error) {
            this.logger.error('Failed to block user', { error: error.message, userId, blockedUserId });
            throw error;
        }
    }

    /**
     * Unblock a user
     */
    async unblockUser(userId, blockedUserId) {
        try {
            const block = await Block.findOne({
                where: {
                    user_id: userId,
                    blocked_user_id: blockedUserId
                }
            });

            if (!block) {
                throw new Error('Block not found');
            }

            await block.destroy();

            // Clear cache
            await this.cache.delete(`blocks:${userId}`);
            await this.cache.delete(`is-blocked:${userId}:${blockedUserId}`);

            // Publish event
            await this.eventBus.publish('user.unblocked', {
                userId,
                blockedUserId,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`User unblocked: ${blockedUserId}`, { userId, blockedUserId });

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to unblock user', { error: error.message, userId, blockedUserId });
            throw error;
        }
    }

    /**
     * Get blocked users
     */
    async getBlockedUsers(userId) {
        try {
            const cacheKey = `blocks:${userId}`;
            const cached = await this.cache.get(cacheKey);
            
            if (cached) {
                return cached;
            }

            const blocks = await Block.findAll({
                where: { user_id: userId },
                include: [{
                    model: User,
                    as: 'blockedUser',
                    attributes: ['uuid', 'display_name', 'username', 'avatar_url', 'is_verified', 'is_premium']
                }],
                order: [['created_at', 'DESC']]
            });

            const result = blocks.map(block => ({
                id: block.uuid,
                user: block.blockedUser ? block.blockedUser.toJSON() : null,
                reason: block.reason,
                createdAt: block.created_at
            }));

            await this.cache.set(cacheKey, result, this.cacheTTL);

            return result;
        } catch (error) {
            this.logger.error('Failed to get blocked users', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Check if user is blocked
     */
    async isBlocked(userId, targetUserId) {
        try {
            const cacheKey = `is-blocked:${userId}:${targetUserId}`;
            const cached = await this.cache.get(cacheKey);
            
            if (cached !== null) {
                return cached;
            }

            const block = await Block.findOne({
                where: {
                    [Op.or]: [
                        { user_id: userId, blocked_user_id: targetUserId },
                        { user_id: targetUserId, blocked_user_id: userId }
                    ]
                }
            });

            const result = !!block;
            await this.cache.set(cacheKey, result, 60); // Short TTL for this

            return result;
        } catch (error) {
            this.logger.error('Failed to check block status', { error: error.message, userId, targetUserId });
            return false;
        }
    }

    /**
     * Get block statistics
     */
    async getBlockStats(userId) {
        try {
            const total = await Block.count({
                where: { user_id: userId }
            });

            const recent = await Block.count({
                where: {
                    user_id: userId,
                    created_at: {
                        [Op.gt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days
                    }
                }
            });

            return {
                total,
                recent
            };
        } catch (error) {
            this.logger.error('Failed to get block stats', { error: error.message, userId });
            return { total: 0, recent: 0 };
        }
    }
}

// Singleton instance
let blockServiceInstance = null;

const getBlockService = async () => {
    if (!blockServiceInstance) {
        blockServiceInstance = new BlockService();
        await blockServiceInstance.initialize();
    }
    return blockServiceInstance;
};

module.exports = {
    BlockService,
    getBlockService
};