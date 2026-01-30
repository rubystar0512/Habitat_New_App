const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CommitFile = sequelize.define('CommitFile', {
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
  filePath: {
    type: DataTypes.STRING(500),
    allowNull: false,
    field: 'file_path'
  },
  fileName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'file_name'
  },
  fileDirectory: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'file_directory'
  },
  additions: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  deletions: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isTestFile: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_test_file'
  },
  isDependencyFile: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_dependency_file'
  },
  fileExtension: {
    type: DataTypes.STRING(10),
    allowNull: true,
    field: 'file_extension'
  }
}, {
  tableName: 'commit_files',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['commit_id', 'file_path'], name: 'unique_commit_file' },
    { fields: ['commit_id'] },
    { fields: ['is_test_file'] },
    { fields: ['is_dependency_file'] },
    { fields: ['file_directory'], length: 255 },
    { fields: ['commit_id', 'is_test_file', 'additions'], name: 'idx_commit_test_additions' },
    { fields: ['commit_id', 'additions'], name: 'idx_commit_additions' },
    { fields: ['is_test_file', 'additions'], name: 'idx_test_additions' }
  ]
});

module.exports = CommitFile;
