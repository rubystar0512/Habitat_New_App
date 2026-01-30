const { body, query, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Common validation rules
const paginationRules = [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
];

const idParamRule = [
  param('id').isInt({ min: 1 }).withMessage('Invalid ID')
];

// Auth validations
const loginRules = [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const registerRules = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be 3-50 characters'),
  body('email')
    .isEmail()
    .withMessage('Invalid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
];

// Commit validations
const commitFilterRules = [
  query('repo_id').optional().isInt({ min: 1 }),
  query('min_habitate_score').optional().isInt({ min: 0 }),
  query('min_difficulty_score').optional().isFloat({ min: 0, max: 100 }),
  query('min_suitability_score').optional().isFloat({ min: 0, max: 100 }),
  query('has_dependency_changes').optional().isBoolean(),
  query('is_unsuitable').optional().isBoolean(),
  query('single_file_200plus').optional().isBoolean(),
  query('multi_file_300plus').optional().isBoolean()
];

// Reservation validations
const createReservationRules = [
  body('commit_id').isInt({ min: 1 }).withMessage('Valid commit_id is required'),
  body('account_id').isInt({ min: 1 }).withMessage('Valid account_id is required')
];

// Successful task validations
const createSuccessfulTaskRules = [
  body('commit_id').isInt({ min: 1 }).withMessage('Valid commit_id is required'),
  body('task_name').notEmpty().withMessage('Task name is required'),
  body('task_description').notEmpty().withMessage('Task description is required'),
  body('git_base_commit').isLength({ min: 40, max: 40 }).withMessage('Invalid git_base_commit'),
  body('merge_commit').isLength({ min: 40, max: 40 }).withMessage('Invalid merge_commit'),
  body('golden_patch').notEmpty().withMessage('Golden patch is required'),
  body('test_patch').notEmpty().withMessage('Test patch is required'),
  body('base_patch').optional(),
  body('pr_number').optional().isInt({ min: 1 }),
  body('ai_success_rate').optional().isFloat({ min: 0, max: 100 }),
  body('payout_amount').optional().isFloat({ min: 0 })
];

module.exports = {
  handleValidationErrors,
  paginationRules,
  idParamRule,
  loginRules,
  registerRules,
  commitFilterRules,
  createReservationRules,
  createSuccessfulTaskRules
};
