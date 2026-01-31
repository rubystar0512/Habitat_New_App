const express = require('express');
const { Sequelize, Op } = require('sequelize');
const { Commit, GitRepo, Reservation, User, SuccessfulTask, UserHabitatAccount, MemoCommit } = require('../models');
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
      highScoreCommits,
      totalReservations,
      activeReservations,
      expiredReservations,
      totalUsers,
      totalSuccessfulTasks,
      totalAccounts,
      activeAccounts,
      totalMemoCommits
    ] = await Promise.all([
      GitRepo.count(),
      GitRepo.count({ where: { isActive: true } }),
      Commit.count(),
      Commit.count({ where: { habitateScore: { [Op.gte]: 100 } } }),
      Reservation.count(),
      Reservation.count({ where: { status: 'reserved' } }),
      Reservation.count({ where: { status: 'expired' } }),
      User.count(),
      SuccessfulTask.count(),
      UserHabitatAccount.count(),
      UserHabitatAccount.count({ where: { isActive: true } }),
      MemoCommit.count({ where: { userId: req.userId } })
    ]);

    res.json({
      repos: { total: totalRepos, active: activeRepos },
      commits: { total: totalCommits, highScore: highScoreCommits },
      reservations: { total: totalReservations, active: activeReservations, expired: expiredReservations },
      users: { total: totalUsers },
      successfulTasks: { total: totalSuccessfulTasks },
      accounts: { total: totalAccounts, active: activeAccounts },
      memoCommits: { total: totalMemoCommits }
    });
  } catch (error) {
    next(error);
  }
});

// User statistics
router.get('/my-stats', async (req, res, next) => {
  try {
    const [
      reservations,
      activeReservations,
      successfulTasks,
      memoCommits,
      accounts
    ] = await Promise.all([
      Reservation.count({ where: { userId: req.userId } }),
      Reservation.count({ where: { userId: req.userId, status: 'reserved' } }),
      SuccessfulTask.count({ where: { userId: req.userId } }),
      MemoCommit.count({ where: { userId: req.userId } }),
      UserHabitatAccount.count({ where: { userId: req.userId, isActive: true } })
    ]);

    res.json({
      reservations: { total: reservations, active: activeReservations },
      successfulTasks: { total: successfulTasks },
      memoCommits: { total: memoCommits },
      accounts: { total: accounts }
    });
  } catch (error) {
    next(error);
  }
});

