const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MemoCommit = sequelize.define('MemoCommit', {
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
  commitId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'commit_id',
    references: {
      model: 'commits',
      key: 'id'
    }
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'memo_commits',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['user_id', 'commit_id'] },
    { fields: ['user_id'] },
    { fields: ['commit_id'] },
    { fields: ['priority'] }
  ]
});

module.exports = MemoCommit;
