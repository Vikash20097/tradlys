const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { authenticate } = require('../middleware/authMiddleware');
const { analyzeLimiter } = require('../middleware/rateLimit');
const {
  validateAnalyzeImage,
  validateAnalyzeText,
  handleValidationErrors
} = require('../middleware/validateInput');
const { analyzeImage, analyzeText, buildQuotaFallback } = require('../services/geminiService');
const { getSafeFallbackMarketContext, buildMarketContext } = require('../services/marketService');
const { saveAnalysis, getAnalysisHistory, deleteAnalysis } = require('../services/firebaseService');
const { consumeCredit } = require('../services/creditService');

const path = require('path');

const safeAnalysisResult = (result, marketName, timeframe) => ({
  marketName: result.marketName || marketName || 'Generic',
  timeframe: result.timeframe || timeframe || 'Daily',
  overallBias: ['Bullish', 'Bearish', 'Sideways', 'Unclear'].includes(result.overallBias) ? result.overallBias : 'Unclear',
  trend: result.trend || '',
  marketStructure: result.marketStructure || '',
  liquidityZones: Array.isArray(result.liquidityZones) ? result.liquidityZones : [],
  invalidConditions: Array.isArray(result.invalidConditions) ? result.invalidConditions.slice(0, 3) : [],
  supportZones: Array.isArray(result.supportZones) ? result.supportZones : [],
  resistanceZones: Array.isArray(result.resistanceZones) ? result.resistanceZones : [],
  bullishScenario: result.bullishScenario || '',
  bearishScenario: result.bearishScenario || '',
  sidewaysScenario: result.sidewaysScenario || '',
  entryZoneLogic: result.entryZoneLogic || '',
  stopLossLogic: result.stopLossLogic || '',
  targetZones: Array.isArray(result.targetZones) ? result.targetZones : [],
  riskLevel: ['Low', 'Medium', 'High'].includes(result.riskLevel) ? result.riskLevel : 'Medium',
  confidence: ['Low', 'Medium', 'High'].includes(result.confidence) ? result.confidence : 'Low',
  keyReasons: Array.isArray(result.keyReasons) ? result.keyReasons.slice(0, 20) : [],
  newsImpact: result.newsImpact || '',
  liveMarketContext: result.liveMarketContext || 'No live context available.',
  finalEducationalNote: 'This is educational analysis only, not financial advice.'
});

const buildResponse = (result) => ({
  report: {
    ...safeAnalysisResult(result, result.marketName, result.timeframe),
    finalEducationalNote: 'This is educational analysis only, not financial advice.'
  }
});

router.post('/image',
  authenticate,
  analyzeLimiter,
  upload.single('chartImage'),
  validateAnalyzeImage,
  handleValidationErrors,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Chart image is required' });
      }
      if (!req.file.size || !req.file.path) {
        return res.status(400).json({ message: 'Invalid image file' });
      }
      const marketName = req.body?.marketName || 'Generic';
      const timeframe = req.body?.timeframe || 'Daily';
      const uid = req.user?.uid || 'demo_user';
      const creditResult = consumeCredit(uid);
      if (!creditResult.success) {
        return res.status(403).json({ message: 'No credits remaining. Please upgrade your plan.', blocked: true, plan: creditResult.plan, remainingCredits: creditResult.remaining });
      }
      let marketContext;
      try {
        marketContext = await buildMarketContext(marketName);
      } catch (e) {
        console.error('Image market context error:', e);
        marketContext = getSafeFallbackMarketContext(marketName);
      }
      let aiResult;
      try {
        aiResult = await analyzeImage(req.file.path, req.body?.question || '', marketContext);
      } catch (e) {
        console.error('Image AI error (fallback):', e);
        aiResult = buildQuotaFallback(marketContext);
      }
      const result = safeAnalysisResult(aiResult, marketName, timeframe);
      const saved = await saveAnalysis(uid, result, 'image', `/uploads/${path.basename(req.file.path)}`);
      res.json({ ...buildResponse(result), reportId: saved.reportId });
    } catch (error) {
      console.error('Image route error (fallback):', error);
      const marketName = req.body?.marketName || 'Generic';
      const timeframe = req.body?.timeframe || 'Daily';
      const uid = req.user?.uid || 'demo_user';
      const fallback = safeAnalysisResult(buildQuotaFallback(getSafeFallbackMarketContext(marketName)), marketName, timeframe);
      const saved = await saveAnalysis(uid, fallback, 'image', null);
      res.json({ ...buildResponse(fallback), reportId: saved.reportId });
    }
  }
);

router.post('/text',
  authenticate,
  analyzeLimiter,
  validateAnalyzeText,
  handleValidationErrors,
  async (req, res) => {
    try {
      const marketName = req.body?.marketName || 'NIFTY 50';
      const timeframe = req.body?.timeframe || '1h';
      const uid = req.user?.uid || 'demo_user';
      const question = req.body?.question || '';
      const creditResult = consumeCredit(uid);
      if (!creditResult.success) {
        return res.status(403).json({ message: 'No credits remaining. Please upgrade your plan.', blocked: true, plan: creditResult.plan, remainingCredits: creditResult.remaining });
      }
      if (!question || question.trim().length < 3) {
        return res.status(400).json({ message: 'Question is required (min 3 chars)' });
      }
      let marketContext;
      try {
        marketContext = await buildMarketContext(marketName);
      } catch (e) {
        console.error('Text market context error:', e);
        marketContext = getSafeFallbackMarketContext(marketName);
      }
      let aiResult;
      try {
        aiResult = await analyzeText(question, marketContext);
      } catch (e) {
        console.error('Text AI error (fallback):', e);
        aiResult = buildQuotaFallback(marketContext);
      }
      const result = safeAnalysisResult(aiResult, marketName, timeframe);
      const saved = await saveAnalysis(uid, result, 'text', null);
      res.json({ ...buildResponse(result), reportId: saved.reportId });
    } catch (error) {
      console.error('Text route error (fallback):', error);
      const marketName = req.body?.marketName || 'NIFTY 50';
      const timeframe = req.body?.timeframe || '1h';
      const uid = req.user?.uid || 'demo_user';
      const fallback = safeAnalysisResult(buildQuotaFallback(getSafeFallbackMarketContext(marketName)), marketName, timeframe);
      const saved = await saveAnalysis(uid, fallback, 'text', null);
      res.json({ ...buildResponse(fallback), reportId: saved.reportId });
    }
  }
);

router.get('/history/:userId',
  authenticate,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const effectiveUserId = req.user?.uid || userId || 'demo_user';
      const history = await getAnalysisHistory(effectiveUserId);
      // Always return 200 + an array; never 404.
      res.json({ success: true, data: history || [], userId: effectiveUserId });
    } catch (error) {
      console.error('History error:', error);
      res.status(200).json({ success: true, data: [], userId: req.user?.uid || 'demo_user' });
    }
  }
);

router.delete('/history/:reportId',
  authenticate,
  async (req, res) => {
    try {
      const { reportId } = req.params;
      const uid = req.user?.uid || 'demo_user';
      await deleteAnalysis(reportId, uid);
      res.json({ message: 'Report deleted', reportId });
    } catch (error) {
      console.error('Delete error:', error);
      if (error.message === 'Report not found') {
        return res.status(404).json({ message: 'Report not found' });
      }
      res.status(200).json({ message: 'Delete skipped in demo mode', reportId: req.params.reportId });
    }
  }
);

module.exports = router;
