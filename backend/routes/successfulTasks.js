const express = require('express');
const { Op } = require('sequelize');
const { SuccessfulTask, Commit, User } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { createSuccessfulTaskRules, idParamRule, paginationRules, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all successful tasks
router.get('/', paginationRules, handleValidationErrors, async (req, res, next) => {
  try {
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;
    const status = req.query.status || 'approved'; // Default to approved
    const commitId = req.query.commit_id;
    const repoId = req.query.repo_id;
    const minAiSuccessRate = req.query.min_ai_success_rate;

    const where = {};
    if (status) {
      where.status = status;
    }
    if (commitId) {
      where.commitId = parseInt(commitId);
    }
    if (minAiSuccessRate) {
      where.aiSuccessRate = { [Op.gte]: parseFloat(minAiSuccessRate) };
    }

    const include = [
      {
        model: Commit,
        as: 'commit',
        include: [{ model: require('../models').GitRepo, as: 'repo' }],
        ...(repoId && { where: { repoId: parseInt(repoId) } })
      },
      {
        model: User,
        as: 'submitter',
        attributes: ['id', 'username']
      }
    ];

    // Only show approved tasks to non-admins, or pending/approved to admins
    if (req.user.role !== 'admin' && status === 'approved') {
      where.status = 'approved';
    }

    const { count, rows: tasks } = await SuccessfulTask.findAndCountAll({
      where,
      include,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      tasks,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

// Get task by ID
router.get('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const task = await SuccessfulTask.findByPk(req.params.id, {
      include: [
        {
          model: Commit,
          as: 'commit',
          include: [{ model: require('../models').GitRepo, as: 'repo' }]
        },
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username'],
          required: false
        }
      ]
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Only show approved tasks to non-admins, or if user owns the task
    if (task.status !== 'approved' && req.user.role !== 'admin' && task.userId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ task });
  } catch (error) {
    next(error);
  }
});

// Get tasks for a commit
router.get('/commits/:commit_id', async (req, res, next) => {
  try {
    const tasks = await SuccessfulTask.findAll({
      where: {
        commitId: req.params.commit_id,
        status: 'approved'
      },
      include: [
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'username']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      commitId: req.params.commit_id,
      tasks,
      total: tasks.length
    });
  } catch (error) {
    next(error);
  }
});

// Submit successful task
router.post('/', createSuccessfulTaskRules, handleValidationErrors, async (req, res, next) => {
  try {
    const {
      commitId,
      taskName,
      taskDescription,
      gitBaseCommit,
      mergeCommit,
      basePatch,
      goldenPatch,
      testPatch,
      prNumber,
      hints,
      aiSuccessRate,
      payoutAmount
    } = req.body;

    // Verify commit exists and validate hashes
    const commit = await Commit.findByPk(commitId);
    if (!commit) {
      return res.status(404).json({ error: 'Commit not found' });
    }

    if (commit.baseCommit !== gitBaseCommit) {
      return res.status(400).json({ error: 'git_base_commit does not match commit base_commit' });
    }

    if (commit.mergedCommit !== mergeCommit) {
      return res.status(400).json({ error: 'merge_commit does not match commit merged_commit' });
    }

    const task = await SuccessfulTask.create({
      userId: req.userId,
      commitId,
      taskName,
      taskDescription,
      gitBaseCommit,
      mergeCommit,
      basePatch,
      goldenPatch,
      testPatch,
      prNumber,
      hints,
      aiSuccessRate,
      payoutAmount,
      status: 'pending'
    });

    res.status(201).json({
      task,
      message: 'Task submission created successfully. Awaiting admin approval.'
    });
  } catch (error) {
    next(error);
  }
});

// Update own submission (pending only)
router.patch('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const task = await SuccessfulTask.findByPk(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (task.status !== 'pending') {
      return res.status(400).json({ error: 'Can only update pending submissions' });
    }

    const allowedFields = ['taskDescription', 'hints', 'basePatch', 'goldenPatch', 'testPatch'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    await task.update(updates);

    res.json({ task });
  } catch (error) {
    next(error);
  }
});

// Delete own submission (pending only)
router.delete('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const task = await SuccessfulTask.findByPk(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (task.status !== 'pending') {
      return res.status(400).json({ error: 'Can only delete pending submissions' });
    }

    await task.destroy();

    res.json({ message: 'Task submission deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Approve task (admin only)
router.patch('/:id/approve', requireAdmin, idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const task = await SuccessfulTask.findByPk(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await task.update({
      status: 'approved',
      approvedBy: req.userId,
      approvedAt: new Date()
    });

    res.json({
      message: 'Task approved successfully',
      task
    });
  } catch (error) {
    next(error);
  }
});

// Reject task (admin only)
router.patch('/:id/reject', requireAdmin, idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const { rejectionReason } = req.body;

    const task = await SuccessfulTask.findByPk(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await task.update({
      status: 'rejected',
      rejectionReason
    });

    res.json({
      message: 'Task rejected',
      task
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
