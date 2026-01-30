const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GitRepo = sequelize.define('GitRepo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  repoName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'repo_name'
  },
  fullName: {
    type: DataTypes.STRING(200),
    allowNull: false,
    field: 'full_name'
  },
  habitatRepoId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'habitat_repo_id'
  },
  defaultBranch: {
    type: DataTypes.STRING(50),
    defaultValue: 'main',
    field: 'default_branch'
  },
  cutoffDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'cutoff_date'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  clonedPath: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'cloned_path'
  },
  lastFetchedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_fetched_at'
  },
  fetchStatus: {
    type: DataTypes.ENUM('idle', 'fetching', 'error'),
    defaultValue: 'idle',
    field: 'fetch_status'
  },
  fetchErrorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'fetch_error_message'
  },
  totalCommitsFetched: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_commits_fetched'
  }
}, {
  tableName: 'git_repos',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['repo_name'] },
    { fields: ['full_name'] },
    { fields: ['is_active'] },
    { fields: ['habitat_repo_id'] },
    { fields: ['fetch_status'] }
  ]
});

module.exports = GitRepo;
