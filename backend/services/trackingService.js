const store = {
  logs: [],
  counts: {
    analyses: 0,
    imageAnalyses: 0,
    textAnalyses: 0,
    apiErrors: 0,
    watchlistEvents: 0,
    pwaInstalls: 0,
    logins: 0,
    adminLogins: 0,
    apiRequestsToday: 0
  },
  snapshots: {
    totalUsers: new Set(),
    activeWatchlists: 0,
    failedRequests: 0
  }
};

function pushLog(type, action, meta = {}) {
  store.logs.push({
    type,
    action,
    userEmail: meta.userEmail || null,
    userId: meta.userId || null,
    meta,
    timestamp: new Date().toISOString()
  });
  if (store.logs.length > 1000) {
    store.logs = store.logs.slice(-800);
  }
}

function track(eventType, meta = {}) {
  const entry = {
    type: eventType,
    userEmail: meta.userEmail || null,
    userId: meta.userId || null,
    action: meta.action || eventType,
    meta,
    timestamp: new Date().toISOString()
  };
  pushLog('track', eventType, meta);
  switch (eventType) {
    case 'analysis':
      store.counts.analyses += 1;
      if (meta.mode === 'image') store.counts.imageAnalyses += 1;
      if (meta.mode === 'text') store.counts.textAnalyses += 1;
      break;
    case 'api_error':
    case 'error':
      store.counts.apiErrors += 1;
      store.snapshots.failedRequests += 1;
      break;
    case 'watchlist':
      store.counts.watchlistEvents += 1;
      break;
    case 'pwa_install':
      store.counts.pwaInstalls += 1;
      break;
    case 'login':
    case 'demo_login':
      store.counts.logins += 1;
      if (meta.email) store.snapshots.totalUsers.add(meta.email);
      break;
    case 'admin_login':
      store.counts.adminLogins += 1;
      break;
    case 'api_request':
      store.counts.apiRequestsToday += 1;
      break;
    default:
      break;
  }
}

function getStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toISOString();
  const todayLogs = (store.logs || []).filter(l => l.timestamp && l.timestamp >= todayKey);
  const todayAnalyses = todayLogs.filter(l => l.type === 'analysis').length;
  return {
    totalUsers: store.snapshots.totalUsers.size,
    totalAnalyses: store.counts.analyses,
    todayAnalyses,
    imageAnalyses: store.counts.imageAnalyses,
    textAnalyses: store.counts.textAnalyses,
    activeWatchlists: store.counts.watchlistEvents,
    apiRequestsToday: store.counts.apiRequestsToday,
    failedRequests: store.snapshots.failedRequests,
    pwaInstalls: store.counts.pwaInstalls,
    lastUpdated: new Date().toISOString()
  };
}

function getReports(limit = 100) {
  return store.logs.filter(l => l.type === 'analysis').slice(-limit);
}

function getUsers() {
  return Array.from(store.snapshots.totalUsers).map(email => ({
    uid: email,
    email,
    type: email && email.indexOf('demo') !== -1 ? 'demo' : 'user',
    createdAt: new Date().toISOString()
  }));
}

function getLogs(limit = 300) {
  return store.logs.slice(-limit);
}

function getSystem() {
  const used = process.memoryUsage();
  return {
    backend: { status: 'up' },
    'Market API': { status: 'up' },
    'News API': { status: 'up' },
    Gemini: { status: 'up', model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' },
    uptime: process.uptime ? Math.floor(process.uptime()) + 's' : 'n/a',
    memory: {
      rss: Math.round(used.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(used.heapUsed / 1024 / 1024) + 'MB'
    },
    environment: process.env.NODE_ENV || 'development'
  };
}

function saveAnnouncement(message, createdBy) {
  store.announcement = { message, createdBy, createdAt: new Date().toISOString() };
  pushLog('system', 'announcement', { message, createdBy });
  return store.announcement;
}

function getAnnouncement() {
  return store.announcement || null;
}

module.exports = {
  track,
  getStats,
  getReports,
  getUsers,
  getLogs,
  getSystem,
  saveAnnouncement,
  getAnnouncement,
  pushLog
};
