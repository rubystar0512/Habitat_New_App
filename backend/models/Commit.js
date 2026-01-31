const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Commit = sequelize.define('Commit', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  repoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'repo_id',
    references: {
      model: 'git_repos',
      key: 'id'
    }
  },
  mergedCommit: {
    type: DataTypes.STRING(40),
    allowNull: false,
    field: 'merged_commit'
  },
  baseCommit: {
    type: DataTypes.STRING(40),
    allowNull: false,
    field: 'base_commit'
  },
  sourceSha: {
    type: DataTypes.STRING(40),
    allowNull: true,
    field: 'source_sha'
  },
  branch: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  author: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  commitDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'commit_date'
  },
  // File statistics (aggregate)
  fileChanges: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'file_changes'
  },
  additions: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  deletions: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  netChange: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'net_change'
  },
  testAdditions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'test_additions'
  },
  nonTestAdditions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'non_test_additions'
  },
  // Scoring
  habitateScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'habitate_score'
  },
  difficultyScore: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field: 'difficulty_score'
  },
  suitabilityScore: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field: 'suitability_score'
  },
  // Metadata
  prNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'pr_number'
  },
  isMerge: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_merge'
  },
  files: {
    type: DataTypes.JSON,
    allowNull: true
  },
  habitatSignals: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'habitat_signals'
  },
  // Quality indicators
  hasDependencyChanges: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'has_dependency_changes'
  },
  testCoverageScore: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    field: 'test_coverage_score'
  },
  complexityIndicators: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'complexity_indicators'
  },
  isBehaviorPreservingRefactor: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_behavior_preserving_refactor'
  },
  // Status tracking
  isUnsuitable: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_unsuitable'
  },
  unsuitableReason: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'unsuitable_reason'
  },
  lastStatusCheck: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_status_check'
  }
}, {
  tableName: 'commits',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['repo_id', 'base_commit'], name: 'unique_commit' },
    { fields: ['repo_id'] },
    { fields: ['merged_commit'] },
    { fields: ['base_commit'] },
    { fields: ['habitate_score'] },
    { fields: ['difficulty_score'] },
    { fields: ['suitability_score'] },
    { fields: ['has_dependency_changes'] },
    { fields: ['is_unsuitable'] },
    { fields: ['is_behavior_preserving_refactor'] },
    { fields: ['commit_date'] },
    // Indexes for commonly sorted columns to improve sort performance
    { fields: ['net_change'] },
    { fields: ['additions'] },
    { fields: ['deletions'] },
    { fields: ['file_changes'] },
    { fields: ['author'] },
    { fields: ['pr_number'] },
    // Composite index for common sort combinations
    { fields: ['habitate_score', 'net_change'] },
    { fields: ['habitate_score', 'commit_date'] }
  ]
});

module.exports = Commit;
