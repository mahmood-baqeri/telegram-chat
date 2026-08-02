const ResponseHandler = require('../../../utils/responseHandler');
const { getUserService } = require('../services/UserService');
const { getContactService } = require('../services/ContactService');
const { getBlockService } = require('../services/BlockService');
const { getLogger } = require('../../../services/LoggerService');

class UserController {
    constructor() {
        this.userService = null;
        this.contactService = null;
        this.blockService = null;
        this.logger = null;
    }

    async initialize() {
        this.userService = await getUserService();
        this.contactService = await getContactService();
        this.blockService = await getBlockService();
        this.logger = getLogger();
        return this;
    }

    /**
     * Get current user profile
     * GET /api/v1/users/me
     */
    getMe = async (req, res, next) => {
        try {
            const user = await this.userService.getUserById(req.user.id, true);
            if (!user) {
                return ResponseHandler.notFound(res, 'User not found');
            }
            return ResponseHandler.success(res, user, 'User retrieved successfully');
        } catch (error) {
            this.logger.error('Get me error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Update current user profile
     * PUT /api/v1/users/me
     */
    updateMe = async (req, res, next) => {
        try {
            const result = await this.userService.updateProfile(req.user.id, req.body);
            return ResponseHandler.success(res, result, 'Profile updated successfully');
        } catch (error) {
            this.logger.error('Update me error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Change username
     * PUT /api/v1/users/me/username
     */
    changeUsername = async (req, res, next) => {
        try {
            const { username } = req.body;
            if (!username) {
                return ResponseHandler.error(res, 'Username is required', 400);
            }
            const result = await this.userService.changeUsername(req.user.id, username);
            return ResponseHandler.success(res, result, 'Username updated successfully');
        } catch (error) {
            this.logger.error('Change username error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Update avatar
     * POST /api/v1/users/me/avatar
     */
    updateAvatar = async (req, res, next) => {
        try {
            const { avatarUrl, avatarThumb, avatarHash } = req.body;
            const result = await this.userService.updateAvatar(
                req.user.id,
                avatarUrl,
                avatarThumb,
                avatarHash
            );
            return ResponseHandler.success(res, result, 'Avatar updated successfully');
        } catch (error) {
            this.logger.error('Update avatar error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Delete avatar
     * DELETE /api/v1/users/me/avatar
     */
    deleteAvatar = async (req, res, next) => {
        try {
            const result = await this.userService.deleteAvatar(req.user.id);
            return ResponseHandler.success(res, result, 'Avatar deleted successfully');
        } catch (error) {
            this.logger.error('Delete avatar error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get user by UUID
     * GET /api/v1/users/:uuid
     */
    getUser = async (req, res, next) => {
        try {
            const { uuid } = req.params;
            const user = await this.userService.getUserByUUID(uuid);
            if (!user) {
                return ResponseHandler.notFound(res, 'User not found');
            }

            // Check if blocked
            const isBlocked = await this.blockService.isBlocked(req.user.id, user.id);
            if (isBlocked) {
                return ResponseHandler.error(res, 'User not available', 403);
            }

            return ResponseHandler.success(res, user, 'User retrieved successfully');
        } catch (error) {
            this.logger.error('Get user error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Search users
     * GET /api/v1/users/search
     */
    searchUsers = async (req, res, next) => {
        try {
            const { q, ...filters } = req.query;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;

            const result = await this.userService.searchUsers(q, filters, { page, limit });
            return ResponseHandler.paginated(res, result.users, result.pagination, 'Users retrieved successfully');
        } catch (error) {
            this.logger.error('Search users error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get user contacts
     * GET /api/v1/users/contacts
     */
    getContacts = async (req, res, next) => {
        try {
            const { favoritesOnly } = req.query;
            const contacts = await this.contactService.getContacts(req.user.id, {
                favoritesOnly: favoritesOnly === 'true'
            });
            return ResponseHandler.success(res, contacts, 'Contacts retrieved successfully');
        } catch (error) {
            this.logger.error('Get contacts error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Add contact
     * POST /api/v1/users/contacts
     */
    addContact = async (req, res, next) => {
        try {
            const { userId: contactUserId, ...data } = req.body;
            const result = await this.contactService.addContact(req.user.id, contactUserId, data);
            return ResponseHandler.success(res, result, 'Contact added successfully');
        } catch (error) {
            this.logger.error('Add contact error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Remove contact
     * DELETE /api/v1/users/contacts/:id
     */
    removeContact = async (req, res, next) => {
        try {
            const { id } = req.params;
            const result = await this.contactService.removeContact(req.user.id, id);
            return ResponseHandler.success(res, result, 'Contact removed successfully');
        } catch (error) {
            this.logger.error('Remove contact error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Toggle favorite contact
     * PUT /api/v1/users/contacts/:id/favorite
     */
    toggleFavorite = async (req, res, next) => {
        try {
            const { id } = req.params;
            const result = await this.contactService.toggleFavorite(req.user.id, id);
            return ResponseHandler.success(res, result, 'Favorite status toggled');
        } catch (error) {
            this.logger.error('Toggle favorite error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Sync contacts
     * POST /api/v1/users/contacts/sync
     */
    syncContacts = async (req, res, next) => {
        try {
            const { contacts } = req.body;
            if (!contacts || !Array.isArray(contacts)) {
                return ResponseHandler.error(res, 'Invalid contacts data', 400);
            }
            const result = await this.contactService.syncContacts(req.user.id, contacts);
            return ResponseHandler.success(res, result, 'Contacts synced successfully');
        } catch (error) {
            this.logger.error('Sync contacts error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Discover contacts
     * POST /api/v1/users/contacts/discover
     */
    discoverContacts = async (req, res, next) => {
        try {
            const { phoneNumbers } = req.body;
            if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
                return ResponseHandler.error(res, 'Invalid phone numbers', 400);
            }
            const result = await this.contactService.discoverContacts(req.user.id, phoneNumbers);
            return ResponseHandler.success(res, result, 'Contacts discovered successfully');
        } catch (error) {
            this.logger.error('Discover contacts error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get blocked users
     * GET /api/v1/users/blocks
     */
    getBlocks = async (req, res, next) => {
        try {
            const blocks = await this.blockService.getBlockedUsers(req.user.id);
            return ResponseHandler.success(res, blocks, 'Blocked users retrieved successfully');
        } catch (error) {
            this.logger.error('Get blocks error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Block user
     * POST /api/v1/users/blocks
     */
    blockUser = async (req, res, next) => {
        try {
            const { userId, reason } = req.body;
            if (!userId) {
                return ResponseHandler.error(res, 'User ID is required', 400);
            }
            const result = await this.blockService.blockUser(req.user.id, userId, reason);
            return ResponseHandler.success(res, result, 'User blocked successfully');
        } catch (error) {
            this.logger.error('Block user error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Unblock user
     * DELETE /api/v1/users/blocks/:id
     */
    unblockUser = async (req, res, next) => {
        try {
            const { id } = req.params;
            const result = await this.blockService.unblockUser(req.user.id, id);
            return ResponseHandler.success(res, result, 'User unblocked successfully');
        } catch (error) {
            this.logger.error('Unblock user error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get user stats
     * GET /api/v1/users/me/stats
     */
    getStats = async (req, res, next) => {
        try {
            const stats = await this.userService.getUserStats(req.user.id);
            return ResponseHandler.success(res, stats, 'Stats retrieved successfully');
        } catch (error) {
            this.logger.error('Get stats error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };
}

// Singleton instance
let userControllerInstance = null;

const getUserController = async () => {
    if (!userControllerInstance) {
        userControllerInstance = new UserController();
        await userControllerInstance.initialize();
    }
    return userControllerInstance;
};

module.exports = {
    UserController,
    getUserController
};