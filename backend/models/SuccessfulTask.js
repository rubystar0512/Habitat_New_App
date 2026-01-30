const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SuccessfulTask = sequelize.define('SuccessfulTask', {
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
  taskName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'task_name'
  },
  taskDescription: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'task_description'
  },
  prNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'pr_number'
  },
  hints: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  gitBaseCommit: {
    type: DataTypes.STRING(40),
    allowNull: false,
    field: 'git_base_commit'
  },
  mergeCommit: {
    type: DataTypes.STRING(40),
    allowNull: false,
    field: 'merge_commit'
  },
  basePatch: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'base_patch'
  },
  goldenPatch: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'golden_patch'
  },
  testPatch: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'test_patch'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  approvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'approved_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'approved_at'
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rejection_reason'
  },
  aiSuccessRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field: 'ai_success_rate'
  },
  payoutAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'payout_amount'
  }
}, {
  tableName: 'successful_tasks',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['commit_id'] },
    { fields: ['status'] },
    { fields: ['task_name'] },
    { fields: ['created_at'] }
  ]
});

module.exports = SuccessfulTask;
