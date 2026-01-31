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

    // All tasks are approved by default, but allow filtering by status if needed
    // No special filtering needed since all tasks are approved when submitted

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
      task_name,
      task_description,
      git_base_commit,
      merge_commit,
      base_patch,
      golden_patch,
      test_patch,
      pr_number,
      hints,
      ai_success_rate,
      payout_amount
    } = req.body;

    // Validate required fields
    if (!git_base_commit || !merge_commit) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Both git_base_commit and merge_commit are required.'
      });
    }

    // Find commit by git_base_commit and merge_commit hashes
    const commit = await Commit.findOne({
      where: {
        baseCommit: git_base_commit,
        mergedCommit: merge_commit
      },
      include: [
        {
          model: require('../models').GitRepo,
          as: 'repo',
          attributes: ['id', 'repoName', 'fullName']
        }
      ]
    });
    
    if (!commit) {
      return res.status(404).json({ 
        error: 'Commit not found',
        message: `No commit found with base_commit="${git_base_commit.substring(0, 8)}..." and merge_commit="${merge_commit.substring(0, 8)}...". Please verify the commit hashes.`,
        git_base_commit: git_base_commit,
        merge_commit: merge_commit
      });
    }

    // Map snake_case request body to camelCase model attributes
    const task = await SuccessfulTask.create({
      userId: req.userId,
      commitId: commit.id,
      taskName: task_name,
      taskDescription: task_description,
      gitBaseCommit: git_base_commit,
      mergeCommit: merge_commit,
      basePatch: base_patch,
      goldenPatch: golden_patch,
      testPatch: test_patch,
      prNumber: pr_number,
      hints: hints,
      aiSuccessRate: ai_success_rate,
      payoutAmount: payout_amount,
      status: 'approved' // Tasks are approved immediately when submitted
    });

    res.status(201).json({
      task,
      message: 'Task submitted successfully and is now visible to all team members.'
    });
  } catch (error) {
    next(error);
  }
});

// Update own submission
router.patch('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const task = await SuccessfulTask.findByPk(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized. You can only update your own tasks.' });
    }

    // Allow updates to own tasks regardless of status
    // Map snake_case request body to camelCase model attributes
    const fieldMap = {
      task_name: 'taskName',
      task_description: 'taskDescription',
      hints: 'hints',
      base_patch: 'basePatch',
      golden_patch: 'goldenPatch',
      test_patch: 'testPatch',
      pr_number: 'prNumber',
      ai_success_rate: 'aiSuccessRate',
      payout_amount: 'payoutAmount'
    };
    
    const updates = {};
    Object.keys(fieldMap).forEach(snakeKey => {
      const camelKey = fieldMap[snakeKey];
      if (req.body[snakeKey] !== undefined) {
        updates[camelKey] = req.body[snakeKey];
      }
      // Also support camelCase for backward compatibility
      if (req.body[camelKey] !== undefined) {
        updates[camelKey] = req.body[camelKey];
      }
    });

    await task.update(updates);

    res.json({ task });
  } catch (error) {
    next(error);
  }
});

// Delete submission (own tasks for members, any task for admins)
router.delete('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const task = await SuccessfulTask.findByPk(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Admins can delete any task, members can only delete their own tasks
    if (task.userId !== req.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized. You can only delete your own tasks.' });
    }

    await task.destroy();

    res.json({ message: 'Task deleted successfully' });
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
