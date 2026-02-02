const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const userRoutes = require('./users');
const repoRoutes = require('./repos');
const commitRoutes = require('./commits');
const reservationRoutes = require('./reservations');
const accountRoutes = require('./accounts');
const memoRoutes = require('./memo');
const successfulTaskRoutes = require('./successfulTasks');
const statsRoutes = require('./stats');
const feedbackRoutes = require('./feedback');

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/repos', repoRoutes);
router.use('/commits', commitRoutes);
router.use('/reservations', reservationRoutes);
router.use('/accounts', accountRoutes);
router.use('/memo', memoRoutes);
router.use('/successful-tasks', successfulTaskRoutes);
router.use('/stats', statsRoutes);
router.use('/feedback', feedbackRoutes);

module.exports = router;
