const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CommitTestAnalysis = sequelize.define('CommitTestAnalysis', {
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
  hasTestChanges: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'has_test_changes'
  },
  testFileCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'test_file_count'
  },
  testAdditions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'test_additions'
  },
  testDeletions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'test_deletions'
  },
  estimatedCoverage: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    field: 'estimated_coverage'
  },
  testFiles: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'test_files'
  }
}, {
  tableName: 'commit_test_analysis',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['commit_id'] },
    { fields: ['has_test_changes'] }
  ]
});

module.exports = CommitTestAnalysis;
