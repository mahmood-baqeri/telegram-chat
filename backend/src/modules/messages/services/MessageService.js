const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { Message, Chat, ChatParticipant, User } = require('../../../database/models');
const { getCacheService } = require('../../../services/CacheService');
const { getLogger } = require('../../../services/LoggerService');
const { getEventBus } = require('../../../services/EventBus');
const { getFeatureToggleService } = require('../../../services/FeatureToggleService');
const { getQueue } = require('../../../queues');

class MessageService {
    constructor() {
        this.cache = null;
        this.logger = null;
        this.eventBus = null;
        this.featureService = null;
        this.cacheTTL = 300;
        this.messageQueue = null;
    }

    async initialize() {
        this.cache = await getCacheService();
        this.logger = getLogger();
        this.eventBus = await getEventBus();
        this.featureService = await getFeatureToggleService();
        this.messageQueue = getQueue('messages');
        this.logger.info('✅ Message Service initialized');
        return this;
    }

    /**
     * Send a new message
     */
    async sendMessage(userId, data) {
        try {
            const { chatId, content, messageType = 'text', replyTo, media, metadata } = data;

            // Get chat
            const chat = await Chat.findOne({ where: { uuid: chatId } });
            if (!chat) {
                throw new Error('Chat not found');
            }

            // Check if user is participant
            const participant = await ChatParticipant.findOne({
                where: {
                    chat_id: chat.id,
                    user_id: userId
                }
            });

            if (!participant) {
                throw new Error('User not in chat');
            }

            // Check if muted
            if (participant.is_muted && participant.muted_until && new Date() < participant.muted_until) {
                throw new Error('Chat is muted');
            }

            // Check message length
            const maxLength = await this.featureService.isEnabled('message.length_limit') ? 4096 : 0;
            if (maxLength > 0 && content && content.length > maxLength) {
                throw new Error(`Message exceeds ${maxLength} characters`);
            }

            // Create message
            const message = await Message.create({
                uuid: uuidv4(),
                chat_id: chat.id,
                sender_id: userId,
                message_type: messageType,
                content,
                rich_text: this.parseRichText(content),
                mentions: this.extractMentions(content),
                hashtags: this.extractHashtags(content),
                links: this.extractLinks(content),
                media,
                metadata,
                is_reply: !!replyTo,
                reply_to_message_id: replyTo,
                reply_preview: replyTo ? await this.getReplyPreview(replyTo) : null,
                status: 'sent'
            });

            // Update chat last message
            chat.last_message_id = message.id;
            chat.last_message_at = new Date();
            chat.last_message_preview = content ? content.substring(0, 100) : '[Media]';
            await chat.save();

            // Update unread count for other participants
            await this.updateUnreadCounts(chat.id, userId);

            // Process media if any
            if (media) {
                await this.processMedia(message.id, media);
            }

            // Publish event
            await this.eventBus.publish('message.created', {
                messageId: message.uuid,
                chatId: chat.uuid,
                senderId: userId,
                timestamp: new Date().toISOString()
            });

            // Send notifications
            await this.sendMessageNotifications(message, chat);

            // Clear cache
            await this.cache.delete(`messages:${chat.uuid}`);

            this.logger.info(`Message sent: ${message.uuid}`, {
                messageId: message.uuid,
                chatId: chat.uuid,
                senderId: userId,
                type: messageType
            });

            return await this.getMessage(message.uuid, userId);
        } catch (error) {
            this.logger.error('Failed to send message', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Get message by UUID
     */
    async getMessage(messageId, userId) {
        try {
            const message = await Message.findOne({
                where: { uuid: messageId },
                include: [
                    {
                        model: User,
                        as: 'sender',
                        attributes: ['uuid', 'display_name', 'username', 'avatar_url', 'is_verified', 'is_premium']
                    },
                    {
                        model: Message,
                        as: 'replyTo',
                        include: [{
                            model: User,
                            as: 'sender',
                            attributes: ['uuid', 'display_name']
                        }]
                    }
                ]
            });

            if (!message) {
                return null;
            }

            // Check if user can view message
            const chat = await Chat.findByPk(message.chat_id);
            if (!chat) {
                return null;
            }

            const participant = await ChatParticipant.findOne({
                where: {
                    chat_id: chat.id,
                    user_id: userId
                }
            });

            if (!participant) {
                return null;
            }

            return this.formatMessage(message);
        } catch (error) {
            this.logger.error('Failed to get message', { error: error.message, messageId });
            throw error;
        }
    }

    /**
     * Get chat messages
     */
    async getChatMessages(chatId, userId, pagination = {}) {
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

            const page = pagination.page || 1;
            const limit = pagination.limit || 50;
            const offset = (page - 1) * limit;

            const where = {
                chat_id: chat.id,
                is_deleted: false
            };

            if (pagination.before) {
                where.id = { [Op.lt]: pagination.before };
            }

            const { count, rows } = await Message.findAndCountAll({
                where,
                include: [
                    {
                        model: User,
                        as: 'sender',
                        attributes: ['uuid', 'display_name', 'username', 'avatar_url', 'is_verified', 'is_premium']
                    },
                    {
                        model: Message,
                        as: 'replyTo',
                        include: [{
                            model: User,
                            as: 'sender',
                            attributes: ['uuid', 'display_name']
                        }]
                    }
                ],
                order: [['created_at', 'DESC']],
                limit,
                offset
            });

            const messages = rows.map(msg => this.formatMessage(msg));

            // Mark messages as delivered
            await this.markAsDelivered(chat.id, userId, messages.map(m => m.id));

            return {
                messages: messages.reverse(),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit),
                    hasMore: offset + limit < count
                }
            };
        } catch (error) {
            this.logger.error('Failed to get chat messages', { error: error.message, chatId });
            throw error;
        }
    }

