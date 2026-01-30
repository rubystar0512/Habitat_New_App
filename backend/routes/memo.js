const express = require('express');
const { MemoCommit, Commit } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { idParamRule, paginationRules, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get memo commits
router.get('/', paginationRules, handleValidationErrors, async (req, res, next) => {
  try {
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;

    const { count, rows: memoCommits } = await MemoCommit.findAndCountAll({
      where: { userId: req.userId },
      include: [
        {
          model: Commit,
          as: 'commit',
          include: [{ model: require('../models').GitRepo, as: 'repo' }]
        }
      ],
      limit,
      offset,
      order: [['priority', 'DESC'], ['createdAt', 'DESC']]
    });

    res.json({
      memoCommits,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

// Add to memo
router.post('/', async (req, res, next) => {
  try {
    const { commitId, priority, notes } = req.body;

    const [memoCommit] = await MemoCommit.findOrCreate({
      where: { userId: req.userId, commitId },
      defaults: { priority: priority || 0, notes }
    });

    if (!memoCommit.isNewRecord) {
      await memoCommit.update({ priority: priority || memoCommit.priority, notes: notes || memoCommit.notes });
    }

    res.status(201).json({ memoCommit });
  } catch (error) {
    next(error);
  }
});

// Remove from memo
router.delete('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const memoCommit = await MemoCommit.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!memoCommit) {
      return res.status(404).json({ error: 'Memo commit not found' });
    }

    await memoCommit.destroy();

    res.json({ message: 'Removed from memo successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
