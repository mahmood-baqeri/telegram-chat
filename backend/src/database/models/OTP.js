const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const OTP = sequelize.define('OTP', {
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
        allowNull: false
    },
    code: {
        type: DataTypes.STRING(10),
        allowNull: false
    },
    country: {
        type: DataTypes.STRING(5),
        allowNull: true
    },
    provider: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    attempts: {
        type: DataTypes.TINYINT,
        defaultValue: 0
    },
    max_attempts: {
        type: DataTypes.TINYINT,
        defaultValue: 5
    },
    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    verified_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'otp_codes',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['phone'] },
        { fields: ['code'] },
        { fields: ['is_verified'] },
        { fields: ['expires_at'] },
        { fields: ['created_at'] }
    ]
});

OTP.prototype.isExpired = function() {
    return new Date() > this.expires_at;
};

OTP.prototype.canAttempt = function() {
    return this.attempts < this.max_attempts;
};

OTP.prototype.incrementAttempts = async function() {
    this.attempts += 1;
    await this.save();
};

OTP.prototype.markVerified = async function() {
    this.is_verified = true;
    this.verified_at = new Date();
    await this.save();
};

module.exports = OTP;