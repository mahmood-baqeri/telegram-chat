const express = require('express');
const router = express.Router();
const { getUserController } = require('../controllers/UserController');
const { auth } = require('../../../middlewares/auth');
const { validate } = require('../../../middlewares/validator');
const Joi = require('joi');

const userControllerPromise = getUserController();

// Validation schemas
const updateProfileSchema = Joi.object({
    display_name: Joi.string().min(1).max(100),
    username: Joi.string().pattern(/^[a-zA-Z0-9_]{5,32}$/),
    bio: Joi.string().max(500),
    language: Joi.string().length(2),
    timezone: Joi.string(),
    country: Joi.string().length(2),
    profile: Joi.object({
        first_name: Joi.string().max(100),
        last_name: Joi.string().max(100),
        email: Joi.string().email(),
        birth_date: Joi.date(),
        gender: Joi.string().valid('male', 'female', 'other'),
        location_city: Joi.string().max(100),
        location_country: Joi.string().length(2),
        work_title: Joi.string().max(255),
        company: Joi.string().max(255),
        education: Joi.string().max(255),
        website: Joi.string().uri(),
        social_links: Joi.object(),
        interests: Joi.array().items(Joi.string()),
        about: Joi.string().max(1000)
    })
});

const usernameSchema = Joi.object({
    username: Joi.string().pattern(/^[a-zA-Z0-9_]{5,32}$/).required()
});

const avatarSchema = Joi.object({
    avatarUrl: Joi.string().uri(),
    avatarThumb: Joi.string().uri(),
    avatarHash: Joi.string().length(32)
});

const addContactSchema = Joi.object({
    userId: Joi.string().uuid().required(),
    displayName: Joi.string().max(100),
    phone: Joi.string().pattern(/^[0-9]{10,15}$/),
    email: Joi.string().email(),
    isFavorite: Joi.boolean(),
    note: Joi.string().max(500),
    tags: Joi.array().items(Joi.string())
});

const syncContactsSchema = Joi.object({
    contacts: Joi.array().items(
        Joi.object({
            phone: Joi.string().pattern(/^[0-9]{10,15}$/).required(),
            displayName: Joi.string().max(100),
            email: Joi.string().email()
        })
    ).required()
});

const discoverContactsSchema = Joi.object({
    phoneNumbers: Joi.array().items(
        Joi.string().pattern(/^[0-9]{10,15}$/)
    ).required()
});

const blockUserSchema = Joi.object({
    userId: Joi.string().uuid().required(),
    reason: Joi.string().max(255)
});

// User routes
router.get('/me',
    auth,
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.getMe(req, res, next);
    }
);

router.put('/me',
    auth,
    validate(updateProfileSchema),
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.updateMe(req, res, next);
    }
);

router.put('/me/username',
    auth,
    validate(usernameSchema),
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.changeUsername(req, res, next);
    }
);

router.post('/me/avatar',
    auth,
    validate(avatarSchema),
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.updateAvatar(req, res, next);
    }
);

router.delete('/me/avatar',
    auth,
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.deleteAvatar(req, res, next);
    }
);

router.get('/me/stats',
    auth,
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.getStats(req, res, next);
    }
);

router.get('/:uuid',
    auth,
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.getUser(req, res, next);
    }
);

router.get('/search',
    auth,
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.searchUsers(req, res, next);
    }
);

// Contact routes
router.get('/contacts',
    auth,
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.getContacts(req, res, next);
    }
);

router.post('/contacts',
    auth,
    validate(addContactSchema),
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.addContact(req, res, next);
    }
);

router.delete('/contacts/:id',
    auth,
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.removeContact(req, res, next);
    }
);

router.put('/contacts/:id/favorite',
    auth,
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.toggleFavorite(req, res, next);
    }
);

router.post('/contacts/sync',
    auth,
    validate(syncContactsSchema),
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.syncContacts(req, res, next);
    }
);

router.post('/contacts/discover',
    auth,
    validate(discoverContactsSchema),
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.discoverContacts(req, res, next);
    }
);

// Block routes
router.get('/blocks',
    auth,
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.getBlocks(req, res, next);
    }
);

router.post('/blocks',
    auth,
    validate(blockUserSchema),
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.blockUser(req, res, next);
    }
);

router.delete('/blocks/:id',
    auth,
    async (req, res, next) => {
        const controller = await userControllerPromise;
        return controller.unblockUser(req, res, next);
    }
);

module.exports = router;