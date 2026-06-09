const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/authMiddleware');
const { getAnalysisHistory } = require('../services/firebaseService');

// GET /api/history/:userId
// Must never 404. If no history exists, return HTTP 200 with an empty array.
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const effectiveUserId = req.user?.uid || userId || 'demo_user';
    const history = await getAnalysisHistory(effectiveUserId);
    return res.status(200).json({ success: true, data: history || [], userId: effectiveUserId });
  } catch (error) {
    console.error('History error:', error);
    return res.status(200).json({ success: true, data: [], userId: req.user?.uid || 'demo_user' });
  }
});

module.exports = router;

