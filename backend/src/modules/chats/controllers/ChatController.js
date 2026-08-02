const ResponseHandler = require('../../../utils/responseHandler');
const { getChatService } = require('../services/ChatService');
const { getLogger } = require('../../../services/LoggerService');

class ChatController {
    constructor() {
        this.chatService = null;
        this.logger = null;
    }

    async initialize() {
        this.chatService = await getChatService();
        this.logger = getLogger();
        return this;
    }

    /**
     * Get user chats
     * GET /api/v1/chats
     */
    getChats = async (req, res, next) => {
        try {
            const filters = {
                isArchived: req.query.archived === 'true',
                isMuted: req.query.muted === 'true',
                isPinned: req.query.pinned === 'true'
            };

            const chats = await this.chatService.getUserChats(req.user.id, filters);
            return ResponseHandler.success(res, chats, 'Chats retrieved successfully');
        } catch (error) {
            this.logger.error('Get chats error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get chat
     * GET /api/v1/chats/:chatId
     */
    getChat = async (req, res, next) => {
        try {
            const { chatId } = req.params;
            const chat = await this.chatService.getChat(chatId, req.user.id);

            if (!chat) {
                return ResponseHandler.notFound(res, 'Chat not found');
            }

            return ResponseHandler.success(res, chat, 'Chat retrieved successfully');
        } catch (error) {
            this.logger.error('Get chat error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Create chat
     * POST /api/v1/chats
     */
    createChat = async (req, res, next) => {
        try {
            const { userId, title } = req.body;

            if (!userId) {
                return ResponseHandler.error(res, 'User ID is required', 400);
            }

            const chat = await this.chatService.createChat(req.user.id, {
                participantId: userId,
                title
            });

            return ResponseHandler.created(res, chat, 'Chat created successfully');
        } catch (error) {
            this.logger.error('Create chat error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Archive chat
     * PUT /api/v1/chats/:chatId/archive
     */
    archiveChat = async (req, res, next) => {
        try {
            const { chatId } = req.params;
            const chat = await this.chatService.archiveChat(chatId, req.user.id);
            return ResponseHandler.success(res, chat, 'Chat archived successfully');
        } catch (error) {
            this.logger.error('Archive chat error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Unarchive chat
     * PUT /api/v1/chats/:chatId/unarchive
     */
    unarchiveChat = async (req, res, next) => {
        try {
            const { chatId } = req.params;
            const chat = await this.chatService.unarchiveChat(chatId, req.user.id);
            return ResponseHandler.success(res, chat, 'Chat unarchived successfully');
        } catch (error) {
            this.logger.error('Unarchive chat error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Mute chat
     * PUT /api/v1/chats/:chatId/mute
     */
    muteChat = async (req, res, next) => {
        try {
            const { chatId } = req.params;
            const { duration } = req.body;

            const chat = await this.chatService.muteChat(chatId, req.user.id, duration);
            return ResponseHandler.success(res, chat, 'Chat muted successfully');
        } catch (error) {
            this.logger.error('Mute chat error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Unmute chat
     * PUT /api/v1/chats/:chatId/unmute
     */
    unmuteChat = async (req, res, next) => {
        try {
            const { chatId } = req.params;
            const chat = await this.chatService.unmuteChat(chatId, req.user.id);
            return ResponseHandler.success(res, chat, 'Chat unmuted successfully');
        } catch (error) {
            this.logger.error('Unmute chat error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Pin chat
     * PUT /api/v1/chats/:chatId/pin
     */
    pinChat = async (req, res, next) => {
        try {
            const { chatId } = req.params;
            const chat = await this.chatService.pinChat(chatId, req.user.id);
            return ResponseHandler.success(res, chat, 'Chat pinned successfully');
        } catch (error) {
            this.logger.error('Pin chat error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Unpin chat
     * PUT /api/v1/chats/:chatId/unpin
     */
    unpinChat = async (req, res, next) => {
        try {
            const { chatId } = req.params;
            const chat = await this.chatService.unpinChat(chatId, req.user.id);
            return ResponseHandler.success(res, chat, 'Chat unpinned successfully');
        } catch (error) {
            this.logger.error('Unpin chat error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Mark chat as read
     * PUT /api/v1/chats/:chatId/read
     */
    markAsRead = async (req, res, next) => {
        try {
            const { chatId } = req.params;
            const { messageId } = req.body;

            const result = await this.chatService.markAsRead(chatId, req.user.id, messageId);
            return ResponseHandler.success(res, result, 'Chat marked as read');
        } catch (error) {
            this.logger.error('Mark as read error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Delete chat
     * DELETE /api/v1/chats/:chatId
     */
    deleteChat = async (req, res, next) => {
        try {
            const { chatId } = req.params;
            const result = await this.chatService.deleteChat(chatId, req.user.id);
            return ResponseHandler.success(res, result, 'Chat deleted successfully');
        } catch (error) {
            this.logger.error('Delete chat error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get chat participants
     * GET /api/v1/chats/:chatId/participants
     */
    getParticipants = async (req, res, next) => {
        try {
            const { chatId } = req.params;
            const participants = await this.chatService.getChatParticipants(chatId);
            return ResponseHandler.success(res, participants, 'Participants retrieved successfully');
        } catch (error) {
            this.logger.error('Get participants error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };
}

// Singleton instance
let chatControllerInstance = null;

const getChatController = async () => {
    if (!chatControllerInstance) {
        chatControllerInstance = new ChatController();
        await chatControllerInstance.initialize();
    }
    return chatControllerInstance;
};

module.exports = {
    ChatController,
    getChatController
};