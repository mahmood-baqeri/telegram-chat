const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GroupRole = sequelize.define('GroupRole', {
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
    group_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    color: {
        type: DataTypes.STRING(7),
        allowNull: true
    },
    is_system: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_default: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    level: {
        type: DataTypes.TINYINT,
        defaultValue: 0
    },
    permissions: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: 'group_roles',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['group_id'] },
        { fields: ['level'] }
    ]
});

module.exports = GroupRole;