    /**
     * Edit message
     */
    async editMessage(messageId, userId, newContent) {
        try {
            const message = await Message.findOne({
                where: { uuid: messageId },
                include: ['chat']
            });

            if (!message) {
                throw new Error('Message not found');
            }

            if (message.sender_id !== userId) {
                throw new Error('Cannot edit another user\'s message');
            }

            if (message.is_deleted) {
                throw new Error('Cannot edit deleted message');
            }

            // Check edit time limit
            const editLimit = await this.featureService.isEnabled('message.edit_limit') ? 86400 : 0;
            if (editLimit > 0) {
                const diff = (Date.now() - new Date(message.created_at)) / 1000;
                if (diff > editLimit) {
                    throw new Error('Edit window has expired');
                }
            }

            // Save history
            await this.saveMessageHistory(message);

            // Update message
            message.content = newContent;
            message.rich_text = this.parseRichText(newContent);
            message.mentions = this.extractMentions(newContent);
            message.hashtags = this.extractHashtags(newContent);
            message.links = this.extractLinks(newContent);
            message.edited_at = new Date();
            message.edited_version += 1;
            await message.save();

            // Publish event
            await this.eventBus.publish('message.updated', {
                messageId: message.uuid,
                chatId: message.chat.uuid,
                userId,
                timestamp: new Date().toISOString()
            });

            return await this.getMessage(message.uuid, userId);
        } catch (error) {
            this.logger.error('Failed to edit message', { error: error.message, messageId });
            throw error;
        }
    }

    /**
     * Delete message
     */
    async deleteMessage(messageId, userId, forEveryone = false) {
        try {
            const message = await Message.findOne({
                where: { uuid: messageId },
                include: ['chat']
            });

            if (!message) {
                throw new Error('Message not found');
            }

            if (message.sender_id !== userId && !forEveryone) {
                throw new Error('Cannot delete another user\'s message');
            }

            if (message.is_deleted) {
                throw new Error('Message already deleted');
            }

            if (forEveryone) {
                // Check delete for everyone time limit
                const deleteLimit = await this.featureService.isEnabled('message.delete_limit') ? 86400 : 0;
                if (deleteLimit > 0) {
                    const diff = (Date.now() - new Date(message.created_at)) / 1000;
                    if (diff > deleteLimit) {
                        throw new Error('Delete for everyone window has expired');
                    }
                }

                message.is_deleted = true;
                message.deleted_for_everyone = true;
                message.deleted_at = new Date();
                message.deleted_by_id = userId;
                await message.save();

                // Publish event
                await this.eventBus.publish('message.deleted', {
                    messageId: message.uuid,
                    chatId: message.chat.uuid,
                    userId,
                    forEveryone: true,
                    timestamp: new Date().toISOString()
                });
            } else {
                // Delete for me only - mark as deleted for user
                // Implementation depends on how you want to handle "delete for me"
                // Could use a separate table or mark as hidden
                // For now, we'll use a soft delete flag
                message.is_deleted = true;
                await message.save();
            }

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to delete message', { error: error.message, messageId });
            throw error;
        }
    }

    /**
     * Mark message as delivered
     */
    async markAsDelivered(chatId, userId, messageIds) {
        try {
            const chat = await Chat.findByPk(chatId);
            if (!chat) return;

            const messages = await Message.findAll({
                where: {
                    id: { [Op.in]: messageIds },
                    chat_id: chatId,
                    status: { [Op.ne]: 'delivered' }
                }
            });

            for (const message of messages) {
                if (message.sender_id === userId) continue;
                
                const deliveredTo = message.delivered_to || [];
                if (!deliveredTo.includes(userId)) {
                    deliveredTo.push(userId);
                    message.delivered_to = deliveredTo;
                    if (message.status === 'sent') {
                        message.status = 'delivered';
                        message.delivered_at = new Date();
                    }
                    await message.save();
                }
            }

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to mark as delivered', { error: error.message });
            return { success: false };
        }
    }

