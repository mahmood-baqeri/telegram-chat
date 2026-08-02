const { getCacheService } = require('./CacheService');
const { getEventBus } = require('./EventBus');
const { getLogger } = require('./LoggerService');
const { FeatureFlag } = require('../database/models');

class FeatureToggleService {
    constructor() {
        this.cache = null;
        this.eventBus = null;
        this.logger = null;
        this.cacheTTL = 300; // 5 minutes
        this.defaultEnabled = false;
    }

    async initialize() {
        this.cache = await getCacheService();
        this.eventBus = await getEventBus();
        this.logger = getLogger();

        // Subscribe to feature toggle events
        await this.eventBus.subscribe(
            EventBus.Events.FEATURE_TOGGLED,
            this.handleFeatureToggle.bind(this)
        );

        this.logger.info('✅ Feature Toggle Service initialized');
        return this;
    }

    // Check if feature is enabled
    async isEnabled(featureKey, context = {}) {
        try {
            // Get feature from cache or database
            const feature = await this.getFeature(featureKey);
            if (!feature) {
                return this.defaultEnabled;
            }

            // Check if feature is globally disabled
            if (!feature.is_enabled) {
                return false;
            }

            // Check rollout percentage
            if (feature.rollout_percentage > 0 && feature.rollout_percentage < 100) {
                const hash = this.hashContext(context);
                if (hash > feature.rollout_percentage) {
                    return false;
                }
            }

            // Check target roles
            if (feature.target_roles && feature.target_roles.length > 0) {
                if (!context.role || !feature.target_roles.includes(context.role)) {
                    return false;
                }
            }

            // Check target users
            if (feature.target_users && feature.target_users.length > 0) {
                if (!context.userId || !feature.target_users.includes(context.userId)) {
                    return false;
                }
            }

            // Check target groups
            if (feature.target_groups && feature.target_groups.length > 0) {
                if (!context.groupId || !feature.target_groups.includes(context.groupId)) {
                    return false;
                }
            }

            // Check target channels
            if (feature.target_channels && feature.target_channels.length > 0) {
                if (!context.channelId || !feature.target_channels.includes(context.channelId)) {
                    return false;
                }
            }

            // Check target countries
            if (feature.target_countries && feature.target_countries.length > 0) {
                if (!context.country || !feature.target_countries.includes(context.country)) {
                    return false;
                }
            }

            // Check target versions
            if (feature.target_versions && feature.target_versions.length > 0) {
                if (!context.version || !this.matchVersion(context.version, feature.target_versions)) {
                    return false;
                }
            }

            // Check date range
            if (feature.start_date) {
                const now = new Date();
                if (now < new Date(feature.start_date)) {
                    return false;
                }
            }
            if (feature.end_date) {
                const now = new Date();
                if (now > new Date(feature.end_date)) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            this.logger.error(`Failed to check feature: ${featureKey}`, { error: error.message });
            return this.defaultEnabled;
        }
    }

    // Get feature from cache or database
    async getFeature(featureKey) {
        // Try cache first
        const cacheKey = `feature:${featureKey}`;
        const cached = await this.cache.get(cacheKey);
        if (cached !== null) {
            return cached;
        }

        // Query database
        const feature = await FeatureFlag.findOne({
            where: { key: featureKey }
        });

        if (!feature) {
            // Cache null result to prevent repeated DB queries
            await this.cache.set(cacheKey, null, 60);
            return null;
        }

        // Cache feature
        await this.cache.set(cacheKey, feature.toJSON(), this.cacheTTL);
        return feature.toJSON();
    }

    // Toggle feature
    async toggleFeature(featureKey, enabled, changedBy, reason = '') {
        try {
            const feature = await FeatureFlag.findOne({
                where: { key: featureKey }
            });

            if (!feature) {
                throw new Error(`Feature not found: ${featureKey}`);
            }

            const oldValue = feature.is_enabled;
            const oldRollout = feature.rollout_percentage;

            // Update feature
            feature.is_enabled = enabled;
            feature.updated_by_id = changedBy;
            await feature.save();

            // Create history entry
            await FeatureFlagHistory.create({
                feature_flag_id: feature.id,
                changed_by_id: changedBy,
                old_value: oldValue,
                new_value: enabled,
                old_rollout: oldRollout,
                new_rollout: feature.rollout_percentage,
                reason
            });

            // Clear cache
            await this.cache.delete(`feature:${featureKey}`);

            // Publish event
            await this.eventBus.publish(EventBus.Events.FEATURE_TOGGLED, {
                featureKey,
                enabled,
                changedBy,
                reason,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`Feature toggled: ${featureKey} -> ${enabled}`, {
                featureKey,
                enabled,
                changedBy
            });

            return feature.toJSON();
        } catch (error) {
            this.logger.error(`Failed to toggle feature: ${featureKey}`, { error: error.message });
            throw error;
        }
    }

    // Update rollout percentage
    async updateRollout(featureKey, percentage, changedBy, reason = '') {
        try {
            const feature = await FeatureFlag.findOne({
                where: { key: featureKey }
            });

            if (!feature) {
                throw new Error(`Feature not found: ${featureKey}`);
            }

            if (percentage < 0 || percentage > 100) {
                throw new Error('Rollout percentage must be between 0 and 100');
            }

            const oldRollout = feature.rollout_percentage;

            // Update feature
            feature.rollout_percentage = percentage;
            feature.updated_by_id = changedBy;
            await feature.save();

            // Create history entry
            await FeatureFlagHistory.create({
                feature_flag_id: feature.id,
                changed_by_id: changedBy,
                old_value: feature.is_enabled,
                new_value: feature.is_enabled,
                old_rollout: oldRollout,
                new_rollout: percentage,
                reason
            });

            // Clear cache
            await this.cache.delete(`feature:${featureKey}`);

            // Publish event
            await this.eventBus.publish('feature.rollout.updated', {
                featureKey,
                percentage,
                changedBy,
                reason,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`Feature rollout updated: ${featureKey} -> ${percentage}%`, {
                featureKey,
                percentage,
                changedBy
            });

            return feature.toJSON();
        } catch (error) {
            this.logger.error(`Failed to update rollout: ${featureKey}`, { error: error.message });
            throw error;
        }
    }

    // Hash context for rollout
    hashContext(context) {
        const str = JSON.stringify(context);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash) % 100;
    }

    // Match version
    matchVersion(version, targetVersions) {
        for (const target of targetVersions) {
            if (this.semverMatches(version, target)) {
                return true;
            }
        }
        return false;
    }

    // Semantic version matching
    semverMatches(version, target) {
        // Simple exact match
        if (version === target) return true;

        // Wildcard match (e.g., 1.2.x)
        if (target.endsWith('.x')) {
            const prefix = target.slice(0, -2);
            return version.startsWith(prefix);
        }

        // Range match (e.g., >=2.0.0)
        if (target.startsWith('>=')) {
            const minVersion = target.slice(2);
            return this.compareVersions(version, minVersion) >= 0;
        }

        if (target.startsWith('<=')) {
            const maxVersion = target.slice(2);
            return this.compareVersions(version, maxVersion) <= 0;
        }

        return false;
    }

    // Compare versions
    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 !== p2) {
                return p1 - p2;
            }
        }
        return 0;
    }

    // Handle feature toggle events
    async handleFeatureToggle(data) {
        // Clear cache for this feature
        await this.cache.delete(`feature:${data.featureKey}`);
        
        // Log the change
        this.logger.info(`Feature toggle change received: ${data.featureKey}`, {
            featureKey: data.featureKey,
            enabled: data.enabled,
            changedBy: data.changedBy
        });
    }

    // Get all features with status
    async getAllFeatures() {
        try {
            const features = await FeatureFlag.findAll({
                order: [['category', 'ASC'], ['key', 'ASC']]
            });
            return features.map(f => f.toJSON());
        } catch (error) {
            this.logger.error('Failed to get all features', { error: error.message });
            throw error;
        }
    }
}

// Singleton instance
let featureToggleInstance = null;

const getFeatureToggleService = async () => {
    if (!featureToggleInstance) {
        featureToggleInstance = new FeatureToggleService();
        await featureToggleInstance.initialize();
    }
    return featureToggleInstance;
};

module.exports = {
    FeatureToggleService,
    getFeatureToggleService
};