const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { getLogger } = require('../../../services/LoggerService');
const { getQueue } = require('../../../queues');

class MediaProcessorService {
    constructor() {
        this.logger = null;
        this.mediaQueue = null;
    }

    async initialize() {
        this.logger = getLogger();
        this.mediaQueue = getQueue('media');
        this.logger.info('✅ Media Processor Service initialized');
        return this;
    }

    /**
     * Process image
     */
    async processImage(inputPath, outputPath, options = {}) {
        try {
            const image = sharp(inputPath);
            
            // Get metadata
            const metadata = await image.metadata();

            // Resize if needed
            if (options.width || options.height) {
                image.resize(options.width || null, options.height || null, {
                    fit: options.fit || 'cover',
                    withoutEnlargement: true
                });
            }

            // Compress
            const quality = options.quality || 80;
            const format = options.format || 'webp';

            if (format === 'webp') {
                image.webp({ quality });
            } else if (format === 'jpeg' || format === 'jpg') {
                image.jpeg({ quality });
            } else if (format === 'png') {
                image.png({ compressionLevel: 9 });
            }

            // Save
            await image.toFile(outputPath);

            // Generate thumbnail
            let thumbnailPath = null;
            if (options.generateThumbnail !== false) {
                thumbnailPath = this.generateThumbnail(inputPath, options.thumbnailSize || 200);
            }

            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: (await fs.stat(outputPath)).size,
                thumbnailPath
            };
        } catch (error) {
            this.logger.error('Failed to process image', { error: error.message, inputPath });
            throw error;
        }
    }

    /**
     * Process video
     */
    async processVideo(inputPath, outputPath, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const command = ffmpeg(inputPath);

                // Video codec
                const videoCodec = options.videoCodec || 'libx264';
                const audioCodec = options.audioCodec || 'aac';
                const bitrate = options.bitrate || '1000k';
                const resolution = options.resolution || '1280x720';

                command
                    .videoCodec(videoCodec)
                    .audioCodec(audioCodec)
                    .outputOptions([
                        `-b:v ${bitrate}`,
                        `-s ${resolution}`,
                        '-movflags +faststart',
                        '-preset medium'
                    ])
                    .on('start', () => {
                        this.logger.info('Video processing started', { inputPath, outputPath });
                    })
                    .on('progress', (progress) => {
                        this.logger.debug('Video processing progress', { 
                            percent: progress.percent,
                            inputPath 
                        });
                    })
                    .on('end', async () => {
                        try {
                            // Generate thumbnail
                            let thumbnailPath = null;
                            if (options.generateThumbnail !== false) {
                                thumbnailPath = await this.generateVideoThumbnail(
                                    inputPath,
                                    options.thumbnailSize || '320x180'
                                );
                            }

                            // Get duration
                            const duration = await this.getVideoDuration(outputPath);

                            resolve({
                                duration,
                                size: (await fs.stat(outputPath)).size,
                                thumbnailPath
                            });
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', (error) => {
                        this.logger.error('Video processing failed', { error: error.message, inputPath });
                        reject(error);
                    })
                    .save(outputPath);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate thumbnail from image
     */
    async generateThumbnail(inputPath, size = 200) {
        try {
            const outputPath = path.join(
                path.dirname(inputPath),
                'thumbnails',
                `${path.basename(inputPath, path.extname(inputPath))}_thumb.jpg`
            );

            await sharp(inputPath)
                .resize(size, size, {
                    fit: 'cover',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 60 })
                .toFile(outputPath);

            return outputPath;
        } catch (error) {
            this.logger.error('Failed to generate thumbnail', { error: error.message, inputPath });
            return null;
        }
    }

    /**
     * Generate thumbnail from video
     */
    async generateVideoThumbnail(inputPath, size = '320x180') {
        return new Promise((resolve, reject) => {
            const outputPath = path.join(
                path.dirname(inputPath),
                'thumbnails',
                `${path.basename(inputPath, path.extname(inputPath))}_thumb.jpg`
            );

            ffmpeg(inputPath)
                .screenshots({
                    count: 1,
                    folder: path.dirname(outputPath),
                    filename: path.basename(outputPath),
                    size: size
                })
                .on('end', () => resolve(outputPath))
                .on('error', (error) => {
                    this.logger.error('Failed to generate video thumbnail', { error: error.message, inputPath });
                    resolve(null);
                });
        });
    }

    /**
     * Get video duration
     */
    async getVideoDuration(inputPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(inputPath, (error, metadata) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(metadata.format.duration);
                }
            });
        });
    }

    /**
     * Queue media processing
     */
    async queueMediaProcessing(fileId, filePath, fileType, options = {}) {
        await this.mediaQueue.add('process-media', {
            fileId,
            filePath,
            fileType,
            options
        }, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000
            }
        });
    }

    /**
     * Process voice message
     */
    async processVoice(inputPath, outputPath, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const command = ffmpeg(inputPath);

                command
                    .audioCodec('libopus')
                    .audioBitrate('32k')
                    .audioFilters('loudnorm')
                    .on('end', async () => {
                        try {
                            const duration = await this.getVideoDuration(outputPath);
                            resolve({
                                duration,
                                size: (await fs.stat(outputPath)).size
                            });
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', (error) => {
                        this.logger.error('Voice processing failed', { error: error.message, inputPath });
                        reject(error);
                    })
                    .save(outputPath);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Process audio
     */
    async processAudio(inputPath, outputPath, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const command = ffmpeg(inputPath);
                const bitrate = options.bitrate || '128k';
                const codec = options.codec || 'libmp3lame';

                command
                    .audioCodec(codec)
                    .audioBitrate(bitrate)
                    .audioFilters('loudnorm')
                    .on('end', async () => {
                        try {
                            const duration = await this.getVideoDuration(outputPath);
                            resolve({
                                duration,
                                size: (await fs.stat(outputPath)).size
                            });
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', (error) => {
                        this.logger.error('Audio processing failed', { error: error.message, inputPath });
                        reject(error);
                    })
                    .save(outputPath);
            } catch (error) {
                reject(error);
            }
        });
    }
}

// Singleton instance
let mediaProcessorInstance = null;

const getMediaProcessor = async () => {
    if (!mediaProcessorInstance) {
        mediaProcessorInstance = new MediaProcessorService();
        await mediaProcessorInstance.initialize();
    }
    return mediaProcessorInstance;
};

module.exports = {
    MediaProcessorService,
    getMediaProcessor
};