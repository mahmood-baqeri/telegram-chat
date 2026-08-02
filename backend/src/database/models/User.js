const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const User = sequelize.define('User', {
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
    phone: {
        type: DataTypes.STRING(20),
        unique: true,
        allowNull: false,
        validate: {
            is: /^[0-9]{10,15}$/
        }
    },
    phone_country: {
        type: DataTypes.STRING(5),
        defaultValue: 'IR'
    },
    phone_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    display_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            len: [1, 100]
        }
    },
    username: {
        type: DataTypes.STRING(32),
        unique: true,
        allowNull: true,
        validate: {
            is: /^[a-zA-Z0-9_]{5,32}$/
        }
    },
    bio: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
            len: [0, 500]
        }
    },
    avatar_url: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    avatar_thumb: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    avatar_hash: {
        type: DataTypes.STRING(32),
        allowNull: true
    },
    language: {
        type: DataTypes.STRING(10),
        defaultValue: 'fa'
    },
    timezone: {
        type: DataTypes.STRING(50),
        defaultValue: 'Asia/Tehran'
    },
    country: {
        type: DataTypes.STRING(5),
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    verified_badge_type: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    is_premium: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    premium_level: {
        type: DataTypes.TINYINT,
        defaultValue: 0
    },
    premium_until: {
        type: DataTypes.DATE,
        allowNull: true
    },
    role: {
        type: DataTypes.STRING(30),
        defaultValue: 'member'
    },
    last_seen_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    last_activity_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    last_login_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    last_login_ip: {
        type: DataTypes.STRING(45),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('online', 'offline', 'invisible'),
        defaultValue: 'offline'
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: 'users',
    paranoid: true,
    indexes: [
        { fields: ['phone'] },
        { fields: ['username'] },
        { fields: ['uuid'] },
        { fields: ['display_name'] },
        { fields: ['is_active'] },
        { fields: ['is_verified'] },
        { fields: ['is_premium'] },
        { fields: ['role'] },
        { fields: ['last_seen_at'] },
        { fields: ['last_activity_at'] },
        { fields: ['status'] },
        { fields: ['created_at'] }
    ]
});

// Virtual fields
User.prototype.getAvatarUrl = function() {
    if (this.avatar_url) {
        return this.avatar_url;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.display_name)}&background=2196f3&color=fff&size=200`;
};

User.prototype.getFullName = function() {
    return this.display_name;
};

User.prototype.isOnline = function() {
    return this.status === 'online';
};

User.prototype.toJSON = function() {
    const values = { ...this.get() };
    delete values.id;
    delete values.phone;
    delete values.phone_verified;
    delete values.last_login_ip;
    delete values.updated_at;
    delete values.deleted_at;
    return values;
};

module.exports = User;