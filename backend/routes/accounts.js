const express = require('express');
const { UserHabitatAccount, AccountRepoMapping, GitRepo } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { idParamRule, paginationRules, handleValidationErrors } = require('../middleware/validation');

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

    res.json({
      accounts,
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
    const account = await UserHabitatAccount.findOne({
      where: { id: req.params.id, userId: req.userId },
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
    const account = await UserHabitatAccount.findOne({
      where: { id: req.params.id, userId: req.userId }
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
    const account = await UserHabitatAccount.findOne({
      where: { id: req.params.id, userId: req.userId }
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
    const { repoId } = req.body;

    const account = await UserHabitatAccount.findOne({
      where: { id: req.params.id, userId: req.userId }
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

module.exports = router;