    /**
     * Mark message as seen
     */
    async markAsSeen(messageId, userId) {
        try {
            const message = await Message.findOne({ where: { uuid: messageId } });
            if (!message) {
                throw new Error('Message not found');
            }

            if (message.sender_id === userId) return;

            const seenBy = message.seen_by || [];
            if (!seenBy.includes(userId)) {
                seenBy.push(userId);
                message.seen_by = seenBy;
                if (message.status !== 'seen') {
                    message.status = 'seen';
                    message.seen_at = new Date();
                }
                await message.save();

                // Publish event
                await this.eventBus.publish('message.seen', {
                    messageId: message.uuid,
                    userId,
                    timestamp: new Date().toISOString()
                });
            }

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to mark as seen', { error: error.message, messageId });
            return { success: false };
        }
    }

    /**
     * Format message for response
     */
    formatMessage(message) {
        return {
            id: message.uuid,
            chatId: message.chat?.uuid || null,
            type: message.message_type,
            content: message.content,
            richText: message.rich_text,
            mentions: message.mentions,
            hashtags: message.hashtags,
            links: message.links,
            media: message.media,
            metadata: message.metadata,
            status: message.status,
            deliveredAt: message.delivered_at,
            seenAt: message.seen_at,
            deliveredTo: message.delivered_to,
            seenBy: message.seen_by,
            isEdited: message.edited_version > 0,
            editedAt: message.edited_at,
            editedVersion: message.edited_version,
            isForwarded: message.is_forwarded,
            forwardFrom: message.forward_from_user_id,
            isReply: message.is_reply,
            replyTo: message.replyTo ? {
                id: message.replyTo.uuid,
                content: message.replyTo.content,
                sender: message.replyTo.sender ? {
                    id: message.replyTo.sender.uuid,
                    displayName: message.replyTo.sender.display_name
                } : null
            } : null,
            sender: message.sender ? {
                id: message.sender.uuid,
                displayName: message.sender.display_name,
                username: message.sender.username,
                avatarUrl: message.sender.avatar_url,
                isVerified: message.sender.is_verified,
                isPremium: message.sender.is_premium
            } : null,
            createdAt: message.created_at,
            updatedAt: message.updated_at
        };
    }

    /**
     * Parse rich text from content
     */
    parseRichText(content) {
        if (!content) return null;
        // Parse markdown, mentions, hashtags, links, etc.
        // This is a simplified version
        return {
            text: content,
            entities: []
        };
    }

    /**
     * Extract mentions from content
     */
    extractMentions(content) {
        if (!content) return [];
        const regex = /@(\w+)/g;
        const matches = content.matchAll(regex);
        return Array.from(matches, m => m[1]);
    }

    /**
     * Extract hashtags from content
     */
    extractHashtags(content) {
        if (!content) return [];
        const regex = /#(\w+)/g;
        const matches = content.matchAll(regex);
        return Array.from(matches, m => m[1]);
    }

    /**
     * Extract links from content
     */
    extractLinks(content) {
        if (!content) return [];
        const regex = /(https?:\/\/[^\s]+)/g;
        const matches = content.matchAll(regex);
        return Array.from(matches, m => m[1]);
    }

    /**
     * Get reply preview
     */
    async getReplyPreview(messageId) {
        const message = await Message.findByPk(messageId);
        if (!message) return null;
        return message.content ? message.content.substring(0, 100) : '[Media]';
    }

    /**
     * Save message history
     */
    async saveMessageHistory(message) {
        // Implementation for saving message history
        // This would store previous versions of messages
    }

    /**
     * Update unread counts
     */
    async updateUnreadCounts(chatId, senderId) {
        const participants = await ChatParticipant.findAll({
            where: {
                chat_id: chatId,
                user_id: { [Op.ne]: senderId }
            }
        });

        for (const participant of participants) {
            participant.unread_count += 1;
            await participant.save();
        }
    }

    /**
     * Process media
     */
    async processMedia(messageId, media) {
        // Queue media processing job
        await this.messageQueue.add('process-media', {
            messageId,
            media
        });
    }

    /**
     * Send message notifications
     */
    async sendMessageNotifications(message, chat) {
        // Queue notification job
        await this.messageQueue.add('send-notification', {
            messageId: message.uuid,
            chatId: chat.uuid,
            senderId: message.sender_id
        });
    }
}

// Singleton instance
let messageServiceInstance = null;

const getMessageService = async () => {
    if (!messageServiceInstance) {
        messageServiceInstance = new MessageService();
        await messageServiceInstance.initialize();
    }
    return messageServiceInstance;
};

module.exports = {
    MessageService,
    getMessageService
};