const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { File, UploadSession, DownloadSession } = require('../../../database/models');
const { getCacheService } = require('../../../services/CacheService');
const { getLogger } = require('../../../services/LoggerService');
const { getEventBus } = require('../../../services/EventBus');
const { getFeatureToggleService } = require('../../../services/FeatureToggleService');
const config = require('../../../config');

class FileService {
    constructor() {
        this.cache = null;
        this.logger = null;
        this.eventBus = null;
        this.featureService = null;
        this.cacheTTL = 300;
        this.storagePath = config.storage.path || './storage';
        this.chunkSize = 1024 * 1024; // 1MB
    }

    async initialize() {
        this.cache = await getCacheService();
        this.logger = getLogger();
        this.eventBus = await getEventBus();
        this.featureService = await getFeatureToggleService();
        
        // Ensure storage directory exists
        await this.ensureStorageDirectory();
        
        this.logger.info('✅ File Service initialized');
        return this;
    }

    /**
     * Ensure storage directory exists
     */
    async ensureStorageDirectory() {
        try {
            await fs.mkdir(this.storagePath, { recursive: true });
            await fs.mkdir(path.join(this.storagePath, 'avatars'), { recursive: true });
            await fs.mkdir(path.join(this.storagePath, 'media'), { recursive: true });
            await fs.mkdir(path.join(this.storagePath, 'documents'), { recursive: true });
            await fs.mkdir(path.join(this.storagePath, 'thumbnails'), { recursive: true });
            await fs.mkdir(path.join(this.storagePath, 'temp'), { recursive: true });
        } catch (error) {
            this.logger.error('Failed to create storage directories', { error: error.message });
            throw error;
        }
    }

