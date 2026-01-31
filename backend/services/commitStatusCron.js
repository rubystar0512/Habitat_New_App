const cron = require('node-cron');
const { UserHabitatAccount, GitRepo, Commit, CommitStatusCache } = require('../models');
const habitatApi = require('./habitatApi');

class CommitStatusCronService {
  constructor() {
    this.job = null;
    this.isRunning = false;
    // Default: run every 5 minutes
    this.cronSchedule = process.env.COMMIT_STATUS_CRON_SCHEDULE || '*/5 * * * *';
  }

  /**
   * Start the cron service
   */
  async start() {
    if (this.isRunning) {
      console.log('[CommitStatusCron] Service already running');
      return;
    }

    console.log(`[CommitStatusCron] Starting service with schedule: ${this.cronSchedule}`);
    this.isRunning = true;

    // Schedule the cron job
    this.job = cron.schedule(
      this.cronSchedule,
      async () => {
        await this.fetchAllCommitStatuses();
      },
      {
        scheduled: true,
        timezone: 'UTC'
      }
    );

    // Run immediately on startup (optional - comment out if you don't want this)
    // await this.fetchAllCommitStatuses();

    console.log('[CommitStatusCron] Service started');
  }

  /**
   * Fetch commit statuses for all active accounts and repos
   */
  async fetchAllCommitStatuses() {
    console.log('[CommitStatusCron] Starting commit status fetch...');
    const startTime = Date.now();

    try {
      // Get all active Habitat accounts
      const accounts = await UserHabitatAccount.findAll({
        where: { isActive: true },
        attributes: ['id', 'userId', 'apiUrl', 'apiToken', 'accountName']
      });

      if (accounts.length === 0) {
        console.log('[CommitStatusCron] No active accounts found');
        return;
      }

      console.log(`[CommitStatusCron] Found ${accounts.length} active account(s)`);

      let totalUpdated = 0;
      let totalErrors = 0;

      // Process each account
      for (const account of accounts) {
        try {
          const updated = await this.fetchCommitStatusesForAccount(account);
          totalUpdated += updated;
        } catch (error) {
          console.error(`[CommitStatusCron] Error processing account ${account.id} (${account.accountName}):`, error.message);
          totalErrors++;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[CommitStatusCron] Completed in ${duration}ms. Updated ${totalUpdated} status(es), ${totalErrors} error(s)`);
    } catch (error) {
      console.error('[CommitStatusCron] Error in fetchAllCommitStatuses:', error);
    }
  }

  /**
   * Fetch commit statuses for a specific account
   */
  async fetchCommitStatusesForAccount(account) {
    if (!account.apiToken) {
      console.log(`[CommitStatusCron] Account ${account.id} has no apiToken, skipping`);
      return 0;
    }

    const apiUrl = account.apiUrl || 'https://code.habitat.inc';
    let updatedCount = 0;

    try {
      // Get all repos that have a habitat_repo_id
      const repos = await GitRepo.findAll({
        where: {
          habitatRepoId: { [require('sequelize').Op.not]: null }
        },
        attributes: ['id', 'habitatRepoId', 'repoName', 'fullName']
      });

      if (repos.length === 0) {
        console.log(`[CommitStatusCron] No repos with habitat_repo_id found for account ${account.id}`);
        return 0;
      }

      // Process each repo
      for (const repo of repos) {
        try {
          const updated = await this.fetchCommitStatusesForRepo(account, repo, apiUrl);
          updatedCount += updated;
        } catch (error) {
          console.error(`[CommitStatusCron] Error fetching statuses for repo ${repo.id} (${repo.repoName}):`, error.message);
        }
      }
    } catch (error) {
      console.error(`[CommitStatusCron] Error processing account ${account.id}:`, error);
      throw error;
    }

    return updatedCount;
  }

  /**
   * Fetch commit statuses for a specific repo and account
   */
  async fetchCommitStatusesForRepo(account, repo, apiUrl) {
    try {
      // Call Habitat API to get unavailable commits
      const result = await habitatApi.getUnavailableCommits(
        account.apiToken,
        apiUrl,
        repo.habitatRepoId
      );

      if (!result.success) {
        console.error(`[CommitStatusCron] API error for repo ${repo.id}: ${result.error}`);
        return 0;
      }

      // Parse the CSV response (Habitat API returns CSV)
      const unavailableCommits = this.parseUnavailableCommitsCSV(result.commits || result.data || '');

      if (unavailableCommits.size === 0) {
        // No unavailable commits means all commits are available
        // We can optionally update all commits for this repo/account to 'available'
        // For now, we'll just skip
        return 0;
      }

      // Get all commits for this repo
      const commits = await Commit.findAll({
        where: { repoId: repo.id },
        attributes: ['id', 'baseCommit']
      });

      let updatedCount = 0;

      // Update status cache for each commit
      for (const commit of commits) {
        const statusInfo = unavailableCommits.get(commit.baseCommit);

        if (statusInfo) {
          // Commit is unavailable - update cache
          const apiStatus = (statusInfo.status || '').trim();
          const expiresAt = statusInfo.expires_at ? new Date(statusInfo.expires_at) : null;

          // Map 'reserved' to 'already_reserved' for consistency
          const mappedStatus = apiStatus === 'reserved' ? 'already_reserved' : apiStatus;

          // Upsert status cache
          await CommitStatusCache.upsert({
            commitId: commit.id,
            accountId: account.id,
            status: mappedStatus || 'unavailable',
            expiresAt: expiresAt,
            checkedAt: new Date()
          }, {
            conflictFields: ['commit_id', 'account_id']
          });

          updatedCount++;
        } else {
          // Commit is available - update cache to 'available'
          await CommitStatusCache.upsert({
            commitId: commit.id,
            accountId: account.id,
            status: 'available',
            expiresAt: null,
            checkedAt: new Date()
          }, {
            conflictFields: ['commit_id', 'account_id']
          });

          updatedCount++;
        }
      }

      return updatedCount;
    } catch (error) {
      console.error(`[CommitStatusCron] Error fetching statuses for repo ${repo.id}:`, error);
      throw error;
    }
  }

  /**
   * Parse CSV response from Habitat API
   * Format: commit_hash,status,expires_at (optional header row)
   */
  parseUnavailableCommitsCSV(csvText) {
    const statusMap = new Map();

    if (!csvText || typeof csvText !== 'string') {
      return statusMap;
    }

    const lines = csvText.trim().split('\n');
    if (lines.length === 0) {
      return statusMap;
    }

    // Skip header row if present
    let startIdx = 0;
    if (lines[0].toLowerCase().includes('commit_hash')) {
      startIdx = 1;
    }

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 2) continue;

      const commitHash = parts[0].trim();
      const status = parts[1].trim();
      const expiresAt = parts.length > 2 && parts[2].trim() ? parts[2].trim() : undefined;

      if (commitHash && status) {
        statusMap.set(commitHash, {
          status,
          expires_at: expiresAt || undefined
        });
      }
    }

    return statusMap;
  }

  /**
   * Stop the cron service
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
    this.isRunning = false;
    console.log('[CommitStatusCron] Service stopped');
  }

  /**
   * Manually trigger a status fetch (for testing or manual refresh)
   */
  async triggerFetch() {
    console.log('[CommitStatusCron] Manual trigger requested');
    await this.fetchAllCommitStatuses();
  }
}

// Singleton instance
const commitStatusCronService = new CommitStatusCronService();

module.exports = commitStatusCronService;
