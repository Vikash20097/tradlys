const { body, param, query, validationResult } = require('express-validator');

exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

exports.validateAnalyzeText = [
  body('question')
    .isString().isLength({ min: 3, max: 10000 })
    .withMessage('Question must be 3-10000 characters'),
  body('marketName')
    .optional().isString().isLength({ max: 200 })
    .withMessage('Invalid market name'),
  body('timeframe')
    .optional().isString().isLength({ max: 50 })
    .withMessage('Invalid timeframe')
];

exports.validateAnalyzeImage = [
  body('question').optional().isString().isLength({ min: 0, max: 10000 }),
  body('marketName').optional().isString().isLength({ max: 200 }),
  body('timeframe').optional().isString().isLength({ max: 50 })
];

exports.validateSaveHistory = [
  body('marketName').isString().isLength({ min: 1, max: 200 }),
  body('analysisData').isObject(),
  body('type').isIn(['image', 'text'])
];

exports.validateUserId = [
  param('userId').isString().isLength({ min: 1, max: 128 })
];

exports.validateAdminAccess = [
  query('token').isString().isLength({ min: 1 })
];

exports.validateWatchlistAdd = [
  body('symbol')
    .isString()
    .isLength({ min: 2, max: 20 })
    .withMessage('Symbol must be 2-20 characters')
    .matches(/^[A-Z0-9 .\-]+$/i)
    .withMessage('Invalid symbol format')
];

exports.validateWatchlistRemove = [
  body('symbol')
    .optional()
    .isString()
    .isLength({ min: 2, max: 20 })
    .withMessage('Symbol must be 2-20 characters'),
  body('watchlistId')
    .optional()
    .isString()
    .isLength({ min: 1, max: 128 })
    .withMessage('Invalid watchlist id')
];

exports.validateWatchlistList = [
  query('userId')
    .optional()
    .isString()
    .isLength({ min: 1, max: 128 })
];

exports.validateHistoryDetail = [
  param('reportId').isString().isLength({ min: 1, max: 128 })
];
