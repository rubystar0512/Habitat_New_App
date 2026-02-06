const express = require('express');
const { Op, Sequelize } = require('sequelize');
const { UserHabitatAccount, AccountRepoMapping, GitRepo, Reservation } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { idParamRule, paginationRules, handleValidationErrors } = require('../middleware/validation');
const { checkAccountHealth } = require('../services/habitatApi');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get user's accounts
router.get('/', paginationRules, handleValidationErrors, async (req, res, next) => {
  try {
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;

    const { count, rows: accounts } = await UserHabitatAccount.findAndCountAll({
      where: { userId: req.userId },
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    // Calculate remainingReversals for each account based on active reservations
    const accountIds = accounts.map(acc => acc.id);
    const activeReservations = await Reservation.findAll({
      where: {
        accountId: { [Op.in]: accountIds },
        status: { [Op.in]: ['pending', 'active', 'reserved'] }
      },
      attributes: [
        'accountId',
        [Sequelize.fn('COUNT', Sequelize.col('Reservation.id')), 'count']
      ],
      group: ['accountId'],
      raw: true
    });

    const reservationCountMap = {};
    activeReservations.forEach(r => {
      const accountId = r.accountId;
      const count = r.count || 0;
      reservationCountMap[accountId] = parseInt(count) || 0;
    });

    // Add calculated remainingReversals to each account
    const accountsWithRemaining = accounts.map(account => {
      const activeCount = reservationCountMap[account.id] || 0;
      const remainingReversals = Math.max(0, account.reverseLimit - activeCount);
      return {
        ...account.toJSON(),
        remainingReversals
      };
    });

    res.json({
      accounts: accountsWithRemaining,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

// Get account by ID
router.get('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const accountId = parseInt(req.params.id, 10);
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    const account = await UserHabitatAccount.findOne({
      where: { id: accountId, userId: req.userId },
      include: [
        {
          model: GitRepo,
          as: 'repos',
          through: { attributes: [] }
        }
      ]
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ account });
  } catch (error) {
    next(error);
  }
});

// Create account
router.post('/', async (req, res, next) => {
  try {
    const { accountName, apiToken, apiUrl, reverseLimit } = req.body;

    const account = await UserHabitatAccount.create({
      userId: req.userId,
      accountName,
      apiToken,
      apiUrl: apiUrl || process.env.HABITAT_API_URL,
      reverseLimit: reverseLimit || 7
    });

    res.status(201).json({ account });
  } catch (error) {
    next(error);
  }
});

// Update account
router.patch('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const accountId = parseInt(req.params.id, 10);
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    const account = await UserHabitatAccount.findOne({
      where: { id: accountId, userId: req.userId }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const allowedFields = ['accountName', 'apiToken', 'isActive'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    await account.update(updates);

    res.json({ account });
  } catch (error) {
    next(error);
  }
});

// Delete account
router.delete('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const accountId = parseInt(req.params.id, 10);
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    const account = await UserHabitatAccount.findOne({
      where: { id: accountId, userId: req.userId }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await account.destroy();

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Add repo mapping
router.post('/:id/repos', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const accountId = parseInt(req.params.id, 10);
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    const { repoId } = req.body;

    const account = await UserHabitatAccount.findOne({
      where: { id: accountId, userId: req.userId }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await AccountRepoMapping.findOrCreate({
      where: { accountId: account.id, repoId }
    });

    res.json({ message: 'Repo mapping added successfully' });
  } catch (error) {
    next(error);
  }
});

// Check account health
router.post('/:id/check-health', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const accountId = parseInt(req.params.id, 10);
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    const account = await UserHabitatAccount.findOne({
      where: { id: accountId, userId: req.userId }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!account.isActive) {
      return res.status(400).json({ error: 'Account is not active' });
    }

    const apiUrl = account.apiUrl || process.env.HABITAT_API_URL || 'https://code.habitat.inc';
    const healthResult = await checkAccountHealth(account.apiToken, apiUrl);

    if (!healthResult.success) {
      // API call failed - mark as error
      await account.update({
        accountHealth: 'error',
        healthLastChecked: new Date()
      });

      return res.json({
        success: false,
        health: 'error',
        error: healthResult.error,
        account: account
      });
    }

    // Count active reservations in our database
    const activeReservationsCount = await Reservation.count({
      where: {
        accountId: account.id,
        status: {
          [Op.in]: ['pending', 'active']
        }
      }
    });

    // Calculate remaining reversals
    const remainingReversals = Math.max(0, account.reverseLimit - activeReservationsCount);

    // Determine health status
    let healthStatus = 'healthy';
    if (remainingReversals === 0) {
      healthStatus = 'exhausted';
    } else if (remainingReversals <= 2) {
      healthStatus = 'warning';
    }

    // Update account with health information
    await account.update({
      accountHealth: healthStatus,
      remainingReversals: remainingReversals,
      healthLastChecked: new Date(),
      totalReservationsMade: healthResult.totalReservations || account.totalReservationsMade
    });

    // Reload account to get updated values
    await account.reload();

    res.json({
      success: true,
      health: healthStatus,
      remainingReversals: remainingReversals,
      activeReservations: activeReservationsCount,
      reverseLimit: account.reverseLimit,
      account: account
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
