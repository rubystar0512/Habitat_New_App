const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AccountRepoMapping = sequelize.define('AccountRepoMapping', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  accountId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'account_id',
    references: {
      model: 'user_habitat_accounts',
      key: 'id'
    }
  },
  repoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'repo_id',
    references: {
      model: 'git_repos',
      key: 'id'
    }
  }
}, {
  tableName: 'account_repo_mappings',
  timestamps: false,
  underscored: false,
  indexes: [
    { unique: true, fields: ['account_id', 'repo_id'] },
    { fields: ['account_id'] },
    { fields: ['repo_id'] }
  ]
});

module.exports = AccountRepoMapping;
