const express = require('express');
const { GitRepo } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { idParamRule, paginationRules, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all repos
router.get('/', paginationRules, handleValidationErrors, async (req, res, next) => {
  try {
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;
    const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;

    const where = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const { count, rows: repos } = await GitRepo.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      repos,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

// Get repo by ID
router.get('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const repo = await GitRepo.findByPk(req.params.id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    res.json({ repo });
  } catch (error) {
    next(error);
  }
});

// Create repo (admin only)
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { repoName, fullName, habitatRepoId, defaultBranch, cutoffDate, isActive } = req.body;

    const repo = await GitRepo.create({
      repoName,
      fullName,
      habitatRepoId,
      defaultBranch: defaultBranch || 'main',
      cutoffDate,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({ repo });
  } catch (error) {
    next(error);
  }
});

// Update repo (admin only)
router.patch('/:id', requireAdmin, idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const repo = await GitRepo.findByPk(req.params.id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const allowedFields = ['cutoffDate', 'isActive', 'defaultBranch', 'habitatRepoId'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    await repo.update(updates);

    res.json({ repo });
  } catch (error) {
    next(error);
  }
});

// Update fetch status (admin only)
router.patch('/:id/fetch-status', requireAdmin, idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const { fetchStatus, fetchErrorMessage, totalCommitsFetched } = req.body;

    const repo = await GitRepo.findByPk(req.params.id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const updates = {};
    if (fetchStatus) updates.fetchStatus = fetchStatus;
    if (fetchErrorMessage !== undefined) updates.fetchErrorMessage = fetchErrorMessage;
    if (totalCommitsFetched !== undefined) updates.totalCommitsFetched = totalCommitsFetched;
    if (fetchStatus === 'idle') updates.lastFetchedAt = new Date();

    await repo.update(updates);

    res.json({ repo });
  } catch (error) {
    next(error);
  }
});

// Delete repo (admin only)
router.delete('/:id', requireAdmin, idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const repo = await GitRepo.findByPk(req.params.id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    await repo.destroy();

    res.json({
      message: 'Repository deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
