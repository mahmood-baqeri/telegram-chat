const express = require('express');
const router = express.Router();

// Import routes
const authRoutes = require('../modules/auth/routes/auth');
const usersRoutes = require('../modules/users/routes/users');
const chatsRoutes = require('../modules/chats/routes/chats');
const groupsRoutes = require('../modules/groups/routes/groups');
const channelsRoutes = require('../modules/channels/routes/channels');
const filesRoutes = require('../modules/files/routes/files');
const searchRoutes = require('../modules/search/routes/search');
const adminRoutes = require('../modules/admin/routes/admin');
const notificationsRoutes = require('../modules/notifications/routes/notifications');

// Register routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/chats', chatRoutes);
router.use('/groups', groupRoutes);
router.use('/channels', channelRoutes);
router.use('/files', fileRoutes);
router.use('/search', searchRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);

module.exports = router;