const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/authMiddleware');
const { getAdminStats, addTrackEntry } = require('../services/trackingService');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const PAYMENT_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'payments');
if (!fs.existsSync(PAYMENT_UPLOAD_DIR)) fs.mkdirSync(PAYMENT_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, PAYMENT_UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, 'pay_' + Date.now() + '_' + Math.round(Math.random() * 9999) + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.indexOf(file.mimetype) !== -1) cb(null, true);
  else cb(new Error('Only image files allowed'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

const PLANS = {
  starter: { name: 'Starter', price: 99, credits: 20, currency: 'INR', label: 'Starter ₹99' },
  trader:  { name: 'Trader',  price: 299, credits: 100, currency: 'INR', label: 'Trader ₹299' },
  pro:     { name: 'Pro',     price: 799, credits: 999999, currency: 'INR', label: 'Pro ₹799', unlimited: true }
};

let payments = [];

const getStoredUsers = () => {
  try {
    const fp = path.join(__dirname, '..', 'payments_users.json');
    if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {}
  return {};
};

const setStoredUsers = (data) => {
  try {
    const fp = path.join(__dirname, '..', 'payments_users.json');
    fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  } catch (e) { console.error('user store error', e); }
};

const findOrCreateUser = async (uid, email) => {
  const users = getStoredUsers();
  if (users[uid]) return { uid, ...users[uid] };
  const newUser = {
    email: email || ('user_' + uid.slice(0, 8) + '@tradlys.com'),
    plan: 'free',
    credits: 5,
    totalCreditsPurchased: 0,
    totalAnalyses: 0,
    createdAt: new Date().toISOString(),
    lastAnalysis: null,
    emailVerified: false
  };
  users[uid] = newUser;
  setStoredUsers(users);
  await addTrackEntry('user', { userId: uid, userEmail: email, action: 'new_user', meta: { plan: 'free', credits: 5 }, timestamp: new Date().toISOString() });
  return { uid, ...newUser };
};

const saveUser = (uid, data) => {
  const users = getStoredUsers();
  if (users[uid]) Object.assign(users[uid], data);
  else users[uid] = data;
  setStoredUsers(users);
};

const getUser = (uid) => {
  const users = getStoredUsers();
  return users[uid] || null;
};

router.get('/plans', (req, res) => {
  res.json({ plans: PLANS });
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const uid = req.user?.uid || 'demo_user';
    const user = await findOrCreateUser(uid, req.user?.email || null);
    res.json({ user });
  } catch (e) {
    console.error('/payments/me error:', e);
    res.json({
      user: {
        uid: req.user?.uid || 'demo_user',
        email: req.user?.email || null,
        plan: 'free',
        credits: 5,
        totalAnalyses: 0,
        totalCreditsPurchased: 0,
        lastAnalysis: null,
        createdAt: new Date().toISOString()
      }
    });
  }
});

router.post('/verify', authenticate, async (req, res) => {
  try {
    const uid = req.user?.uid || 'demo_user';
    let user = getUser(uid);
    if (!user) user = (await findOrCreateUser(uid, req.user?.email || null));
    if (!user) user = { plan: 'free', credits: 5 };
    if (user.credits <= 0) return res.json({ allowed: false, reason: 'insufficient_credits', user: { uid, ...user } });
    user.totalAnalyses = (user.totalAnalyses || 0) + 1;
    if (user.plan !== 'pro') user.credits = Math.max(0, (user.credits || 0) - 1);
    user.lastAnalysis = new Date().toISOString();
    saveUser(uid, user);
    await addTrackEntry('credits', { userId: uid, userEmail: user.email, action: 'analysis_consumed', meta: { remainingCredits: user.credits, plan: user.plan }, timestamp: new Date().toISOString() });
    res.json({ allowed: true, creditsRemaining: user.credits, user: { uid, ...user } });
  } catch (e) {
    res.json({ allowed: true, creditsRemaining: 5 });
  }
});

router.get('/history', authenticate, (req, res) => {
  const uid = req.user?.uid || 'demo_user';
  const docs = getStoredUsers();
  const user = docs[uid];
  res.json({ history: user?.paymentHistory || [], plan: user?.plan || 'free', credits: user?.credits || 0 });
});

router.post('/request', authenticate, upload.single('screenshot'), async (req, res) => {
  try {
    const uid = req.user?.uid || 'demo_user';
    const user = await findOrCreateUser(uid, req.user?.email || null);
    const planKey = String(req.body?.plan || '').toLowerCase().trim();
    const plan = PLANS[planKey];
    if (!plan) return res.status(400).json({ message: 'Invalid plan selected. Choose starter, trader, or pro.' });
    if (!req.body?.utr || String(req.body.utr).trim().length < 4) return res.status(400).json({ message: 'UTR number is required (min 4 chars).' });
    if (!req.file) return res.status(400).json({ message: 'Payment screenshot is required.' });

    const payment = {
      id: 'P' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      userId: uid,
      userEmail: user.email,
      fullName: String(req.body?.fullName || user.email || 'Customer').trim(),
      planKey,
      planName: plan.label,
      amountINR: plan.price,
      utr: String(req.body.utr).trim(),
      screenshotPath: '/uploads/payments/' + path.basename(req.file.path),
      status: 'pending',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null
    };

    payments.unshift(payment);
    await addTrackEntry('payment', { userId: uid, userEmail: user.email, action: 'payment_requested', meta: { plan: planKey, amountINR: plan.price, paymentId: payment.id }, timestamp: payment.createdAt });

    res.status(200).json({ message: 'Payment request submitted. Awaiting admin approval.', paymentId: payment.id, status: 'pending' });
  } catch (e) {
    console.error('Payment request error:', e);
    res.status(500).json({ message: 'Failed to submit payment request. Please try again.' });
  }
});

const adminGate = (req, res, next) => {
  const passkey = String(req.headers['x-admin-passkey'] || req.body?.passkey || req.query?.passkey || '');
  const sessionUnlocked = req.headers['x-admin-session'] === '1';
  if (!sessionUnlocked && passkey !== '0000') {
    return res.status(403).json({ message: 'Admin passkey required' });
  }
  next();
};

router.get('/admin/list', adminGate, (req, res) => {
  const status = String(req.query.status || 'all').toLowerCase();
  const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);
  let list = payments;
  if (status !== 'all') list = payments.filter((p) => p.status === status);
  res.json({ payments: list.slice(0, limit), total: list.length, pendingCount: payments.filter((p) => p.status === 'pending').length });
});

router.get('/admin/:paymentId', adminGate, (req, res) => {
  const p = payments.find((x) => x.id === req.params.paymentId);
  if (!p) return res.status(404).json({ message: 'Payment not found' });
  res.json({ payment: p });
});

router.post('/admin/:paymentId/approve', adminGate, async (req, res) => {
  try {
    const p = payments.find((x) => x.id === req.params.paymentId);
    if (!p) return res.status(404).json({ message: 'Payment not found' });
    if (p.status !== 'pending') return res.status(400).json({ message: 'Already ' + p.status });

    const plan = PLANS[p.planKey];
    if (!plan) return res.status(400).json({ message: 'Invalid plan' });

    let user = getUser(p.userId);
    if (!user) user = { credits: 5, totalAnalyses: 0, plan: 'free' };
    user.credits = (user.credits || 0) + plan.credits;
    user.totalCreditsPurchased = (user.totalCreditsPurchased || 0) + plan.credits;
    user.plan = plan.name;
    if (!user.paymentHistory) user.paymentHistory = [];
    user.paymentHistory.unshift({
      id: p.id,
      planKey: p.planKey,
      amountINR: plan.price,
      creditsAdded: plan.credits,
      status: 'approved',
      createdAt: p.createdAt,
      approvedAt: new Date().toISOString()
    });
    saveUser(p.userId, user);

    p.status = 'approved';
    p.reviewedAt = new Date().toISOString();
    p.reviewedBy = String(req.body?.reviewedBy || 'admin');

    await addTrackEntry('admin', { userId: p.userId, userEmail: p.userEmail, action: 'payment_approved', meta: { paymentId: p.id, plan: p.planKey, creditsAdded: plan.credits, amountINR: plan.price }, timestamp: p.reviewedAt });

    res.json({ message: 'Payment approved. Credits added.', payment: p, creditsAdded: plan.credits, newCredits: user.credits });
  } catch (e) {
    console.error('Approve error:', e);
    res.status(500).json({ message: 'Approval failed' });
  }
});

router.post('/admin/:paymentId/reject', adminGate, async (req, res) => {
  try {
    const p = payments.find((x) => x.id === req.params.paymentId);
    if (!p) return res.status(404).json({ message: 'Payment not found' });
    if (p.status !== 'pending') return res.status(400).json({ message: 'Already ' + p.status });
    const reason = String(req.body?.reason || 'Payment not approved.').trim();
    p.status = 'rejected';
    p.reviewedAt = new Date().toISOString();
    p.reviewedBy = String(req.body?.reviewedBy || 'admin');
    p.rejectionReason = reason;

    let user = getUser(p.userId);
    if (user) {
      if (!user.paymentHistory) user.paymentHistory = [];
      user.paymentHistory.unshift({
        id: p.id,
        planKey: p.planKey,
        amountINR: p.amountINR,
        status: 'rejected',
        reason,
        createdAt: p.createdAt,
        rejectedAt: p.reviewedAt
      });
      saveUser(p.userId, user);
    }

    await addTrackEntry('admin', { userId: p.userId, userEmail: p.userEmail, action: 'payment_rejected', meta: { paymentId: p.id, reason }, timestamp: p.reviewedAt });

    res.json({ message: 'Payment rejected.', payment: p, reason });
  } catch (e) {
    res.status(500).json({ message: 'Rejection failed' });
  }
});

router.get('/admin/revenue', adminGate, (req, res) => {
  const approved = payments.filter((p) => p.status === 'approved');
  const total = approved.reduce((sum, p) => sum + (p.amountINR || 0), 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();
  const todayApproved = approved.filter((p) => (p.reviewedAt || '') >= todayStr);
  const todayTotal = todayApproved.reduce((sum, p) => sum + (p.amountINR || 0), 0);

  const byPlan = {};
  approved.forEach((p) => {
    const k = p.planKey || 'unknown';
    byPlan[k] = (byPlan[k] || 0) + 1;
  });

  res.json({ revenue: { total, todayTotal, totalApproved: approved.length, todayApproved: todayApproved.length, byPlan } });
});

router.get('/admin/dashboard', adminGate, (req, res) => {
  const approved = payments.filter((p) => p.status === 'approved');
  const rejected = payments.filter((p) => p.status === 'rejected');
  const pending = payments.filter((p) => p.status === 'pending');
  const revenueTotal = approved.reduce((s, p) => s + (p.amountINR || 0), 0);

  const docs = getStoredUsers();
  const users = Object.values(docs);
  const activeUsers = users.filter((u) => (u.totalAnalyses || 0) > 0).length;
  const totalAnalyses = users.reduce((s, u) => s + (u.totalAnalyses || 0), 0);

  res.json({
    stats: {
      totalUsers: users.length,
      activeUsers,
      totalAnalyses,
      pendingPayments: pending.length,
      approvedPayments: approved.length,
      rejectedPayments: rejected.length,
      revenueINR: revenueTotal
    }
  });
});

module.exports = router;
