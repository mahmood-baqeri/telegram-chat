const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { Notification, NotificationDevice } = require('../../../database/models');
const { getCacheService } = require('../../../services/CacheService');
const { getLogger } = require('../../../services/LoggerService');
const { getEventBus } = require('../../../services/EventBus');
const { getFeatureToggleService } = require('../../../services/FeatureToggleService');
const { getQueue } = require('../../../queues');

class NotificationService {
    constructor() {
        this.cache = null;
        this.logger = null;
        this.eventBus = null;
        this.featureService = null;
        this.notificationQueue = null;
        this.cacheTTL = 300;
    }

    async initialize() {
        this.cache = await getCacheService();
        this.logger = getLogger();
        this.eventBus = await getEventBus();
        this.featureService = await getFeatureToggleService();
        this.notificationQueue = getQueue('notifications');
        this.logger.info('✅ Notification Service initialized');
        return this;
    }

    /**
     * Send notification
     */
    async sendNotification(data) {
        try {
            const notificationsEnabled = await this.featureService.isEnabled('notifications.enabled');
            if (!notificationsEnabled) {
                return { success: false, message: 'Notifications are disabled' };
            }

            const { userId, type, category, title, body, data: extraData, priority = 'normal', channels = ['push', 'web'] } = data;

            // Create notification record
            const notification = await Notification.create({
                uuid: uuidv4(),
                user_id: userId,
                type,
                category,
                title,
                body,
                data: extraData || null,
                priority,
                status: 'pending',
                channels
            });

            // Check user notification settings
            const settings = await this.getUserNotificationSettings(userId);
            const allowedChannels = this.filterAllowedChannels(channels, settings);

            // Queue notification for each channel
            for (const channel of allowedChannels) {
                await this.notificationQueue.add('send-notification', {
                    notificationId: notification.uuid,
                    userId,
                    channel,
                    data: {
                        title,
                        body,
                        data: extraData,
                        priority
                    }
                }, {
                    priority: this.getPriorityValue(priority),
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 1000
                    }
                });
            }

            // Publish event
            await this.eventBus.publish('notification.created', {
                notificationId: notification.uuid,
                userId,
                type,
                channels: allowedChannels,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`Notification created: ${notification.uuid}`, {
                notificationId: notification.uuid,
                userId,
                type,
                channels: allowedChannels
            });

            return {
                success: true,
                notificationId: notification.uuid,
                channels: allowedChannels
            };
        } catch (error) {
            this.logger.error('Failed to send notification', { error: error.message });
            throw error;
        }
    }

