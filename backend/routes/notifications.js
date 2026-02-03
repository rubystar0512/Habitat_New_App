const express = require('express');
const { Op } = require('sequelize');
const { Reservation, Commit, GitRepo, User } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { computePriorityFromCommit } = require('../services/priorityCalculator');

const router = express.Router();

router.use(authenticateToken);

// Hours window for "expiring soon" (reservations expiring within this many hours)
const EXPIRING_SOON_HOURS = 2;

/**
 * GET /notifications/expiring-commits
 * Capacity-aware: high expected-value commits reserved by another user that expire soon.
 * Lets the current user know "you could complete this when it frees up."
 */
router.get('/expiring-commits', async (req, res, next) => {
  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + EXPIRING_SOON_HOURS * 60 * 60 * 1000);

    const rows = await Reservation.findAll({
      where: {
        status: 'reserved',
        userId: { [Op.ne]: req.userId },
        expiresAt: {
          [Op.gte]: now,
          [Op.lte]: windowEnd
        }
      },
      include: [
        {
          model: Commit,
          as: 'commit',
          required: true,
          include: [
            {
              model: GitRepo,
              as: 'repo',
              required: true,
              where: { isActive: true },
              attributes: ['id', 'repoName', 'fullName']
            }
          ]
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        }
      ],
      order: [['expires_at', 'ASC']],
      limit: 30
    });

    const withPriority = rows.map(r => {
      const commit = r.commit;
      const expectedValue = commit ? computePriorityFromCommit(commit) : 0;
      return {
        reservationId: r.id,
        commitId: commit?.id,
        repoName: commit?.repo?.fullName || commit?.repo?.repoName,
        baseCommit: commit?.baseCommit,
        mergedCommit: commit?.mergedCommit,
        expectedValue,
        expiresAt: r.expiresAt,
        reservedBy: r.user?.username
      };
    });

    // Sort by expected value descending (highest first), then by expiresAt ascending
    withPriority.sort((a, b) => {
      if (b.expectedValue !== a.expectedValue) return b.expectedValue - a.expectedValue;
      return new Date(a.expiresAt) - new Date(b.expiresAt);
    });

    const list = withPriority.slice(0, 20);

    res.json({
      expiringCommits: list,
      total: list.length
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
