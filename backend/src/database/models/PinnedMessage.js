const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PinnedMessage = sequelize.define('PinnedMessage', {
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
    message_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    pinned_by_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    pinned_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'pinned_messages',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['chat_id'] },
        { fields: ['pinned_at'] }
    ]
});

module.exports = PinnedMessage;