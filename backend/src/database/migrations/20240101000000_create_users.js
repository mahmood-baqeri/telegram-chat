module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('users', {
            id: {
                type: Sequelize.BIGINT,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            uuid: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                unique: true,
                allowNull: false
            },
            phone: {
                type: Sequelize.STRING(20),
                unique: true,
                allowNull: false
            },
            phone_country: {
                type: Sequelize.STRING(5),
                defaultValue: 'IR'
            },
            phone_verified: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            display_name: {
                type: Sequelize.STRING(100),
                allowNull: false
            },
            username: {
                type: Sequelize.STRING(32),
                unique: true,
                allowNull: true
            },
            bio: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            avatar_url: {
                type: Sequelize.STRING(500),
                allowNull: true
            },
            avatar_thumb: {
                type: Sequelize.STRING(500),
                allowNull: true
            },
            avatar_hash: {
                type: Sequelize.STRING(32),
                allowNull: true
            },
            language: {
                type: Sequelize.STRING(10),
                defaultValue: 'fa'
            },
            timezone: {
                type: Sequelize.STRING(50),
                defaultValue: 'Asia/Tehran'
            },
            country: {
                type: Sequelize.STRING(5),
                allowNull: true
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            is_verified: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            verified_badge_type: {
                type: Sequelize.STRING(20),
                allowNull: true
            },
            is_premium: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            premium_level: {
                type: Sequelize.TINYINT,
                defaultValue: 0
            },
            premium_until: {
                type: Sequelize.DATE,
                allowNull: true
            },
            role: {
                type: Sequelize.STRING(30),
                defaultValue: 'member'
            },
            last_seen_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            last_activity_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            last_login_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            last_login_ip: {
                type: Sequelize.STRING(45),
                allowNull: true
            },
            status: {
                type: Sequelize.ENUM('online', 'offline', 'invisible'),
                defaultValue: 'offline'
            },
            metadata: {
                type: Sequelize.JSON,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW,
                allowNull: false
            },
            updated_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW,
                allowNull: false
            },
            deleted_at: {
                type: Sequelize.DATE,
                allowNull: true
            }
        });

        // Create indexes
        await queryInterface.addIndex('users', ['phone']);
        await queryInterface.addIndex('users', ['username']);
        await queryInterface.addIndex('users', ['uuid']);
        await queryInterface.addIndex('users', ['display_name']);
        await queryInterface.addIndex('users', ['is_active']);
        await queryInterface.addIndex('users', ['is_verified']);
        await queryInterface.addIndex('users', ['is_premium']);
        await queryInterface.addIndex('users', ['role']);
        await queryInterface.addIndex('users', ['last_seen_at']);
        await queryInterface.addIndex('users', ['last_activity_at']);
        await queryInterface.addIndex('users', ['status']);
        await queryInterface.addIndex('users', ['created_at']);
        
        // Full-text index
        await queryInterface.sequelize.query(
            'CREATE FULLTEXT INDEX idx_user_search ON users(display_name, username, bio)'
        );
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('users');
    }
};