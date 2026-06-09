const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/authMiddleware');
const { getStats, getReports, getUsers, getLogs, getSystem, saveAnnouncement, getAnnouncement, track } = require('../services/trackingService');

const ADMIN_PASSKEY = '0000';
const ADMIN_SESSION_KEY = 'tradlys_admin_unlocked';

const adminGate = (req, res, next) => {
  const passkey = String(req.headers['x-admin-passkey'] || req.body?.passkey || '');
  const sessionUnlocked = req.headers['x-admin-session'] === '1';
  if (sessionUnlocked && passkey !== ADMIN_PASSKEY) {
    return res.status(403).json({ message: 'Invalid admin session' });
  }
  if (!sessionUnlocked && passkey !== ADMIN_PASSKEY) {
    return res.status(403).json({ message: 'Admin passkey required' });
  }
  next();
};

router.use(adminGate);

router.get('/stats', (req, res) => {
  try {
    const stats = getStats();
    res.status(200).json({ stats });
  } catch (error) {
    console.error('/admin/stats error:', error);
    res.status(200).json({
      stats: {
        totalUsers: 0,
        totalAnalyses: 0,
        todayAnalyses: 0,
        imageAnalyses: 0,
        textAnalyses: 0,
        activeWatchlists: 0,
        apiRequestsToday: 0,
        failedRequests: 0,
        pwaInstalls: 0,
        lastUpdated: new Date().toISOString()
      }
    });
  }
});

router.get('/reports', (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '100', 10);
    const reports = getReports(Math.min(limit, 500));
    res.status(200).json({ reports, count: reports.length });
  } catch (error) {
    console.error('/admin/reports error:', error);
    res.status(200).json({ reports: [], count: 0 });
  }
});

router.get('/users', (req, res) => {
  try {
    const users = getUsers();
    res.status(200).json({ users, count: users.length });
  } catch (error) {
    console.error('/admin/users error:', error);
    res.status(200).json({ users: [], count: 0 });
  }
});

router.get('/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '100', 10);
    const logs = getLogs(Math.min(limit, 500));
    res.status(200).json({ logs, count: logs.length });
  } catch (error) {
    console.error('/admin/logs error:', error);
    res.status(200).json({ logs: [], count: 0 });
  }
});

router.get('/system', (req, res) => {
  try {
    const system = getSystem();
    res.status(200).json(system);
  } catch (error) {
    console.error('/admin/system error:', error);
    res.status(200).json({
      backend: { status: 'down' },
      'Market API': { status: 'unknown' },
      'News API': { status: 'unknown' },
      Gemini: { status: 'unknown', model: 'unknown' },
      uptime: 'n/a',
      memory: {},
      environment: process.env.NODE_ENV || 'development'
    });
  }
});

router.post('/announcement', (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    const createdBy = String(req.body?.createdBy || 'admin');
    if (!message) {
      return res.status(400).json({ message: 'Announcement message is required' });
    }
    const announcement = saveAnnouncement(message, createdBy);
    res.status(200).json({ announcement });
  } catch (error) {
    console.error('/admin/announcement error:', error);
    res.status(200).json({ message: 'Saved', announcement: null });
  }
});

router.post('/track', (req, res) => {
  try {
    const { type, userEmail, action, meta, timestamp } = req.body || {};
    const now = timestamp ? new Date(timestamp) : new Date();
    if (isNaN(now.getTime())) {
      return res.status(200).json({ ok: true });
    }
    const user = req.user || {};
    const effectiveEmail = userEmail || user.email || null;
    const effectiveUserId = user.uid || null;
    track(type || 'unknown', {
      userEmail: effectiveEmail,
      userId: effectiveUserId,
      action,
      meta,
      timestamp: now.toISOString()
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('/admin/track error:', error);
    res.status(200).json({ ok: true });
  }
});

module.exports = router;
