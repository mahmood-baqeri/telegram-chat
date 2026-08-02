const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { AdminUser, AdminRole, AdminPermission, AdminSession } = require('../../../database/models');
const { getCacheService } = require('../../../services/CacheService');
const { getLogger } = require('../../../services/LoggerService');
const { getEventBus } = require('../../../services/EventBus');
const JWTService = require('../../../modules/auth/services/JWTService');
const config = require('../../../config');

class AdminAuthService {
    constructor() {
        this.cache = null;
        this.logger = null;
        this.eventBus = null;
        this.jwtService = new JWTService();
        this.cacheTTL = 300;
    }

    async initialize() {
        this.cache = await getCacheService();
        this.logger = getLogger();
        this.eventBus = await getEventBus();
        this.logger.info('✅ Admin Auth Service initialized');
        return this;
    }

    /**
     * Admin login
     */
    async login(username, password, ip, userAgent) {
        try {
            // Find admin user
            const admin = await AdminUser.findOne({
                where: { username },
                include: [{
                    model: AdminRole,
                    as: 'role',
                    include: [{
                        model: AdminPermission,
                        as: 'permissions',
                        through: { attributes: [] }
                    }]
                }]
            });

            if (!admin) {
                throw new Error('Invalid credentials');
            }

            if (!admin.is_active) {
                throw new Error('Account is disabled');
            }

            // Verify password
            const isValid = await bcrypt.compare(password, admin.password_hash);
            if (!isValid) {
                throw new Error('Invalid credentials');
            }

            // Update last login
            admin.last_login_at = new Date();
            admin.last_login_ip = ip;
            await admin.save();

            // Generate tokens
            const sessionId = uuidv4();
            const tokens = this.jwtService.generateTokens({
                adminId: admin.id,
                sessionId,
                isAdmin: true
            });

            // Create session
            await AdminSession.create({
                uuid: sessionId,
                admin_user_id: admin.id,
                session_token: this.jwtService.hashToken(tokens.accessToken),
                refresh_token: this.jwtService.hashToken(tokens.refreshToken),
                ip,
                user_agent: userAgent,
                expires_at: new Date(Date.now() + 86400 * 1000),
                last_activity_at: new Date(),
                is_active: true
            });

            // Publish event
            await this.eventBus.publish('admin.login', {
                adminId: admin.uuid,
                username: admin.username,
                ip,
                timestamp: new Date().toISOString()
            });

            this.logger.info(`Admin logged in: ${admin.username}`, {
                adminId: admin.uuid,
                username: admin.username,
                ip
            });

            return {
                admin: {
                    id: admin.uuid,
                    username: admin.username,
                    displayName: admin.display_name,
                    email: admin.email,
                    role: admin.role ? {
                        id: admin.role.uuid,
                        name: admin.role.name,
                        displayName: admin.role.display_name,
                        level: admin.role.level
                    } : null,
                    permissions: admin.role ? admin.role.permissions.map(p => p.name) : []
                },
                sessionId,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: tokens.expiresIn
            };
        } catch (error) {
            this.logger.error('Admin login failed', { error: error.message, username });
            throw error;
        }
    }

