const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db.postgres');

const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.STRING(128),
    primaryKey: true,
    allowNull: false,
    comment: 'Firebase UID'
  },
  email: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false,
    validate: {
      isEmail: true,
    },
  },
  first_name: {
    type: DataTypes.STRING(100),
  },
  last_name: {
    type: DataTypes.STRING(100),
  },
  phone_number: {
    type: DataTypes.STRING(20),
  },
  is_admin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'users',
  timestamps: true, // Adds createdAt and updatedAt
});

module.exports = User;