const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Reservation = sequelize.define('Reservation', {
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
  accountId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'account_id',
    references: {
      model: 'user_habitat_accounts',
      key: 'id'
    }
  },
  commitId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'commit_id',
    references: {
      model: 'commits',
      key: 'id'
    }
  },
  habitatReservationId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'reservation_id' // Database column is 'reservation_id'
  },
  status: {
    type: DataTypes.ENUM('reserved', 'released', 'failed', 'expired'),
    defaultValue: 'reserved',
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at'
  },
  autoRenewEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'auto_renew_enabled'
  },
  reservedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reserved_at'
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'released_at' // Database uses 'released_at' instead of 'cancelled_at'
  }
}, {
  tableName: 'reservations',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['account_id'] },
    { fields: ['commit_id'] },
    { fields: ['status'] },
    { fields: ['expires_at'] },
    { fields: ['reservation_id'] }
  ]
});

module.exports = Reservation;
