const ResponseHandler = require('../../../utils/responseHandler');
const { getMessageService } = require('../services/MessageService');
const { getChatService } = require('../../chats/services/ChatService');
const { getLogger } = require('../../../services/LoggerService');

class MessageController {
    constructor() {
        this.messageService = null;
        this.chatService = null;
        this.logger = null;
    }

    async initialize() {
        this.messageService = await getMessageService();
        this.chatService = await getChatService();
        this.logger = getLogger();
        return this;
    }

    /**
     * Send message
     * POST /api/v1/chats/:chatId/messages
     */
    sendMessage = async (req, res, next) => {
        try {
            const { chatId } = req.params;
            const { content, type, replyTo, media, metadata } = req.body;

            const result = await this.messageService.sendMessage(req.user.id, {
                chatId,
                content,
                messageType: type || 'text',
                replyTo,
                media,
                metadata
            });

            return ResponseHandler.success(res, result, 'Message sent successfully');
        } catch (error) {
            this.logger.error('Send message error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get chat messages
     * GET /api/v1/chats/:chatId/messages
     */
    getMessages = async (req, res, next) => {
        try {
            const { chatId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const before = req.query.before;

            const result = await this.messageService.getChatMessages(
                chatId,
                req.user.id,
                { page, limit, before }
            );

            return ResponseHandler.paginated(
                res,
                result.messages,
                result.pagination,
                'Messages retrieved successfully'
            );
        } catch (error) {
            this.logger.error('Get messages error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get message
     * GET /api/v1/messages/:messageId
     */
    getMessage = async (req, res, next) => {
        try {
            const { messageId } = req.params;
            const message = await this.messageService.getMessage(messageId, req.user.id);

            if (!message) {
                return ResponseHandler.notFound(res, 'Message not found');
            }

            return ResponseHandler.success(res, message, 'Message retrieved successfully');
        } catch (error) {
            this.logger.error('Get message error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Edit message
     * PUT /api/v1/messages/:messageId
     */
    editMessage = async (req, res, next) => {
        try {
            const { messageId } = req.params;
            const { content } = req.body;

            if (!content) {
                return ResponseHandler.error(res, 'Content is required', 400);
            }

            const result = await this.messageService.editMessage(
                messageId,
                req.user.id,
                content
            );

            return ResponseHandler.success(res, result, 'Message edited successfully');
        } catch (error) {
            this.logger.error('Edit message error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Delete message
     * DELETE /api/v1/messages/:messageId
     */
    deleteMessage = async (req, res, next) => {
        try {
            const { messageId } = req.params;
            const { forEveryone = false } = req.query;

            const result = await this.messageService.deleteMessage(
                messageId,
                req.user.id,
                forEveryone === 'true'
            );

            return ResponseHandler.success(res, result, 'Message deleted successfully');
        } catch (error) {
            this.logger.error('Delete message error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Mark message as seen
     * POST /api/v1/messages/:messageId/seen
     */
    markAsSeen = async (req, res, next) => {
        try {
            const { messageId } = req.params;
            const result = await this.messageService.markAsSeen(messageId, req.user.id);
            return ResponseHandler.success(res, result, 'Message marked as seen');
        } catch (error) {
            this.logger.error('Mark as seen error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };
}

// Singleton instance
let messageControllerInstance = null;

const getMessageController = async () => {
    if (!messageControllerInstance) {
        messageControllerInstance = new MessageController();
        await messageControllerInstance.initialize();
    }
    return messageControllerInstance;
};

module.exports = {
    MessageController,
    getMessageController
};