const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const reservationsSyncCron = require('../services/reservationsSyncCron');
const { GitRepo, UserHabitatAccount } = require('../models');

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// Get reservations sync cron schedule and enabled state
router.get('/reservations-sync-cron', (req, res) => {
  try {
    res.json({
      enabled: reservationsSyncCron.isEnabled(),
      schedule: reservationsSyncCron.getSchedule(),
      isRunning: reservationsSyncCron.isRunning
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cron schedule' });
  }
});

// Update reservations sync cron schedule
router.post('/reservations-sync-cron', (req, res) => {
  try {
    if (!reservationsSyncCron.isEnabled()) {
      return res.status(400).json({
        error: 'Reservations sync is disabled. Set RESERVATIONS_SYNC_ENABLED=true in the backend environment to enable.'
      });
    }
    const { schedule } = req.body;
    
    if (!schedule) {
      return res.status(400).json({ error: 'Schedule is required' });
    }

    // Validate cron schedule
    const cron = require('node-cron');
    if (!cron.validate(schedule)) {
      return res.status(400).json({ error: 'Invalid cron schedule format' });
    }

    reservationsSyncCron.setSchedule(schedule);
    
    res.json({
      message: 'Cron schedule updated successfully',
      schedule: reservationsSyncCron.getSchedule(),
      isRunning: reservationsSyncCron.isRunning
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to update cron schedule' });
  }
});

// Manually trigger reservations sync
router.post('/reservations-sync-cron/trigger', async (req, res) => {
  try {
    if (!reservationsSyncCron.isEnabled()) {
      return res.status(400).json({
        error: 'Reservations sync is disabled. Set RESERVATIONS_SYNC_ENABLED=true in the backend environment to enable.'
      });
    }
    await reservationsSyncCron.triggerSync();
    res.json({ message: 'Reservations sync triggered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to trigger sync' });
  }
});

// Export repositories (active only) as JSON: habitatRepoId, repoName, fullName, status, cutoffDate
router.get('/repos/export', async (req, res) => {
  try {
    const repos = await GitRepo.findAll({
      where: { isActive: true },
      attributes: ['habitatRepoId', 'repoName', 'fullName', 'isActive', 'cutoffDate'],
      order: [['fullName', 'ASC']],
      raw: true
    });
    const exportData = repos.map((r) => ({
      habitatRepoId: r.habitatRepoId,
      repoName: r.repoName,
      fullName: r.fullName,
      status: Boolean(r.isActive),
      cutoffDate: r.cutoffDate
    }));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="repos-export.json"');
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to export repositories' });
  }
});

// Export Habitat accounts as JSON: token, accountName (admin: all accounts)
router.get('/habitat-accounts/export', async (req, res) => {
  try {
    const accounts = await UserHabitatAccount.findAll({
      attributes: ['accountName', 'apiToken'],
      order: [['accountName', 'ASC']],
      raw: true
    });
    const exportData = accounts.map((a) => ({
      accountName: a.accountName,
      token: a.apiToken
    }));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="habitat-accounts-export.json"');
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to export Habitat accounts' });
  }
});

module.exports = router;
