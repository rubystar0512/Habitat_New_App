const express = require('express');
const { GitRepo, UserHabitatAccount } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { idParamRule, paginationRules, handleValidationErrors } = require('../middleware/validation');
const habitatApiService = require('../services/habitatApi');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all repos
router.get('/', paginationRules, handleValidationErrors, async (req, res, next) => {
  try {
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;
    const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;

    const where = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const { count, rows: repos } = await GitRepo.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      repos,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

// Get repo by ID
router.get('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const repo = await GitRepo.findByPk(req.params.id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    res.json({ repo });
  } catch (error) {
    next(error);
  }
});

// Create repo (admin only)
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { repoName, fullName, habitatRepoId, defaultBranch, cutoffDate, isActive } = req.body;

    const repo = await GitRepo.create({
      repoName,
      fullName,
      habitatRepoId,
      defaultBranch: defaultBranch || 'main',
      cutoffDate,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({ repo });
  } catch (error) {
    next(error);
  }
});

// Update repo (admin only)
router.patch('/:id', requireAdmin, idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const repo = await GitRepo.findByPk(req.params.id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const allowedFields = ['cutoffDate', 'isActive', 'defaultBranch', 'habitatRepoId'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    await repo.update(updates);

    res.json({ repo });
  } catch (error) {
    next(error);
  }
});

// Update fetch status (admin only)
router.patch('/:id/fetch-status', requireAdmin, idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const { fetchStatus, fetchErrorMessage, totalCommitsFetched } = req.body;

    const repo = await GitRepo.findByPk(req.params.id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const updates = {};
    if (fetchStatus) updates.fetchStatus = fetchStatus;
    if (fetchErrorMessage !== undefined) updates.fetchErrorMessage = fetchErrorMessage;
    if (totalCommitsFetched !== undefined) updates.totalCommitsFetched = totalCommitsFetched;
    if (fetchStatus === 'idle') updates.lastFetchedAt = new Date();

    await repo.update(updates);

    res.json({ repo });
  } catch (error) {
    next(error);
  }
});

// Delete repo (admin only)
router.delete('/:id', requireAdmin, idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const repo = await GitRepo.findByPk(req.params.id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    await repo.destroy();

    res.json({
      message: 'Repository deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Sync repos from Habitat API (admin only)
router.post('/sync-from-habitat', requireAdmin, async (req, res, next) => {
  try {
    // Get the first active account for the user to use for API calls
    const account = await UserHabitatAccount.findOne({
      where: { userId: req.userId, isActive: true },
      order: [['createdAt', 'ASC']]
    });

    if (!account) {
      return res.status(400).json({ error: 'No active Habitat account found. Please create an active account first.' });
    }

    const apiUrl = account.apiUrl || process.env.HABITAT_API_URL || 'https://code.habitat.inc';
    
    // Fetch repos statistics from Habitat API
    const result = await habitatApiService.getReposStatistics(account.apiToken, apiUrl);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to fetch repos from Habitat API' });
    }

    const items = result.items || [];
    let updatedCount = 0;
    let createdCount = 0;
    const errors = [];

    for (const item of items) {
      try {
        const habitatRepoId = item.id;
        const repoOrg = item.repo_org || '';
        const repoName = item.repo_name || '';
        const fullName = repoOrg && repoName ? `${repoOrg}/${repoName}` : repoName;
        const commitCutoffDate = item.commit_cutoff_date;
        const submissionStatus = item.submission_status;
        
        // Determine if active (submission_status === 'opened' means active)
        const isActive = true;

        if (!habitatRepoId || !repoName) {
          errors.push({ habitatRepoId, error: 'Missing required fields (id or repo_name)' });
          continue;
        }

        // Find existing repo by habitatRepoId
        const existingRepo = await GitRepo.findOne({
          where: { habitatRepoId }
        });

        if (existingRepo) {
          // Update existing repo
          const updates = {
            isActive
          };

          // Only update cutoffDate if it's not null in the API response
          if (commitCutoffDate) {
            // Parse ISO date string (e.g., "2015-01-01T00:00:00Z")
            const cutoffDate = new Date(commitCutoffDate);
            if (!isNaN(cutoffDate.getTime())) {
              updates.cutoffDate = cutoffDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
            }
          }
          // If commitCutoffDate is null, we don't update cutoffDate (keep current DB data)

          await existingRepo.update(updates);
          updatedCount++;
        } else {
          // Create new repo
          const newRepoData = {
            repoName,
            fullName,
            habitatRepoId,
            defaultBranch: 'main',
            isActive
          };

          // Only set cutoffDate if it's not null
          if (commitCutoffDate) {
            const cutoffDate = new Date(commitCutoffDate);
            if (!isNaN(cutoffDate.getTime())) {
              newRepoData.cutoffDate = cutoffDate.toISOString().split('T')[0];
            }
          }

          await GitRepo.create(newRepoData);
          createdCount++;
        }
      } catch (itemError) {
        errors.push({
          habitatRepoId: item.id,
          error: itemError.message
        });
      }
    }

    res.json({
      message: `Sync completed: ${createdCount} created, ${updatedCount} updated`,
      created: createdCount,
      updated: updatedCount,
      total: items.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
