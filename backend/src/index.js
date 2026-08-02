const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
require('dotenv').config();

const config = require('./config');
const { initDatabase } = require('./config/database');
const { initRedis } = require('./config/redis');
const { initLogger } = require('./services/LoggerService');
const { initSocket } = require('./socket');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});

// Middlewares
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate Limiting
const limiter = rateLimit({
    windowMs: config.rateLimit.window,
    max: config.rateLimit.max,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api', limiter);

// Request logging
app.use((req, res, next) => {
    const logger = require('./services/LoggerService').getLogger();
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});

// Routes
app.use('/api/v1', routes);

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handler
app.use(errorHandler);

// Initialize services
const initializeApp = async () => {
    try {
        // Initialize logger
        const logger = await initLogger();
        logger.info('🚀 Starting Messenger Platform...');

        // Initialize database
        await initDatabase();
        logger.info('✅ Database initialized');

        // Initialize Redis
        await initRedis();
        logger.info('✅ Redis initialized');

        // Initialize Socket.IO
        await initSocket(io);
        logger.info('✅ Socket.IO initialized');

        // Start server
        server.listen(config.port, config.host, () => {
            logger.info(`✅ Server running on http://${config.host}:${config.port}`);
            logger.info(`📝 Environment: ${config.env}`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received, shutting down gracefully...');
            server.close(() => {
                logger.info('Server closed');
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            logger.info('SIGINT received, shutting down gracefully...');
            server.close(() => {
                logger.info('Server closed');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('❌ Failed to initialize application:', error);
        process.exit(1);
    }
};

initializeApp();

module.exports = { app, server, io };