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

// Create user (admin only)
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { username, email, password, role = 'user', isApproved = false } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const bcrypt = require('bcryptjs');
    const { Op } = require('sequelize');

    // Check if user exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }]
      }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      username,
      email,
      passwordHash,
      role: role || 'user',
      isApproved: isApproved || false
    });

    const { passwordHash: _, ...userData } = user.toJSON();

    res.status(201).json({
      message: 'User created successfully',
      user: userData
    });
  } catch (error) {
    next(error);
  }
});

// Update user (admin only)
router.patch('/:id', requireAdmin, idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const { username, email, role, isApproved, password } = req.body;

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) {
      if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updateData.role = role;
    }
    if (isApproved !== undefined) updateData.isApproved = isApproved;
    if (password) {
      const bcrypt = require('bcryptjs');
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    await user.update(updateData);

    const { passwordHash: _, ...userData } = user.toJSON();

    res.json({
      message: 'User updated successfully',
      user: userData
    });
  } catch (error) {
    next(error);
  }
});

// Delete user (admin only)
router.delete('/:id', requireAdmin, idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting yourself
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await user.destroy();

    res.json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
