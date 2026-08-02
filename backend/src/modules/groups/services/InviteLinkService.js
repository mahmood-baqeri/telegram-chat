const { v4: uuidv4 } = require('uuid');
const { GroupInviteLink, GroupMember } = require('../../../database/models');
const { getCacheService } = require('../../../services/CacheService');
const { getLogger } = require('../../../services/LoggerService');
const { getEventBus } = require('../../../services/EventBus');

class InviteLinkService {
    constructor() {
        this.cache = null;
        this.logger = null;
        this.eventBus = null;
        this.cacheTTL = 300;
    }

    async initialize() {
        this.cache = await getCacheService();
        this.logger = getLogger();
        this.eventBus = await getEventBus();
        this.logger.info('✅ Invite Link Service initialized');
        return this;
    }

    /**
     * Generate invite link
     */
    async generateInviteLink(groupId, userId, options = {}) {
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
                }
            });

            if (!member) {
                throw new Error('User is not a member');
            }

            // Generate unique code
            const code = this.generateCode();

            const inviteLink = await GroupInviteLink.create({
                uuid: uuidv4(),
                group_id: group.id,
                code,
                creator_id: userId,
                max_uses: options.maxUses || 0,
                expires_at: options.expiresAt || null,
                is_active: true
            });

            // Publish event
            await this.eventBus.publish('group.invite.created', {
                groupId: group.uuid,
                inviteCode: code,
                creatorId: userId,
                timestamp: new Date().toISOString()
            });

            return {
                code: inviteLink.code,
                link: `/join/${inviteLink.code}`,
                maxUses: inviteLink.max_uses,
                expiresAt: inviteLink.expires_at,
                createdAt: inviteLink.created_at
            };
        } catch (error) {
            this.logger.error('Failed to generate invite link', { error: error.message, groupId, userId });
            throw error;
        }
    }

    /**
     * Join via invite link
     */
    async joinViaInvite(code, userId) {
        try {
            const inviteLink = await GroupInviteLink.findOne({
                where: {
                    code,
                    is_active: true,
                    is_revoked: false
                }
            });

            if (!inviteLink) {
                throw new Error('Invalid or expired invite link');
            }

            // Check expiration
            if (inviteLink.expires_at && new Date() > inviteLink.expires_at) {
                throw new Error('Invite link has expired');
            }

            // Check max uses
            if (inviteLink.max_uses > 0 && inviteLink.uses >= inviteLink.max_uses) {
                throw new Error('Invite link has reached maximum uses');
            }

            const group = await Group.findByPk(inviteLink.group_id);
            if (!group) {
                throw new Error('Group not found');
            }

            // Check if already a member
            const existing = await GroupMember.findOne({
                where: {
                    group_id: group.id,
                    user_id: userId
                }
            });

            if (existing) {
                if (existing.status === 'banned') {
                    throw new Error('You are banned from this group');
                }
                if (existing.status === 'active') {
                    throw new Error('You are already a member');
                }
            }

            // Add member
            const memberRole = await GroupRole.findOne({
                where: {
                    group_id: group.id,
                    is_default: true
                }
            });

            await GroupMember.create({
                group_id: group.id,
                user_id: userId,
                role_id: memberRole ? memberRole.id : null,
                status: 'active',
                joined_at: new Date()
            });

            // Update invite link usage
            inviteLink.uses += 1;
            await inviteLink.save();

            // Update group member count
            group.member_count += 1;
            await group.save();

            // Publish event
            await this.eventBus.publish('group.joined', {
                groupId: group.uuid,
                userId,
                inviteCode: code,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                groupId: group.uuid,
                groupName: group.title
            };
        } catch (error) {
            this.logger.error('Failed to join via invite link', { error: error.message, code, userId });
            throw error;
        }
    }

    /**
     * Revoke invite link
     */
    async revokeInviteLink(groupId, userId, code) {
        try {
            const inviteLink = await GroupInviteLink.findOne({
                where: {
                    code,
                    group_id: groupId
                }
            });

            if (!inviteLink) {
                throw new Error('Invite link not found');
            }

            // Check permission
            const member = await GroupMember.findOne({
                where: {
                    group_id: groupId,
                    user_id: userId,
                    status: 'active'
                }
            });

            if (!member) {
                throw new Error('User is not a member');
            }

            inviteLink.is_revoked = true;
            inviteLink.revoked_at = new Date();
            await inviteLink.save();

            // Publish event
            await this.eventBus.publish('group.invite.revoked', {
                groupId,
                inviteCode: code,
                revokedBy: userId,
                timestamp: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to revoke invite link', { error: error.message, groupId, userId, code });
            throw error;
        }
    }

    /**
     * Generate unique code
     */
    generateCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }
}

// Singleton instance
let inviteLinkServiceInstance = null;

const getInviteLinkService = async () => {
    if (!inviteLinkServiceInstance) {
        inviteLinkServiceInstance = new InviteLinkService();
        await inviteLinkServiceInstance.initialize();
    }
    return inviteLinkServiceInstance;
};

module.exports = {
    InviteLinkService,
    getInviteLinkService
};