    /**
     * Start upload session
     */
    async startUpload(userId, data) {
        try {
            const uploadEnabled = await this.featureService.isEnabled('file.upload.enabled');
            if (!uploadEnabled) {
                throw new Error('File upload is disabled');
            }

            const { fileName, fileSize, mimeType, fileType, chatId, metadata } = data;

            // Validate file size
            const maxSize = this.getMaxFileSize(fileType);
            if (fileSize > maxSize) {
                throw new Error(`File size exceeds maximum allowed (${maxSize / 1024 / 1024}MB)`);
            }

            // Validate file type
            if (!this.isAllowedFileType(mimeType)) {
                throw new Error('File type is not allowed');
            }

            // Generate unique file name
            const extension = path.extname(fileName);
            const storedName = `${uuidv4()}${extension}`;
            const checksum = this.generateChecksum(fileName, fileSize);

            // Create upload session
            const session = await UploadSession.create({
                uuid: uuidv4(),
                file_uuid: uuidv4(),
                user_id: userId,
                chat_id: chatId || null,
                total_size: fileSize,
                chunk_size: this.chunkSize,
                total_chunks: Math.ceil(fileSize / this.chunkSize),
                checksum,
                metadata: {
                    fileName,
                    mimeType,
                    fileType,
                    ...metadata
                },
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            });

            // Generate resume token
            const resumeToken = this.generateResumeToken(session.uuid);

            // Create file record
            const file = await File.create({
                uuid: session.file_uuid,
                original_name: fileName,
                stored_name: storedName,
                path: this.getFilePath(storedName, fileType),
                extension: extension.substring(1),
                mime_type: mimeType,
                size: fileSize,
                checksum: checksum,
                uploader_id: userId,
                chat_id: chatId || null,
                file_type: fileType || this.getFileTypeFromMime(mimeType),
                status: 'uploading',
                storage_provider: 'local',
                expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
            });

            this.logger.info(`Upload session started: ${session.uuid}`, {
                sessionId: session.uuid,
                userId,
                fileName,
                fileSize
            });

            return {
                sessionId: session.uuid,
                fileId: file.uuid,
                chunkSize: this.chunkSize,
                totalChunks: session.total_chunks,
                resumeToken,
                expiresAt: session.expires_at
            };
        } catch (error) {
            this.logger.error('Failed to start upload', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Upload chunk
     */
    async uploadChunk(sessionId, chunkIndex, chunkData, checksum) {
        try {
            const session = await UploadSession.findOne({
                where: { uuid: sessionId }
            });

            if (!session) {
                throw new Error('Upload session not found');
            }

            if (session.status === 'completed') {
                throw new Error('Upload already completed');
            }

            if (session.status === 'cancelled') {
                throw new Error('Upload cancelled');
            }

            if (chunkIndex >= session.total_chunks) {
                throw new Error('Invalid chunk index');
            }

            // Verify checksum
            if (checksum) {
                const calculatedChecksum = this.calculateChecksum(chunkData);
                if (calculatedChecksum !== checksum) {
                    throw new Error('Chunk checksum mismatch');
                }
            }

            // Store chunk
            const chunkPath = this.getChunkPath(session.uuid, chunkIndex);
            await this.storeChunk(chunkPath, chunkData);

            // Update session
            session.uploaded_size += chunkData.length;
            session.uploaded_chunks += 1;
            await session.save();

            // Check if upload is complete
            if (session.uploaded_chunks === session.total_chunks) {
                await this.completeUpload(session.uuid);
            }

            return {
                uploaded: true,
                chunkIndex,
                progress: (session.uploaded_chunks / session.total_chunks) * 100,
                uploadedChunks: session.uploaded_chunks,
                totalChunks: session.total_chunks
            };
        } catch (error) {
            this.logger.error('Failed to upload chunk', { error: error.message, sessionId, chunkIndex });
            throw error;
        }
    }

    /**
     * Complete upload
     */
    async completeUpload(sessionId) {
        try {
            const session = await UploadSession.findOne({
                where: { uuid: sessionId }
            });

            if (!session) {
                throw new Error('Upload session not found');
            }

            // Assemble chunks
            const filePath = this.getFilePath(session.metadata.fileName, session.metadata.fileType);
            await this.assembleChunks(session.uuid, filePath, session.total_chunks);

            // Get file info
            const fileStats = await fs.stat(filePath);

            // Update file record
            const file = await File.findOne({
                where: { uuid: session.file_uuid }
            });

            if (file) {
                file.status = 'ready';
                file.size = fileStats.size;
                await file.save();
            }

            // Update session
            session.status = 'completed';
            await session.save();

            // Cleanup temp chunks
            await this.cleanupChunks(session.uuid);

            // Publish event
            await this.eventBus.publish('file.uploaded', {
                fileId: file ? file.uuid : session.file_uuid,
                userId: session.user_id,
                chatId: session.chat_id,
                fileName: session.metadata.fileName,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`Upload completed: ${session.uuid}`, {
                sessionId: session.uuid,
                fileId: file ? file.uuid : null
            });

            return {
                fileId: file ? file.uuid : session.file_uuid,
                fileName: session.metadata.fileName,
                fileSize: fileStats.size
            };
        } catch (error) {
            this.logger.error('Failed to complete upload', { error: error.message, sessionId });
            throw error;
        }
    }

    /**
     * Get file info
     */
    async getFileInfo(fileId, userId) {
        try {
            const file = await File.findOne({
                where: { uuid: fileId },
                include: [
                    {
                        model: User,
                        as: 'uploader',
                        attributes: ['uuid', 'display_name', 'username']
                    }
                ]
            });

            if (!file) {
                return null;
            }

            // Check if user has access
            if (file.chat_id) {
                const Chat = require('../../../database/models').Chat;
                const chat = await Chat.findByPk(file.chat_id);
                if (!chat) {
                    return null;
                }

                const ChatParticipant = require('../../../database/models').ChatParticipant;
                const participant = await ChatParticipant.findOne({
                    where: {
                        chat_id: chat.id,
                        user_id: userId
                    }
                });

                if (!participant && file.uploader_id !== userId) {
                    return null;
                }
            }

            return {
                id: file.uuid,
                name: file.original_name,
                size: file.size,
                mimeType: file.mime_type,
                fileType: file.file_type,
                width: file.width,
                height: file.height,
                duration: file.duration,
                thumbnailUrl: file.thumbnail_url,
                previewUrl: file.preview_url,
                uploader: file.uploader ? {
                    id: file.uploader.uuid,
                    displayName: file.uploader.display_name
                } : null,
                uploadedAt: file.uploaded_at,
                expiresAt: file.expires_at
            };
        } catch (error) {
            this.logger.error('Failed to get file info', { error: error.message, fileId });
            throw error;
        }
    }

    /**
     * Download file
     */
    async downloadFile(fileId, userId) {
        try {
            const file = await File.findOne({
                where: { uuid: fileId, status: 'ready' }
            });

            if (!file) {
                throw new Error('File not found');
            }

            // Check access
            if (file.chat_id) {
                const Chat = require('../../../database/models').Chat;
                const chat = await Chat.findByPk(file.chat_id);
                if (!chat) {
                    throw new Error('File not accessible');
                }

                const ChatParticipant = require('../../../database/models').ChatParticipant;
                const participant = await ChatParticipant.findOne({
                    where: {
                        chat_id: chat.id,
                        user_id: userId
                    }
                });

                if (!participant && file.uploader_id !== userId) {
                    throw new Error('File not accessible');
                }
            }

            const filePath = path.join(this.storagePath, file.path);
            
            // Check if file exists
            try {
                await fs.access(filePath);
            } catch {
                throw new Error('File not found on disk');
            }

            // Create download session
            const session = await DownloadSession.create({
                uuid: uuidv4(),
                file_uuid: file.uuid,
                user_id: userId,
                total_size: file.size,
                status: 'downloading'
            });

            // Publish event
            await this.eventBus.publish('file.downloaded', {
                fileId: file.uuid,
                userId,
                timestamp: new Date().toISOString()
            });

            return {
                filePath,
                fileName: file.original_name,
                mimeType: file.mime_type,
                size: file.size,
                sessionId: session.uuid
            };
        } catch (error) {
            this.logger.error('Failed to download file', { error: error.message, fileId });
            throw error;
        }
    }

    /**
     * Delete file
     */
    async deleteFile(fileId, userId) {
        try {
            const file = await File.findOne({
                where: { uuid: fileId }
            });

            if (!file) {
                throw new Error('File not found');
            }

            // Check permission
            if (file.uploader_id !== userId) {
                const isAdmin = await this.checkAdminPermission(userId);
                if (!isAdmin) {
                    throw new Error('Insufficient permissions');
                }
            }

            // Delete file from disk
            const filePath = path.join(this.storagePath, file.path);
            try {
                await fs.unlink(filePath);
            } catch (error) {
                this.logger.warn('File not found on disk', { fileId, path: filePath });
            }

            // Delete thumbnail if exists
            if (file.thumbnail_url) {
                const thumbPath = path.join(this.storagePath, 'thumbnails', path.basename(file.thumbnail_url));
                try {
                    await fs.unlink(thumbPath);
                } catch (error) {
                    this.logger.warn('Thumbnail not found on disk', { fileId });
                }
            }

            // Soft delete file record
            file.status = 'deleted';
            file.deleted_at = new Date();
            await file.save();

            // Publish event
            await this.eventBus.publish('file.deleted', {
                fileId: file.uuid,
                userId,
                timestamp: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to delete file', { error: error.message, fileId });
            throw error;
        }
    }

    /**
     * Get file URL
     */
    getFileUrl(fileId) {
        return `/api/v1/files/${fileId}/download`;
    }

    /**
     * Get thumbnail URL
     */
    getThumbnailUrl(fileId) {
        return `/api/v1/files/${fileId}/thumbnail`;
    }

    /**
     * Generate checksum
     */
    generateChecksum(fileName, fileSize) {
        const data = `${fileName}:${fileSize}:${Date.now()}`;
        return crypto
            .createHash('sha256')
            .update(data)
            .digest('hex');
    }

    /**
     * Calculate checksum from data
     */
    calculateChecksum(data) {
        return crypto
            .createHash('sha256')
            .update(data)
            .digest('hex');
    }

    /**
     * Generate resume token
     */
    generateResumeToken(sessionId) {
        const data = `${sessionId}:${Date.now()}`;
        return crypto
            .createHash('sha256')
            .update(data)
            .digest('hex')
            .substring(0, 32);
    }

    /**
     * Get file path
     */
    getFilePath(fileName, fileType) {
        const typeFolder = this.getFileTypeFolder(fileType);
        return path.join(typeFolder, fileName);
    }

    /**
     * Get file type folder
     */
    getFileTypeFolder(fileType) {
        const folders = {
            'avatar': 'avatars',
            'image': 'media',
            'video': 'media',
            'audio': 'media',
            'voice': 'media',
            'document': 'documents',
            'sticker': 'media',
            'gif': 'media',
            'other': 'documents'
        };
        return folders[fileType] || 'documents';
    }

    /**
     * Get chunk path
     */
    getChunkPath(sessionId, chunkIndex) {
        return path.join(this.storagePath, 'temp', `${sessionId}_${chunkIndex}.chunk`);
    }

    /**
     * Store chunk
     */
    async storeChunk(chunkPath, data) {
        await fs.writeFile(chunkPath, data);
    }

    /**
     * Assemble chunks
     */
    async assembleChunks(sessionId, outputPath, totalChunks) {
        const writeStream = fs.createWriteStream(outputPath);
        
        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = this.getChunkPath(sessionId, i);
            try {
                const data = await fs.readFile(chunkPath);
                writeStream.write(data);
            } catch (error) {
                this.logger.error('Failed to read chunk', { error: error.message, sessionId, chunkIndex: i });
                throw error;
            }
        }

        return new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
            writeStream.end();
        });
    }

    /**
     * Cleanup chunks
     */
    async cleanupChunks(sessionId) {
        try {
            const files = await fs.readdir(path.join(this.storagePath, 'temp'));
            const chunkFiles = files.filter(f => f.startsWith(sessionId));
            
            for (const file of chunkFiles) {
                await fs.unlink(path.join(this.storagePath, 'temp', file));
            }
        } catch (error) {
            this.logger.warn('Failed to cleanup chunks', { error: error.message, sessionId });
        }
    }

    /**
     * Get max file size based on type
     */
    getMaxFileSize(fileType) {
        const limits = {
            'image': 20 * 1024 * 1024, // 20MB
            'video': 200 * 1024 * 1024, // 200MB
            'audio': 50 * 1024 * 1024, // 50MB
            'voice': 5 * 1024 * 1024, // 5MB
            'document': 100 * 1024 * 1024, // 100MB
            'sticker': 1 * 1024 * 1024, // 1MB
            'gif': 20 * 1024 * 1024, // 20MB
            'avatar': 5 * 1024 * 1024, // 5MB
            'other': 100 * 1024 * 1024 // 100MB
        };
        return limits[fileType] || 100 * 1024 * 1024;
    }

    /**
     * Check if file type is allowed
     */
    isAllowedFileType(mimeType) {
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/webp', 'image/gif',
            'video/mp4', 'video/webm', 'video/quicktime',
            'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/wav',
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain', 'text/csv', 'application/json'
        ];
        return allowedTypes.includes(mimeType) || mimeType.startsWith('image/');
    }

    /**
     * Get file type from mime type
     */
    getFileTypeFromMime(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType.includes('pdf') || mimeType.includes('document')) return 'document';
        return 'other';
    }

    /**
     * Check admin permission
     */
    async checkAdminPermission(userId) {
        // This will be implemented when admin module is ready
        return false;
    }
}

// Singleton instance
let fileServiceInstance = null;

const getFileService = async () => {
    if (!fileServiceInstance) {
        fileServiceInstance = new FileService();
        await fileServiceInstance.initialize();
    }
    return fileServiceInstance;
};

module.exports = {
    FileService,
    getFileService
};