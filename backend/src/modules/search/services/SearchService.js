const { Op } = require('sequelize');
const { Message, User, Group, Channel, File } = require('../../../database/models');
const { getCacheService } = require('../../../services/CacheService');
const { getLogger } = require('../../../services/LoggerService');
const { getFeatureToggleService } = require('../../../services/FeatureToggleService');
const config = require('../../../config');

class SearchService {
    constructor() {
        this.cache = null;
        this.logger = null;
        this.featureService = null;
        this.cacheTTL = 300;
        this.elasticsearch = null;
        this.useElasticsearch = false;
    }

    async initialize() {
        this.cache = await getCacheService();
        this.logger = getLogger();
        this.featureService = await getFeatureToggleService();
        
        // Check if Elasticsearch is enabled
        const esEnabled = await this.featureService.isEnabled('search.elasticsearch');
        if (esEnabled) {
            try {
                const { Client } = require('@elastic/elasticsearch');
                this.elasticsearch = new Client({
                    node: `http://${config.elasticsearch.host}:${config.elasticsearch.port}`,
                    auth: config.elasticsearch.user ? {
                        username: config.elasticsearch.user,
                        password: config.elasticsearch.password
                    } : undefined
                });
                await this.elasticsearch.ping();
                this.useElasticsearch = true;
                this.logger.info('✅ Elasticsearch connected');
            } catch (error) {
                this.logger.warn('Elasticsearch not available, falling back to MySQL', { error: error.message });
                this.useElasticsearch = false;
            }
        }

        this.logger.info('✅ Search Service initialized');
        return this;
    }

    /**
     * Search messages
     */
    async searchMessages(userId, query, filters = {}, pagination = {}) {
        try {
            const searchEnabled = await this.featureService.isEnabled('search.enabled');
            if (!searchEnabled) {
                throw new Error('Search is disabled');
            }

            const page = pagination.page || 1;
            const limit = pagination.limit || 50;
            const offset = (page - 1) * limit;

            // Get user's chat IDs
            const ChatParticipant = require('../../../database/models').ChatParticipant;
            const participants = await ChatParticipant.findAll({
                where: { user_id: userId },
                attributes: ['chat_id']
            });
            const chatIds = participants.map(p => p.chat_id);

            if (this.useElasticsearch) {
                return await this.searchMessagesES(query, chatIds, filters, pagination);
            } else {
                return await this.searchMessagesMySQL(query, chatIds, filters, pagination);
            }
        } catch (error) {
            this.logger.error('Failed to search messages', { error: error.message, userId, query });
            throw error;
        }
    }

