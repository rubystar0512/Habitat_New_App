const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReservationAuditLog = sequelize.define('ReservationAuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  reservationId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'reservation_id',
    references: {
      model: 'reservations',
      key: 'id'
    }
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
    allowNull: true,
    field: 'account_id',
    references: {
      model: 'user_habitat_accounts',
      key: 'id'
    }
  },
  commitId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'commit_id',
    references: {
      model: 'commits',
      key: 'id'
    }
  },
  action: {
    type: DataTypes.ENUM('reserve', 'cancel', 'expire', 'sync', 'error'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('success', 'failure'),
    allowNull: false
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'reservation_audit_log',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['reservation_id'] },
    { fields: ['user_id'] },
    { fields: ['account_id'] },
    { fields: ['commit_id'] },
    { fields: ['action'] },
    { fields: ['status'] },
    { fields: ['created_at'] }
  ]
});

module.exports = ReservationAuditLog;
