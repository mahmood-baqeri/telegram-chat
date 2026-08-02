const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { User, UserProfile } = require('../../../database/models');
const { getCacheService } = require('../../../services/CacheService');
const { getLogger } = require('../../../services/LoggerService');
const { getEventBus } = require('../../../services/EventBus');
const { getFeatureToggleService } = require('../../../services/FeatureToggleService');
const ResponseHandler = require('../../../utils/responseHandler');

class UserService {
    constructor() {
        this.cache = null;
        this.logger = null;
        this.eventBus = null;
        this.featureService = null;
        this.cacheTTL = 300; // 5 minutes
    }

    async initialize() {
        this.cache = await getCacheService();
        this.logger = getLogger();
        this.eventBus = await getEventBus();
        this.featureService = await getFeatureToggleService();
        this.logger.info('✅ User Service initialized');
        return this;
    }

    /**
     * Get user by ID
     */
    async getUserById(userId, includeSensitive = false) {
        try {
            const cacheKey = `user:${userId}`;
            const cached = await this.cache.get(cacheKey);
            
            if (cached) {
                return cached;
            }

            const user = await User.findByPk(userId, {
                include: ['profiles']
            });

            if (!user) {
                return null;
            }

            const userData = includeSensitive ? user.toJSON() : user.toJSON();
            
            // Cache user data
            await this.cache.set(cacheKey, userData, this.cacheTTL);

            return userData;
        } catch (error) {
            this.logger.error('Failed to get user by ID', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Get user by UUID
     */
    async getUserByUUID(uuid) {
        try {
            const user = await User.findOne({
                where: { uuid },
                include: ['profiles']
            });

            if (!user) {
                return null;
            }

            return user.toJSON();
        } catch (error) {
            this.logger.error('Failed to get user by UUID', { error: error.message, uuid });
            throw error;
        }
    }

    /**
     * Get user by username
     */
    async getUserByUsername(username) {
        try {
            const user = await User.findOne({
                where: { username },
                include: ['profiles']
            });

            if (!user) {
                return null;
            }

            return user.toJSON();
        } catch (error) {
            this.logger.error('Failed to get user by username', { error: error.message, username });
            throw error;
        }
    }

    /**
     * Get user by phone
     */
    async getUserByPhone(phone) {
        try {
            const user = await User.findOne({
                where: { phone },
                include: ['profiles']
            });

            if (!user) {
                return null;
            }

            return user.toJSON();
        } catch (error) {
            this.logger.error('Failed to get user by phone', { error: error.message, phone });
            throw error;
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(userId, data) {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Check feature toggles
            if (data.username) {
                const usernameEnabled = await this.featureService.isEnabled('user.username');
                if (!usernameEnabled) {
                    throw new Error('Username feature is disabled');
                }
                
                // Check username availability
                if (data.username !== user.username) {
                    const existing = await User.findOne({
                        where: {
                            username: data.username,
                            id: { [Op.ne]: userId }
                        }
                    });
                    if (existing) {
                        throw new Error('Username already taken');
                    }
                }
            }

            if (data.bio) {
                const bioEnabled = await this.featureService.isEnabled('user.bio');
                if (!bioEnabled) {
                    throw new Error('Bio feature is disabled');
                }
            }

            // Update user
            const allowedFields = ['display_name', 'username', 'bio', 'language', 'timezone', 'country'];
            const updateData = {};
            
            for (const field of allowedFields) {
                if (data[field] !== undefined) {
                    updateData[field] = data[field];
                }
            }

            await user.update(updateData);

            // Update profile if provided
            if (data.profile) {
                let profile = await UserProfile.findOne({ where: { user_id: userId } });
                if (!profile) {
                    profile = await UserProfile.create({ user_id: userId });
                }
                await profile.update(data.profile);
            }

            // Clear cache
            await this.cache.delete(`user:${userId}`);

            // Publish event
            await this.eventBus.publish('user.updated', {
                userId: user.uuid,
                updatedFields: Object.keys(updateData),
                timestamp: new Date().toISOString()
            });

            this.logger.info(`User profile updated: ${user.uuid}`, {
                userId: user.uuid,
                fields: Object.keys(updateData)
            });

            return user.toJSON();
        } catch (error) {
            this.logger.error('Failed to update user profile', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Change username
     */
    async changeUsername(userId, newUsername) {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Check if username is enabled
            const usernameEnabled = await this.featureService.isEnabled('user.username');
            if (!usernameEnabled) {
                throw new Error('Username feature is disabled');
            }

            // Validate username
            if (!this.validateUsername(newUsername)) {
                throw new Error('Invalid username format');
            }

            // Check availability
            const existing = await User.findOne({
                where: {
                    username: newUsername,
                    id: { [Op.ne]: userId }
                }
            });
            if (existing) {
                throw new Error('Username already taken');
            }

            const oldUsername = user.username;
            user.username = newUsername;
            await user.save();

            // Clear cache
            await this.cache.delete(`user:${userId}`);

            // Publish event
            await this.eventBus.publish('user.username.changed', {
                userId: user.uuid,
                oldUsername,
                newUsername,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`Username changed: ${oldUsername} -> ${newUsername}`, {
                userId: user.uuid,
                oldUsername,
                newUsername
            });

            return { oldUsername, newUsername };
        } catch (error) {
            this.logger.error('Failed to change username', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Validate username
     */
    validateUsername(username) {
        // Username: 5-32 characters, alphanumeric and underscore
        const regex = /^[a-zA-Z0-9_]{5,32}$/;
        return regex.test(username);
    }

    /**
     * Update avatar
     */
    async updateAvatar(userId, avatarUrl, avatarThumb, avatarHash) {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Check if avatar is enabled
            const avatarEnabled = await this.featureService.isEnabled('user.avatar');
            if (!avatarEnabled) {
                throw new Error('Avatar feature is disabled');
            }

            // Delete old avatar if exists
            if (user.avatar_url) {
                // TODO: Delete old avatar file from storage
            }

            user.avatar_url = avatarUrl;
            user.avatar_thumb = avatarThumb;
            user.avatar_hash = avatarHash;
            await user.save();

            // Clear cache
            await this.cache.delete(`user:${userId}`);

            // Publish event
            await this.eventBus.publish('user.avatar.updated', {
                userId: user.uuid,
                avatarUrl,
                timestamp: new Date().toISOString()
            });

            return {
                avatarUrl: user.avatar_url,
                avatarThumb: user.avatar_thumb,
                avatarHash: user.avatar_hash
            };
        } catch (error) {
            this.logger.error('Failed to update avatar', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Delete avatar
     */
    async deleteAvatar(userId) {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // TODO: Delete avatar files from storage

            user.avatar_url = null;
            user.avatar_thumb = null;
            user.avatar_hash = null;
            await user.save();

            // Clear cache
            await this.cache.delete(`user:${userId}`);

            // Publish event
            await this.eventBus.publish('user.avatar.deleted', {
                userId: user.uuid,
                timestamp: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to delete avatar', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Search users
     */
    async searchUsers(query, filters = {}, pagination = {}) {
        try {
            const searchEnabled = await this.featureService.isEnabled('user.search');
            if (!searchEnabled) {
                throw new Error('User search is disabled');
            }

            const page = pagination.page || 1;
            const limit = pagination.limit || 20;
            const offset = (page - 1) * limit;

            const where = {
                is_active: true
            };

            // Search query
            if (query) {
                where[Op.or] = [
                    { display_name: { [Op.like]: `%${query}%` } },
                    { username: { [Op.like]: `%${query}%` } },
                    { phone: { [Op.like]: `%${query}%` } }
                ];
            }

            // Filters
            if (filters.username) {
                where.username = { [Op.like]: `%${filters.username}%` };
            }
            if (filters.displayName) {
                where.display_name = { [Op.like]: `%${filters.displayName}%` };
            }
            if (filters.country) {
                where.country = filters.country;
            }
            if (filters.isVerified !== undefined) {
                where.is_verified = filters.isVerified;
            }
            if (filters.isPremium !== undefined) {
                where.is_premium = filters.isPremium;
            }

            const { count, rows } = await User.findAndCountAll({
                where,
                attributes: ['uuid', 'display_name', 'username', 'avatar_url', 'avatar_thumb', 'is_verified', 'is_premium', 'status', 'last_seen_at'],
                limit,
                offset,
                order: [['display_name', 'ASC']]
            });

            return {
                users: rows.map(user => user.toJSON()),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };
        } catch (error) {
            this.logger.error('Failed to search users', { error: error.message, query });
            throw error;
        }
    }

    /**
     * Get user statistics
     */
    async getUserStats(userId) {
        try {
            const stats = {
                messages: 0,
                groups: 0,
                channels: 0,
                contacts: 0
            };

            // Get message count
            const Message = require('../../../database/models').Message;
            stats.messages = await Message.count({
                where: { sender_id: userId }
            });

            // Get group count
            const Group = require('../../../database/models').Group;
            stats.groups = await Group.count({
                include: [{
                    model: require('../../../database/models').GroupMember,
                    where: { user_id: userId, status: 'active' }
                }]
            });

            // Get contact count
            const Contact = require('../../../database/models').Contact;
            stats.contacts = await Contact.count({
                where: { user_id: userId, is_blocked: false }
            });

            return stats;
        } catch (error) {
            this.logger.error('Failed to get user stats', { error: error.message, userId });
            return {
                messages: 0,
                groups: 0,
                channels: 0,
                contacts: 0
            };
        }
    }
}

// Singleton instance
let userServiceInstance = null;

const getUserService = async () => {
    if (!userServiceInstance) {
        userServiceInstance = new UserService();
        await userServiceInstance.initialize();
    }
    return userServiceInstance;
};

module.exports = {
    UserService,
    getUserService
};