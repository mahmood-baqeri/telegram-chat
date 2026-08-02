const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { Group, GroupMember, GroupRole, User } = require('../../../database/models');
const { getCacheService } = require('../../../services/CacheService');
const { getLogger } = require('../../../services/LoggerService');
const { getEventBus } = require('../../../services/EventBus');
const { getFeatureToggleService } = require('../../../services/FeatureToggleService');

class GroupService {
    constructor() {
        this.cache = null;
        this.logger = null;
        this.eventBus = null;
        this.featureService = null;
        this.cacheTTL = 300;
    }

    async initialize() {
        this.cache = await getCacheService();
        this.logger = getLogger();
        this.eventBus = await getEventBus();
        this.featureService = await getFeatureToggleService();
        this.logger.info('✅ Group Service initialized');
        return this;
    }

    /**
     * Create a new group
     */
    async createGroup(userId, data) {
        try {
            const groupsEnabled = await this.featureService.isEnabled('groups.enabled');
            if (!groupsEnabled) {
                throw new Error('Groups are disabled');
            }

            const { title, description, visibility = 'private', username, avatar } = data;

            // Check username if provided
            if (username) {
                const existing = await Group.findOne({ where: { username } });
                if (existing) {
                    throw new Error('Username already taken');
                }
            }

            // Create group
            const group = await Group.create({
                uuid: uuidv4(),
                username: username || null,
                title,
                description: description || null,
                visibility,
                avatar_url: avatar || null,
                owner_id: userId,
                group_type: data.groupType || 'normal',
                settings: data.settings || {}
            });

            // Create default roles
            await this.createDefaultRoles(group.id);

            // Add owner as member with owner role
            const ownerRole = await GroupRole.findOne({
                where: {
                    group_id: group.id,
                    is_system: true,
                    level: 5
                }
            });

            await GroupMember.create({
                group_id: group.id,
                user_id: userId,
                role_id: ownerRole.id,
                status: 'active',
                joined_at: new Date()
            });

            // Update member count
            group.member_count = 1;
            await group.save();

            // Clear cache
            await this.cache.delete(`groups:${userId}`);

            // Publish event
            await this.eventBus.publish('group.created', {
                groupId: group.uuid,
                ownerId: userId,
                title: group.title,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`Group created: ${group.uuid}`, {
                groupId: group.uuid,
                ownerId: userId,
                title: group.title
            });

            return await this.getGroup(group.uuid, userId);
        } catch (error) {
            this.logger.error('Failed to create group', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Get group by UUID
     */
    async getGroup(groupId, userId) {
        try {
            const cacheKey = `group:${groupId}:${userId}`;
            const cached = await this.cache.get(cacheKey);
            
            if (cached) {
                return cached;
            }

            const group = await Group.findOne({
                where: { uuid: groupId, is_deleted: false },
                include: [
                    {
                        model: User,
                        as: 'owner',
                        attributes: ['uuid', 'display_name', 'username', 'avatar_url']
                    },
                    {
                        model: GroupMember,
                        as: 'members',
                        include: [{
                            model: User,
                            as: 'user',
                            attributes: ['uuid', 'display_name', 'username', 'avatar_url', 'is_verified', 'is_premium']
                        }]
                    }
                ]
            });

            if (!group) {
                return null;
            }

            // Check if user is member
            const member = await GroupMember.findOne({
                where: {
                    group_id: group.id,
                    user_id: userId,
                    status: 'active'
                }
            });

            if (!member && group.visibility !== 'public') {
                return null;
            }

            const groupData = {
                id: group.uuid,
                username: group.username,
                title: group.title,
                description: group.description,
                visibility: group.visibility,
                avatarUrl: group.avatar_url,
                bannerUrl: group.banner_url,
                groupType: group.group_type,
                isVerified: group.is_verified,
                isPremium: group.is_premium,
                isActive: group.is_active,
                memberCount: group.member_count,
                onlineCount: group.online_count,
                owner: group.owner ? {
                    id: group.owner.uuid,
                    displayName: group.owner.display_name,
                    username: group.owner.username
                } : null,
                settings: group.settings,
                members: group.members.map(m => ({
                    id: m.user.uuid,
                    displayName: m.user.display_name,
                    username: m.user.username,
                    avatarUrl: m.user.avatar_url,
                    isVerified: m.user.is_verified,
                    isPremium: m.user.is_premium,
                    role: m.role,
                    status: m.status,
                    joinedAt: m.joined_at
                })),
                createdAt: group.created_at,
                updatedAt: group.updated_at
            };

            await this.cache.set(cacheKey, groupData, this.cacheTTL);

            return groupData;
        } catch (error) {
            this.logger.error('Failed to get group', { error: error.message, groupId });
            throw error;
        }
    }

    /**
     * Get user's groups
     */
    async getUserGroups(userId, filters = {}) {
        try {
            const cacheKey = `groups:${userId}`;
            const cached = await this.cache.get(cacheKey);
            
            if (cached && !filters.forceRefresh) {
                return cached;
            }

            const where = {
                user_id: userId,
                status: 'active'
            };

            const members = await GroupMember.findAll({
                where,
                include: [{
                    model: Group,
                    as: 'group',
                    where: { is_deleted: false }
                }],
                order: [[{ model: Group, as: 'group' }, 'created_at', 'DESC']]
            });

            const groups = members.map(m => ({
                id: m.group.uuid,
                username: m.group.username,
                title: m.group.title,
                description: m.group.description,
                visibility: m.group.visibility,
                avatarUrl: m.group.avatar_url,
                groupType: m.group.group_type,
                isVerified: m.group.is_verified,
                isPremium: m.group.is_premium,
                memberCount: m.group.member_count,
                onlineCount: m.group.online_count,
                role: m.role,
                status: m.status,
                joinedAt: m.joined_at
            }));

            await this.cache.set(cacheKey, groups, this.cacheTTL);

            return groups;
        } catch (error) {
            this.logger.error('Failed to get user groups', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Update group
     */
    async updateGroup(groupId, userId, data) {
        try {
            const group = await Group.findOne({ where: { uuid: groupId } });
            if (!group) {
                throw new Error('Group not found');
            }

            // Check permission
            const member = await GroupMember.findOne({
                where: {
                    group_id: group.id,
                    user_id: userId,
                    status: 'active'
                },
                include: [{
                    model: GroupRole,
                    as: 'role'
                }]
            });

            if (!member || !this.hasPermission(member, 'update_group')) {
                throw new Error('Insufficient permissions');
            }

            // Check username if being updated
            if (data.username && data.username !== group.username) {
                const existing = await Group.findOne({
                    where: {
                        username: data.username,
                        id: { [Op.ne]: group.id }
                    }
                });
                if (existing) {
                    throw new Error('Username already taken');
                }
            }

            const allowedFields = ['title', 'description', 'visibility', 'username', 'avatar_url', 'banner_url', 'settings'];
            const updateData = {};

            for (const field of allowedFields) {
                if (data[field] !== undefined) {
                    updateData[field] = data[field];
                }
            }

            await group.update(updateData);

            // Clear cache
            await this.cache.delete(`group:${groupId}:${userId}`);
            await this.cache.delete(`groups:${userId}`);

            // Publish event
            await this.eventBus.publish('group.updated', {
                groupId: group.uuid,
                userId,
                updatedFields: Object.keys(updateData),
                timestamp: new Date().toISOString()
            });

            return await this.getGroup(groupId, userId);
        } catch (error) {
            this.logger.error('Failed to update group', { error: error.message, groupId, userId });
            throw error;
        }
    }

    /**
     * Delete group
     */
    async deleteGroup(groupId, userId) {
        try {
            const group = await Group.findOne({ where: { uuid: groupId } });
            if (!group) {
                throw new Error('Group not found');
            }

            // Check if user is owner
            if (group.owner_id !== userId) {
                throw new Error('Only group owner can delete the group');
            }

            group.is_deleted = true;
            group.deleted_at = new Date();
            await group.save();

            // Clear cache
            await this.cache.delete(`group:${groupId}:${userId}`);

            // Publish event
            await this.eventBus.publish('group.deleted', {
                groupId: group.uuid,
                userId,
                timestamp: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to delete group', { error: error.message, groupId, userId });
            throw error;
        }
    }

    /**
     * Add member to group
     */
    async addMember(groupId, userId, targetUserId, roleName = 'member') {
        try {
            const group = await Group.findOne({ where: { uuid: groupId } });
            if (!group) {
                throw new Error('Group not found');
            }

            // Check if user has permission to add members
            const member = await GroupMember.findOne({
                where: {
                    group_id: group.id,
                    user_id: userId,
                    status: 'active'
                },
                include: [{
                    model: GroupRole,
                    as: 'role'
                }]
            });

            if (!member || !this.hasPermission(member, 'invite_users')) {
                throw new Error('Insufficient permissions');
            }

            // Check if target user exists
            const targetUser = await User.findByPk(targetUserId);
            if (!targetUser) {
                throw new Error('User not found');
            }

            // Check if already a member
            const existing = await GroupMember.findOne({
                where: {
                    group_id: group.id,
                    user_id: targetUserId
                }
            });

            if (existing) {
                if (existing.status === 'banned') {
                    throw new Error('User is banned from this group');
                }
                if (existing.status === 'active') {
                    throw new Error('User is already a member');
                }
            }

            // Get role
            const role = await GroupRole.findOne({
                where: {
                    group_id: group.id,
                    name: roleName
                }
            });

            if (!role) {
                throw new Error('Role not found');
            }

            // Add member
            await GroupMember.create({
                group_id: group.id,
                user_id: targetUserId,
                role_id: role.id,
                status: 'active',
                joined_at: new Date()
            });

            // Update member count
            group.member_count += 1;
            await group.save();

            // Clear cache
            await this.cache.delete(`group:${groupId}:${userId}`);
            await this.cache.delete(`groups:${targetUserId}`);

            // Publish event
            await this.eventBus.publish('group.member.added', {
                groupId: group.uuid,
                userId: targetUserId,
                addedBy: userId,
                timestamp: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to add member', { error: error.message, groupId, userId });
            throw error;
        }
    }

    /**
     * Remove member from group
     */
    async removeMember(groupId, userId, targetUserId) {
        try {
            const group = await Group.findOne({ where: { uuid: groupId } });
            if (!group) {
                throw new Error('Group not found');
            }

            // Check permission
            const member = await GroupMember.findOne({
                where: {
                    group_id: group.id,
                    user_id: userId,
                    status: 'active'
                },
                include: [{
                    model: GroupRole,
                    as: 'role'
                }]
            });

            if (!member || !this.hasPermission(member, 'remove_users')) {
                throw new Error('Insufficient permissions');
            }

            // Cannot remove owner
            if (group.owner_id === targetUserId) {
                throw new Error('Cannot remove group owner');
            }

            // Check if target is member
            const targetMember = await GroupMember.findOne({
                where: {
                    group_id: group.id,
                    user_id: targetUserId,
                    status: 'active'
                }
            });

            if (!targetMember) {
                throw new Error('User is not a member');
            }

            // Remove member
            await targetMember.destroy();

            // Update member count
            group.member_count -= 1;
            await group.save();

            // Clear cache
            await this.cache.delete(`group:${groupId}:${userId}`);
            await this.cache.delete(`groups:${targetUserId}`);

            // Publish event
            await this.eventBus.publish('group.member.removed', {
                groupId: group.uuid,
                userId: targetUserId,
                removedBy: userId,
                timestamp: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to remove member', { error: error.message, groupId, userId });
            throw error;
        }
    }

    /**
     * Create default roles for group
     */
    async createDefaultRoles(groupId) {
        const defaultRoles = [
            { name: 'owner', level: 5, isSystem: true },
            { name: 'admin', level: 4, isSystem: true },
            { name: 'moderator', level: 3, isSystem: true },
            { name: 'member', level: 1, isSystem: true, isDefault: true },
            { name: 'guest', level: 0, isSystem: true }
        ];

        for (const roleData of defaultRoles) {
            await GroupRole.create({
                group_id: groupId,
                name: roleData.name,
                level: roleData.level,
                is_system: roleData.isSystem,
                is_default: roleData.isDefault || false,
                permissions: this.getDefaultPermissions(roleData.name)
            });
        }
    }

    /**
     * Get default permissions for role
     */
    getDefaultPermissions(roleName) {
        const permissions = {
            owner: ['*'],
            admin: ['view_group', 'send_message', 'edit_messages', 'delete_messages', 'pin_messages', 'invite_users', 'remove_users', 'mute_users', 'ban_users', 'update_group_settings', 'change_avatar', 'change_banner', 'create_invite_links', 'view_reports', 'view_audit_logs'],
            moderator: ['view_group', 'send_message', 'edit_messages', 'delete_messages', 'pin_messages', 'mute_users', 'ban_users', 'view_reports'],
            member: ['view_group', 'send_message', 'edit_own_messages', 'delete_own_messages', 'react_to_messages', 'report_messages'],
            guest: ['view_group']
        };

        return permissions[roleName] || [];
    }

    /**
     * Check if member has permission
     */
    hasPermission(member, permission) {
        if (!member.role) return false;
        const permissions = member.role.permissions || [];
        return permissions.includes('*') || permissions.includes(permission);
    }

    /**
     * Search groups
     */
    async searchGroups(query, filters = {}, pagination = {}) {
        try {
            const page = pagination.page || 1;
            const limit = pagination.limit || 20;
            const offset = (page - 1) * limit;

            const where = {
                is_deleted: false,
                visibility: 'public'
            };

            if (query) {
                where[Op.or] = [
                    { title: { [Op.like]: `%${query}%` } },
                    { description: { [Op.like]: `%${query}%` } },
                    { username: { [Op.like]: `%${query}%` } }
                ];
            }

            if (filters.username) {
                where.username = filters.username;
            }

            if (filters.category) {
                where.category_id = filters.category;
            }

            if (filters.isVerified !== undefined) {
                where.is_verified = filters.isVerified;
            }

            const { count, rows } = await Group.findAndCountAll({
                where,
                include: [{
                    model: User,
                    as: 'owner',
                    attributes: ['uuid', 'display_name', 'username']
                }],
                limit,
                offset,
                order: [['member_count', 'DESC']]
            });

            return {
                groups: rows.map(g => ({
                    id: g.uuid,
                    username: g.username,
                    title: g.title,
                    description: g.description,
                    avatarUrl: g.avatar_url,
                    groupType: g.group_type,
                    isVerified: g.is_verified,
                    isPremium: g.is_premium,
                    memberCount: g.member_count,
                    owner: g.owner ? {
                        id: g.owner.uuid,
                        displayName: g.owner.display_name
                    } : null,
                    createdAt: g.created_at
                })),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };
        } catch (error) {
            this.logger.error('Failed to search groups', { error: error.message, query });
            throw error;
        }
    }
}

// Singleton instance
let groupServiceInstance = null;

const getGroupService = async () => {
    if (!groupServiceInstance) {
        groupServiceInstance = new GroupService();
        await groupServiceInstance.initialize();
    }
    return groupServiceInstance;
};

module.exports = {
    GroupService,
    getGroupService
};