const express = require('express');
const { Sequelize, Op } = require('sequelize');
const { Commit, GitRepo, Reservation, User, SuccessfulTask, UserHabitatAccount, MemoCommit, CommitStatusCache } = require('../models');
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
      attributes: ['id', 'repoName', 'fullName', 'cutoffDate'],
      include: [
        {
          model: Commit,
          as: 'commits',
          attributes: ['id', 'commitDate'],
          required: false
        }
      ]
    });

    const data = repos.map(repo => {
      let commits = repo.commits || [];

      // Filter by cutoff date if it exists
      if (repo.cutoffDate) {
        const cutoffDate = new Date(repo.cutoffDate);
        commits = commits.filter(c => {
          if (!c.commitDate) return false;
          const commitDate = new Date(c.commitDate);
          return commitDate >= cutoffDate;
        });
      }

      return {
        name: repo.repoName || repo.fullName,
        value: commits.length
      };
    }).sort((a, b) => b.value - a.value);

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
      attributes: ['id', 'repoName', 'fullName', 'cutoffDate'],
      include: [
        {
          model: Commit,
          as: 'commits',
          attributes: ['habitateScore', 'suitabilityScore', 'difficultyScore', 'commitDate'],
          required: false
        }
      ]
    });

    const data = repos.map(repo => {
      let commits = repo.commits || [];

      // Filter by cutoff date if it exists
      if (repo.cutoffDate) {
        const cutoffDate = new Date(repo.cutoffDate);
        commits = commits.filter(c => {
          if (!c.commitDate) return false;
          const commitDate = new Date(c.commitDate);
          return commitDate >= cutoffDate;
        });
      }

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
        },
        {
          model: UserHabitatAccount,
          as: 'habitatAccounts',
          attributes: ['id', 'isActive'],
          required: false
        }
      ]
    });

    const data = users.map(user => {
      const reservations = user.reservations || [];
      const tasks = user.submittedTasks || [];
      const accounts = user.habitatAccounts || [];
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
        avgAiSuccessRate: avgAiSuccess,
        accountCount: accounts.length,
        activeAccountCount: accounts.filter(a => a.isActive).length
      };
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// Commit score distribution (overall or per-repo)
router.get('/score-distribution', async (req, res, next) => {
  try {
    const repoId = req.query.repoId ? parseInt(req.query.repoId) : null;
    
    let whereClause = {
      habitateScore: { [Op.not]: null }
    };

    // If repoId is provided, filter by repo and respect cutoff date
    if (repoId) {
      const repo = await GitRepo.findByPk(repoId, {
        attributes: ['id', 'cutoffDate']
      });

      if (!repo) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      whereClause.repoId = repoId;

      // Filter commits by cutoff date if it exists
      if (repo.cutoffDate) {
        whereClause.commitDate = {
          [Op.gte]: new Date(repo.cutoffDate)
        };
      }
    }

    const commits = await Commit.findAll({
      attributes: ['habitateScore', 'isUnsuitable'],
      where: whereClause
    });

    const distribution = {
      tooEasy: commits.filter(c => c.habitateScore < 50).length,
      easy: commits.filter(c => c.habitateScore >= 50 && c.habitateScore < 80).length,
      inDistribution: commits.filter(c => c.habitateScore >= 80 && c.habitateScore < 120).length,
      hard: commits.filter(c => c.habitateScore >= 120 && c.habitateScore < 150).length,
      tooHard: commits.filter(c => c.habitateScore >= 150).length,
      unsuitable: commits.filter(c => c.isUnsuitable).length
    };

    res.json({ distribution, total: commits.length, repoId: repoId || null });
  } catch (error) {
    next(error);
  }
});

// Score distribution per repository
router.get('/score-distribution-by-repo', async (req, res, next) => {
  try {
    const repos = await GitRepo.findAll({
      where: { isActive: true },
      attributes: ['id', 'repoName', 'fullName', 'cutoffDate'],
      include: [
        {
          model: Commit,
          as: 'commits',
          attributes: ['habitateScore', 'isUnsuitable', 'commitDate'],
          required: false,
          where: {
            habitateScore: { [Op.not]: null }
          }
        }
      ]
    });

    const data = repos.map(repo => {
      let commits = repo.commits || [];

      // Filter by cutoff date if it exists
      if (repo.cutoffDate) {
        const cutoffDate = new Date(repo.cutoffDate);
        commits = commits.filter(c => {
          if (!c.commitDate) return false;
          const commitDate = new Date(c.commitDate);
          return commitDate >= cutoffDate;
        });
      }

      const distribution = {
        tooEasy: commits.filter(c => c.habitateScore < 50).length,
        easy: commits.filter(c => c.habitateScore >= 50 && c.habitateScore < 80).length,
        inDistribution: commits.filter(c => c.habitateScore >= 80 && c.habitateScore < 120).length,
        hard: commits.filter(c => c.habitateScore >= 120 && c.habitateScore < 150).length,
        tooHard: commits.filter(c => c.habitateScore >= 150).length,
        unsuitable: commits.filter(c => c.isUnsuitable).length
      };

      return {
        repoId: repo.id,
        repoName: repo.repoName || repo.fullName,
        distribution,
        total: commits.length
      };
    }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);

    res.json({ data });
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
          attributes: ['id', 'commitDate'],
          include: [
            {
              model: GitRepo,
              as: 'repo',
              attributes: ['id', 'repoName', 'fullName', 'cutoffDate'],
              required: true
            }
          ]
        }
      ]
    });

    const repoData = {};
    tasks.forEach(task => {
      const repo = task.commit?.repo;
      if (!repo) return;

      // Filter by cutoff date if it exists
      if (repo.cutoffDate && task.commit?.commitDate) {
        const cutoffDate = new Date(repo.cutoffDate);
        const commitDate = new Date(task.commit.commitDate);
        if (commitDate < cutoffDate) {
          return; // Skip this task if commit is before cutoff date
        }
      }

      const repoName = repo.repoName || repo.fullName || 'Unknown';
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

// Account count per team member (admin only)
router.get('/team-accounts', requireAdmin, async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username'],
      include: [
        {
          model: UserHabitatAccount,
          as: 'habitatAccounts',
          attributes: ['id', 'isActive'],
          required: false
        }
      ]
    });

    const data = users.map(user => {
      const accounts = user.habitatAccounts || [];
      return {
        username: user.username,
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter(a => a.isActive).length,
        inactiveAccounts: accounts.filter(a => !a.isActive).length
      };
    }).filter(u => u.totalAccounts > 0); // Only show users with accounts

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// Paid out commits scores histogram (admin only)
router.get('/paid-out-scores', requireAdmin, async (req, res, next) => {
  try {
    // Get all commits that have paid_out status in cache
    const paidOutStatuses = await CommitStatusCache.findAll({
      where: {
        status: 'paid_out'
      },
      attributes: ['commitId']
    });

    // Get unique commit IDs
    const commitIds = [...new Set(paidOutStatuses.map(s => s.commitId))];

    if (commitIds.length === 0) {
      return res.json({
        habitateScore: [],
        suitabilityScore: [],
        difficultyScore: [],
        total: 0
      });
    }

    // Get commits with their scores
    const commits = await Commit.findAll({
      where: {
        id: { [Op.in]: commitIds }
      },
      attributes: ['habitateScore', 'suitabilityScore', 'difficultyScore']
    });

    // Create histogram bins
    const createHistogram = (values, min, max, binCount = 20) => {
      const bins = Array(binCount).fill(0);
      const binSize = (max - min) / binCount;
      
      values.forEach(value => {
        if (value !== null && value !== undefined) {
          const binIndex = Math.min(
            Math.floor((value - min) / binSize),
            binCount - 1
          );
          if (binIndex >= 0) {
            bins[binIndex]++;
          }
        }
      });

      return bins.map((count, index) => ({
        bin: min + (index * binSize) + (binSize / 2), // Center of bin
        count
      }));
    };

    // Extract scores
    const habitateScores = commits
      .map(c => parseFloat(c.habitateScore))
      .filter(s => !isNaN(s));
    const suitabilityScores = commits
      .map(c => parseFloat(c.suitabilityScore))
      .filter(s => !isNaN(s));
    const difficultyScores = commits
      .map(c => parseFloat(c.difficultyScore))
      .filter(s => !isNaN(s));

    // Calculate ranges - use reduce instead of spread operator to avoid stack overflow
    const habitateMin = habitateScores.length > 0 ? habitateScores.reduce((a, b) => Math.min(a, b)) : 0;
    const habitateMax = habitateScores.length > 0 ? habitateScores.reduce((a, b) => Math.max(a, b)) : 100;
    const suitabilityMin = suitabilityScores.length > 0 ? suitabilityScores.reduce((a, b) => Math.min(a, b)) : 0;
    const suitabilityMax = suitabilityScores.length > 0 ? suitabilityScores.reduce((a, b) => Math.max(a, b)) : 100;
    const difficultyMin = difficultyScores.length > 0 ? difficultyScores.reduce((a, b) => Math.min(a, b)) : 0;
    const difficultyMax = difficultyScores.length > 0 ? difficultyScores.reduce((a, b) => Math.max(a, b)) : 100;

    res.json({
      habitateScore: createHistogram(habitateScores, habitateMin, habitateMax),
      suitabilityScore: createHistogram(suitabilityScores, suitabilityMin, suitabilityMax),
      difficultyScore: createHistogram(difficultyScores, difficultyMin, difficultyMax),
      total: commits.length,
      stats: {
        habitate: {
          min: habitateMin,
          max: habitateMax,
          avg: habitateScores.length > 0 ? habitateScores.reduce((a, b) => a + b, 0) / habitateScores.length : 0
        },
        suitability: {
          min: suitabilityMin,
          max: suitabilityMax,
          avg: suitabilityScores.length > 0 ? suitabilityScores.reduce((a, b) => a + b, 0) / suitabilityScores.length : 0
        },
        difficulty: {
          min: difficultyMin,
          max: difficultyMax,
          avg: difficultyScores.length > 0 ? difficultyScores.reduce((a, b) => a + b, 0) / difficultyScores.length : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// All commits scores histogram
router.get('/all-commits-scores', async (req, res, next) => {
  try {
    // Get all commits with scores
    const commits = await Commit.findAll({
      where: {
        habitateScore: { [Op.not]: null }
      },
      attributes: ['habitateScore', 'suitabilityScore', 'difficultyScore']
    });

    if (commits.length === 0) {
      return res.json({
        habitateScore: [],
        suitabilityScore: [],
        difficultyScore: [],
        total: 0,
        stats: {
          habitate: { min: 0, max: 0, avg: 0 },
          suitability: { min: 0, max: 0, avg: 0 },
          difficulty: { min: 0, max: 0, avg: 0 }
        }
      });
    }

    // Create histogram bins
    const createHistogram = (values, min, max, binCount = 20) => {
      const bins = Array(binCount).fill(0);
      const binSize = (max - min) / binCount;
      
      values.forEach(value => {
        if (value !== null && value !== undefined) {
          const binIndex = Math.min(
            Math.floor((value - min) / binSize),
            binCount - 1
          );
          if (binIndex >= 0) {
            bins[binIndex]++;
          }
        }
      });

      return bins.map((count, index) => ({
        bin: min + (index * binSize) + (binSize / 2), // Center of bin
        count
      }));
    };

    // Extract scores
    const habitateScores = commits
      .map(c => parseFloat(c.habitateScore))
      .filter(s => !isNaN(s));
    const suitabilityScores = commits
      .map(c => parseFloat(c.suitabilityScore))
      .filter(s => !isNaN(s));
    const difficultyScores = commits
      .map(c => parseFloat(c.difficultyScore))
      .filter(s => !isNaN(s));

    // Calculate ranges - use reduce instead of spread operator to avoid stack overflow
    const habitateMin = habitateScores.length > 0 ? habitateScores.reduce((a, b) => Math.min(a, b)) : 0;
    const habitateMax = habitateScores.length > 0 ? habitateScores.reduce((a, b) => Math.max(a, b)) : 100;
    const suitabilityMin = suitabilityScores.length > 0 ? suitabilityScores.reduce((a, b) => Math.min(a, b)) : 0;
    const suitabilityMax = suitabilityScores.length > 0 ? suitabilityScores.reduce((a, b) => Math.max(a, b)) : 100;
    const difficultyMin = difficultyScores.length > 0 ? difficultyScores.reduce((a, b) => Math.min(a, b)) : 0;
    const difficultyMax = difficultyScores.length > 0 ? difficultyScores.reduce((a, b) => Math.max(a, b)) : 100;

    res.json({
      habitateScore: createHistogram(habitateScores, habitateMin, habitateMax),
      suitabilityScore: createHistogram(suitabilityScores, suitabilityMin, suitabilityMax),
      difficultyScore: createHistogram(difficultyScores, difficultyMin, difficultyMax),
      total: commits.length,
      stats: {
        habitate: {
          min: habitateMin,
          max: habitateMax,
          avg: habitateScores.length > 0 ? habitateScores.reduce((a, b) => a + b, 0) / habitateScores.length : 0
        },
        suitability: {
          min: suitabilityMin,
          max: suitabilityMax,
          avg: suitabilityScores.length > 0 ? suitabilityScores.reduce((a, b) => a + b, 0) / suitabilityScores.length : 0
        },
        difficulty: {
          min: difficultyMin,
          max: difficultyMax,
          avg: difficultyScores.length > 0 ? difficultyScores.reduce((a, b) => a + b, 0) / difficultyScores.length : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
