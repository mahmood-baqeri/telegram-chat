module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('sessions', {
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
            user_id: {
                type: Sequelize.BIGINT,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            device_id: {
                type: Sequelize.BIGINT,
                allowNull: true,
                references: {
                    model: 'devices',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            },
            session_token: {
                type: Sequelize.STRING(500),
                unique: true,
                allowNull: false
            },
            refresh_token: {
                type: Sequelize.STRING(500),
                unique: true,
                allowNull: true
            },
            access_token: {
                type: Sequelize.STRING(500),
                allowNull: true
            },
            push_token: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            ip: {
                type: Sequelize.STRING(45),
                allowNull: true
            },
            user_agent: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            location: {
                type: Sequelize.STRING(100),
                allowNull: true
            },
            browser: {
                type: Sequelize.STRING(50),
                allowNull: true
            },
            os: {
                type: Sequelize.STRING(50),
                allowNull: true
            },
            device_type: {
                type: Sequelize.ENUM('mobile', 'desktop', 'web'),
                allowNull: true
            },
            is_trusted: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            last_activity_at: {
                type: Sequelize.DATE,
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
            }
        });

        await queryInterface.addIndex('sessions', ['user_id']);
        await queryInterface.addIndex('sessions', ['device_id']);
        await queryInterface.addIndex('sessions', ['session_token']);
        await queryInterface.addIndex('sessions', ['refresh_token']);
        await queryInterface.addIndex('sessions', ['is_active']);
        await queryInterface.addIndex('sessions', ['expires_at']);
        await queryInterface.addIndex('sessions', ['last_activity_at']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('sessions');
    }
};