const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash'
  },
  role: {
    type: DataTypes.ENUM('admin', 'user'),
    defaultValue: 'user'
  },
  isApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_approved'
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login'
  },
  totalReservations: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_reservations'
  },
  successfulTasks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'successful_tasks'
  },
  failedTasks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'failed_tasks'
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: false,
  indexes: [
    { fields: ['username'] },
    { fields: ['email'] },
    { fields: ['role'] },
    { fields: ['is_approved'] }
  ]
});

module.exports = User;
