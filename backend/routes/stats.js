const express = require('express');
const { Sequelize } = require('sequelize');
const { Commit, GitRepo, Reservation, User, SuccessfulTask } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Overall statistics
router.get('/overall', async (req, res, next) => {
  try {
    const [
      totalRepos,
      activeRepos,
      totalCommits,
      totalReservations,
      activeReservations,
      totalUsers,
      totalSuccessfulTasks
    ] = await Promise.all([
      GitRepo.count(),
      GitRepo.count({ where: { isActive: true } }),
      Commit.count(),
      Reservation.count(),
      Reservation.count({ where: { status: 'active' } }),
      User.count(),
      SuccessfulTask.count({ where: { status: 'approved' } })
    ]);

    res.json({
      repos: { total: totalRepos, active: activeRepos },
      commits: { total: totalCommits },
      reservations: { total: totalReservations, active: activeReservations },
      users: { total: totalUsers },
      successfulTasks: { total: totalSuccessfulTasks }
    });
  } catch (error) {
    next(error);
  }
});

// User statistics
router.get('/my-stats', async (req, res, next) => {
  try {
    const [reservations, successfulTasks] = await Promise.all([
      Reservation.count({ where: { userId: req.userId } }),
      SuccessfulTask.count({ where: { userId: req.userId, status: 'approved' } })
    ]);

    res.json({
      reservations: { total: reservations },
      successfulTasks: { total: successfulTasks }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
