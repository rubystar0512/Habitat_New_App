const express = require('express');
const { Op } = require('sequelize');
const { Feedback, User } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { idParamRule, paginationRules, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get feedback list
// - Team members: only their own feedback
// - Admins: all feedback with filters
router.get('/', paginationRules, handleValidationErrors, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status;
    const category = req.query.category;
    const priority = req.query.priority;
    const userId = req.query.user_id;

    const where = {};
    
    // Team members can only see their own feedback
    if (req.user.role !== 'admin') {
      where.userId = req.userId;
    } else {
      // Admins can filter by user_id
      if (userId) {
        where.userId = parseInt(userId);
      }
    }

    // Apply filters
    if (status) {
      where.status = status;
    }
    if (category) {
      where.category = category;
    }
    if (priority) {
      where.priority = priority;
    }

    const { count, rows: feedbacks } = await Feedback.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        },
        {
          model: User,
          as: 'resolver',
          attributes: ['id', 'username'],
          required: false
        }
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      feedbacks,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

// Get single feedback by ID
router.get('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const feedback = await Feedback.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        },
        {
          model: User,
          as: 'resolver',
          attributes: ['id', 'username'],
          required: false
        }
      ]
    });

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    // Team members can only view their own feedback
    if (req.user.role !== 'admin' && feedback.userId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ feedback });
  } catch (error) {
    next(error);
  }
});

// Create feedback (team members only)
router.post('/', async (req, res, next) => {
  try {
    const { title, category, description, priority } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const feedback = await Feedback.create({
      userId: req.userId,
      title: title.trim(),
      category: category || 'other',
      description: description.trim(),
      priority: priority || 'medium',
      status: 'pending'
    });

    const feedbackWithUser = await Feedback.findByPk(feedback.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback: feedbackWithUser
    });
  } catch (error) {
    next(error);
  }
});

// Update feedback status and admin notes (admin only)
router.patch('/:id', idParamRule, handleValidationErrors, requireAdmin, async (req, res, next) => {
  try {
    const { status, admin_notes } = req.body;

    const feedback = await Feedback.findByPk(req.params.id);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    const updateData = {};
    if (status) {
      updateData.status = status;
      // If resolving, set resolvedAt and resolvedBy
      if (status === 'resolved' || status === 'closed') {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = req.userId;
      } else if (status === 'pending' || status === 'reviewing' || status === 'in_progress') {
        // If reopening, clear resolved fields
        updateData.resolvedAt = null;
        updateData.resolvedBy = null;
      }
    }
    if (admin_notes !== undefined) {
      updateData.adminNotes = admin_notes ? admin_notes.trim() : null;
    }

    await feedback.update(updateData);

    const updatedFeedback = await Feedback.findByPk(feedback.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        },
        {
          model: User,
          as: 'resolver',
          attributes: ['id', 'username'],
          required: false
        }
      ]
    });

    res.json({
      message: 'Feedback updated successfully',
      feedback: updatedFeedback
    });
  } catch (error) {
    next(error);
  }
});

// Delete feedback (only by owner or admin)
router.delete('/:id', idParamRule, handleValidationErrors, async (req, res, next) => {
  try {
    const feedback = await Feedback.findByPk(req.params.id);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    // Only owner or admin can delete
    if (feedback.userId !== req.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await feedback.destroy();

    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get feedback statistics (admin only)
router.get('/stats/overview', requireAdmin, async (req, res, next) => {
  try {
    const total = await Feedback.count();
    const byStatus = await Feedback.findAll({
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });
    const byCategory = await Feedback.findAll({
      attributes: [
        'category',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['category'],
      raw: true
    });
    const byPriority = await Feedback.findAll({
      attributes: [
        'priority',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['priority'],
      raw: true
    });
    const pending = await Feedback.count({ where: { status: 'pending' } });
    const inProgress = await Feedback.count({ where: { status: 'in_progress' } });
    const resolved = await Feedback.count({ where: { status: { [Op.in]: ['resolved', 'closed'] } } });

    res.json({
      total,
      pending,
      inProgress,
      resolved,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      }, {}),
      byCategory: byCategory.reduce((acc, item) => {
        acc[item.category] = parseInt(item.count);
        return acc;
      }, {}),
      byPriority: byPriority.reduce((acc, item) => {
        acc[item.priority] = parseInt(item.count);
        return acc;
      }, {})
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
