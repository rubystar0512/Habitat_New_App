const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CommitDependencyAnalysis = sequelize.define('CommitDependencyAnalysis', {
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
  hasDependencyChanges: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'has_dependency_changes'
  },
  dependencyType: {
    type: DataTypes.ENUM('package_json', 'requirements_txt', 'pom_xml', 'build_gradle', 'cargo_toml', 'go_mod', 'other'),
    allowNull: true,
    field: 'dependency_type'
  },
  changedFiles: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'changed_files'
  },
  analysisDetails: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'analysis_details'
  }
}, {
  tableName: 'commit_dependency_analysis',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['commit_id'] },
    { fields: ['has_dependency_changes'] },
    { fields: ['dependency_type'] }
  ]
});

module.exports = CommitDependencyAnalysis;