    /**
     * Send push notification (Firebase)
     */
    async sendPushNotification(userId, title, body, data = {}, priority = 'normal') {
        try {
            const pushEnabled = await this.featureService.isEnabled('notification.push');
            if (!pushEnabled) {
                return { success: false, message: 'Push notifications are disabled' };
            }

            // Get user's devices
            const devices = await NotificationDevice.findAll({
                where: {
                    user_id: userId,
                    is_active: true,
                    is_enabled: true
                }
            });

            if (devices.length === 0) {
                return { success: false, message: 'No devices registered' };
            }

            // Send to each device
            const results = [];
            for (const device of devices) {
                const result = await this.sendToDevice(device, title, body, data, priority);
                results.push(result);
            }

            return {
                success: true,
                devices: results
            };
        } catch (error) {
            this.logger.error('Failed to send push notification', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Send to specific device
     */
    async sendToDevice(device, title, body, data = {}, priority = 'normal') {
        try {
            const { platform, push_token } = device;

            switch (platform) {
                case 'ios':
                    return await this.sendAPNS(device, title, body, data, priority);
                case 'android':
                    return await this.sendFCM(device, title, body, data, priority);
                case 'web':
                    return await this.sendWebPush(device, title, body, data, priority);
                default:
                    return { success: false, message: 'Unsupported platform' };
            }
        } catch (error) {
            this.logger.error('Failed to send to device', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Send via FCM (Android)
     */
    async sendFCM(device, title, body, data, priority) {
        try {
            // This is a placeholder - implement with firebase-admin
            // const admin = require('firebase-admin');
            // const message = {
            //     token: device.push_token,
            //     notification: { title, body },
            //     data: data,
            //     priority: priority === 'high' ? 'high' : 'normal'
            // };
            // const response = await admin.messaging().send(message);
            
            this.logger.info(`[FCM] Sending to ${device.device_uuid}`, { title, body });
            return { success: true, deviceId: device.device_uuid };
        } catch (error) {
            this.logger.error('FCM send failed', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Send via APNS (iOS)
     */
    async sendAPNS(device, title, body, data, priority) {
        try {
            // This is a placeholder - implement with apn
            this.logger.info(`[APNS] Sending to ${device.device_uuid}`, { title, body });
            return { success: true, deviceId: device.device_uuid };
        } catch (error) {
            this.logger.error('APNS send failed', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Send via Web Push
     */
    async sendWebPush(device, title, body, data, priority) {
        try {
            // This is a placeholder - implement with web-push
            // const webpush = require('web-push');
            // const payload = JSON.stringify({ title, body, data });
            // const result = await webpush.sendNotification(
            //     device.endpoint,
            //     payload
            // );
            
            this.logger.info(`[WebPush] Sending to ${device.device_uuid}`, { title, body });
            return { success: true, deviceId: device.device_uuid };
        } catch (error) {
            this.logger.error('WebPush send failed', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Get user notifications
     */
    async getUserNotifications(userId, pagination = {}) {
        try {
            const page = pagination.page || 1;
            const limit = pagination.limit || 50;
            const offset = (page - 1) * limit;

            const where = {
                user_id: userId
            };

            if (pagination.unreadOnly) {
                where.status = 'pending';
            }

            const { count, rows } = await Notification.findAndCountAll({
                where,
                order: [['created_at', 'DESC']],
                limit,
                offset
            });

            return {
                notifications: rows.map(n => ({
                    id: n.uuid,
                    type: n.type,
                    category: n.category,
                    title: n.title,
                    body: n.body,
                    data: n.data,
                    priority: n.priority,
                    status: n.status,
                    readAt: n.read_at,
                    createdAt: n.created_at
                })),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };
        } catch (error) {
            this.logger.error('Failed to get user notifications', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        try {
            const notification = await Notification.findOne({
                where: {
                    uuid: notificationId,
                    user_id: userId
                }
            });

            if (!notification) {
                throw new Error('Notification not found');
            }

            notification.status = 'read';
            notification.read_at = new Date();
            await notification.save();

            // Publish event
            await this.eventBus.publish('notification.read', {
                notificationId: notification.uuid,
                userId,
                timestamp: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to mark notification as read', { error: error.message, notificationId });
            throw error;
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId) {
        try {
            await Notification.update(
                { status: 'read', read_at: new Date() },
                {
                    where: {
                        user_id: userId,
                        status: 'pending'
                    }
                }
            );

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to mark all as read', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Register device for notifications
     */
    async registerDevice(userId, data) {
        try {
            const { deviceUuid, platform, pushToken, provider = 'fcm' } = data;

            // Check if device already exists
            let device = await NotificationDevice.findOne({
                where: {
                    user_id: userId,
                    device_uuid: deviceUuid
                }
            });

            if (device) {
                // Update device
                device.push_token = pushToken;
                device.platform = platform;
                device.provider = provider;
                device.is_active = true;
                device.is_enabled = true;
                device.last_used_at = new Date();
                await device.save();
            } else {
                // Create new device
                device = await NotificationDevice.create({
                    uuid: uuidv4(),
                    user_id: userId,
                    device_uuid: deviceUuid,
                    platform,
                    push_token: pushToken,
                    provider,
                    is_active: true,
                    is_enabled: true,
                    last_registered_at: new Date(),
                    last_used_at: new Date()
                });
            }

            this.logger.info(`Device registered: ${deviceUuid}`, {
                userId,
                platform,
                deviceId: device.uuid
            });

            return {
                success: true,
                deviceId: device.uuid,
                platform: device.platform
            };
        } catch (error) {
            this.logger.error('Failed to register device', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Unregister device
     */
    async unregisterDevice(deviceId, userId) {
        try {
            const device = await NotificationDevice.findOne({
                where: {
                    uuid: deviceId,
                    user_id: userId
                }
            });

            if (!device) {
                throw new Error('Device not found');
            }

            device.is_active = false;
            await device.save();

            this.logger.info(`Device unregistered: ${deviceId}`, { userId });

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to unregister device', { error: error.message, deviceId });
            throw error;
        }
    }

    /**
     * Get user notification settings
     */
    async getUserNotificationSettings(userId) {
        try {
            // This will be implemented with user settings
            return {
                push: true,
                web: true,
                desktop: true,
                email: false,
                sms: false
            };
        } catch (error) {
            this.logger.error('Failed to get user notification settings', { error: error.message, userId });
            return {
                push: true,
                web: true,
                desktop: true,
                email: false,
                sms: false
            };
        }
    }

    /**
     * Filter allowed channels based on user settings
     */
    filterAllowedChannels(channels, settings) {
        return channels.filter(channel => {
            switch (channel) {
                case 'push':
                    return settings.push !== false;
                case 'web':
                    return settings.web !== false;
                case 'desktop':
                    return settings.desktop !== false;
                case 'email':
                    return settings.email === true;
                case 'sms':
                    return settings.sms === true;
                default:
                    return true;
            }
        });
    }

    /**
     * Get priority value for queue
     */
    getPriorityValue(priority) {
        const priorities = {
            critical: 1,
            high: 2,
            normal: 3,
            low: 4
        };
        return priorities[priority] || 3;
    }
}

// Singleton instance
let notificationServiceInstance = null;

const getNotificationService = async () => {
    if (!notificationServiceInstance) {
        notificationServiceInstance = new NotificationService();
        await notificationServiceInstance.initialize();
    }
    return notificationServiceInstance;
};

module.exports = {
    NotificationService,
    getNotificationService
};