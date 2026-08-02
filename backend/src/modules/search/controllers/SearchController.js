const ResponseHandler = require('../../../utils/responseHandler');
const { getSearchService } = require('../services/SearchService');
const { getLogger } = require('../../../services/LoggerService');

class SearchController {
    constructor() {
        this.searchService = null;
        this.logger = null;
    }

    async initialize() {
        this.searchService = await getSearchService();
        this.logger = getLogger();
        return this;
    }

    /**
     * Search messages
     * GET /api/v1/search/messages
     */
    searchMessages = async (req, res, next) => {
        try {
            const { q, type, sender, from, to, page = 1, limit = 50 } = req.query;

            const filters = {
                messageType: type,
                senderId: sender,
                fromDate: from,
                toDate: to
            };

            const result = await this.searchService.searchMessages(
                req.user.id,
                q,
                filters,
                { page: parseInt(page), limit: parseInt(limit) }
            );

            return ResponseHandler.paginated(
                res,
                result.messages,
                result.pagination,
                'Messages found'
            );
        } catch (error) {
            this.logger.error('Search messages error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Search users
     * GET /api/v1/search/users
     */
    searchUsers = async (req, res, next) => {
        try {
            const { q, verified, premium, page = 1, limit = 20 } = req.query;

            const filters = {
                isVerified: verified === 'true',
                isPremium: premium === 'true'
            };

            const result = await this.searchService.searchUsers(
                q,
                filters,
                { page: parseInt(page), limit: parseInt(limit) }
            );

            return ResponseHandler.paginated(
                res,
                result.users,
                result.pagination,
                'Users found'
            );
        } catch (error) {
            this.logger.error('Search users error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Search files
     * GET /api/v1/search/files
     */
    searchFiles = async (req, res, next) => {
        try {
            const { q, fileType, mimeType, page = 1, limit = 20 } = req.query;

            const filters = {
                fileType,
                mimeType
            };

            const result = await this.searchService.searchFiles(
                req.user.id,
                q,
                filters,
                { page: parseInt(page), limit: parseInt(limit) }
            );

            return ResponseHandler.paginated(
                res,
                result.files,
                result.pagination,
                'Files found'
            );
        } catch (error) {
            this.logger.error('Search files error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Global search
     * POST /api/v1/search/global
     */
    globalSearch = async (req, res, next) => {
        try {
            const { q, types = ['messages', 'users', 'files'] } = req.body;
            const results = {};

            // Search messages
            if (types.includes('messages')) {
                const messages = await this.searchService.searchMessages(
                    req.user.id,
                    q,
                    {},
                    { page: 1, limit: 10 }
                );
                results.messages = messages.messages;
            }

            // Search users
            if (types.includes('users')) {
                const users = await this.searchService.searchUsers(
                    q,
                    {},
                    { page: 1, limit: 10 }
                );
                results.users = users.users;
            }

            // Search files
            if (types.includes('files')) {
                const files = await this.searchService.searchFiles(
                    req.user.id,
                    q,
                    {},
                    { page: 1, limit: 10 }
                );
                results.files = files.files;
            }

            return ResponseHandler.success(res, results, 'Global search completed');
        } catch (error) {
            this.logger.error('Global search error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Get search suggestions
     * GET /api/v1/search/suggestions
     */
    getSuggestions = async (req, res, next) => {
        try {
            const { q } = req.query;
            if (!q) {
                return ResponseHandler.success(res, [], 'No query provided');
            }

            const suggestions = await this.searchService.getSuggestions(req.user.id, q);
            return ResponseHandler.success(res, suggestions, 'Suggestions retrieved');
        } catch (error) {
            this.logger.error('Get suggestions error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };

    /**
     * Reindex (Admin)
     * POST /api/v1/admin/search/reindex
     */
    reindex = async (req, res, next) => {
        try {
            // Check admin permission
            if (!req.user.is_admin) {
                return ResponseHandler.forbidden(res, 'Admin access required');
            }

            const result = await this.searchService.reindexAll();
            return ResponseHandler.success(res, result, 'Reindex completed');
        } catch (error) {
            this.logger.error('Reindex error:', { error: error.message });
            return ResponseHandler.error(res, error.message, 400);
        }
    };
}

// Singleton instance
let searchControllerInstance = null;

const getSearchController = async () => {
    if (!searchControllerInstance) {
        searchControllerInstance = new SearchController();
        await searchControllerInstance.initialize();
    }
    return searchControllerInstance;
};

module.exports = {
    SearchController,
    getSearchController
};