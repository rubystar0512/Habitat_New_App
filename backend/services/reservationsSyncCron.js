const cron = require('node-cron');
const { UserHabitatAccount, GitRepo, Reservation, Commit } = require('../models');
const { Op } = require('sequelize');
const habitatApiService = require('./habitatApi');

class ReservationsSyncCronService {
  constructor() {
    this.job = null;
    this.isRunning = false;
    // Enable only when RESERVATIONS_SYNC_ENABLED=true (default: off)
    this.enabled = process.env.RESERVATIONS_SYNC_ENABLED === 'true';
    // Default: run every 30 minutes
    this.cronSchedule = process.env.RESERVATIONS_SYNC_CRON_SCHEDULE || '*/30 * * * *';
  }

  /**
   * Whether the reservations sync cron is enabled via env (RESERVATIONS_SYNC_ENABLED=true).
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Set the cron schedule (called by admin API)
   */
  setSchedule(schedule) {
    if (!cron.validate(schedule)) {
      throw new Error(`Invalid cron schedule: ${schedule}`);
    }
    this.cronSchedule = schedule;
    
    // Restart with new schedule if already running
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get current schedule
   */
  getSchedule() {
    return this.cronSchedule;
  }

  /**
   * Start the cron service (no-op if RESERVATIONS_SYNC_ENABLED is not 'true')
   */
  async start() {
    if (!this.enabled) {
      console.log('[ReservationsSyncCron] Service disabled (RESERVATIONS_SYNC_ENABLED is not true). Set RESERVATIONS_SYNC_ENABLED=true to enable.');
      return;
    }
    if (this.isRunning) {
      console.log('[ReservationsSyncCron] Service already running');
      return;
    }

    console.log(`[ReservationsSyncCron] Starting service with schedule: ${this.cronSchedule}`);
    this.isRunning = true;

    // Schedule the cron job
    this.job = cron.schedule(
      this.cronSchedule,
      async () => {
        await this.syncAllReservations();
      },
      {
        scheduled: true,
        timezone: 'UTC'
      }
    );

    console.log('[ReservationsSyncCron] Service started');
  }

  /**
   * Sync reservations for all users
   */
  async syncAllReservations() {
    console.log('[ReservationsSyncCron] Starting reservations sync...');
    const startTime = Date.now();

    try {
      // Get all users with active accounts
      const users = await require('../models').User.findAll({
        where: { isApproved: true },
        attributes: ['id']
      });

      let totalSynced = 0;
      let totalUpdated = 0;
      const errors = [];

      for (const user of users) {
        try {
          // Get user's active accounts
          const accounts = await UserHabitatAccount.findAll({
            where: { userId: user.id, isActive: true },
            attributes: ['id', 'accountName', 'apiToken', 'apiUrl']
          });

          if (accounts.length === 0) {
            continue;
          }

          // Get repository mappings
          const repos = await GitRepo.findAll({
            where: { habitatRepoId: { [Op.ne]: null } },
            attributes: ['id', 'habitatRepoId']
          });
          const repoMap = new Map();
          repos.forEach(repo => {
            repoMap.set(repo.habitatRepoId, repo.id);
          });

          // Sync reservations from each account
          for (const account of accounts) {
            try {
              const apiUrl = account.apiUrl || process.env.HABITAT_API_URL || 'https://code.habitat.inc';
              
              // Fetch reservations from Habitat API
              const result = await habitatApiService.getMyReservations(
                account.apiToken,
                apiUrl,
                false // include_released = false (only active reservations)
              );

              if (!result.success) {
                errors.push({ 
                  userId: user.id,
                  accountId: account.id, 
                  accountName: account.accountName,
                  error: result.error || 'Failed to fetch reservations' 
                });
                continue;
              }

              const remoteReservations = result.reservations || [];

              // Process each remote reservation
              for (const remoteRes of remoteReservations) {
                try {
                  // Find the local repository
                  const repoId = repoMap.get(remoteRes.repo_id);
                  if (!repoId) {
                    continue; // Skip if repo not found
                  }

                  // Find the commit by base_commit and repo_id
                  const commit = await Commit.findOne({
                    where: {
                      baseCommit: remoteRes.base_commit,
                      repoId: repoId
                    }
                  });

                  if (!commit) {
                    continue; // Skip if commit not found
                  }

                  // Parse dates
                  const expiresAt = remoteRes.expires_at ? new Date(remoteRes.expires_at) : null;
                  const reservedAt = remoteRes.reserved_at ? new Date(remoteRes.reserved_at) : new Date();
                  const releasedAt = remoteRes.released_at ? new Date(remoteRes.released_at) : null;

                  // Determine status
                  const status = releasedAt ? 'released' : 'reserved';

                  // Find or create reservation
                  const [existingReservation, created] = await Reservation.findOrCreate({
                    where: {
                      userId: user.id,
                      commitId: commit.id,
                      habitatReservationId: remoteRes.id
                    },
                    defaults: {
                      userId: user.id,
                      accountId: account.id,
                      commitId: commit.id,
                      habitatReservationId: remoteRes.id,
                      status: status,
                      expiresAt: expiresAt,
                      reservedAt: reservedAt,
                      cancelledAt: releasedAt
                    }
                  });

                  if (!created) {
                    // Update existing reservation
                    await existingReservation.update({
                      status: status,
                      expiresAt: expiresAt,
                      reservedAt: reservedAt,
                      cancelledAt: releasedAt
                    });
                    totalUpdated++;
                  } else {
                    totalSynced++;
                  }
                } catch (commitError) {
                  console.error(`[ReservationsSyncCron] Error processing reservation ${remoteRes.id}:`, commitError);
                  errors.push({
                    userId: user.id,
                    accountId: account.id,
                    accountName: account.accountName,
                    reservationId: remoteRes.id,
                    error: commitError.message
                  });
                }
              }
            } catch (accountError) {
              console.error(`[ReservationsSyncCron] Error syncing reservations for account ${account.id}:`, accountError);
              errors.push({ 
                userId: user.id,
                accountId: account.id, 
                accountName: account.accountName,
                error: accountError.message 
              });
            }
          }
        } catch (userError) {
          console.error(`[ReservationsSyncCron] Error syncing for user ${user.id}:`, userError);
          errors.push({
            userId: user.id,
            error: userError.message
          });
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[ReservationsSyncCron] Sync completed in ${duration}ms. Synced: ${totalSynced}, Updated: ${totalUpdated}, Errors: ${errors.length}`);
      
      if (errors.length > 0) {
        console.warn('[ReservationsSyncCron] Errors:', errors);
      }
    } catch (error) {
      console.error('[ReservationsSyncCron] Fatal error during sync:', error);
    }
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
    console.log('[ReservationsSyncCron] Service stopped');
  }

  /**
   * Manually trigger a sync (for testing or manual refresh)
   */
  async triggerSync() {
    console.log('[ReservationsSyncCron] Manual trigger requested');
    await this.syncAllReservations();
  }
}

// Singleton instance
const reservationsSyncCronService = new ReservationsSyncCronService();

module.exports = reservationsSyncCronService;
