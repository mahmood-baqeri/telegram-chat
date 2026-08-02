const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');
const User = require('./User');

const Session = sequelize.define('Session', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        unique: true,
        allowNull: false
    },
    user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    device_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: {
            model: 'devices',
            key: 'id'
        }
    },
    session_token: {
        type: DataTypes.STRING(500),
        unique: true,
        allowNull: false
    },
    refresh_token: {
        type: DataTypes.STRING(500),
        unique: true,
        allowNull: true
    },
    access_token: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    push_token: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    ip: {
        type: DataTypes.STRING(45),
        allowNull: true
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    location: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    browser: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    os: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    device_type: {
        type: DataTypes.ENUM('mobile', 'desktop', 'web'),
        allowNull: true
    },
    is_trusted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    last_activity_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'sessions',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['user_id'] },
        { fields: ['device_id'] },
        { fields: ['session_token'] },
        { fields: ['refresh_token'] },
        { fields: ['is_active'] },
        { fields: ['expires_at'] },
        { fields: ['last_activity_at'] }
    ]
});

Session.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Session.prototype.isExpired = function() {
    if (!this.expires_at) return false;
    return new Date() > this.expires_at;
};

Session.prototype.toJSON = function() {
    const values = { ...this.get() };
    delete values.id;
    delete values.user_id;
    delete values.device_id;
    delete values.session_token;
    delete values.refresh_token;
    delete values.access_token;
    delete values.push_token;
    delete values.ip;
    delete values.user_agent;
    return values;
};

module.exports = Session;