const express = require('express');
const { Op } = require('sequelize');
const { Commit, GitRepo, CommitFile, CommitFileStatsCache } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { commitFilterRules, paginationRules, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get commits with filtering
router.get('/', commitFilterRules, paginationRules, handleValidationErrors, async (req, res, next) => {
  try {
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;

    // Build where clause
    const where = {};
    if (req.query.repo_id) {
      where.repoId = parseInt(req.query.repo_id);
    }
    if (req.query.min_habitate_score) {
      where.habitateScore = { [Op.gte]: parseInt(req.query.min_habitate_score) };
    }
    if (req.query.min_difficulty_score) {
      where.difficultyScore = { [Op.gte]: parseFloat(req.query.min_difficulty_score) };
    }
    if (req.query.min_suitability_score) {
      where.suitabilityScore = { [Op.gte]: parseFloat(req.query.min_suitability_score) };
    }
    if (req.query.has_dependency_changes !== undefined) {
      where.hasDependencyChanges = req.query.has_dependency_changes === 'true';
    }
    if (req.query.is_unsuitable !== undefined) {
      where.isUnsuitable = req.query.is_unsuitable === 'true';
    }
    if (req.query.is_behavior_preserving_refactor !== undefined) {
      where.isBehaviorPreservingRefactor = req.query.is_behavior_preserving_refactor === 'true';
    }

    const include = [
      {
        model: GitRepo,
        as: 'repo',
        attributes: ['id', 'repoName', 'fullName']
      }
    ];

    // Handle file pattern filters using cache table
    if (req.query.single_file_200plus === 'true') {
      include.push({
        model: CommitFileStatsCache,
        as: 'fileStatsCache',
        where: { singleFile200plus: true },
        required: true
      });
    }

    if (req.query.multi_file_300plus === 'true') {
      include.push({
        model: CommitFileStatsCache,
        as: 'fileStatsCache',
        where: { multiFile300plus: true },
        required: true
      });
    }

    const { count, rows: commits } = await Commit.findAndCountAll({
      where,
      include,
      limit,
      offset,
      order: [['habitateScore', 'DESC'], ['commitDate', 'DESC']]
    });

    res.json({
      commits,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

// Get commit by ID with details
router.get('/:id', async (req, res, next) => {
  try {
    const commit = await Commit.findByPk(req.params.id, {
      include: [
        {
          model: GitRepo,
          as: 'repo',
          attributes: ['id', 'repoName', 'fullName', 'cutoffDate']
        },
        {
          model: CommitFile,
          as: 'files',
          attributes: ['id', 'filePath', 'fileName', 'additions', 'deletions', 'isTestFile', 'isDependencyFile']
        }
      ]
    });

    if (!commit) {
      return res.status(404).json({ error: 'Commit not found' });
    }

    res.json({ commit });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
