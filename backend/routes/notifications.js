const express = require('express');
const { Op } = require('sequelize');
const { Reservation, Commit, GitRepo, User } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { computePriorityFromCommit } = require('../services/priorityCalculator');

const router = express.Router();

router.use(authenticateToken);

// Hours window for "expiring soon" (reservations expiring within this many hours)
const EXPIRING_SOON_HOURS = 2;
// Minutes window for "my reservation expiring soon" alert
const MY_EXPIRING_SOON_MINUTES = 30;

/**
 * GET /notifications/expiring-commits
 * Returns:
 * - expiringCommits: high expected-value commits reserved by ANOTHER user that expire soon (2h window).
 * - myExpiringReservations: current user's reservations that expire soon (30 min window).
 * So the inbox can show both "your reservations expiring" and "others' commits expiring soon".
 */
router.get('/expiring-commits', async (req, res, next) => {
  try {
    const now = new Date();
    const windowEndOthers = new Date(now.getTime() + EXPIRING_SOON_HOURS * 60 * 60 * 1000);
    const windowEndMine = new Date(now.getTime() + MY_EXPIRING_SOON_MINUTES * 60 * 1000);

    const [rows, myRows] = await Promise.all([
      Reservation.findAll({
        where: {
          status: 'reserved',
          userId: { [Op.ne]: req.userId },
          expiresAt: {
            [Op.gte]: now,
            [Op.lte]: windowEndOthers
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
      }),
      Reservation.findAll({
        where: {
          userId: req.userId,
          status: 'reserved',
          expiresAt: {
            [Op.gte]: now,
            [Op.lte]: windowEndMine
          }
        },
        include: [
          {
            model: Commit,
            as: 'commit',
            required: true,
            include: [{ model: GitRepo, as: 'repo', attributes: ['id', 'repoName', 'fullName'] }]
          }
        ],
        order: [['expires_at', 'ASC']],
        limit: 50
      })
    ]);

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
    const myExpiringReservations = myRows.map(r => ({
      reservationId: r.id,
      commitId: r.commit?.id,
      repoName: r.commit?.repo?.fullName || r.commit?.repo?.repoName,
      baseCommit: r.commit?.baseCommit,
      expiresAt: r.expiresAt,
      isMine: true
    }));

    res.json({
      expiringCommits: list,
      total: list.length,
      myExpiringReservations,
      myExpiringTotal: myExpiringReservations.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /notifications/my-reservations-expiring-soon
 * Current user's reserved commits that expire within the next MY_EXPIRING_SOON_MINUTES.
 * Used by frontend background job to show "your reservation will expire soon" alerts.
 */
router.get('/my-reservations-expiring-soon', async (req, res, next) => {
  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + MY_EXPIRING_SOON_MINUTES * 60 * 1000);

    const rows = await Reservation.findAll({
      where: {
        userId: req.userId,
        status: 'reserved',
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
              attributes: ['id', 'repoName', 'fullName']
            }
          ]
        }
      ],
      order: [['expires_at', 'ASC']],
      limit: 50
    });

    const list = rows.map(r => ({
      reservationId: r.id,
      commitId: r.commit?.id,
      repoName: r.commit?.repo?.fullName || r.commit?.repo?.repoName,
      baseCommit: r.commit?.baseCommit,
      expiresAt: r.expiresAt
    }));

    res.json({
      expiringReservations: list,
      total: list.length
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
