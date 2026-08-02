const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MessageReaction = sequelize.define('MessageReaction', {
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
    user_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    emoji: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    skin_tone: {
        type: DataTypes.STRING(10),
        allowNull: true
    }
}, {
    tableName: 'message_reactions',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['message_id'] },
        { fields: ['user_id'] },
        { fields: ['emoji'] }
    ]
});

module.exports = MessageReaction;