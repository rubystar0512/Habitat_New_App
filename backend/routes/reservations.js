const express = require('express');
const { Op } = require('sequelize');
const { Reservation, Commit, UserHabitatAccount, GitRepo } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { createReservationRules, bulkReservationRules, idParamRule, paginationRules, handleValidationErrors } = require('../middleware/validation');
const habitatApiService = require('../services/habitatApi');
const { computePriorityFromCommit } = require('../services/priorityCalculator');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get user's reservations
router.get('/', paginationRules, handleValidationErrors, async (req, res, next) => {
  try {
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;
    const status = req.query.status;
    const sortBy = req.query.sortBy || 'reservedAt';
    const sortOrder = req.query.sortOrder || 'DESC';

    const where = { userId: req.userId };
    if (status) {
      where.status = status;
    }

    // Handle sorting
    const { col } = require('sequelize');
    let order = [['reserved_at', 'DESC']];
    
    if (sortBy) {
      const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      // Map frontend field names to database columns
      const fieldMap = {
        'reservedAt': 'reserved_at',
        'expiresAt': 'expires_at',
        'cancelledAt': 'released_at',
        'status': 'status',
        'account_name': 'account.account_name',
        'repo_name': 'repo.full_name',
        'merged_commit': 'commit.merged_commit',
        'base_commit': 'commit.base_commit',
        'pr_number': 'commit.pr_number',
        'habitate_score': 'commit.habitate_score',
        'file_changes': 'commit.file_changes',
        'additions': 'commit.additions',
        'deletions': 'commit.deletions',
        'priority': 'priority'
      };
      
      const dbField = fieldMap[sortBy] || sortBy;
      order = [[col(dbField.includes('.') ? dbField : `Reservation.${dbField}`), orderDirection]];
    }

    const { count, rows: reservations } = await Reservation.findAndCountAll({
      where,
      include: [
        {
          model: Commit,
          as: 'commit',
          include: [{ 
            model: require('../models').GitRepo, 
            as: 'repo',
            attributes: ['id', 'repoName', 'fullName', 'habitatRepoId']
          }]
        },
        {
          model: UserHabitatAccount,
          as: 'account',
          attributes: ['id', 'accountName', 'apiUrl']
        }
      ],
      limit,
      offset,
      order
    });

    // Format response to include commit details
    const formattedReservations = reservations.map(reservation => {
      const commit = reservation.commit;
      return {
        id: reservation.id,
        userId: reservation.userId,
        accountId: reservation.accountId,
        commitId: reservation.commitId,
        habitatReservationId: reservation.habitatReservationId,
        status: reservation.status,
        expiresAt: reservation.expiresAt,
        reservedAt: reservation.reservedAt,
        cancelledAt: reservation.cancelledAt, // Model field maps to released_at in database
        priority: reservation.priority != null ? reservation.priority : 0,
        suggestedPriority: commit ? computePriorityFromCommit(commit) : null,
        createdAt: reservation.createdAt,
        updatedAt: reservation.updatedAt,
        // Account info
        account_name: reservation.account?.accountName,
        // Commit details
        repo_id: commit?.repoId,
        repo_name: commit?.repo?.fullName || commit?.repo?.repoName,
        merged_commit: commit?.mergedCommit,
        base_commit: commit?.baseCommit,
        source_sha: commit?.sourceSha,
        branch: commit?.branch,
        message: commit?.message,
        author: commit?.author,
        commit_date: commit?.commitDate,
        file_changes: commit?.fileChanges,
        additions: commit?.additions,
        deletions: commit?.deletions,
        net_change: commit?.netChange,
        habitate_score: commit?.habitateScore,
        difficulty_score: commit?.difficultyScore,
        suitability_score: commit?.suitabilityScore,
        pr_number: commit?.prNumber,
        is_merge: commit?.isMerge,
      };
    });

    res.json({
      reservations: formattedReservations,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

// Bulk create reservations (commit_ids + account_id)
router.post('/bulk', bulkReservationRules, handleValidationErrors, async (req, res, next) => {
  try {
    const { account_id: accountId, commit_ids: commitIds } = req.body;

    const account = await UserHabitatAccount.findOne({
      where: { id: accountId, userId: req.userId, isActive: true }
    });
    if (!account) {
      return res.status(404).json({ error: 'Account not found or inactive' });
    }

    const apiUrl = account.apiUrl || process.env.HABITAT_API_URL || 'https://code.habitat.inc';
    const results = { reserved: [], failed: [] };

    for (const commitId of commitIds) {
      const commit = await Commit.findByPk(commitId, {
        include: [{ model: GitRepo, as: 'repo', attributes: ['habitatRepoId'] }]
      });
      if (!commit) {
        results.failed.push({ commitId, error: 'Commit not found' });
        continue;
      }
      if (!commit.repo?.habitatRepoId) {
        results.failed.push({ commitId, error: 'Repository does not have Habitat ID' });
        continue;
      }
      const existing = await Reservation.findOne({
        where: { commitId, status: 'reserved' }
      });
      if (existing) {
        results.failed.push({ commitId, error: 'Commit already reserved' });
        continue;
      }

      const claimResult = await habitatApiService.claim(
        account.apiToken,
        apiUrl,
        commit.repo.habitatRepoId,
        commit.baseCommit
      );

      if (claimResult.success) {
        const priority = computePriorityFromCommit(commit);
        await Reservation.create({
          userId: req.userId,
          accountId: account.id,
          commitId,
          habitatReservationId: claimResult.reservationId,
          status: 'reserved',
          expiresAt: claimResult.expiresAt,
          reservedAt: new Date(),
          priority
        });
        results.reserved.push({ commitId });
      } else {
        results.failed.push({ commitId, error: claimResult.error || 'Claim failed' });
      }
    }

    res.status(201).json({
      message: `Reserved ${results.reserved.length} of ${commitIds.length} commit(s)`,
      reserved: results.reserved.length,
      failed: results.failed.length,
      results
    });
  } catch (error) {
    next(error);
  }
});

// Create reservation (single)
router.post('/', createReservationRules, handleValidationErrors, async (req, res, next) => {
  try {
    const { commitId, accountId } = req.body;
    const singleCommitId = req.body.commit_id || commitId;
    if (!singleCommitId) {
      return res.status(400).json({ error: 'commit_id or commitId is required' });
    }
    const cid = parseInt(singleCommitId, 10);

    // Verify account belongs to user
    const account = await UserHabitatAccount.findOne({
      where: { id: accountId, userId: req.userId, isActive: true }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found or inactive' });
    }

    // Verify commit exists
    const commit = await Commit.findByPk(commitId);
    if (!commit) {
      return res.status(404).json({ error: 'Commit not found' });
    }

    // Check if already reserved
    const existingReservation = await Reservation.findOne({
      where: { commitId, status: 'reserved' }
    });

    if (existingReservation) {
      return res.status(409).json({ error: 'Commit already reserved' });
    }

    // Get commit with repo info
    const commitWithRepo = await Commit.findByPk(cid, {
      include: [{ model: require('../models').GitRepo, as: 'repo', attributes: ['habitatRepoId'] }]
    });

    if (!commitWithRepo.repo?.habitatRepoId) {
      return res.status(400).json({ error: 'Repository does not have Habitat ID' });
    }

    // Reserve via Habitat API
    const habitatReservation = await habitatApiService.claim(
      account.apiToken,
      account.apiUrl || process.env.HABITAT_API_URL || 'https://code.habitat.inc',
      commitWithRepo.repo.habitatRepoId,
      commitWithRepo.baseCommit
    );

    if (!habitatReservation.success) {
      return res.status(400).json({ error: habitatReservation.error || 'Failed to reserve commit' });
    }

    const autoPriority = computePriorityFromCommit(commitWithRepo);

    const reservation = await Reservation.create({
      userId: req.userId,
      accountId,
      commitId: cid,
      habitatReservationId: habitatReservation.reservationId,
      status: 'reserved',
      expiresAt: habitatReservation.expiresAt,
      reservedAt: new Date(),
      priority: autoPriority
    });

    res.status(201).json({ reservation });
  } catch (error) {
    next(error);
  }
});

// Update reservation (e.g. user-customized priority)
router.patch('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const reservation = await Reservation.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const { priority } = req.body;
    const updates = {};
    if (typeof priority === 'number' || (priority !== undefined && priority !== null)) {
      updates.priority = Math.min(100, Math.max(0, parseInt(priority, 10) || 0));
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update (e.g. priority 0-100)' });
    }
    await reservation.update(updates);
    res.json({ message: 'Reservation updated', reservation });
  } catch (error) {
    next(error);
  }
});

// Cancel reservation
router.delete('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const reservation = await Reservation.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Cancel via Habitat API
    if (reservation.habitatReservationId) {
      const account = await UserHabitatAccount.findByPk(reservation.accountId);
      await habitatApiService.deleteReservation(
        account.apiToken,
        account.apiUrl,
        reservation.habitatReservationId
      );
    }

    await reservation.update({
      status: 'released', // Database uses 'released' for cancelled reservations
      cancelledAt: new Date() // Model field maps to 'released_at' in database
    });

    res.json({ message: 'Reservation cancelled successfully' });
  } catch (error) {
    next(error);
  }
});

// Sync reservations from Habitat API
router.post('/sync', async (req, res, next) => {
  try {
    // Get all user's active accounts
    const accounts = await UserHabitatAccount.findAll({
      where: { userId: req.userId, isActive: true },
      attributes: ['id', 'accountName', 'apiToken', 'apiUrl']
    });

    if (accounts.length === 0) {
      return res.json({ 
        message: 'No active accounts found', 
        synced: 0,
        updated: 0,
        errors: []
      });
    }

    let totalSynced = 0;
    let totalUpdated = 0;
    const errors = [];

    // Get repository mappings (habitat_repo_id -> local repo_id)
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
            const repoId = repoMap.get(remoteRes.repository_id);
            if (!repoId) {
              // Repository not found in our database, skip
              continue;
            }

            // Find the commit by base_commit hash
            const commit = await Commit.findOne({
              where: {
                repoId: repoId,
                baseCommit: remoteRes.commit_hash
              }
            });

            if (!commit) {
              // Commit not found in our database, skip
              continue;
            }

            // Check if reservation already exists
            const existingReservation = await Reservation.findOne({
              where: {
                userId: req.userId,
                accountId: account.id,
                commitId: commit.id,
                habitatReservationId: remoteRes.id
              }
            });

            const reservedAt = remoteRes.reserved_at ? new Date(remoteRes.reserved_at) : new Date();
            const expiresAt = remoteRes.expires_at ? new Date(remoteRes.expires_at) : null;
            const releasedAt = remoteRes.released_at ? new Date(remoteRes.released_at) : null;
            const status = releasedAt ? 'released' : 'reserved';

            if (existingReservation) {
              // Update existing reservation
              await existingReservation.update({
                habitatReservationId: remoteRes.id,
                status: status,
                expiresAt: expiresAt,
                reservedAt: reservedAt,
                cancelledAt: releasedAt // Maps to released_at in database
              });
              totalUpdated++;
            } else {
              // Create new reservation
              await Reservation.create({
                userId: req.userId,
                accountId: account.id,
                commitId: commit.id,
                habitatReservationId: remoteRes.id,
                status: status,
                expiresAt: expiresAt,
                reservedAt: reservedAt,
                cancelledAt: releasedAt // Maps to released_at in database
              });
              totalSynced++;
            }
          } catch (commitError) {
            console.error(`Error processing reservation ${remoteRes.id}:`, commitError);
            errors.push({
              accountId: account.id,
              accountName: account.accountName,
              reservationId: remoteRes.id,
              error: commitError.message
            });
          }
        }
      } catch (accountError) {
        console.error(`Error syncing reservations for account ${account.id}:`, accountError);
        errors.push({ 
          accountId: account.id, 
          accountName: account.accountName,
          error: accountError.message 
        });
      }
    }

    res.json({
      message: `Synced ${totalSynced} new reservations, updated ${totalUpdated} existing reservations`,
      synced: totalSynced,
      updated: totalUpdated,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
