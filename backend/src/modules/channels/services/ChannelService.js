const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { Channel, ChannelSubscriber, User } = require('../../../database/models');
const { getCacheService } = require('../../../services/CacheService');
const { getLogger } = require('../../../services/LoggerService');
const { getEventBus } = require('../../../services/EventBus');
const { getFeatureToggleService } = require('../../../services/FeatureToggleService');

class ChannelService {
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
        this.logger.info('✅ Channel Service initialized');
        return this;
    }

    /**
     * Create a new channel
     */
    async createChannel(userId, data) {
        try {
            const channelsEnabled = await this.featureService.isEnabled('channels.enabled');
            if (!channelsEnabled) {
                throw new Error('Channels are disabled');
            }

            const { title, description, visibility = 'public', username, channelType = 'public' } = data;

            // Check username if provided
            if (username) {
                const existing = await Channel.findOne({ where: { username } });
                if (existing) {
                    throw new Error('Username already taken');
                }
            }

            // Create channel
            const channel = await Channel.create({
                uuid: uuidv4(),
                username: username || null,
                title,
                description: description || null,
                visibility,
                avatar_url: data.avatar || null,
                owner_id: userId,
                channel_type: channelType,
                settings: data.settings || {}
            });

            // Add owner as subscriber
            await ChannelSubscriber.create({
                channel_id: channel.id,
                user_id: userId,
                status: 'active',
                subscribed_at: new Date()
            });

            // Update subscriber count
            channel.subscriber_count = 1;
            await channel.save();

            // Clear cache
            await this.cache.delete(`channels:${userId}`);

            // Publish event
            await this.eventBus.publish('channel.created', {
                channelId: channel.uuid,
                ownerId: userId,
                title: channel.title,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`Channel created: ${channel.uuid}`, {
                channelId: channel.uuid,
                ownerId: userId,
                title: channel.title
            });

            return await this.getChannel(channel.uuid, userId);
        } catch (error) {
            this.logger.error('Failed to create channel', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Get channel by UUID
     */
    async getChannel(channelId, userId) {
        try {
            const cacheKey = `channel:${channelId}:${userId}`;
            const cached = await this.cache.get(cacheKey);
            
            if (cached) {
                return cached;
            }

            const channel = await Channel.findOne({
                where: { uuid: channelId, is_deleted: false },
                include: [
                    {
                        model: User,
                        as: 'owner',
                        attributes: ['uuid', 'display_name', 'username', 'avatar_url']
                    }
                ]
            });

            if (!channel) {
                return null;
            }

            // Check if user is subscriber for private channels
            let isSubscriber = false;
            if (channel.visibility === 'private') {
                const subscriber = await ChannelSubscriber.findOne({
                    where: {
                        channel_id: channel.id,
                        user_id: userId,
                        status: 'active'
                    }
                });
                isSubscriber = !!subscriber;
                if (!isSubscriber && channel.owner_id !== userId) {
                    return null;
                }
            }

            const channelData = {
                id: channel.uuid,
                username: channel.username,
                title: channel.title,
                description: channel.description,
                visibility: channel.visibility,
                avatarUrl: channel.avatar_url,
                bannerUrl: channel.banner_url,
                channelType: channel.channel_type,
                isVerified: channel.is_verified,
                isPremium: channel.is_premium,
                isActive: channel.is_active,
                subscriberCount: channel.subscriber_count,
                totalViews: channel.total_views || 0,
                totalForwards: channel.total_forwards || 0,
                totalReactions: channel.total_reactions || 0,
                owner: channel.owner ? {
                    id: channel.owner.uuid,
                    displayName: channel.owner.display_name,
                    username: channel.owner.username
                } : null,
                isSubscriber,
                settings: channel.settings,
                createdAt: channel.created_at,
                updatedAt: channel.updated_at
            };

            await this.cache.set(cacheKey, channelData, this.cacheTTL);

            return channelData;
        } catch (error) {
            this.logger.error('Failed to get channel', { error: error.message, channelId });
            throw error;
        }
    }

    /**
     * Get user's channels
     */
    async getUserChannels(userId) {
        try {
            const cacheKey = `channels:${userId}`;
            const cached = await this.cache.get(cacheKey);
            
            if (cached) {
                return cached;
            }

            const subscriptions = await ChannelSubscriber.findAll({
                where: {
                    user_id: userId,
                    status: 'active'
                },
                include: [{
                    model: Channel,
                    as: 'channel',
                    where: { is_deleted: false }
                }],
                order: [[{ model: Channel, as: 'channel' }, 'created_at', 'DESC']]
            });

            const channels = subscriptions.map(s => ({
                id: s.channel.uuid,
                username: s.channel.username,
                title: s.channel.title,
                description: s.channel.description,
                visibility: s.channel.visibility,
                avatarUrl: s.channel.avatar_url,
                channelType: s.channel.channel_type,
                isVerified: s.channel.is_verified,
                isPremium: s.channel.is_premium,
                subscriberCount: s.channel.subscriber_count,
                status: s.status,
                subscribedAt: s.subscribed_at
            }));

            await this.cache.set(cacheKey, channels, this.cacheTTL);

            return channels;
        } catch (error) {
            this.logger.error('Failed to get user channels', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Subscribe to channel
     */
    async subscribe(channelId, userId) {
        try {
            const channel = await Channel.findOne({ where: { uuid: channelId } });
            if (!channel) {
                throw new Error('Channel not found');
            }

            if (channel.owner_id === userId) {
                throw new Error('Channel owner cannot subscribe to their own channel');
            }

            // Check if already subscribed
            const existing = await ChannelSubscriber.findOne({
                where: {
                    channel_id: channel.id,
                    user_id: userId
                }
            });

            if (existing) {
                if (existing.status === 'blocked') {
                    throw new Error('You have been blocked from this channel');
                }
                if (existing.status === 'active') {
                    throw new Error('Already subscribed to this channel');
                }
            }

            // Subscribe
            await ChannelSubscriber.create({
                channel_id: channel.id,
                user_id: userId,
                status: 'active',
                subscribed_at: new Date()
            });

            // Update subscriber count
            channel.subscriber_count += 1;
            await channel.save();

            // Clear cache
            await this.cache.delete(`channel:${channelId}:${userId}`);
            await this.cache.delete(`channels:${userId}`);

            // Publish event
            await this.eventBus.publish('channel.subscribed', {
                channelId: channel.uuid,
                userId,
                timestamp: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to subscribe to channel', { error: error.message, channelId, userId });
            throw error;
        }
    }

    /**
     * Unsubscribe from channel
     */
    async unsubscribe(channelId, userId) {
        try {
            const channel = await Channel.findOne({ where: { uuid: channelId } });
            if (!channel) {
                throw new Error('Channel not found');
            }

            const subscription = await ChannelSubscriber.findOne({
                where: {
                    channel_id: channel.id,
                    user_id: userId,
                    status: 'active'
                }
            });

            if (!subscription) {
                throw new Error('Not subscribed to this channel');
            }

            await subscription.destroy();

            // Update subscriber count
            channel.subscriber_count -= 1;
            await channel.save();

            // Clear cache
            await this.cache.delete(`channel:${channelId}:${userId}`);
            await this.cache.delete(`channels:${userId}`);

            // Publish event
            await this.eventBus.publish('channel.unsubscribed', {
                channelId: channel.uuid,
                userId,
                timestamp: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to unsubscribe from channel', { error: error.message, channelId, userId });
            throw error;
        }
    }

    /**
     * Update channel
     */
    async updateChannel(channelId, userId, data) {
        try {
            const channel = await Channel.findOne({ where: { uuid: channelId } });
            if (!channel) {
                throw new Error('Channel not found');
            }

            // Check if user is owner
            if (channel.owner_id !== userId) {
                throw new Error('Only channel owner can update the channel');
            }

            // Check username if being updated
            if (data.username && data.username !== channel.username) {
                const existing = await Channel.findOne({
                    where: {
                        username: data.username,
                        id: { [Op.ne]: channel.id }
                    }
                });
                if (existing) {
                    throw new Error('Username already taken');
                }
            }

            const allowedFields = ['title', 'description', 'visibility', 'username', 'avatar_url', 'banner_url', 'settings'];
            const updateData = {};

            for (const field of allowedFields) {
                if (data[field] !== undefined) {
                    updateData[field] = data[field];
                }
            }

            await channel.update(updateData);

            // Clear cache
            await this.cache.delete(`channel:${channelId}:${userId}`);
            await this.cache.delete(`channels:${userId}`);

            // Publish event
            await this.eventBus.publish('channel.updated', {
                channelId: channel.uuid,
                userId,
                updatedFields: Object.keys(updateData),
                timestamp: new Date().toISOString()
            });

            return await this.getChannel(channelId, userId);
        } catch (error) {
            this.logger.error('Failed to update channel', { error: error.message, channelId, userId });
            throw error;
        }
    }

    /**
     * Delete channel
     */
    async deleteChannel(channelId, userId) {
        try {
            const channel = await Channel.findOne({ where: { uuid: channelId } });
            if (!channel) {
                throw new Error('Channel not found');
            }

            // Check if user is owner
            if (channel.owner_id !== userId) {
                throw new Error('Only channel owner can delete the channel');
            }

            channel.is_deleted = true;
            channel.deleted_at = new Date();
            await channel.save();

            // Clear cache
            await this.cache.delete(`channel:${channelId}:${userId}`);

            // Publish event
            await this.eventBus.publish('channel.deleted', {
                channelId: channel.uuid,
                userId,
                timestamp: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to delete channel', { error: error.message, channelId, userId });
            throw error;
        }
    }

    /**
     * Search channels
     */
    async searchChannels(query, filters = {}, pagination = {}) {
        try {
            const page = pagination.page || 1;
            const limit = pagination.limit || 20;
            const offset = (page - 1) * limit;

            const where = {
                is_deleted: false,
                visibility: 'public'
            };

            if (query) {
                where[Op.or] = [
                    { title: { [Op.like]: `%${query}%` } },
                    { description: { [Op.like]: `%${query}%` } },
                    { username: { [Op.like]: `%${query}%` } }
                ];
            }

            if (filters.username) {
                where.username = filters.username;
            }

            if (filters.isVerified !== undefined) {
                where.is_verified = filters.isVerified;
            }

            const { count, rows } = await Channel.findAndCountAll({
                where,
                include: [{
                    model: User,
                    as: 'owner',
                    attributes: ['uuid', 'display_name', 'username']
                }],
                limit,
                offset,
                order: [['subscriber_count', 'DESC']]
            });

            return {
                channels: rows.map(c => ({
                    id: c.uuid,
                    username: c.username,
                    title: c.title,
                    description: c.description,
                    avatarUrl: c.avatar_url,
                    channelType: c.channel_type,
                    isVerified: c.is_verified,
                    isPremium: c.is_premium,
                    subscriberCount: c.subscriber_count,
                    owner: c.owner ? {
                        id: c.owner.uuid,
                        displayName: c.owner.display_name
                    } : null,
                    createdAt: c.created_at
                })),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };
        } catch (error) {
            this.logger.error('Failed to search channels', { error: error.message, query });
            throw error;
        }
    }
}

// Singleton instance
let channelServiceInstance = null;

const getChannelService = async () => {
    if (!channelServiceInstance) {
        channelServiceInstance = new ChannelService();
        await channelServiceInstance.initialize();
    }
    return channelServiceInstance;
};

module.exports = {
    ChannelService,
    getChannelService
};