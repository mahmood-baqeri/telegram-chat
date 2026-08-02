const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { Chat, ChatParticipant, User } = require('../../../database/models');
const { getCacheService } = require('../../../services/CacheService');
const { getLogger } = require('../../../services/LoggerService');
const { getEventBus } = require('../../../services/EventBus');
const { getFeatureToggleService } = require('../../../services/FeatureToggleService');

class ChatService {
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
        this.logger.info('✅ Chat Service initialized');
        return this;
    }

    /**
     * Create a new chat
     */
    async createChat(userId, data) {
        try {
            const privateChatsEnabled = await this.featureService.isEnabled('private.chats.enabled');
            if (!privateChatsEnabled) {
                throw new Error('Private chats are disabled');
            }

            const { participantId, chatType = 'private' } = data;

            // Check if chat already exists
            if (chatType === 'private') {
                const existingChat = await this.findPrivateChat(userId, participantId);
                if (existingChat) {
                    return existingChat;
                }
            }

            // Create chat
            const chat = await Chat.create({
                uuid: uuidv4(),
                chat_type: chatType,
                creator_id: userId,
                title: data.title || null
            });

            // Add participants
            const participants = [userId, participantId];
            for (const participant of participants) {
                await ChatParticipant.create({
                    chat_id: chat.id,
                    user_id: participant,
                    role: participant === userId ? 'creator' : 'member'
                });
            }

            // Clear cache
            await this.cache.delete(`chats:${userId}`);
            await this.cache.delete(`chats:${participantId}`);

            // Publish event
            await this.eventBus.publish('chat.created', {
                chatId: chat.uuid,
                creatorId: userId,
                participants,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`Chat created: ${chat.uuid}`, {
                chatId: chat.uuid,
                creatorId: userId,
                participants
            });

            return await this.getChat(chat.uuid, userId);
        } catch (error) {
            this.logger.error('Failed to create chat', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Find private chat between two users
     */
    async findPrivateChat(userId1, userId2) {
        try {
            const chats1 = await ChatParticipant.findAll({
                where: { user_id: userId1 },
                attributes: ['chat_id']
            });
            const chatIds1 = chats1.map(c => c.chat_id);

            const chats2 = await ChatParticipant.findAll({
                where: {
                    user_id: userId2,
                    chat_id: { [Op.in]: chatIds1 }
                },
                attributes: ['chat_id']
            });

            if (chats2.length > 0) {
                const chat = await Chat.findByPk(chats2[0].chat_id);
                return chat ? await this.getChat(chat.uuid, userId1) : null;
            }

            return null;
        } catch (error) {
            this.logger.error('Failed to find private chat', { error: error.message });
            return null;
        }
    }

    /**
     * Get chat by UUID
     */
    async getChat(chatId, userId) {
        try {
            const cacheKey = `chat:${chatId}:${userId}`;
            const cached = await this.cache.get(cacheKey);
            
            if (cached) {
                return cached;
            }

            const chat = await Chat.findOne({
                where: { uuid: chatId },
                include: [
                    {
                        model: User,
                        as: 'participants',
                        through: { attributes: ['role', 'is_muted', 'is_archived', 'is_pinned'] },
                        attributes: ['uuid', 'display_name', 'username', 'avatar_url', 'is_verified', 'is_premium', 'status']
                    }
                ]
            });

            if (!chat) {
                return null;
            }

            // Check if user is participant
            const participant = await ChatParticipant.findOne({
                where: {
                    chat_id: chat.id,
                    user_id: userId
                }
            });

            if (!participant) {
                return null;
            }

            const chatData = {
                id: chat.uuid,
                type: chat.chat_type,
                title: chat.title,
                avatarUrl: chat.avatar_url,
                creatorId: chat.creator_id,
                lastMessageId: chat.last_message_id,
                lastMessageAt: chat.last_message_at,
                lastMessagePreview: chat.last_message_preview,
                unreadCount: participant.unread_count || 0,
                unreadMentions: chat.unread_mentions || 0,
                isMuted: participant.is_muted || false,
                mutedUntil: participant.muted_until,
                isArchived: participant.is_archived || false,
                isPinned: participant.is_pinned || false,
                pinnedAt: participant.pinned_at,
                draft: chat.draft_message,
                draftUpdatedAt: chat.draft_updated_at,
                participants: chat.participants.map(p => ({
                    id: p.uuid,
                    displayName: p.display_name,
                    username: p.username,
                    avatarUrl: p.avatar_url,
                    isVerified: p.is_verified,
                    isPremium: p.is_premium,
                    status: p.status,
                    role: p.ChatParticipant.role,
                    isMuted: p.ChatParticipant.is_muted,
                    isArchived: p.ChatParticipant.is_archived,
                    isPinned: p.ChatParticipant.is_pinned
                })),
                createdAt: chat.created_at,
                updatedAt: chat.updated_at
            };

            await this.cache.set(cacheKey, chatData, this.cacheTTL);

            return chatData;
        } catch (error) {
            this.logger.error('Failed to get chat', { error: error.message, chatId });
            throw error;
        }
    }

    /**
     * Get user's chats
     */
    async getUserChats(userId, filters = {}) {
        try {
            const cacheKey = `chats:${userId}`;
            const cached = await this.cache.get(cacheKey);
            
            if (cached && !filters.forceRefresh) {
                return cached;
            }

            const where = {
                user_id: userId
            };

            if (filters.isArchived !== undefined) {
                where.is_archived = filters.isArchived;
            }

            if (filters.isMuted !== undefined) {
                where.is_muted = filters.isMuted;
            }

            if (filters.isPinned !== undefined) {
                where.is_pinned = filters.isPinned;
            }

            const participants = await ChatParticipant.findAll({
                where,
                include: [{
                    model: Chat,
                    as: 'chat',
                    include: [
                        {
                            model: User,
                            as: 'participants',
                            through: { attributes: ['role', 'is_muted', 'is_archived', 'is_pinned'] },
                            attributes: ['uuid', 'display_name', 'username', 'avatar_url', 'is_verified', 'is_premium', 'status']
                        }
                    ]
                }],
                order: [
                    ['is_pinned', 'DESC'],
                    [{ model: Chat, as: 'chat' }, 'last_message_at', 'DESC']
                ]
            });

            const chats = participants.map(p => {
                const chat = p.chat;
                return {
                    id: chat.uuid,
                    type: chat.chat_type,
                    title: chat.title,
                    avatarUrl: chat.avatar_url,
                    creatorId: chat.creator_id,
                    lastMessageId: chat.last_message_id,
                    lastMessageAt: chat.last_message_at,
                    lastMessagePreview: chat.last_message_preview,
                    unreadCount: p.unread_count || 0,
                    unreadMentions: chat.unread_mentions || 0,
                    isMuted: p.is_muted || false,
                    mutedUntil: p.muted_until,
                    isArchived: p.is_archived || false,
                    isPinned: p.is_pinned || false,
                    pinnedAt: p.pinned_at,
                    draft: chat.draft_message,
                    draftUpdatedAt: chat.draft_updated_at,
                    participants: chat.participants.map(u => ({
                        id: u.uuid,
                        displayName: u.display_name,
                        username: u.username,
                        avatarUrl: u.avatar_url,
                        isVerified: u.is_verified,
                        isPremium: u.is_premium,
                        status: u.status,
                        role: u.ChatParticipant.role,
                        isMuted: u.ChatParticipant.is_muted,
                        isArchived: u.ChatParticipant.is_archived,
                        isPinned: u.ChatParticipant.is_pinned
                    })),
                    createdAt: chat.created_at,
                    updatedAt: chat.updated_at
                };
            });

            await this.cache.set(cacheKey, chats, this.cacheTTL);

            return chats;
        } catch (error) {
            this.logger.error('Failed to get user chats', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Update chat participant settings
     */
    async updateParticipantSettings(chatId, userId, settings) {
        try {
            const chat = await Chat.findOne({ where: { uuid: chatId } });
            if (!chat) {
                throw new Error('Chat not found');
            }

            const participant = await ChatParticipant.findOne({
                where: {
                    chat_id: chat.id,
                    user_id: userId
                }
            });

            if (!participant) {
                throw new Error('User not in chat');
            }

            const allowedFields = ['is_muted', 'muted_until', 'is_archived', 'is_pinned'];
            const updateData = {};

            for (const field of allowedFields) {
                if (settings[field] !== undefined) {
                    updateData[field] = settings[field];
                    if (field === 'is_pinned' && settings[field]) {
                        updateData.pinned_at = new Date();
                    }
                }
            }

            await participant.update(updateData);

            // Clear cache
            await this.cache.delete(`chat:${chatId}:${userId}`);
            await this.cache.delete(`chats:${userId}`);

            return await this.getChat(chatId, userId);
        } catch (error) {
            this.logger.error('Failed to update participant settings', { error: error.message, chatId, userId });
            throw error;
        }
    }

    /**
     * Archive chat
     */
    async archiveChat(chatId, userId) {
        return await this.updateParticipantSettings(chatId, userId, { is_archived: true });
    }

    /**
     * Unarchive chat
     */
    async unarchiveChat(chatId, userId) {
        return await this.updateParticipantSettings(chatId, userId, { is_archived: false });
    }

    /**
     * Mute chat
     */
    async muteChat(chatId, userId, duration = null) {
        const mutedUntil = duration ? new Date(Date.now() + duration * 1000) : null;
        return await this.updateParticipantSettings(chatId, userId, { 
            is_muted: true, 
            muted_until: mutedUntil 
        });
    }

    /**
     * Unmute chat
     */
    async unmuteChat(chatId, userId) {
        return await this.updateParticipantSettings(chatId, userId, { 
            is_muted: false, 
            muted_until: null 
        });
    }

    /**
     * Pin chat
     */
    async pinChat(chatId, userId) {
        return await this.updateParticipantSettings(chatId, userId, { is_pinned: true });
    }

    /**
     * Unpin chat
     */
    async unpinChat(chatId, userId) {
        return await this.updateParticipantSettings(chatId, userId, { is_pinned: false });
    }

    /**
     * Mark chat as read
     */
    async markAsRead(chatId, userId, messageId = null) {
        try {
            const chat = await Chat.findOne({ where: { uuid: chatId } });
            if (!chat) {
                throw new Error('Chat not found');
            }

            const participant = await ChatParticipant.findOne({
                where: {
                    chat_id: chat.id,
                    user_id: userId
                }
            });

            if (!participant) {
                throw new Error('User not in chat');
            }

            participant.unread_count = 0;
            participant.last_read_at = new Date();
            if (messageId) {
                participant.last_read_message_id = messageId;
            }
            await participant.save();

            // Clear cache
            await this.cache.delete(`chat:${chatId}:${userId}`);
            await this.cache.delete(`chats:${userId}`);

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to mark chat as read', { error: error.message, chatId, userId });
            throw error;
        }
    }

    /**
     * Delete chat (soft delete for user)
     */
    async deleteChat(chatId, userId) {
        try {
            const chat = await Chat.findOne({ where: { uuid: chatId } });
            if (!chat) {
                throw new Error('Chat not found');
            }

            const participant = await ChatParticipant.findOne({
                where: {
                    chat_id: chat.id,
                    user_id: userId
                }
            });

            if (!participant) {
                throw new Error('User not in chat');
            }

            // Soft delete for this user
            await participant.destroy();

            // Clear cache
            await this.cache.delete(`chat:${chatId}:${userId}`);
            await this.cache.delete(`chats:${userId}`);

            // Publish event
            await this.eventBus.publish('chat.deleted', {
                chatId,
                userId,
                timestamp: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to delete chat', { error: error.message, chatId, userId });
            throw error;
        }
    }

    /**
     * Get chat participants
     */
    async getChatParticipants(chatId) {
        try {
            const chat = await Chat.findOne({ where: { uuid: chatId } });
            if (!chat) {
                throw new Error('Chat not found');
            }

            const participants = await ChatParticipant.findAll({
                where: { chat_id: chat.id },
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['uuid', 'display_name', 'username', 'avatar_url', 'is_verified', 'is_premium', 'status', 'last_seen_at']
                }]
            });

            return participants.map(p => ({
                id: p.user.uuid,
                displayName: p.user.display_name,
                username: p.user.username,
                avatarUrl: p.user.avatar_url,
                isVerified: p.user.is_verified,
                isPremium: p.user.is_premium,
                status: p.user.status,
                lastSeenAt: p.user.last_seen_at,
                role: p.role,
                isMuted: p.is_muted,
                mutedUntil: p.muted_until
            }));
        } catch (error) {
            this.logger.error('Failed to get chat participants', { error: error.message, chatId });
            throw error;
        }
    }
}

// Singleton instance
let chatServiceInstance = null;

const getChatService = async () => {
    if (!chatServiceInstance) {
        chatServiceInstance = new ChatService();
        await chatServiceInstance.initialize();
    }
    return chatServiceInstance;
};

module.exports = {
    ChatService,
    getChatService
};