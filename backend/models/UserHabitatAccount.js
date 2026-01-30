const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserHabitatAccount = sequelize.define('UserHabitatAccount', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  accountName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'account_name'
  },
  apiToken: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'api_token'
  },
  apiUrl: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'api_url'
  },
  reverseLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 7,
    field: 'reverse_limit'
  },
  remainingReversals: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'remaining_reversals'
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_used_at'
  },
  totalReservationsMade: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_reservations_made'
  },
  failedReservations: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'failed_reservations'
  },
  accountHealth: {
    type: DataTypes.ENUM('healthy', 'warning', 'error', 'unknown'),
    defaultValue: 'unknown',
    field: 'account_health'
  },
  healthLastChecked: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'health_last_checked'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'user_habitat_accounts',
  timestamps: true,
  underscored: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['account_name'] },
    { fields: ['is_active'] },
    { fields: ['account_health'] }
  ]
});

module.exports = UserHabitatAccount;
