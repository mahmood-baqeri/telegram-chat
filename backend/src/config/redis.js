const Redis = require('redis');
const config = require('./index');

let client = null;
let subscriber = null;

const initRedis = async () => {
    try {
        client = Redis.createClient({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db
        });

        subscriber = client.duplicate();

        await client.connect();
        await subscriber.connect();

        console.log('✅ Redis connection established successfully.');
        return { client, subscriber };
    } catch (error) {
        console.error('❌ Unable to connect to Redis:', error);
        throw error;
    }
};

const getRedisClient = () => {
    if (!client) {
        throw new Error('Redis client not initialized');
    }
    return client;
};

const getRedisSubscriber = () => {
    if (!subscriber) {
        throw new Error('Redis subscriber not initialized');
    }
    return subscriber;
};

module.exports = {
    initRedis,
    getRedisClient,
    getRedisSubscriber,
    client,
    subscriber
};