const { getRedisClient } = require('../config/redis');
const config = require('../config');

class CacheService {
    constructor() {
        this.client = null;
        this.defaultTTL = 300; // 5 minutes
        this.prefix = 'cache:';
    }

    async initialize() {
        this.client = getRedisClient();
        return this;
    }

    // Generate cache key
    getKey(key) {
        return `${this.prefix}${key}`;
    }

    // Set value with optional TTL
    async set(key, value, ttl = this.defaultTTL) {
        try {
            const cacheKey = this.getKey(key);
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            
            if (ttl > 0) {
                await this.client.setEx(cacheKey, ttl, stringValue);
            } else {
                await this.client.set(cacheKey, stringValue);
            }
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }

    // Get value
    async get(key) {
        try {
            const cacheKey = this.getKey(key);
            const value = await this.client.get(cacheKey);
            if (!value) return null;
            
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    // Delete key
    async delete(key) {
        try {
            const cacheKey = this.getKey(key);
            await this.client.del(cacheKey);
            return true;
        } catch (error) {
            console.error('Cache delete error:', error);
            return false;
        }
    }

    // Check if key exists
    async exists(key) {
        try {
            const cacheKey = this.getKey(key);
            const result = await this.client.exists(cacheKey);
            return result === 1;
        } catch (error) {
            console.error('Cache exists error:', error);
            return false;
        }
    }

    // Get or set with callback
    async remember(key, callback, ttl = this.defaultTTL) {
        try {
            // Try to get from cache
            const cached = await this.get(key);
            if (cached !== null) {
                return cached;
            }

            // Execute callback to get data
            const data = await callback();
            
            // Store in cache
            await this.set(key, data, ttl);
            
            return data;
        } catch (error) {
            console.error('Cache remember error:', error);
            // Fallback to callback
            return await callback();
        }
    }

    // Increment counter
    async increment(key, amount = 1) {
        try {
            const cacheKey = this.getKey(key);
            const result = await this.client.incrBy(cacheKey, amount);
            return result;
        } catch (error) {
            console.error('Cache increment error:', error);
            return null;
        }
    }

    // Decrement counter
    async decrement(key, amount = 1) {
        try {
            const cacheKey = this.getKey(key);
            const result = await this.client.decrBy(cacheKey, amount);
            return result;
        } catch (error) {
            console.error('Cache decrement error:', error);
            return null;
        }
    }

    // Set expiration
    async expire(key, ttl) {
        try {
            const cacheKey = this.getKey(key);
            await this.client.expire(cacheKey, ttl);
            return true;
        } catch (error) {
            console.error('Cache expire error:', error);
            return false;
        }
    }

    // Get TTL
    async getTTL(key) {
        try {
            const cacheKey = this.getKey(key);
            const ttl = await this.client.ttl(cacheKey);
            return ttl;
        } catch (error) {
            console.error('Cache getTTL error:', error);
            return -1;
        }
    }

    // Clear all cache
    async clear() {
        try {
            const keys = await this.client.keys(`${this.prefix}*`);
            if (keys.length > 0) {
                await this.client.del(keys);
            }
            return true;
        } catch (error) {
            console.error('Cache clear error:', error);
            return false;
        }
    }

    // Get cache stats
    async getStats() {
        try {
            const keys = await this.client.keys(`${this.prefix}*`);
            const totalKeys = keys.length;
            let totalMemory = 0;
            
            for (const key of keys) {
                const memory = await this.client.memoryUsage(key);
                if (memory) totalMemory += memory;
            }

            return {
                totalKeys,
                totalMemory: Math.round(totalMemory / 1024 / 1024), // MB
                avgMemory: totalKeys > 0 ? Math.round(totalMemory / totalKeys / 1024) : 0 // KB
            };
        } catch (error) {
            console.error('Cache stats error:', error);
            return null;
        }
    }
}

// Singleton instance
let cacheInstance = null;

const getCacheService = async () => {
    if (!cacheInstance) {
        cacheInstance = new CacheService();
        await cacheInstance.initialize();
    }
    return cacheInstance;
};

module.exports = {
    CacheService,
    getCacheService
};