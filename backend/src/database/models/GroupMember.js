const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GroupMember = sequelize.define('GroupMember', {
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
    group_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    user_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    role_id: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    custom_role: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('active', 'invited', 'pending', 'banned', 'muted', 'left', 'restricted'),
        defaultValue: 'active'
    },
    joined_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    last_active_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    muted_until: {
        type: DataTypes.DATE,
        allowNull: true
    },
    restricted_until: {
        type: DataTypes.DATE,
        allowNull: true
    },
    banned_reason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    banned_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    banned_by_id: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    invited_by_id: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    approved_by_id: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    approved_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    notification_settings: {
        type: DataTypes.JSON,
        allowNull: true
    },
    is_pinned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'group_members',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['group_id'] },
        { fields: ['user_id'] },
        { fields: ['role_id'] },
        { fields: ['status'] },
        { fields: ['joined_at'] },
        { fields: ['last_active_at'] },
        { fields: ['muted_until'] }
    ]
});

module.exports = GroupMember;