    /**
     * Admin logout
     */
    async logout(sessionId, adminId) {
        try {
            const session = await AdminSession.findOne({
                where: {
                    uuid: sessionId,
                    admin_user_id: adminId
                }
            });

            if (session) {
                session.is_active = false;
                await session.save();
            }

            // Clear cache
            await this.cache.delete(`admin:session:${sessionId}`);

            // Publish event
            await this.eventBus.publish('admin.logout', {
                adminId,
                sessionId,
                timestamp: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            this.logger.error('Admin logout failed', { error: error.message, sessionId });
            throw error;
        }
    }

    /**
     * Validate admin session
     */
    async validateSession(sessionId, accessToken) {
        try {
            // Check cache
            const cached = await this.cache.get(`admin:session:${sessionId}`);
            if (cached) {
                return cached;
            }

            const session = await AdminSession.findOne({
                where: {
                    uuid: sessionId,
                    is_active: true,
                    expires_at: {
                        [Op.gt]: new Date()
                    }
                },
                include: [{
                    model: AdminUser,
                    as: 'adminUser',
                    include: [{
                        model: AdminRole,
                        as: 'role',
                        include: [{
                            model: AdminPermission,
                            as: 'permissions',
                            through: { attributes: [] }
                        }]
                    }]
                }]
            });

            if (!session) {
                throw new Error('Invalid session');
            }

            // Validate token
            const hashedToken = this.jwtService.hashToken(accessToken);
            if (session.session_token !== hashedToken) {
                throw new Error('Invalid token');
            }

            // Update last activity
            session.last_activity_at = new Date();
            await session.save();

            const sessionData = {
                admin: {
                    id: session.adminUser.uuid,
                    username: session.adminUser.username,
                    displayName: session.adminUser.display_name,
                    email: session.adminUser.email,
                    isSuperAdmin: session.adminUser.is_super_admin,
                    role: session.adminUser.role ? {
                        id: session.adminUser.role.uuid,
                        name: session.adminUser.role.name,
                        displayName: session.adminUser.role.display_name,
                        level: session.adminUser.role.level
                    } : null,
                    permissions: session.adminUser.is_super_admin ? ['*'] :
                        session.adminUser.role ? session.adminUser.role.permissions.map(p => p.name) : []
                },
                sessionId: session.uuid
            };

            // Cache session
            await this.cache.set(
                `admin:session:${sessionId}`,
                sessionData,
                this.cacheTTL
            );

            return sessionData;
        } catch (error) {
            this.logger.error('Session validation failed', { error: error.message, sessionId });
            throw error;
        }
    }

    /**
     * Refresh admin token
     */
    async refreshToken(refreshToken) {
        try {
            const decoded = this.jwtService.verifyRefreshToken(refreshToken);
            
            const session = await AdminSession.findOne({
                where: {
                    uuid: decoded.sessionId,
                    is_active: true
                }
            });

            if (!session) {
                throw new Error('Invalid refresh token');
            }

            // Generate new tokens
            const tokens = this.jwtService.generateTokens({
                adminId: decoded.adminId,
                sessionId: decoded.sessionId,
                isAdmin: true
            });

            // Update session
            session.session_token = this.jwtService.hashToken(tokens.accessToken);
            session.refresh_token = this.jwtService.hashToken(tokens.refreshToken);
            await session.save();

            // Clear cache
            await this.cache.delete(`admin:session:${session.uuid}`);

            return {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: tokens.expiresIn
            };
        } catch (error) {
            this.logger.error('Admin refresh token failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Check admin permission
     */
    async hasPermission(adminId, permission) {
        try {
            const admin = await AdminUser.findByPk(adminId, {
                include: [{
                    model: AdminRole,
                    as: 'role',
                    include: [{
                        model: AdminPermission,
                        as: 'permissions',
                        through: { attributes: [] }
                    }]
                }]
            });

            if (!admin) return false;
            if (admin.is_super_admin) return true;

            if (!admin.role) return false;
            const permissions = admin.role.permissions.map(p => p.name);
            
            return permissions.includes('*') || permissions.includes(permission);
        } catch (error) {
            this.logger.error('Permission check failed', { error: error.message, adminId, permission });
            return false;
        }
    }

    /**
     * Get admin by ID
     */
    async getAdminById(adminId) {
        try {
            const admin = await AdminUser.findByPk(adminId, {
                include: [{
                    model: AdminRole,
                    as: 'role',
                    include: [{
                        model: AdminPermission,
                        as: 'permissions',
                        through: { attributes: [] }
                    }]
                }]
            });

            if (!admin) return null;

            return {
                id: admin.uuid,
                username: admin.username,
                displayName: admin.display_name,
                email: admin.email,
                isSuperAdmin: admin.is_super_admin,
                isActive: admin.is_active,
                role: admin.role ? {
                    id: admin.role.uuid,
                    name: admin.role.name,
                    displayName: admin.role.display_name,
                    level: admin.role.level
                } : null,
                permissions: admin.is_super_admin ? ['*'] :
                    admin.role ? admin.role.permissions.map(p => p.name) : [],
                lastLoginAt: admin.last_login_at,
                createdAt: admin.created_at
            };
        } catch (error) {
            this.logger.error('Failed to get admin', { error: error.message, adminId });
            return null;
        }
    }

    /**
     * Get admin sessions
     */
    async getAdminSessions(adminId) {
        try {
            const sessions = await AdminSession.findAll({
                where: {
                    admin_user_id: adminId,
                    is_active: true
                },
                order: [['created_at', 'DESC']]
            });

            return sessions.map(s => ({
                id: s.uuid,
                ip: s.ip,
                location: s.location,
                userAgent: s.user_agent,
                createdAt: s.created_at,
                lastActivityAt: s.last_activity_at,
                expiresAt: s.expires_at
            }));
        } catch (error) {
            this.logger.error('Failed to get admin sessions', { error: error.message, adminId });
            return [];
        }
    }
}

// Singleton instance
let adminAuthServiceInstance = null;

const getAdminAuthService = async () => {
    if (!adminAuthServiceInstance) {
        adminAuthServiceInstance = new AdminAuthService();
        await adminAuthServiceInstance.initialize();
    }
    return adminAuthServiceInstance;
};

module.exports = {
    AdminAuthService,
    getAdminAuthService
};