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

    const where = { userId: req.userId };
    if (status) {
      where.status = status;
    }

    const { count, rows: reservations } = await Reservation.findAndCountAll({
      where,
      include: [
        {
          model: Commit,
          as: 'commit',
          include: [{ model: require('../models').GitRepo, as: 'repo' }]
        },
        {
          model: UserHabitatAccount,
          as: 'account',
          attributes: ['id', 'accountName']
        }
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      reservations,
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
      where: { commitId, status: { [Op.in]: ['pending', 'active'] } }
    });

    if (existingReservation) {
      return res.status(409).json({ error: 'Commit already reserved' });
    }

    // Reserve via Habitat API
    const habitatReservation = await habitatApiService.claim(
      account.apiToken,
      account.apiUrl,
      commit.repoId,
      commit.mergedCommit
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
      status: 'active',
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
      status: 'cancelled',
      cancelledAt: new Date()
    });

    res.json({ message: 'Reservation cancelled successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
