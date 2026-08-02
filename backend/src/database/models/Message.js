const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');
const User = require('./User');
const Chat = require('./Chat');

const Message = sequelize.define('Message', {
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
        allowNull: false,
        references: {
            model: 'chats',
            key: 'id'
        }
    },
    sender_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    reply_to_message_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: {
            model: 'messages',
            key: 'id'
        }
    },
    message_type: {
        type: DataTypes.ENUM(
            'text', 'emoji', 'sticker', 'gif', 'image', 'video',
            'audio', 'voice', 'document', 'contact', 'location',
            'poll', 'quiz', 'link', 'forwarded', 'reply',
            'scheduled', 'system', 'service', 'deleted'
        ),
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
    mentions: {
        type: DataTypes.JSON,
        allowNull: true
    },
    hashtags: {
        type: DataTypes.JSON,
        allowNull: true
    },
    links: {
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
    status: {
        type: DataTypes.ENUM('pending', 'uploading', 'sent', 'delivered', 'seen', 'edited', 'deleted', 'failed', 'retrying'),
        defaultValue: 'sent'
    },
    delivered_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    seen_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    seen_by: {
        type: DataTypes.JSON,
        allowNull: true
    },
    delivered_to: {
        type: DataTypes.JSON,
        allowNull: true
    },
    edited_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    edited_version: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    is_forwarded: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    forward_from_message_id: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    forward_from_user_id: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    forward_from_chat_id: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    forward_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    is_reply: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    reply_preview: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    is_scheduled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    scheduled_for: {
        type: DataTypes.DATE,
        allowNull: true
    },
    is_silent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_encrypted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    encryption_key: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    deleted_for_everyone: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    deleted_by_id: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    reaction_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    reply_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    forward_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    view_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'messages',
    paranoid: true,
    indexes: [
        { fields: ['chat_id'] },
        { fields: ['sender_id'] },
        { fields: ['message_type'] },
        { fields: ['status'] },
        { fields: ['created_at'] },
        { fields: ['delivered_at'] },
        { fields: ['seen_at'] },
        { fields: ['scheduled_for'] },
        { fields: ['is_deleted'] },
        { fields: ['is_forwarded'] },
        { fields: ['is_reply'] },
        { fields: ['created_at'] },
        {
            fields: ['content'],
            type: 'FULLTEXT'
        }
    ]
});

Message.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
Message.belongsTo(Message, { foreignKey: 'reply_to_message_id', as: 'replyTo' });

Message.prototype.isOwn = function(userId) {
    return this.sender_id === userId;
};

Message.prototype.canEdit = function(userId, timeLimit = 86400) {
    if (!this.isOwn(userId)) return false;
    if (this.is_deleted) return false;
    if (this.edited_at) {
        const diff = (Date.now() - new Date(this.edited_at)) / 1000;
        if (diff > timeLimit) return false;
    }
    return true;
};

Message.prototype.canDeleteForEveryone = function(userId, timeLimit = 86400) {
    if (!this.isOwn(userId)) return false;
    if (this.is_deleted) return false;
    const diff = (Date.now() - new Date(this.created_at)) / 1000;
    return diff <= timeLimit;
};

Message.prototype.toJSON = function() {
    const values = { ...this.get() };
    delete values.id;
    delete values.sender_id;
    delete values.chat_id;
    delete values.reply_to_message_id;
    delete values.forward_from_message_id;
    delete values.forward_from_user_id;
    delete values.forward_from_chat_id;
    delete values.deleted_by_id;
    delete values.encryption_key;
    return values;
};

module.exports = Message;