const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CommitFavorite = sequelize.define('CommitFavorite', {
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
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'commit_favorites',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['user_id', 'commit_id'], name: 'unique_user_commit' },
    { fields: ['user_id'] },
    { fields: ['commit_id'] }
  ]
});

module.exports = CommitFavorite;
