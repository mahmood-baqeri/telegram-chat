const { getMessageService } = require('../modules/messages/services/MessageService');
const { getChatService } = require('../modules/chats/services/ChatService');
const { getLogger } = require('../services/LoggerService');

const setupMessagingSocket = (io) => {
    const logger = getLogger();
    const messageNamespace = io.of('/messaging');

    messageNamespace.on('connection', (socket) => {
        const userId = socket.user.id;
        const userUuid = socket.user.uuid;

        logger.info(`User connected to messaging: ${userUuid}`);

        // Join user room
        socket.join(`user:${userUuid}`);

        // Handle typing events
        socket.on('typing:start', async (data) => {
            const { chatId } = data;
            socket.to(`chat:${chatId}`).emit('typing:started', {
                userId: userUuid,
                chatId,
                timestamp: new Date().toISOString()
            });
        });

        socket.on('typing:stop', async (data) => {
            const { chatId } = data;
            socket.to(`chat:${chatId}`).emit('typing:stopped', {
                userId: userUuid,
                chatId,
                timestamp: new Date().toISOString()
            });
        });

        // Handle message events
        socket.on('message:send', async (data) => {
            try {
                const messageService = await getMessageService();
                const { chatId, content, type, replyTo, media } = data;

                const message = await messageService.sendMessage(userId, {
                    chatId,
                    content,
                    messageType: type || 'text',
                    replyTo,
                    media
                });

                // Broadcast to chat room
                io.to(`chat:${chatId}`).emit('message:created', {
                    message,
                    chatId,
                    timestamp: new Date().toISOString()
                });

                // Notify sender
                socket.emit('message:sent', {
                    message,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                logger.error('Socket message send error:', { error: error.message });
                socket.emit('message:error', {
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        socket.on('message:edit', async (data) => {
            try {
                const { messageId, content } = data;
                const messageService = await getMessageService();

                const message = await messageService.editMessage(
                    messageId,
                    userId,
                    content
                );

                io.to(`chat:${message.chatId}`).emit('message:updated', {
                    message,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                logger.error('Socket message edit error:', { error: error.message });
                socket.emit('message:error', {
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        socket.on('message:delete', async (data) => {
            try {
                const { messageId, forEveryone } = data;
                const messageService = await getMessageService();

                const result = await messageService.deleteMessage(
                    messageId,
                    userId,
                    forEveryone || false
                );

                io.to(`chat:${data.chatId}`).emit('message:deleted', {
                    messageId,
                    chatId: data.chatId,
                    forEveryone: forEveryone || false,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                logger.error('Socket message delete error:', { error: error.message });
                socket.emit('message:error', {
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        socket.on('message:seen', async (data) => {
            try {
                const { messageId } = data;
                const messageService = await getMessageService();

                await messageService.markAsSeen(messageId, userId);

                socket.to(`chat:${data.chatId}`).emit('message:seen', {
                    messageId,
                    userId: userUuid,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                logger.error('Socket message seen error:', { error: error.message });
            }
        });

        // Handle chat events
        socket.on('chat:join', async (data) => {
            const { chatId } = data;
            socket.join(`chat:${chatId}`);
            logger.debug(`User ${userUuid} joined chat: ${chatId}`);
        });

        socket.on('chat:leave', async (data) => {
            const { chatId } = data;
            socket.leave(`chat:${chatId}`);
            logger.debug(`User ${userUuid} left chat: ${chatId}`);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            logger.info(`User disconnected from messaging: ${userUuid}`);
        });
    });
};

module.exports = {
    setupMessagingSocket
};