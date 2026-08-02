const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MessageDraft = sequelize.define('MessageDraft', {
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
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    rich_text: {
        type: DataTypes.JSON,
        allowNull: true
    },
    reply_to_message_id: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    media: {
        type: DataTypes.JSON,
        allowNull: true
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: 'message_drafts',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['chat_id'] },
        { fields: ['user_id'] }
    ]
});

module.exports = MessageDraft;