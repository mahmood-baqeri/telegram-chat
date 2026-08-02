module.exports = {
    up: async (queryInterface) => {
        const permissions = [
            // User permissions
            { uuid: 'a0000000-0000-0000-0000-000000000001', name: 'user.view', display_name: 'View Users', description: 'View user profiles', category: 'user', resource: 'user', action: 'view', created_at: new Date() },
            { uuid: 'a0000000-0000-0000-0000-000000000002', name: 'user.edit', display_name: 'Edit Users', description: 'Edit user profiles', category: 'user', resource: 'user', action: 'edit', created_at: new Date() },
            { uuid: 'a0000000-0000-0000-0000-000000000003', name: 'user.manage', display_name: 'Manage Users', description: 'Full user management', category: 'user', resource: 'user', action: 'manage', created_at: new Date() },
            
            // Group permissions
            { uuid: 'a0000000-0000-0000-0000-000000000004', name: 'group.view', display_name: 'View Groups', description: 'View group details', category: 'group', resource: 'group', action: 'view', created_at: new Date() },
            { uuid: 'a0000000-0000-0000-0000-000000000005', name: 'group.edit', display_name: 'Edit Groups', description: 'Edit group details', category: 'group', resource: 'group', action: 'edit', created_at: new Date() },
            { uuid: 'a0000000-0000-0000-0000-000000000006', name: 'group.manage', display_name: 'Manage Groups', description: 'Full group management', category: 'group', resource: 'group', action: 'manage', created_at: new Date() },
            
            // Channel permissions
            { uuid: 'a0000000-0000-0000-0000-000000000007', name: 'channel.view', display_name: 'View Channels', description: 'View channel details', category: 'channel', resource: 'channel', action: 'view', created_at: new Date() },
            { uuid: 'a0000000-0000-0000-0000-000000000008', name: 'channel.edit', display_name: 'Edit Channels', description: 'Edit channel details', category: 'channel', resource: 'channel', action: 'edit', created_at: new Date() },
            { uuid: 'a0000000-0000-0000-0000-000000000009', name: 'channel.manage', display_name: 'Manage Channels', description: 'Full channel management', category: 'channel', resource: 'channel', action: 'manage', created_at: new Date() },
            
            // Feature permissions
            { uuid: 'a0000000-0000-0000-0000-000000000010', name: 'feature.view', display_name: 'View Features', description: 'View feature toggles', category: 'feature', resource: 'feature', action: 'view', created_at: new Date() },
            { uuid: 'a0000000-0000-0000-0000-000000000011', name: 'feature.toggle', display_name: 'Toggle Features', description: 'Enable/disable features', category: 'feature', resource: 'feature', action: 'toggle', created_at: new Date() },
            { uuid: 'a0000000-0000-0000-0000-000000000012', name: 'feature.manage', display_name: 'Manage Features', description: 'Full feature management', category: 'feature', resource: 'feature', action: 'manage', created_at: new Date() },
            
            // Report permissions
            { uuid: 'a0000000-0000-0000-0000-000000000013', name: 'reports.view', display_name: 'View Reports', description: 'View user reports', category: 'report', resource: 'report', action: 'view', created_at: new Date() },
            { uuid: 'a0000000-0000-0000-0000-000000000014', name: 'reports.resolve', display_name: 'Resolve Reports', description: 'Resolve user reports', category: 'report', resource: 'report', action: 'resolve', created_at: new Date() },
            
            // Audit permissions
            { uuid: 'a0000000-0000-0000-0000-000000000015', name: 'audit.view', display_name: 'View Audit Logs', description: 'View audit logs', category: 'audit', resource: 'audit', action: 'view', created_at: new Date() },
            { uuid: 'a0000000-0000-0000-0000-000000000016', name: 'audit.export', display_name: 'Export Audit Logs', description: 'Export audit logs', category: 'audit', resource: 'audit', action: 'export', created_at: new Date() },
            
            // Analytics permissions
            { uuid: 'a0000000-0000-0000-0000-000000000017', name: 'analytics.view', display_name: 'View Analytics', description: 'View system analytics', category: 'analytics', resource: 'analytics', action: 'view', created_at: new Date() },
            { uuid: 'a0000000-0000-0000-0000-000000000018', name: 'analytics.export', display_name: 'Export Analytics', description: 'Export analytics data', category: 'analytics', resource: 'analytics', action: 'export', created_at: new Date() },
            
            // Backup permissions
            { uuid: 'a0000000-0000-0000-0000-000000000019', name: 'backup.view', display_name: 'View Backups', description: 'View backup jobs', category: 'backup', resource: 'backup', action: 'view', created_at: new Date() },
            { uuid: 'a0000000-0000-0000-0000-000000000020', name: 'backup.create', display_name: 'Create Backups', description: 'Create backup jobs', category: 'backup', resource: 'backup', action: 'create', created_at: new Date() },
            { uuid: 'a0000000-0000-0000-0000-000000000021', name: 'backup.restore', display_name: 'Restore Backups', description: 'Restore from backup', category: 'backup', resource: 'backup', action: 'restore', created_at: new Date() }
        ];

        await queryInterface.bulkInsert('admin_permissions', permissions);
    },

    down: async (queryInterface) => {
        await queryInterface.bulkDelete('admin_permissions', null, {});
    }
};