// Recent activity
router.get('/recent-activity', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const [recentReservations, recentTasks, recentCommits] = await Promise.all([
      Reservation.findAll({
        where: { userId: req.userId },
        include: [
          {
            model: Commit,
            as: 'commit',
            attributes: ['id', 'message', 'habitateScore', 'baseCommit', 'mergedCommit'],
            include: [
              {
                model: GitRepo,
                as: 'repo',
                attributes: ['id', 'repoName', 'fullName']
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit
      }),
      SuccessfulTask.findAll({
        where: { userId: req.userId },
        include: [
          {
            model: Commit,
            as: 'commit',
            attributes: ['id', 'message'],
            include: [
              {
                model: GitRepo,
                as: 'repo',
                attributes: ['id', 'repoName', 'fullName']
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit
      }),
      Commit.findAll({
        order: [['commitDate', 'DESC']],
        limit: 5,
        include: [
          {
            model: GitRepo,
            as: 'repo',
            attributes: ['id', 'repoName', 'fullName']
          }
        ]
      })
    ]);

    res.json({
      reservations: recentReservations,
      tasks: recentTasks,
      commits: recentCommits
    });
  } catch (error) {
    next(error);
  }
});

// Repo commits statistics
router.get('/repo-commits', async (req, res, next) => {
  try {
    const repos = await GitRepo.findAll({
      where: { isActive: true },
      attributes: ['id', 'repoName', 'fullName'],
      include: [
        {
          model: Commit,
          as: 'commits',
          attributes: ['id'],
          required: false
        }
      ]
    });

    const data = repos.map(repo => ({
      name: repo.repoName || repo.fullName,
      value: repo.commits?.length || 0
    })).sort((a, b) => b.value - a.value);

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// Repo scores statistics (habitat, suitability, difficulty)
router.get('/repo-scores', async (req, res, next) => {
  try {
    const repos = await GitRepo.findAll({
      where: { isActive: true },
      attributes: ['id', 'repoName', 'fullName'],
      include: [
        {
          model: Commit,
          as: 'commits',
          attributes: ['habitateScore', 'suitabilityScore', 'difficultyScore'],
          required: false
        }
      ]
    });

    const data = repos.map(repo => {
      const commits = repo.commits || [];
      const validCommits = commits.filter(c => c.habitateScore !== null);
      
      return {
        name: repo.repoName || repo.fullName,
        avgHabitatScore: validCommits.length > 0 
          ? commits.reduce((sum, c) => sum + (parseFloat(c.habitateScore) || 0), 0) / validCommits.length 
          : 0,
        avgSuitabilityScore: validCommits.length > 0
          ? commits.reduce((sum, c) => sum + (parseFloat(c.suitabilityScore) || 0), 0) / validCommits.length
          : 0,
        avgDifficultyScore: validCommits.length > 0
          ? commits.reduce((sum, c) => sum + (parseFloat(c.difficultyScore) || 0), 0) / validCommits.length
          : 0,
        commitCount: commits.length
      };
    }).filter(r => r.commitCount > 0).sort((a, b) => b.commitCount - a.commitCount);

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// Team member statistics
router.get('/team-stats', async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username'],
      include: [
        {
          model: Reservation,
          as: 'reservations',
          attributes: ['id', 'status'],
          required: false
        },
        {
          model: SuccessfulTask,
          as: 'submittedTasks',
          attributes: ['id', 'payoutAmount', 'aiSuccessRate'],
          required: false
        }
      ]
    });

    const data = users.map(user => {
      const reservations = user.reservations || [];
      const tasks = user.submittedTasks || [];
      const activeReservations = reservations.filter(r => r.status === 'reserved').length;
      const totalPayout = tasks.reduce((sum, t) => sum + (parseFloat(t.payoutAmount) || 0), 0);
      const avgAiSuccess = tasks.length > 0
        ? tasks.reduce((sum, t) => sum + (parseFloat(t.aiSuccessRate) || 0), 0) / tasks.length
        : 0;

      return {
        username: user.username,
        totalReservations: reservations.length,
        activeReservations,
        successfulTasks: tasks.length,
        totalPayout,
        avgAiSuccessRate: avgAiSuccess
      };
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// Commit score distribution
router.get('/score-distribution', async (req, res, next) => {
  try {
    const commits = await Commit.findAll({
      attributes: ['habitateScore', 'isUnsuitable'],
      where: {
        habitateScore: { [Op.not]: null }
      }
    });

    const distribution = {
      tooEasy: commits.filter(c => c.habitateScore < 50).length,
      easy: commits.filter(c => c.habitateScore >= 50 && c.habitateScore < 80).length,
      inDistribution: commits.filter(c => c.habitateScore >= 80 && c.habitateScore < 120).length,
      hard: commits.filter(c => c.habitateScore >= 120 && c.habitateScore < 150).length,
      tooHard: commits.filter(c => c.habitateScore >= 150).length,
      unsuitable: commits.filter(c => c.isUnsuitable).length
    };

    res.json({ distribution, total: commits.length });
  } catch (error) {
    next(error);
  }
});

// Earnings over time (from successful tasks)
router.get('/earnings-timeline', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const tasks = await SuccessfulTask.findAll({
      where: {
        createdAt: { [Op.gte]: startDate },
        payoutAmount: { [Op.not]: null }
      },
      attributes: ['createdAt', 'payoutAmount'],
      include: [
        {
          model: Commit,
          as: 'commit',
          attributes: ['habitateScore'],
          include: [
            {
              model: GitRepo,
              as: 'repo',
              attributes: ['repoName', 'fullName']
            }
          ]
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    // Group by date
    const dailyData = {};
    tasks.forEach(task => {
      const date = new Date(task.createdAt).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { date, total: 0, easy: 0, inDistribution: 0 };
      }
      const amount = parseFloat(task.payoutAmount) || 0;
      dailyData[date].total += amount;
      
      const score = task.commit?.habitateScore || 0;
      if (score < 80) {
        dailyData[date].easy += amount;
      } else {
        dailyData[date].inDistribution += amount;
      }
    });

    const data = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// Earnings by repo
router.get('/earnings-by-repo', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const tasks = await SuccessfulTask.findAll({
      where: {
        createdAt: { [Op.gte]: startDate },
        payoutAmount: { [Op.not]: null }
      },
      attributes: ['payoutAmount'],
      include: [
        {
          model: Commit,
          as: 'commit',
          attributes: ['id'],
          include: [
            {
              model: GitRepo,
              as: 'repo',
              attributes: ['repoName', 'fullName'],
              required: true
            }
          ]
        }
      ]
    });

    const repoData = {};
    tasks.forEach(task => {
      const repoName = task.commit?.repo?.repoName || task.commit?.repo?.fullName || 'Unknown';
      if (!repoData[repoName]) {
        repoData[repoName] = 0;
      }
      repoData[repoName] += parseFloat(task.payoutAmount) || 0;
    });

    const data = Object.entries(repoData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const total = data.reduce((sum, item) => sum + item.value, 0);

    res.json({ data, total });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
