const express = require('express');
const router = express.Router();
const { getGroupService } = require('../services/GroupService');
const { getInviteLinkService } = require('../services/InviteLinkService');
const { getChannelService } = require('../../channels/services/ChannelService');
const { auth } = require('../../../middlewares/auth');
const { validate } = require('../../../middlewares/validator');
const Joi = require('joi');

const groupServicePromise = getGroupService();
const inviteLinkServicePromise = getInviteLinkService();
const channelServicePromise = getChannelService();

// Validation schemas
const createGroupSchema = Joi.object({
    title: Joi.string().max(100).required(),
    description: Joi.string().max(2000),
    visibility: Joi.string().valid('public', 'private', 'invite_only', 'approval_required', 'hidden'),
    username: Joi.string().pattern(/^[a-zA-Z0-9_]{5,32}$/),
    groupType: Joi.string().valid('normal', 'super', 'enterprise', 'support', 'learning', 'project', 'announcement')
});

const updateGroupSchema = Joi.object({
    title: Joi.string().max(100),
    description: Joi.string().max(2000),
    visibility: Joi.string().valid('public', 'private', 'invite_only', 'approval_required', 'hidden'),
    username: Joi.string().pattern(/^[a-zA-Z0-9_]{5,32}$/),
    settings: Joi.object()
});

const createChannelSchema = Joi.object({
    title: Joi.string().max(100).required(),
    description: Joi.string().max(2000),
    visibility: Joi.string().valid('public', 'private', 'hidden'),
    username: Joi.string().pattern(/^[a-zA-Z0-9_]{5,32}$/),
    channelType: Joi.string().valid('public', 'private', 'news', 'broadcast', 'business')
});

const generateInviteSchema = Joi.object({
    maxUses: Joi.number().min(1).max(1000),
    expiresAt: Joi.date()
});

// Group routes
router.post('/groups',
    auth,
    validate(createGroupSchema),
    async (req, res, next) => {
        try {
            const service = await groupServicePromise;
            const result = await service.createGroup(req.user.id, req.body);
            return ResponseHandler.created(res, result, 'Group created successfully');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

router.get('/groups',
    auth,
    async (req, res, next) => {
        try {
            const service = await groupServicePromise;
            const groups = await service.getUserGroups(req.user.id);
            return ResponseHandler.success(res, groups, 'Groups retrieved successfully');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

router.get('/groups/:groupId',
    auth,
    async (req, res, next) => {
        try {
            const service = await groupServicePromise;
            const group = await service.getGroup(req.params.groupId, req.user.id);
            if (!group) {
                return ResponseHandler.notFound(res, 'Group not found');
            }
            return ResponseHandler.success(res, group, 'Group retrieved successfully');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

router.put('/groups/:groupId',
    auth,
    validate(updateGroupSchema),
    async (req, res, next) => {
        try {
            const service = await groupServicePromise;
            const result = await service.updateGroup(req.params.groupId, req.user.id, req.body);
            return ResponseHandler.success(res, result, 'Group updated successfully');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

router.delete('/groups/:groupId',
    auth,
    async (req, res, next) => {
        try {
            const service = await groupServicePromise;
            const result = await service.deleteGroup(req.params.groupId, req.user.id);
            return ResponseHandler.success(res, result, 'Group deleted successfully');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

// Group members
router.post('/groups/:groupId/members',
    auth,
    async (req, res, next) => {
        try {
            const { userId, role } = req.body;
            const service = await groupServicePromise;
            const result = await service.addMember(req.params.groupId, req.user.id, userId, role);
            return ResponseHandler.success(res, result, 'Member added successfully');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

router.delete('/groups/:groupId/members/:userId',
    auth,
    async (req, res, next) => {
        try {
            const service = await groupServicePromise;
            const result = await service.removeMember(
                req.params.groupId,
                req.user.id,
                req.params.userId
            );
            return ResponseHandler.success(res, result, 'Member removed successfully');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

// Invite links
router.post('/groups/:groupId/invites',
    auth,
    validate(generateInviteSchema),
    async (req, res, next) => {
        try {
            const service = await inviteLinkServicePromise;
            const result = await service.generateInviteLink(
                req.params.groupId,
                req.user.id,
                req.body
            );
            return ResponseHandler.success(res, result, 'Invite link generated successfully');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

router.post('/groups/invite/:code',
    auth,
    async (req, res, next) => {
        try {
            const service = await inviteLinkServicePromise;
            const result = await service.joinViaInvite(req.params.code, req.user.id);
            return ResponseHandler.success(res, result, 'Joined group successfully');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

// Channel routes
router.post('/channels',
    auth,
    validate(createChannelSchema),
    async (req, res, next) => {
        try {
            const service = await channelServicePromise;
            const result = await service.createChannel(req.user.id, req.body);
            return ResponseHandler.created(res, result, 'Channel created successfully');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

router.get('/channels',
    auth,
    async (req, res, next) => {
        try {
            const service = await channelServicePromise;
            const channels = await service.getUserChannels(req.user.id);
            return ResponseHandler.success(res, channels, 'Channels retrieved successfully');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

router.get('/channels/:channelId',
    auth,
    async (req, res, next) => {
        try {
            const service = await channelServicePromise;
            const channel = await service.getChannel(req.params.channelId, req.user.id);
            if (!channel) {
                return ResponseHandler.notFound(res, 'Channel not found');
            }
            return ResponseHandler.success(res, channel, 'Channel retrieved successfully');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

router.post('/channels/:channelId/subscribe',
    auth,
    async (req, res, next) => {
        try {
            const service = await channelServicePromise;
            const result = await service.subscribe(req.params.channelId, req.user.id);
            return ResponseHandler.success(res, result, 'Subscribed successfully');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

router.delete('/channels/:channelId/unsubscribe',
    auth,
    async (req, res, next) => {
        try {
            const service = await channelServicePromise;
            const result = await service.unsubscribe(req.params.channelId, req.user.id);
            return ResponseHandler.success(res, result, 'Unsubscribed successfully');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

// Search
router.get('/search/groups',
    auth,
    async (req, res, next) => {
        try {
            const service = await groupServicePromise;
            const { q, ...filters } = req.query;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const result = await service.searchGroups(q, filters, { page, limit });
            return ResponseHandler.paginated(res, result.groups, result.pagination, 'Groups found');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

router.get('/search/channels',
    auth,
    async (req, res, next) => {
        try {
            const service = await channelServicePromise;
            const { q, ...filters } = req.query;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const result = await service.searchChannels(q, filters, { page, limit });
            return ResponseHandler.paginated(res, result.channels, result.pagination, 'Channels found');
        } catch (error) {
            return ResponseHandler.error(res, error.message, 400);
        }
    }
);

module.exports = router;