    /**
     * Search messages using Elasticsearch
     */
    async searchMessagesES(query, chatIds, filters = {}, pagination = {}) {
        try {
            const page = pagination.page || 1;
            const limit = pagination.limit || 50;
            const from = (page - 1) * limit;

            const must = [
                {
                    multi_match: {
                        query,
                        fields: ['content^3', 'rich_text.text^2'],
                        fuzziness: 'AUTO'
                    }
                }
            ];

            // Chat filter
            if (chatIds && chatIds.length > 0) {
                must.push({
                    terms: { chat_id: chatIds }
                });
            }

            // Additional filters
            if (filters.messageType) {
                must.push({
                    term: { message_type: filters.messageType }
                });
            }

            if (filters.senderId) {
                must.push({
                    term: { sender_id: filters.senderId }
                });
            }

            if (filters.fromDate) {
                must.push({
                    range: {
                        created_at: { gte: filters.fromDate }
                    }
                });
            }

            if (filters.toDate) {
                must.push({
                    range: {
                        created_at: { lte: filters.toDate }
                    }
                });
            }

            const result = await this.elasticsearch.search({
                index: 'messages',
                body: {
                    query: {
                        bool: { must }
                    },
                    sort: filters.sort || [
                        { created_at: 'desc' }
                    ],
                    from,
                    size: limit,
                    highlight: {
                        fields: {
                            content: {},
                            'rich_text.text': {}
                        }
                    }
                }
            });

            const hits = result.hits.hits;
            const total = result.hits.total.value;

            return {
                messages: hits.map(hit => ({
                    id: hit._source.message_id || hit._source.id,
                    content: hit._source.content,
                    chatId: hit._source.chat_id,
                    senderId: hit._source.sender_id,
                    createdAt: hit._source.created_at,
                    highlight: hit.highlight
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            this.logger.error('Elasticsearch search failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Search messages using MySQL (fallback)
     */
    async searchMessagesMySQL(query, chatIds, filters = {}, pagination = {}) {
        try {
            const page = pagination.page || 1;
            const limit = pagination.limit || 50;
            const offset = (page - 1) * limit;

            const where = {
                chat_id: { [Op.in]: chatIds },
                is_deleted: false
            };

            if (query) {
                where.content = { [Op.like]: `%${query}%` };
            }

            if (filters.messageType) {
                where.message_type = filters.messageType;
            }

            if (filters.senderId) {
                where.sender_id = filters.senderId;
            }

            if (filters.fromDate) {
                where.created_at = { [Op.gte]: filters.fromDate };
            }

            if (filters.toDate) {
                where.created_at = { ...where.created_at, [Op.lte]: filters.toDate };
            }

            const { count, rows } = await Message.findAndCountAll({
                where,
                include: [
                    {
                        model: User,
                        as: 'sender',
                        attributes: ['uuid', 'display_name', 'username', 'avatar_url']
                    },
                    {
                        model: Chat,
                        as: 'chat',
                        attributes: ['uuid', 'title', 'chat_type']
                    }
                ],
                order: [['created_at', 'DESC']],
                limit,
                offset
            });

            return {
                messages: rows.map(msg => ({
                    id: msg.uuid,
                    content: msg.content,
                    chatId: msg.chat ? msg.chat.uuid : null,
                    chatTitle: msg.chat ? msg.chat.title : null,
                    chatType: msg.chat ? msg.chat.chat_type : null,
                    sender: msg.sender ? {
                        id: msg.sender.uuid,
                        displayName: msg.sender.display_name,
                        username: msg.sender.username
                    } : null,
                    createdAt: msg.created_at
                })),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };
        } catch (error) {
            this.logger.error('MySQL search failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Search users
     */
    async searchUsers(query, filters = {}, pagination = {}) {
        try {
            const page = pagination.page || 1;
            const limit = pagination.limit || 20;
            const offset = (page - 1) * limit;

            const where = {
                is_active: true
            };

            if (query) {
                where[Op.or] = [
                    { display_name: { [Op.like]: `%${query}%` } },
                    { username: { [Op.like]: `%${query}%` } },
                    { phone: { [Op.like]: `%${query}%` } }
                ];
            }

            if (filters.isVerified !== undefined) {
                where.is_verified = filters.isVerified;
            }

            if (filters.isPremium !== undefined) {
                where.is_premium = filters.isPremium;
            }

            const { count, rows } = await User.findAndCountAll({
                where,
                attributes: ['uuid', 'display_name', 'username', 'avatar_url', 'is_verified', 'is_premium', 'status'],
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
     * Search files
     */
    async searchFiles(userId, query, filters = {}, pagination = {}) {
        try {
            const page = pagination.page || 1;
            const limit = pagination.limit || 20;
            const offset = (page - 1) * limit;

            const where = {
                status: 'ready'
            };

            if (query) {
                where.original_name = { [Op.like]: `%${query}%` };
            }

            if (filters.fileType) {
                where.file_type = filters.fileType;
            }

            if (filters.mimeType) {
                where.mime_type = { [Op.like]: `%${filters.mimeType}%` };
            }

            // Filter by chat access
            const ChatParticipant = require('../../../database/models').ChatParticipant;
            const participants = await ChatParticipant.findAll({
                where: { user_id: userId },
                attributes: ['chat_id']
            });
            const chatIds = participants.map(p => p.chat_id);
            where[Op.or] = [
                { chat_id: { [Op.in]: chatIds } },
                { uploader_id: userId }
            ];

            const { count, rows } = await File.findAndCountAll({
                where,
                include: [
                    {
                        model: User,
                        as: 'uploader',
                        attributes: ['uuid', 'display_name', 'username']
                    }
                ],
                limit,
                offset,
                order: [['uploaded_at', 'DESC']]
            });

            return {
                files: rows.map(file => ({
                    id: file.uuid,
                    name: file.original_name,
                    size: file.size,
                    mimeType: file.mime_type,
                    fileType: file.file_type,
                    thumbnailUrl: file.thumbnail_url,
                    uploader: file.uploader ? {
                        id: file.uploader.uuid,
                        displayName: file.uploader.display_name
                    } : null,
                    uploadedAt: file.uploaded_at
                })),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };
        } catch (error) {
            this.logger.error('Failed to search files', { error: error.message, query });
            throw error;
        }
    }

    /**
     * Get search suggestions
     */
    async getSuggestions(userId, query) {
        try {
            const suggestions = [];

            // Get user suggestions
            const users = await User.findAll({
                where: {
                    display_name: { [Op.like]: `%${query}%` },
                    is_active: true
                },
                attributes: ['display_name', 'username'],
                limit: 5
            });
            suggestions.push(...users.map(u => ({
                type: 'user',
                label: u.display_name,
                value: u.username
            })));

            // Get group suggestions
            const Group = require('../../../database/models').Group;
            const groups = await Group.findAll({
                where: {
                    title: { [Op.like]: `%${query}%` },
                    is_deleted: false,
                    visibility: 'public'
                },
                attributes: ['title'],
                limit: 5
            });
            suggestions.push(...groups.map(g => ({
                type: 'group',
                label: g.title,
                value: g.title
            })));

            return suggestions;
        } catch (error) {
            this.logger.error('Failed to get suggestions', { error: error.message, query });
            return [];
        }
    }

    /**
     * Index message for search
     */
    async indexMessage(message) {
        if (!this.useElasticsearch) return;

        try {
            await this.elasticsearch.index({
                index: 'messages',
                id: message.uuid,
                body: {
                    id: message.uuid,
                    chat_id: message.chat_id,
                    sender_id: message.sender_id,
                    content: message.content,
                    rich_text: message.rich_text,
                    message_type: message.message_type,
                    created_at: message.created_at,
                    updated_at: message.updated_at
                }
            });
        } catch (error) {
            this.logger.error('Failed to index message', { error: error.message, messageId: message.uuid });
        }
    }

    /**
     * Delete message from index
     */
    async deleteIndexMessage(messageId) {
        if (!this.useElasticsearch) return;

        try {
            await this.elasticsearch.delete({
                index: 'messages',
                id: messageId
            });
        } catch (error) {
            this.logger.error('Failed to delete indexed message', { error: error.message, messageId });
        }
    }

    /**
     * Reindex all messages
     */
    async reindexAll() {
        if (!this.useElasticsearch) {
            throw new Error('Elasticsearch is not enabled');
        }

        try {
            // Delete existing index
            try {
                await this.elasticsearch.indices.delete({ index: 'messages' });
            } catch (error) {
                // Index might not exist
            }

            // Create new index with mapping
            await this.elasticsearch.indices.create({
                index: 'messages',
                body: {
                    mappings: {
                        properties: {
                            id: { type: 'keyword' },
                            chat_id: { type: 'keyword' },
                            sender_id: { type: 'keyword' },
                            content: { type: 'text', analyzer: 'standard' },
                            'rich_text.text': { type: 'text', analyzer: 'standard' },
                            message_type: { type: 'keyword' },
                            created_at: { type: 'date' },
                            updated_at: { type: 'date' }
                        }
                    }
                }
            });

            // Index all messages
            const messages = await Message.findAll({
                where: { is_deleted: false }
            });

            let count = 0;
            for (const message of messages) {
                await this.indexMessage(message);
                count++;
                if (count % 100 === 0) {
                    this.logger.info(`Indexed ${count} messages`);
                }
            }

            this.logger.info(`Reindex complete: ${count} messages indexed`);
            return { success: true, count };
        } catch (error) {
            this.logger.error('Failed to reindex', { error: error.message });
            throw error;
        }
    }
}

// Singleton instance
let searchServiceInstance = null;

const getSearchService = async () => {
    if (!searchServiceInstance) {
        searchServiceInstance = new SearchService();
        await searchServiceInstance.initialize();
    }
    return searchServiceInstance;
};

module.exports = {
    SearchService,
    getSearchService
};