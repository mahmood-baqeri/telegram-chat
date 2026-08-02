const express = require('express');
const router = express.Router();
const { getChatController } = require('../controllers/ChatController');
const { getMessageController } = require('../../messages/controllers/MessageController');
const { auth } = require('../../../middlewares/auth');
const { validate } = require('../../../middlewares/validator');
const Joi = require('joi');

const chatControllerPromise = getChatController();
const messageControllerPromise = getMessageController();

// Validation schemas
const createChatSchema = Joi.object({
    userId: Joi.string().uuid().required(),
    title: Joi.string().max(100)
});

const sendMessageSchema = Joi.object({
    content: Joi.string().max(4096),
    type: Joi.string().valid('text', 'image', 'video', 'audio', 'voice', 'document', 'sticker', 'gif'),
    replyTo: Joi.string().uuid(),
    media: Joi.object(),
    metadata: Joi.object()
});

const editMessageSchema = Joi.object({
    content: Joi.string().max(4096).required()
});

// Chat routes
router.get('/',
    auth,
    async (req, res, next) => {
        const controller = await chatControllerPromise;
        return controller.getChats(req, res, next);
    }
);

router.get('/:chatId',
    auth,
    async (req, res, next) => {
        const controller = await chatControllerPromise;
        return controller.getChat(req, res, next);
    }
);

router.post('/',
    auth,
    validate(createChatSchema),
    async (req, res, next) => {
        const controller = await chatControllerPromise;
        return controller.createChat(req, res, next);
    }
);

router.put('/:chatId/archive',
    auth,
    async (req, res, next) => {
        const controller = await chatControllerPromise;
        return controller.archiveChat(req, res, next);
    }
);

router.put('/:chatId/unarchive',
    auth,
    async (req, res, next) => {
        const controller = await chatControllerPromise;
        return controller.unarchiveChat(req, res, next);
    }
);

router.put('/:chatId/mute',
    auth,
    async (req, res, next) => {
        const controller = await chatControllerPromise;
        return controller.muteChat(req, res, next);
    }
);

router.put('/:chatId/unmute',
    auth,
    async (req, res, next) => {
        const controller = await chatControllerPromise;
        return controller.unmuteChat(req, res, next);
    }
);

router.put('/:chatId/pin',
    auth,
    async (req, res, next) => {
        const controller = await chatControllerPromise;
        return controller.pinChat(req, res, next);
    }
);

router.put('/:chatId/unpin',
    auth,
    async (req, res, next) => {
        const controller = await chatControllerPromise;
        return controller.unpinChat(req, res, next);
    }
);

router.put('/:chatId/read',
    auth,
    async (req, res, next) => {
        const controller = await chatControllerPromise;
        return controller.markAsRead(req, res, next);
    }
);

router.delete('/:chatId',
    auth,
    async (req, res, next) => {
        const controller = await chatControllerPromise;
        return controller.deleteChat(req, res, next);
    }
);

router.get('/:chatId/participants',
    auth,
    async (req, res, next) => {
        const controller = await chatControllerPromise;
        return controller.getParticipants(req, res, next);
    }
);

// Message routes
router.get('/:chatId/messages',
    auth,
    async (req, res, next) => {
        const controller = await messageControllerPromise;
        return controller.getMessages(req, res, next);
    }
);

router.post('/:chatId/messages',
    auth,
    validate(sendMessageSchema),
    async (req, res, next) => {
        const controller = await messageControllerPromise;
        return controller.sendMessage(req, res, next);
    }
);

router.get('/messages/:messageId',
    auth,
    async (req, res, next) => {
        const controller = await messageControllerPromise;
        return controller.getMessage(req, res, next);
    }
);

router.put('/messages/:messageId',
    auth,
    validate(editMessageSchema),
    async (req, res, next) => {
        const controller = await messageControllerPromise;
        return controller.editMessage(req, res, next);
    }
);

router.delete('/messages/:messageId',
    auth,
    async (req, res, next) => {
        const controller = await messageControllerPromise;
        return controller.deleteMessage(req, res, next);
    }
);

router.post('/messages/:messageId/seen',
    auth,
    async (req, res, next) => {
        const controller = await messageControllerPromise;
        return controller.markAsSeen(req, res, next);
    }
);

module.exports = router;