const { Op } = require('sequelize');
const { Contact, User } = require('../../../database/models');
const { getCacheService } = require('../../../services/CacheService');
const { getLogger } = require('../../../services/LoggerService');
const { getEventBus } = require('../../../services/EventBus');
const { getFeatureToggleService } = require('../../../services/FeatureToggleService');

class ContactService {
    constructor() {
        this.cache = null;
        this.logger = null;
        this.eventBus = null;
        this.featureService = null;
        this.cacheTTL = 300; // 5 minutes
    }

    async initialize() {
        this.cache = await getCacheService();
        this.logger = getLogger();
        this.eventBus = await getEventBus();
        this.featureService = await getFeatureToggleService();
        this.logger.info('✅ Contact Service initialized');
        return this;
    }

    /**
     * Get user's contacts
     */
    async getContacts(userId, options = {}) {
        try {
            const contactsEnabled = await this.featureService.isEnabled('user.contacts');
            if (!contactsEnabled) {
                throw new Error('Contacts feature is disabled');
            }

            const where = {
                user_id: userId,
                is_blocked: false
            };

            if (options.favoritesOnly) {
                where.is_favorite = true;
            }

            const contacts = await Contact.findAll({
                where,
                include: [{
                    model: User,
                    as: 'contactUser',
                    attributes: ['uuid', 'display_name', 'username', 'avatar_url', 'avatar_thumb', 'is_verified', 'is_premium', 'status']
                }],
                order: [['display_name', 'ASC']]
            });

            return contacts.map(contact => ({
                id: contact.uuid,
                displayName: contact.display_name || contact.contactUser?.display_name,
                phone: contact.phone,
                email: contact.email,
                isFavorite: contact.is_favorite,
                user: contact.contactUser ? contact.contactUser.toJSON() : null,
                note: contact.note,
                tags: contact.tags,
                createdAt: contact.created_at
            }));
        } catch (error) {
            this.logger.error('Failed to get contacts', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Add contact
     */
    async addContact(userId, contactUserId, data = {}) {
        try {
            const contactsEnabled = await this.featureService.isEnabled('user.contacts');
            if (!contactsEnabled) {
                throw new Error('Contacts feature is disabled');
            }

            // Check if contact exists
            const contactUser = await User.findByPk(contactUserId);
            if (!contactUser) {
                throw new Error('User not found');
            }

            // Check if already a contact
            const existing = await Contact.findOne({
                where: {
                    user_id: userId,
                    contact_user_id: contactUserId
                }
            });

            if (existing) {
                throw new Error('User already in contacts');
            }

            // Check if blocked
            const Block = require('../../../database/models').Block;
            const isBlocked = await Block.findOne({
                where: {
                    [Op.or]: [
                        { user_id: userId, blocked_user_id: contactUserId },
                        { user_id: contactUserId, blocked_user_id: userId }
                    ]
                }
            });

            if (isBlocked) {
                throw new Error('Cannot add blocked user to contacts');
            }

            // Create contact
            const contact = await Contact.create({
                user_id: userId,
                contact_user_id: contactUserId,
                display_name: data.displayName || contactUser.display_name,
                phone: data.phone || contactUser.phone,
                email: data.email || null,
                is_favorite: data.isFavorite || false,
                note: data.note || null,
                tags: data.tags || []
            });

            // Clear cache
            await this.cache.delete(`contacts:${userId}`);

            // Publish event
            await this.eventBus.publish('contact.added', {
                userId,
                contactUserId,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`Contact added: ${contactUserId}`, { userId, contactUserId });

            return {
                id: contact.uuid,
                displayName: contact.display_name,
                isFavorite: contact.is_favorite
            };
        } catch (error) {
            this.logger.error('Failed to add contact', { error: error.message, userId, contactUserId });
            throw error;
        }
    }

    /**
     * Remove contact
     */
    async removeContact(userId, contactId) {
        try {
            const contact = await Contact.findOne({
                where: {
                    user_id: userId,
                    uuid: contactId
                }
            });

            if (!contact) {
                throw new Error('Contact not found');
            }

            await contact.destroy();

            // Clear cache
            await this.cache.delete(`contacts:${userId}`);

            // Publish event
            await this.eventBus.publish('contact.removed', {
                userId,
                contactId,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`Contact removed: ${contactId}`, { userId, contactId });

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to remove contact', { error: error.message, userId, contactId });
            throw error;
        }
    }

    /**
     * Toggle favorite
     */
    async toggleFavorite(userId, contactId) {
        try {
            const contact = await Contact.findOne({
                where: {
                    user_id: userId,
                    uuid: contactId
                }
            });

            if (!contact) {
                throw new Error('Contact not found');
            }

            contact.is_favorite = !contact.is_favorite;
            await contact.save();

            // Clear cache
            await this.cache.delete(`contacts:${userId}`);

            return {
                id: contact.uuid,
                isFavorite: contact.is_favorite
            };
        } catch (error) {
            this.logger.error('Failed to toggle favorite', { error: error.message, userId, contactId });
            throw error;
        }
    }

    /**
     * Sync contacts from device
     */
    async syncContacts(userId, contacts) {
        try {
            const syncEnabled = await this.featureService.isEnabled('user.contacts.sync');
            if (!syncEnabled) {
                throw new Error('Contact sync is disabled');
            }

            const results = {
                added: 0,
                updated: 0,
                skipped: 0
            };

            for (const contactData of contacts) {
                // Find user by phone
                const user = await User.findOne({
                    where: { phone: contactData.phone }
                });

                if (!user) {
                    results.skipped++;
                    continue;
                }

                // Check if already a contact
                const existing = await Contact.findOne({
                    where: {
                        user_id: userId,
                        contact_user_id: user.id
                    }
                });

                if (existing) {
                    // Update contact info
                    existing.display_name = contactData.displayName || existing.display_name;
                    await existing.save();
                    results.updated++;
                } else {
                    // Add new contact
                    await Contact.create({
                        user_id: userId,
                        contact_user_id: user.id,
                        display_name: contactData.displayName || user.display_name,
                        phone: user.phone
                    });
                    results.added++;
                }
            }

            // Clear cache
            await this.cache.delete(`contacts:${userId}`);

            // Publish event
            await this.eventBus.publish('contacts.synced', {
                userId,
                results,
                timestamp: new Date().toISOString()
            });

            return results;
        } catch (error) {
            this.logger.error('Failed to sync contacts', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Discover contacts (find users who are on the platform)
     */
    async discoverContacts(userId, phoneNumbers) {
        try {
            const results = [];

            for (const phone of phoneNumbers) {
                const user = await User.findOne({
                    where: {
                        phone,
                        is_active: true
                    },
                    attributes: ['uuid', 'display_name', 'username', 'avatar_url', 'is_verified', 'is_premium']
                });

                if (user) {
                    // Check if already a contact
                    const isContact = await Contact.findOne({
                        where: {
                            user_id: userId,
                            contact_user_id: user.id
                        }
                    });

                    results.push({
                        phone,
                        user: user.toJSON(),
                        isContact: !!isContact
                    });
                } else {
                    results.push({
                        phone,
                        user: null,
                        isContact: false
                    });
                }
            }

            return results;
        } catch (error) {
            this.logger.error('Failed to discover contacts', { error: error.message, userId });
            throw error;
        }
    }
}

// Singleton instance
let contactServiceInstance = null;

const getContactService = async () => {
    if (!contactServiceInstance) {
        contactServiceInstance = new ContactService();
        await contactServiceInstance.initialize();
    }
    return contactServiceInstance;
};

module.exports = {
    ContactService,
    getContactService
};