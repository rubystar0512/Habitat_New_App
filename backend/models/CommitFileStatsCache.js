const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CommitFileStatsCache = sequelize.define('CommitFileStatsCache', {
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
  nonTestFileCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'non_test_file_count'
  },
  testFileCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'test_file_count'
  },
  totalFileCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_file_count'
  },
  minNonTestAdditions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'min_non_test_additions'
  },
  maxNonTestAdditions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'max_non_test_additions'
  },
  avgNonTestAdditions: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'avg_non_test_additions'
  },
  totalNonTestAdditions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_non_test_additions'
  },
  singleFile200plus: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'single_file_200plus'
  },
  singleFile500plus: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'single_file_500plus'
  },
  multiFile300plus: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'multi_file_300plus'
  },
  allFiles200plus: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'all_files_200plus'
  }
}, {
  tableName: 'commit_file_stats_cache',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['commit_id'] },
    { fields: ['single_file_200plus'] },
    { fields: ['multi_file_300plus'] },
    { fields: ['all_files_200plus'] }
  ]
});

module.exports = CommitFileStatsCache;
