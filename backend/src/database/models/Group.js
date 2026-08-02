const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Group = sequelize.define('Group', {
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
    username: {
        type: DataTypes.STRING(32),
        unique: true,
        allowNull: true
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    group_type: {
        type: DataTypes.ENUM('normal', 'super', 'enterprise', 'support', 'learning', 'project', 'announcement', 'custom'),
        defaultValue: 'normal'
    },
    visibility: {
        type: DataTypes.ENUM('private', 'public', 'invite_only', 'approval_required', 'hidden'),
        defaultValue: 'private'
    },
    avatar_url: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    avatar_thumb: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    banner_url: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    owner_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    category_id: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    tags: {
        type: DataTypes.JSON,
        allowNull: true
    },
    language: {
        type: DataTypes.STRING(10),
        defaultValue: 'en'
    },
    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_premium: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    member_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    online_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    last_message_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    settings: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: 'groups',
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ['username'] },
        { fields: ['owner_id'] },
        { fields: ['group_type'] },
        { fields: ['visibility'] },
        { fields: ['category_id'] },
        { fields: ['is_verified'] },
        { fields: ['is_premium'] },
        { fields: ['is_active'] },
        { fields: ['member_count'] },
        { fields: ['last_message_at'] },
        { fields: ['created_at'] }
    ]
});

module.exports = Group;