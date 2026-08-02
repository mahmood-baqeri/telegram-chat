const express = require('express');
const router = express.Router();
const { getSearchController } = require('../controllers/SearchController');
const { auth } = require('../../../middlewares/auth');
const { validate } = require('../../../middlewares/validator');
const Joi = require('joi');

const searchControllerPromise = getSearchController();

const globalSearchSchema = Joi.object({
    q: Joi.string().required(),
    types: Joi.array().items(
        Joi.string().valid('messages', 'users', 'files', 'groups', 'channels')
    )
});

router.get('/messages',
    auth,
    async (req, res, next) => {
        const controller = await searchControllerPromise;
        return controller.searchMessages(req, res, next);
    }
);

router.get('/users',
    auth,
    async (req, res, next) => {
        const controller = await searchControllerPromise;
        return controller.searchUsers(req, res, next);
    }
);

router.get('/files',
    auth,
    async (req, res, next) => {
        const controller = await searchControllerPromise;
        return controller.searchFiles(req, res, next);
    }
);

router.post('/global',
    auth,
    validate(globalSearchSchema),
    async (req, res, next) => {
        const controller = await searchControllerPromise;
        return controller.globalSearch(req, res, next);
    }
);

router.get('/suggestions',
    auth,
    async (req, res, next) => {
        const controller = await searchControllerPromise;
        return controller.getSuggestions(req, res, next);
    }
);

// Admin routes
router.post('/admin/reindex',
    auth,
    async (req, res, next) => {
        const controller = await searchControllerPromise;
        return controller.reindex(req, res, next);
    }
);

module.exports = router;