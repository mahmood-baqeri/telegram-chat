const { getRedisClient, getRedisSubscriber } = require('../config/redis');
const { getLogger } = require('./LoggerService');

class EventBus {
    constructor() {
        this.client = null;
        this.subscriber = null;
        this.handlers = new Map();
        this.logger = null;
        this.eventPrefix = 'event:';
    }

    async initialize() {
        this.client = getRedisClient();
        this.subscriber = getRedisSubscriber();
        this.logger = getLogger();
        this.logger.info('✅ Event Bus initialized');
        return this;
    }

    // Publish event
    async publish(eventName, data) {
        try {
            const eventKey = `${this.eventPrefix}${eventName}`;
            const payload = JSON.stringify({
                event: eventName,
                data,
                timestamp: new Date().toISOString()
            });

            await this.client.publish(eventKey, payload);
            
            this.logger.debug(`Event published: ${eventName}`, { 
                event: eventName,
                hasData: !!data
            });

            return true;
        } catch (error) {
            this.logger.error(`Failed to publish event: ${eventName}`, { error: error.message });
            return false;
        }
    }

    // Subscribe to event
    async subscribe(eventName, handler) {
        try {
            const eventKey = `${this.eventPrefix}${eventName}`;
            
            // Store handler for local execution
            if (!this.handlers.has(eventName)) {
                this.handlers.set(eventName, []);
            }
            this.handlers.get(eventName).push(handler);

            // Subscribe to Redis channel
            await this.subscriber.subscribe(eventKey, (message) => {
                try {
                    const payload = JSON.parse(message);
                    this.executeHandlers(eventName, payload.data);
                } catch (error) {
                    this.logger.error(`Failed to process event: ${eventName}`, { error: error.message });
                }
            });

            this.logger.debug(`Subscribed to event: ${eventName}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to subscribe to event: ${eventName}`, { error: error.message });
            return false;
        }
    }

    // Execute local handlers
    async executeHandlers(eventName, data) {
        const handlers = this.handlers.get(eventName) || [];
        for (const handler of handlers) {
            try {
                await handler(data);
            } catch (error) {
                this.logger.error(`Handler failed for event: ${eventName}`, { error: error.message });
            }
        }
    }

    // Unsubscribe from event
    async unsubscribe(eventName) {
        try {
            const eventKey = `${this.eventPrefix}${eventName}`;
            await this.subscriber.unsubscribe(eventKey);
            this.handlers.delete(eventName);
            
            this.logger.debug(`Unsubscribed from event: ${eventName}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to unsubscribe from event: ${eventName}`, { error: error.message });
            return false;
        }
    }

    // Subscribe to multiple events with wildcard
    async subscribePattern(pattern, handler) {
        try {
            const patternKey = `${this.eventPrefix}${pattern}`;
            await this.subscriber.pSubscribe(patternKey, (message, channel) => {
                try {
                    const payload = JSON.parse(message);
                    this.executeHandlers(payload.event, payload.data);
                } catch (error) {
                    this.logger.error(`Failed to process pattern event`, { error: error.message });
                }
            });

            // Store handler
            if (!this.handlers.has(pattern)) {
                this.handlers.set(pattern, []);
            }
            this.handlers.get(pattern).push(handler);

            this.logger.debug(`Subscribed to pattern: ${pattern}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to subscribe to pattern: ${pattern}`, { error: error.message });
            return false;
        }
    }

    // Event definitions
    static get Events() {
        return {
            // Auth events
            USER_REGISTERED: 'user.registered',
            USER_LOGGED_IN: 'user.logged_in',
            USER_LOGGED_OUT: 'user.logged_out',
            USER_SESSION_CREATED: 'user.session.created',
            USER_SESSION_TERMINATED: 'user.session.terminated',
            USER_OTP_REQUESTED: 'user.otp.requested',
            USER_OTP_VERIFIED: 'user.otp.verified',

            // User events
            USER_UPDATED: 'user.updated',
            USER_USERNAME_CHANGED: 'user.username.changed',
            USER_AVATAR_UPDATED: 'user.avatar.updated',
            USER_PREMIUM_GRANTED: 'user.premium.granted',
            USER_VERIFIED: 'user.verified',

            // Message events
            MESSAGE_CREATED: 'message.created',
            MESSAGE_UPDATED: 'message.updated',
            MESSAGE_DELETED: 'message.deleted',
            MESSAGE_DELIVERED: 'message.delivered',
            MESSAGE_SEEN: 'message.seen',
            MESSAGE_REACTED: 'message.reacted',
            MESSAGE_PINNED: 'message.pinned',

            // Chat events
            CHAT_CREATED: 'chat.created',
            CHAT_ARCHIVED: 'chat.archived',
            CHAT_MUTED: 'chat.muted',
            CHAT_PINNED: 'chat.pinned',

            // Group events
            GROUP_CREATED: 'group.created',
            GROUP_UPDATED: 'group.updated',
            GROUP_DELETED: 'group.deleted',
            GROUP_MEMBER_ADDED: 'group.member.added',
            GROUP_MEMBER_REMOVED: 'group.member.removed',

            // Channel events
            CHANNEL_CREATED: 'channel.created',
            CHANNEL_UPDATED: 'channel.updated',
            CHANNEL_DELETED: 'channel.deleted',
            CHANNEL_SUBSCRIBED: 'channel.subscribed',
            CHANNEL_UNSUBSCRIBED: 'channel.unsubscribed',

            // File events
            FILE_UPLOADED: 'file.uploaded',
            FILE_DOWNLOADED: 'file.downloaded',
            FILE_DELETED: 'file.deleted',

            // Notification events
            NOTIFICATION_SENT: 'notification.sent',
            NOTIFICATION_DELIVERED: 'notification.delivered',
            NOTIFICATION_READ: 'notification.read',

            // Feature events
            FEATURE_TOGGLED: 'feature.toggled',
            FEATURE_ROLLOUT_UPDATED: 'feature.rollout.updated',

            // Admin events
            ADMIN_USER_BANNED: 'admin.user.banned',
            ADMIN_USER_UNBANNED: 'admin.user.unbanned',
            ADMIN_GROUP_DELETED: 'admin.group.deleted',
            ADMIN_CHANNEL_DELETED: 'admin.channel.deleted'
        };
    }
}

// Singleton instance
let eventBusInstance = null;

const getEventBus = async () => {
    if (!eventBusInstance) {
        eventBusInstance = new EventBus();
        await eventBusInstance.initialize();
    }
    return eventBusInstance;
};

module.exports = {
    EventBus,
    getEventBus
};