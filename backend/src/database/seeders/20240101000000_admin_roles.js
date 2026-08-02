module.exports = {
    up: async (queryInterface) => {
        const roles = [
            {
                uuid: '11111111-1111-1111-1111-111111111111',
                name: 'super_admin',
                display_name: 'Super Administrator',
                description: 'Full system access with all permissions',
                level: 5,
                is_system: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                uuid: '22222222-2222-2222-2222-222222222222',
                name: 'system_admin',
                display_name: 'System Administrator',
                description: 'System administration and configuration',
                level: 4,
                is_system: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                uuid: '33333333-3333-3333-3333-333333333333',
                name: 'moderator',
                display_name: 'Moderator',
                description: 'Content moderation and user management',
                level: 3,
                is_system: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                uuid: '44444444-4444-4444-4444-444444444444',
                name: 'support_agent',
                display_name: 'Support Agent',
                description: 'User support and issue resolution',
                level: 2,
                is_system: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                uuid: '55555555-5555-5555-5555-555555555555',
                name: 'viewer',
                display_name: 'Viewer',
                description: 'Read-only access',
                level: 0,
                is_system: true,
                created_at: new Date(),
                updated_at: new Date()
            }
        ];

        await queryInterface.bulkInsert('admin_roles', roles);
    },

    down: async (queryInterface) => {
        await queryInterface.bulkDelete('admin_roles', null, {});
    }
};