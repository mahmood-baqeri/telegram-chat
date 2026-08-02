require('dotenv').config();

const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || '0.0.0.0',
    
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        name: process.env.DB_NAME || 'messenger_db',
        poolMin: parseInt(process.env.DB_POOL_MIN, 10) || 2,
        poolMax: parseInt(process.env.DB_POOL_MAX, 10) || 10
    },
    
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        password: process.env.REDIS_PASSWORD || '',
        db: parseInt(process.env.REDIS_DB, 10) || 0
    },
    
    elasticsearch: {
        host: process.env.ELASTICSEARCH_HOST || 'localhost',
        port: parseInt(process.env.ELASTICSEARCH_PORT, 10) || 9200,
        user: process.env.ELASTICSEARCH_USER || '',
        password: process.env.ELASTICSEARCH_PASSWORD || ''
    },
    
    jwt: {
        secret: process.env.JWT_SECRET || 'default_jwt_secret',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret',
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },
    
    otp: {
        length: parseInt(process.env.OTP_LENGTH, 10) || 4,
        expiration: parseInt(process.env.OTP_EXPIRATION, 10) || 300,
        maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,
        resendDelay: parseInt(process.env.OTP_RESEND_DELAY, 10) || 60,
        dailyLimit: parseInt(process.env.OTP_DAILY_LIMIT, 10) || 10
    },
    
    storage: {
        provider: process.env.STORAGE_PROVIDER || 'local',
        path: process.env.STORAGE_PATH || './storage'
    },
    
    rateLimit: {
        window: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 60000,
        max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
        apiMax: parseInt(process.env.API_RATE_LIMIT_MAX, 10) || 1000
    },
    
    admin: {
        username: process.env.ADMIN_USERNAME || 'admin',
        email: process.env.ADMIN_EMAIL || 'admin@messenger.com',
        password: process.env.ADMIN_PASSWORD || 'admin123'
    },
    
    security: {
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 86400,
        bruteForceThreshold: parseInt(process.env.BRUTE_FORCE_THRESHOLD, 10) || 5,
        bruteForceWindow: parseInt(process.env.BRUTE_FORCE_WINDOW, 10) || 300
    },
    
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        retentionDays: parseInt(process.env.LOG_RETENTION_DAYS, 10) || 30
    }
};

module.exports = config;