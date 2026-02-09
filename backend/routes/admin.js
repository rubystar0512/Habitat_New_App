const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const reservationsSyncCron = require('../services/reservationsSyncCron');

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

module.exports = router;
