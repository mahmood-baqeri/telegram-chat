const { Sequelize } = require('sequelize');
const config = require('./index');

const sequelize = new Sequelize(
    config.db.name,
    config.db.user,
    config.db.password,
    {
        host: config.db.host,
        port: config.db.port,
        dialect: 'mysql',
        logging: config.env === 'development' ? console.log : false,
        pool: {
            min: config.db.poolMin,
            max: config.db.poolMax,
            acquire: 30000,
            idle: 10000
        },
        dialectOptions: {
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci'
        },
        define: {
            underscored: true,
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            deletedAt: 'deleted_at',
            paranoid: true
        },
        timezone: '+00:00'
    }
);

const initDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established successfully.');
        return sequelize;
    } catch (error) {
        console.error('❌ Unable to connect to the database:', error);
        throw error;
    }
};

module.exports = {
    sequelize,
    initDatabase
};