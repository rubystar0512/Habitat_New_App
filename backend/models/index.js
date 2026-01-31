const { sequelize } = require('../config/database');
const User = require('./User');
const GitRepo = require('./GitRepo');
const Commit = require('./Commit');
const CommitFile = require('./CommitFile');
const UserHabitatAccount = require('./UserHabitatAccount');
const AccountRepoMapping = require('./AccountRepoMapping');
const Reservation = require('./Reservation');
const MemoCommit = require('./MemoCommit');
const CommitStatusCache = require('./CommitStatusCache');
const CommitDependencyAnalysis = require('./CommitDependencyAnalysis');
const CommitTestAnalysis = require('./CommitTestAnalysis');
const ReservationAuditLog = require('./ReservationAuditLog');
const CommitFavorite = require('./CommitFavorite');
const CommitFileStatsCache = require('./CommitFileStatsCache');
const SuccessfulTask = require('./SuccessfulTask');

// Define associations
User.hasMany(UserHabitatAccount, { foreignKey: 'user_id', as: 'habitatAccounts' });
UserHabitatAccount.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Reservation, { foreignKey: 'user_id', as: 'reservations' });
Reservation.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(MemoCommit, { foreignKey: 'user_id', as: 'memoCommits' });
MemoCommit.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(CommitFavorite, { foreignKey: 'user_id', as: 'favorites' });
CommitFavorite.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(SuccessfulTask, { foreignKey: 'user_id', as: 'submittedTasks' });
SuccessfulTask.belongsTo(User, { foreignKey: 'user_id', as: 'submitter' });

User.hasMany(SuccessfulTask, { foreignKey: 'approved_by', as: 'approvedTasks' });
SuccessfulTask.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });

GitRepo.hasMany(Commit, { foreignKey: 'repo_id', as: 'commits' });
Commit.belongsTo(GitRepo, { foreignKey: 'repo_id', as: 'repo' });

Commit.hasMany(CommitFile, { foreignKey: 'commit_id', as: 'commitFiles' });
CommitFile.belongsTo(Commit, { foreignKey: 'commit_id', as: 'commit' });

Commit.hasOne(CommitDependencyAnalysis, { foreignKey: 'commit_id', as: 'dependencyAnalysis' });
CommitDependencyAnalysis.belongsTo(Commit, { foreignKey: 'commit_id', as: 'commit' });

Commit.hasOne(CommitTestAnalysis, { foreignKey: 'commit_id', as: 'testAnalysis' });
CommitTestAnalysis.belongsTo(Commit, { foreignKey: 'commit_id', as: 'commit' });

Commit.hasOne(CommitFileStatsCache, { foreignKey: 'commit_id', as: 'fileStatsCache' });
CommitFileStatsCache.belongsTo(Commit, { foreignKey: 'commit_id', as: 'commit' });

Commit.hasMany(CommitFavorite, { foreignKey: 'commit_id', as: 'favorites' });
CommitFavorite.belongsTo(Commit, { foreignKey: 'commit_id', as: 'commit' });

Commit.hasMany(SuccessfulTask, { foreignKey: 'commit_id', as: 'successfulTasks' });
SuccessfulTask.belongsTo(Commit, { foreignKey: 'commit_id', as: 'commit' });

Commit.hasMany(CommitStatusCache, { foreignKey: 'commit_id', as: 'statusCache' });
CommitStatusCache.belongsTo(Commit, { foreignKey: 'commit_id', as: 'commit' });

UserHabitatAccount.hasMany(CommitStatusCache, { foreignKey: 'account_id', as: 'statusCache' });
CommitStatusCache.belongsTo(UserHabitatAccount, { foreignKey: 'account_id', as: 'account' });

UserHabitatAccount.hasMany(Reservation, { foreignKey: 'account_id', as: 'reservations' });
Reservation.belongsTo(UserHabitatAccount, { foreignKey: 'account_id', as: 'account' });

UserHabitatAccount.belongsToMany(GitRepo, {
  through: AccountRepoMapping,
  foreignKey: 'account_id',
  otherKey: 'repo_id',
  as: 'repos'
});

GitRepo.belongsToMany(UserHabitatAccount, {
  through: AccountRepoMapping,
  foreignKey: 'repo_id',
  otherKey: 'account_id',
  as: 'accounts'
});

Commit.hasMany(MemoCommit, { foreignKey: 'commit_id', as: 'memoCommits' });
MemoCommit.belongsTo(Commit, { foreignKey: 'commit_id', as: 'commit' });

Commit.hasMany(Reservation, { foreignKey: 'commit_id', as: 'reservations' });
Reservation.belongsTo(Commit, { foreignKey: 'commit_id', as: 'commit' });

module.exports = {
  sequelize,
  User,
  GitRepo,
  Commit,
  CommitFile,
  UserHabitatAccount,
  AccountRepoMapping,
  Reservation,
  MemoCommit,
  CommitStatusCache,
  CommitDependencyAnalysis,
  CommitTestAnalysis,
  ReservationAuditLog,
  CommitFavorite,
  CommitFileStatsCache,
  SuccessfulTask
};
