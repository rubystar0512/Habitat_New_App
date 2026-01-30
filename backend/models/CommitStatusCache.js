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
    unique: true,
    field: 'commit_id',
    references: {
      model: 'commits',
      key: 'id'
    }
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_available'
  },
  cachedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'cached_at'
  }
}, {
  tableName: 'commit_status_cache',
  timestamps: false,
  underscored: false,
  indexes: [
    { unique: true, fields: ['commit_id'] },
    { fields: ['is_available'] },
    { fields: ['cached_at'] }
  ]
});

module.exports = CommitStatusCache;
