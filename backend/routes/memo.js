const express = require('express');
const { Op } = require('sequelize');
const { MemoCommit, Commit, GitRepo } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { idParamRule, paginationRules, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get memo commits with full commit details
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
          include: [
            {
              model: GitRepo,
              as: 'repo',
              attributes: ['id', 'repoName', 'fullName', 'habitatRepoId']
            }
          ]
        }
      ],
      limit,
      offset,
      order: [['priority', 'DESC'], ['createdAt', 'DESC']]
    });

    // Format response to include commit details
    const formattedMemos = memoCommits.map(memo => {
      const commit = memo.commit;
      return {
        id: memo.id,
        userId: memo.userId,
        commitId: memo.commitId,
        priority: memo.priority || 0,
        notes: memo.notes,
        createdAt: memo.createdAt,
        updatedAt: memo.updatedAt,
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
        has_dependency_changes: commit?.hasDependencyChanges,
        is_unsuitable: commit?.isUnsuitable,
        is_behavior_preserving_refactor: commit?.isBehaviorPreservingRefactor,
      };
    });

    res.json({
      memoCommits: formattedMemos,
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
    const { commit_id, priority, notes } = req.body;

    if (!commit_id) {
      return res.status(400).json({ error: 'commit_id is required' });
    }

    // Verify commit exists
    const commit = await Commit.findByPk(commit_id);
    if (!commit) {
      return res.status(404).json({ error: 'Commit not found' });
    }

    const [memoCommit, created] = await MemoCommit.findOrCreate({
      where: { userId: req.userId, commitId: commit_id },
      defaults: { 
        userId: req.userId,
        commitId: commit_id,
        priority: priority || 0, 
        notes: notes || null
      }
    });

    if (!created) {
      await memoCommit.update({ 
        priority: priority !== undefined ? priority : memoCommit.priority, 
        notes: notes !== undefined ? notes : memoCommit.notes 
      });
    }

    res.status(201).json({ 
      message: created ? 'Commit added to memo' : 'Memo updated',
      memoCommit 
    });
  } catch (error) {
    next(error);
  }
});

// Update memo commit
router.patch('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const { priority, notes } = req.body;

    const memoCommit = await MemoCommit.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!memoCommit) {
      return res.status(404).json({ error: 'Memo commit not found' });
    }

    const updateData = {};
    if (priority !== undefined) updateData.priority = priority;
    if (notes !== undefined) updateData.notes = notes;

    await memoCommit.update(updateData);

    res.json({ message: 'Memo updated successfully', memoCommit });
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
