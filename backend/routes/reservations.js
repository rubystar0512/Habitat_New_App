const express = require('express');
const { Op } = require('sequelize');
const { Reservation, Commit, UserHabitatAccount } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { createReservationRules, idParamRule, paginationRules, handleValidationErrors } = require('../middleware/validation');
const habitatApiService = require('../services/habitatApi');

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
        'deletions': 'commit.deletions'
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

// Create reservation
router.post('/', createReservationRules, handleValidationErrors, async (req, res, next) => {
  try {
    const { commitId, accountId } = req.body;

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
    const commitWithRepo = await Commit.findByPk(commitId, {
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

    // Create reservation record
    const reservation = await Reservation.create({
      userId: req.userId,
      accountId,
      commitId,
      habitatReservationId: habitatReservation.reservationId,
      status: 'reserved', // Database uses 'reserved' status
      expiresAt: habitatReservation.expiresAt,
      reservedAt: new Date()
    });

    res.status(201).json({ reservation });
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

module.exports = router;
