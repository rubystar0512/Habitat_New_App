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
  query('limit').optional().isInt({ min: 1, max: 10000 }).toInt(), // Increased max for memo and other large queries
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
  query('repo_ids').optional(), // array of repo ids (e.g. repo_ids=1&repo_ids=2)
  query('min_habitate_score').optional().isInt({ min: 0 }),
  query('max_habitate_score').optional().isInt({ min: 0 }),
  query('min_difficulty_score').optional().isFloat({ min: 0, max: 100 }),
  query('max_difficulty_score').optional().isFloat({ min: 0, max: 100 }),
  query('min_suitability_score').optional().isFloat({ min: 0, max: 100 }),
  query('max_suitability_score').optional().isFloat({ min: 0, max: 100 }),
  query('min_additions').optional().isInt({ min: 0 }),
  query('max_additions').optional().isInt({ min: 0 }),
  query('min_deletions').optional().isInt({ min: 0 }),
  query('max_deletions').optional().isInt({ min: 0 }),
  query('min_net_change').optional().isInt(),
  query('max_net_change').optional().isInt(),
  query('min_file_changes').optional().isInt({ min: 0 }),
  query('max_file_changes').optional().isInt({ min: 0 }),
  query('is_merge').optional().isBoolean(),
  query('author').optional().isString(),
  query('merged_commit').optional().isString(),
  query('base_commit').optional().isString(),
  query('pr_number').optional().isInt({ min: 1 }),
  query('message').optional().isString(),
  query('date_from').optional().isISO8601(),
  query('date_to').optional().isISO8601(),
  query('has_dependency_changes').optional().isBoolean(),
  query('is_unsuitable').optional().isBoolean(),
  query('is_behavior_preserving_refactor').optional().isBoolean(),
  query('single_file_200plus').optional().isBoolean(),
  query('multi_file_300plus').optional().isBoolean(),
  query('sort_field').optional().isString(),
  query('sort_order').optional().isIn(['ASC', 'DESC']),
  query('display_status').optional().isIn(['reserved', 'available', 'paid_out', 'unavailable', 'too_easy', 'already_reserved', 'in_distribution', 'pending_admin_approval', 'failed', 'error']),
  query('status').optional().isIn(['reserved', 'available', 'paid_out', 'unavailable', 'too_easy', 'already_reserved', 'in_distribution', 'pending_admin_approval', 'failed', 'error'])
];

// Reservation validations
const createReservationRules = [
  body('commit_id').optional().isInt({ min: 1 }),
  body('account_id').isInt({ min: 1 }).withMessage('Valid account_id is required'),
  body('commit_ids').optional().isArray(),
  body('commit_ids.*').optional().isInt({ min: 1 })
];
const bulkReservationRules = [
  body('account_id').isInt({ min: 1 }).withMessage('Valid account_id is required'),
  body('commit_ids').isArray({ min: 1 }).withMessage('commit_ids array is required'),
  body('commit_ids.*').isInt({ min: 1 }).withMessage('Each commit_id must be a positive integer')
];

// Successful task validations
const createSuccessfulTaskRules = [
  body('task_name').notEmpty().withMessage('Task name is required'),
  body('task_description').notEmpty().withMessage('Task description is required'),
  body('git_base_commit').notEmpty().withMessage('git_base_commit is required').isLength({ min: 7, max: 40 }).withMessage('git_base_commit must be 7-40 characters (commit hash)'),
  body('merge_commit').notEmpty().withMessage('merge_commit is required').isLength({ min: 7, max: 40 }).withMessage('merge_commit must be 7-40 characters (commit hash)'),
  body('golden_patch').notEmpty().withMessage('Golden patch is required'),
  body('test_patch').notEmpty().withMessage('Test patch is required'),
  body('base_patch').optional(),
  body('pr_number').optional().isInt({ min: 1 }),
  body('hints').optional().isString(),
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
  bulkReservationRules,
  createSuccessfulTaskRules
};
