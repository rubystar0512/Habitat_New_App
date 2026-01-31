const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CommitStatusCache = sequelize.define('CommitStatusCache', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
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
  accountId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'account_id',
    references: {
      model: 'user_habitat_accounts',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM(
      'available',
      'reserved',
      'already_reserved',
      'unavailable',
      'too_easy',
      'paid_out',
      'pending_admin_approval',
      'failed',
      'error'
    ),
    allowNull: true,
    defaultValue: 'available'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at'
  },
  checkedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'checked_at'
  }
}, {
  tableName: 'commit_status_cache',
  timestamps: false,
  underscored: true,
  indexes: [
    { unique: true, fields: ['commit_id', 'account_id'], name: 'unique_status' },
    { fields: ['commit_id'] },
    { fields: ['account_id'] },
    { fields: ['status'] },
    { fields: ['expires_at'] },
    { fields: ['checked_at'] }
  ]
});

module.exports = CommitStatusCache;
