const express = require('express');
const { User } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { idParamRule, paginationRules, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all users (admin only)
router.get('/', requireAdmin, paginationRules, handleValidationErrors, async (req, res, next) => {
  try {
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;

    const { count, rows: users } = await User.findAndCountAll({
      limit,
      offset,
      attributes: { exclude: ['passwordHash'] },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      users,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

// Get user by ID
router.get('/:id', requireAdmin, idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['passwordHash'] }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// Approve user (admin only)
router.patch('/:id/approve', requireAdmin, idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({ isApproved: true });

    res.json({
      message: 'User approved successfully',
      user: {
        id: user.id,
        username: user.username,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update user role (admin only)
router.patch('/:id/role', requireAdmin, idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({ role });

    res.json({
      message: 'User role updated successfully',
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
