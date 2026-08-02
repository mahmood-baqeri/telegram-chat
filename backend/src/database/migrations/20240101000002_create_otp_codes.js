module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('otp_codes', {
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
                allowNull: false
            },
            code: {
                type: Sequelize.STRING(10),
                allowNull: false
            },
            country: {
                type: Sequelize.STRING(5),
                allowNull: true
            },
            provider: {
                type: Sequelize.STRING(50),
                allowNull: true
            },
            attempts: {
                type: Sequelize.TINYINT,
                defaultValue: 0
            },
            max_attempts: {
                type: Sequelize.TINYINT,
                defaultValue: 5
            },
            is_verified: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            verified_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false
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

        await queryInterface.addIndex('otp_codes', ['phone']);
        await queryInterface.addIndex('otp_codes', ['code']);
        await queryInterface.addIndex('otp_codes', ['is_verified']);
        await queryInterface.addIndex('otp_codes', ['expires_at']);
        await queryInterface.addIndex('otp_codes', ['created_at']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('otp_codes');
    }
};