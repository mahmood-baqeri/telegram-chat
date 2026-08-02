const winston = require('winston');
const path = require('path');
const config = require('../config');

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
            timestamp,
            level,
            message,
            ...meta
        });
    })
);

// Define console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}] ${message}${metaStr}`;
    })
);

// Create logger instance
let logger = null;

const initLogger = () => {
    if (logger) return logger;

    const logDir = path.join(__dirname, '../../logs');
    const isDevelopment = config.env === 'development';

    logger = winston.createLogger({
        level: config.logging.level || 'info',
        format: logFormat,
        defaultMeta: { service: 'messenger-api' },
        transports: [
            // Error log file
            new winston.transports.File({
                filename: path.join(logDir, 'error.log'),
                level: 'error',
                maxsize: 10485760, // 10MB
                maxFiles: 5
            }),
            // Combined log file
            new winston.transports.File({
                filename: path.join(logDir, 'combined.log'),
                maxsize: 10485760,
                maxFiles: 5
            }),
            // Console transport
            new winston.transports.Console({
                format: isDevelopment ? consoleFormat : winston.format.simple(),
                level: isDevelopment ? 'debug' : 'info'
            })
        ],
        exceptionHandlers: [
            new winston.transports.File({
                filename: path.join(logDir, 'exceptions.log')
            })
        ],
        rejectionHandlers: [
            new winston.transports.File({
                filename: path.join(logDir, 'rejections.log')
            })
        ]
    });

    return logger;
};

const getLogger = () => {
    if (!logger) {
        throw new Error('Logger not initialized. Call initLogger() first.');
    }
    return logger;
};

// Create child logger for modules
const createChildLogger = (module) => {
    const logger = getLogger();
    return logger.child({ module });
};

module.exports = {
    initLogger,
    getLogger,
    createChildLogger
};