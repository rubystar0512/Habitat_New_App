const express = require('express');
const { Op } = require('sequelize');
const { MemoCommit, Commit, GitRepo, CommitStatusCache, Reservation } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { idParamRule, paginationRules, handleValidationErrors } = require('../middleware/validation');
const { computePriorityFromCommit } = require('../services/priorityCalculator');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

const MEMO_LIMIT = Math.max(1, parseInt(process.env.MEMO_LIMIT, 10) || 45);

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

    const commitIds = memoCommits.map(m => m.commitId).filter(Boolean);
    const [statusRows, reservations] = await Promise.all([
      commitIds.length ? CommitStatusCache.findAll({
        where: { commitId: { [Op.in]: commitIds } },
        attributes: ['commitId', 'status', 'expiresAt', 'checkedAt']
      }) : [],
      commitIds.length ? Reservation.findAll({
        where: { userId: req.userId, commitId: { [Op.in]: commitIds }, status: 'reserved' },
        attributes: ['commitId', 'status', 'expiresAt', 'id', 'accountId']
      }) : []
    ]);

    const statusMap = {};
    statusRows.forEach(sc => {
      statusMap[sc.commitId] = { status: sc.status, expiresAt: sc.expiresAt, checkedAt: sc.checkedAt };
    });
    const reservationMap = {};
    reservations.forEach(r => {
      reservationMap[r.commitId] = { id: r.id, status: r.status, expiresAt: r.expiresAt, accountId: r.accountId };
    });

    // Format response to include commit details and commit status
    const formattedMemos = memoCommits.map(memo => {
      const commit = memo.commit;
      const statusInfo = statusMap[memo.commitId];
      const userReservation = reservationMap[memo.commitId];
      let displayStatus = 'available';
      let expiresAt = null;
      if (userReservation) {
        displayStatus = 'reserved';
        expiresAt = userReservation.expiresAt;
      } else if (statusInfo) {
        displayStatus = statusInfo.status || 'available';
        expiresAt = statusInfo.expiresAt;
      }
      return {
        id: memo.id,
        userId: memo.userId,
        commitId: memo.commitId,
        priority: memo.priority || 0,
        suggestedPriority: commit ? computePriorityFromCommit(commit) : null,
        notes: memo.notes,
        createdAt: memo.createdAt,
        updatedAt: memo.updatedAt,
        displayStatus,
        expiresAt,
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
      offset,
      memoLimit: MEMO_LIMIT
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

    const existing = await MemoCommit.findOne({ where: { userId: req.userId, commitId: commit_id } });
    if (!existing) {
      const currentCount = await MemoCommit.count({ where: { userId: req.userId } });
      if (currentCount >= MEMO_LIMIT) {
        return res.status(403).json({
          error: `Memo limit reached (${MEMO_LIMIT}). Remove an item to add more.`,
          memoLimit: MEMO_LIMIT
        });
      }
    }

    const autoPriority = priority != null ? priority : computePriorityFromCommit(commit);
    const [memoCommit, created] = await MemoCommit.findOrCreate({
      where: { userId: req.userId, commitId: commit_id },
      defaults: { 
        userId: req.userId,
        commitId: commit_id,
        priority: autoPriority, 
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
