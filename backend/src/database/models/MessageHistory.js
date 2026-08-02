const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MessageHistory = sequelize.define('MessageHistory', {
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
    message_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    version: {
        type: DataTypes.INTEGER,
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
    edited_by_id: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    edited_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'message_history',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['message_id'] },
        { fields: ['edited_at'] }
    ]
});

module.exports = MessageHistory;