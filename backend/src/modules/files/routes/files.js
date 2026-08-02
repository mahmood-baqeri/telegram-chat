const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getFileController } = require('../controllers/FileController');
const { auth } = require('../../../middlewares/auth');
const { validate } = require('../../../middlewares/validator');
const Joi = require('joi');

const fileControllerPromise = getFileController();

// Multer for chunk upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max chunk size
    }
});

// Validation schemas
const startUploadSchema = Joi.object({
    fileName: Joi.string().max(255).required(),
    fileSize: Joi.number().positive().required(),
    mimeType: Joi.string().required(),
    fileType: Joi.string().valid('image', 'video', 'audio', 'voice', 'document', 'sticker', 'gif', 'avatar', 'other'),
    chatId: Joi.string().uuid(),
    metadata: Joi.object()
});

const uploadChunkSchema = Joi.object({
    sessionId: Joi.string().uuid().required(),
    chunkIndex: Joi.number().min(0).required(),
    checksum: Joi.string().length(64)
});

const completeUploadSchema = Joi.object({
    sessionId: Joi.string().uuid().required()
});

// File routes
router.post('/upload/start',
    auth,
    validate(startUploadSchema),
    async (req, res, next) => {
        const controller = await fileControllerPromise;
        return controller.startUpload(req, res, next);
    }
);

router.post('/upload/chunk',
    auth,
    upload.single('chunk'),
    validate(uploadChunkSchema),
    async (req, res, next) => {
        const controller = await fileControllerPromise;
        return controller.uploadChunk(req, res, next);
    }
);

router.post('/upload/complete',
    auth,
    validate(completeUploadSchema),
    async (req, res, next) => {
        const controller = await fileControllerPromise;
        return controller.completeUpload(req, res, next);
    }
);

router.post('/upload/resume',
    auth,
    async (req, res, next) => {
        const controller = await fileControllerPromise;
        return controller.resumeUpload(req, res, next);
    }
);

router.delete('/upload/:sessionId',
    auth,
    async (req, res, next) => {
        const controller = await fileControllerPromise;
        return controller.cancelUpload(req, res, next);
    }
);

router.get('/:fileId',
    auth,
    async (req, res, next) => {
        const controller = await fileControllerPromise;
        return controller.getFileInfo(req, res, next);
    }
);

router.get('/:fileId/download',
    auth,
    async (req, res, next) => {
        const controller = await fileControllerPromise;
        return controller.downloadFile(req, res, next);
    }
);

router.get('/:fileId/stream',
    auth,
    async (req, res, next) => {
        const controller = await fileControllerPromise;
        return controller.streamFile(req, res, next);
    }
);

router.get('/:fileId/thumbnail',
    auth,
    async (req, res, next) => {
        const controller = await fileControllerPromise;
        return controller.getThumbnail(req, res, next);
    }
);

router.delete('/:fileId',
    auth,
    async (req, res, next) => {
        const controller = await fileControllerPromise;
        return controller.deleteFile(req, res, next);
    }
);

module.exports = router;