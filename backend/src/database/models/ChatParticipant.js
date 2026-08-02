const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChatParticipant = sequelize.define('ChatParticipant', {
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
    chat_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    user_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM('creator', 'admin', 'moderator', 'member'),
        defaultValue: 'member'
    },
    last_read_message_id: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    last_read_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    unread_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    is_muted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    muted_until: {
        type: DataTypes.DATE,
        allowNull: true
    },
    is_archived: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_pinned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    pinned_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    custom_title: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    joined_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    left_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'chat_participants',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['chat_id'] },
        { fields: ['user_id'] },
        { fields: ['role'] },
        { fields: ['unread_count'] },
        { fields: ['last_read_at'] }
    ]
});

module.exports = ChatParticipant;