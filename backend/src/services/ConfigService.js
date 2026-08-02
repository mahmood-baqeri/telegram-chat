const { getCacheService } = require('./CacheService');
const { getLogger } = require('./LoggerService');
const { SystemSetting } = require('../database/models');

class ConfigService {
    constructor() {
        this.cache = null;
        this.logger = null;
        this.cacheTTL = 300; // 5 minutes
        this.config = new Map();
    }

    async initialize() {
        this.cache = await getCacheService();
        this.logger = getLogger();
        
        // Load all settings on startup
        await this.loadAllSettings();
        
        this.logger.info('✅ Config Service initialized');
        return this;
    }

    // Load all settings from database
    async loadAllSettings() {
        try {
            const settings = await SystemSetting.findAll({
                where: { is_editable: true }
            });

            for (const setting of settings) {
                this.config.set(setting.key, {
                    value: this.parseValue(setting.value, setting.type),
                    type: setting.type,
                    category: setting.category,
                    isEditable: setting.is_editable,
                    isCached: setting.is_cached
                });

                // Cache if enabled
                if (setting.is_cached) {
                    await this.cache.set(
                        `config:${setting.key}`,
                        this.parseValue(setting.value, setting.type),
                        this.cacheTTL
                    );
                }
            }

            this.logger.info(`Loaded ${settings.length} settings from database`);
        } catch (error) {
            this.logger.error('Failed to load settings', { error: error.message });
            throw error;
        }
    }

    // Get setting value
    async get(key, defaultValue = null) {
        try {
            // Check local cache first
            const cached = this.config.get(key);
            if (cached) {
                // If it's a cached setting, try Redis cache first
                if (cached.isCached) {
                    const redisValue = await this.cache.get(`config:${key}`);
                    if (redisValue !== null) {
                        return redisValue;
                    }
                }
                return cached.value;
            }

            // Query database
            const setting = await SystemSetting.findOne({
                where: { key }
            });

            if (!setting) {
                return defaultValue;
            }

            const value = this.parseValue(setting.value, setting.type);
            
            // Cache if enabled
            if (setting.is_cached) {
                await this.cache.set(`config:${key}`, value, this.cacheTTL);
            }

            // Store in local cache
            this.config.set(key, {
                value,
                type: setting.type,
                category: setting.category,
                isEditable: setting.is_editable,
                isCached: setting.is_cached
            });

            return value;
        } catch (error) {
            this.logger.error(`Failed to get setting: ${key}`, { error: error.message });
            return defaultValue;
        }
    }

    // Set setting value
    async set(key, value, changedBy = null) {
        try {
            const setting = await SystemSetting.findOne({
                where: { key }
            });

            if (!setting) {
                throw new Error(`Setting not found: ${key}`);
            }

            if (!setting.is_editable) {
                throw new Error(`Setting is not editable: ${key}`);
            }

            const stringValue = this.stringifyValue(value, setting.type);

            // Update setting
            setting.value = stringValue;
            await setting.save();

            // Clear cache
            await this.cache.delete(`config:${key}`);
            this.config.delete(key);

            // Reload setting
            await this.loadAllSettings();

            // Publish event
            const { getEventBus } = require('./EventBus');
            const eventBus = await getEventBus();
            await eventBus.publish('config.updated', {
                key,
                value,
                changedBy,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`Setting updated: ${key}`, { key, changedBy });

            return true;
        } catch (error) {
            this.logger.error(`Failed to set setting: ${key}`, { error: error.message });
            throw error;
        }
    }

    // Parse value based on type
    parseValue(value, type) {
        if (value === null || value === undefined) {
            return null;
        }

        switch (type) {
            case 'number':
                return Number(value);
            case 'boolean':
                return value === 'true' || value === true;
            case 'json':
                try {
                    return JSON.parse(value);
                } catch {
                    return null;
                }
            case 'array':
                try {
                    const parsed = JSON.parse(value);
                    return Array.isArray(parsed) ? parsed : [];
                } catch {
                    return [];
                }
            default:
                return String(value);
        }
    }

    // Stringify value for storage
    stringifyValue(value, type) {
        if (value === null || value === undefined) {
            return '';
        }

        switch (type) {
            case 'json':
            case 'array':
                return JSON.stringify(value);
            default:
                return String(value);
        }
    }

    // Get all settings by category
    async getByCategory(category) {
        try {
            const settings = await SystemSetting.findAll({
                where: { category }
            });

            const result = {};
            for (const setting of settings) {
                result[setting.key] = this.parseValue(setting.value, setting.type);
            }
            return result;
        } catch (error) {
            this.logger.error(`Failed to get settings by category: ${category}`, { error: error.message });
            return {};
        }
    }

    // Reload all settings
    async reload() {
        this.config.clear();
        await this.loadAllSettings();
        this.logger.info('Config reloaded');
        return true;
    }

    // Get setting metadata
    async getMetadata(key) {
        try {
            const setting = await SystemSetting.findOne({
                where: { key },
                attributes: ['key', 'type', 'category', 'description', 'is_editable', 'is_cached']
            });
            return setting ? setting.toJSON() : null;
        } catch (error) {
            this.logger.error(`Failed to get setting metadata: ${key}`, { error: error.message });
            return null;
        }
    }

    // Get all setting keys
    async getAllKeys() {
        return Array.from(this.config.keys());
    }
}

// Singleton instance
let configInstance = null;

const getConfigService = async () => {
    if (!configInstance) {
        configInstance = new ConfigService();
        await configInstance.initialize();
    }
    return configInstance;
};

module.exports = {
    ConfigService,
    getConfigService
};