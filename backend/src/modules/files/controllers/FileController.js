const path = require('path');
const fs = require('fs').promises;
const ResponseHandler = require('../../../utils/responseHandler');
const { getFileService } = require('../services/FileService');
const { getMediaProcessor } = require('../services/MediaProcessorService');
const { getLogger } = require('../../../services/LoggerService');
const config = require('../../../config');

class FileController {
    constructor() {
        this.fileService = null;
        this.mediaProcessor = null;
        this.logger = null;
    }

    async initialize() {
        this.fileService = await getFileService();
        this.mediaProcessor = await getMediaProcessor();
        this.logger = getLogger();
        return this;
    }

    /**
     * Start upload
     * POST /api/v1/files/upload/start
     */
    startUpload = async (req, res, next) => {
        try {
            const { fileName, fileSize, mimeType, fileType, chatId, metadata } = req.body;

            const result = await this.fileService.startUpload(req.user.id, {
                fileName,
                fileSize,
                mimeType,
                fileType,
                chatId,
                metadata
            });

            return ResponseHandler.success(res, result, 'Upload session started');
        } catch (error) {
            this.logger.error('Start upload error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Upload chunk
     * POST /api/v1/files/upload/chunk
     */
    uploadChunk = async (req, res, next) => {
        try {
            const { sessionId, chunkIndex, checksum } = req.body;
            const chunkData = req.file ? req.file.buffer : req.body;

            if (!chunkData) {
                return ResponseHandler.error(res, 'Chunk data is required', 400);
            }

            const result = await this.fileService.uploadChunk(
                sessionId,
                chunkIndex,
                chunkData,
                checksum
            );

            return ResponseHandler.success(res, result, 'Chunk uploaded');
        } catch (error) {
            this.logger.error('Upload chunk error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Complete upload
     * POST /api/v1/files/upload/complete
     */
    completeUpload = async (req, res, next) => {
        try {
            const { sessionId } = req.body;

            const result = await this.fileService.completeUpload(sessionId);
            return ResponseHandler.success(res, result, 'Upload completed');
        } catch (error) {
            this.logger.error('Complete upload error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Resume upload
     * POST /api/v1/files/upload/resume
     */
    resumeUpload = async (req, res, next) => {
        try {
            // This will be implemented for resume support
            return ResponseHandler.success(res, { resume: true }, 'Upload can be resumed');
        } catch (error) {
            this.logger.error('Resume upload error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Cancel upload
     * DELETE /api/v1/files/upload/:sessionId
     */
    cancelUpload = async (req, res, next) => {
        try {
            const { sessionId } = req.params;
            // This will be implemented for cancel support
            return ResponseHandler.success(res, { cancelled: true }, 'Upload cancelled');
        } catch (error) {
            this.logger.error('Cancel upload error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get file info
     * GET /api/v1/files/:fileId
     */
    getFileInfo = async (req, res, next) => {
        try {
            const { fileId } = req.params;
            const file = await this.fileService.getFileInfo(fileId, req.user.id);

            if (!file) {
                return ResponseHandler.notFound(res, 'File not found');
            }

            return ResponseHandler.success(res, file, 'File info retrieved');
        } catch (error) {
            this.logger.error('Get file info error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Download file
     * GET /api/v1/files/:fileId/download
     */
    downloadFile = async (req, res, next) => {
        try {
            const { fileId } = req.params;
            const result = await this.fileService.downloadFile(fileId, req.user.id);

            res.setHeader('Content-Type', result.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.fileName)}"`);
            res.setHeader('Content-Length', result.size);

            const fileStream = fs.createReadStream(result.filePath);
            fileStream.pipe(res);
        } catch (error) {
            this.logger.error('Download file error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Stream file (for video/audio)
     * GET /api/v1/files/:fileId/stream
     */
    streamFile = async (req, res, next) => {
        try {
            const { fileId } = req.params;
            const range = req.headers.range;

            const result = await this.fileService.downloadFile(fileId, req.user.id);
            const fileSize = result.size;

            if (range) {
                const parts = range.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;

                const file = await fs.open(result.filePath, 'r');
                const buffer = Buffer.alloc(chunksize);
                await file.read(buffer, 0, chunksize, start);
                await file.close();

                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': result.mimeType
                });
                res.end(buffer);
            } else {
                res.setHeader('Content-Type', result.mimeType);
                res.setHeader('Content-Length', fileSize);
                res.setHeader('Accept-Ranges', 'bytes');
                
                const fileStream = fs.createReadStream(result.filePath);
                fileStream.pipe(res);
            }
        } catch (error) {
            this.logger.error('Stream file error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get thumbnail
     * GET /api/v1/files/:fileId/thumbnail
     */
    getThumbnail = async (req, res, next) => {
        try {
            const { fileId } = req.params;
            // This will be implemented when thumbnail generation is ready
            return ResponseHandler.success(res, { url: `/storage/thumbnails/${fileId}.jpg` }, 'Thumbnail URL');
        } catch (error) {
            this.logger.error('Get thumbnail error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Delete file
     * DELETE /api/v1/files/:fileId
     */
    deleteFile = async (req, res, next) => {
        try {
            const { fileId } = req.params;
            const result = await this.fileService.deleteFile(fileId, req.user.id);
            return ResponseHandler.success(res, result, 'File deleted');
        } catch (error) {
            this.logger.error('Delete file error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };
}

// Singleton instance
let fileControllerInstance = null;

const getFileController = async () => {
    if (!fileControllerInstance) {
        fileControllerInstance = new FileController();
        await fileControllerInstance.initialize();
    }
    return fileControllerInstance;
};

module.exports = {
    FileController,
    getFileController
};