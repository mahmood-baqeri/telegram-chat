const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduledMessage = sequelize.define('ScheduledMessage', {
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
    sender_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    message_type: {
        type: DataTypes.STRING(30),
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
    media: {
        type: DataTypes.JSON,
        allowNull: true
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true
    },
    scheduled_for: {
        type: DataTypes.DATE,
        allowNull: false
    },
    is_repeating: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    repeat_interval: {
        type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
        allowNull: true
    },
    repeat_until: {
        type: DataTypes.DATE,
        allowNull: true
    },
    is_sent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    sent_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    is_cancelled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    cancelled_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'scheduled_messages',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['chat_id'] },
        { fields: ['scheduled_for'] },
        { fields: ['is_sent'] },
        { fields: ['is_cancelled'] }
    ]
});

module.exports = ScheduledMessage;