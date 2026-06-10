/* =============================================
   TRADLYS — Frontend Controller
   Vanilla JS | No framework
   ============================================= */

'use strict';

const CONFIG = {
  API_BASE: window.location.origin + "/api",
  API_URL: window.location.origin + "/api",
  RECONNECT_DELAY: 5000,
  MAX_HISTORY: 100
};

const state = {
  token: localStorage.getItem('tradlys_token') || null,
  user: JSON.parse(localStorage.getItem('tradlys_user') || 'null'),
  currentSection: 'dashboard',
  selectedFile: null,
  isAnalyzing: false,
  watchlist: JSON.parse(localStorage.getItem('tradlys_watchlist') || '[]'),
  allHistory: [],
  deferredPrompt: null,
  promptCooldown: localStorage.getItem('tradlys_prompt_cooldown') || null,
  plan: 'free',
  credits: 5,
  selectedPremiumPlan: null
};
window.state = state;

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => document.querySelectorAll(sel);
const el = (id) => document.getElementById(id);
const show = (id) => { const e = el(id); if (e) e.classList.remove('hidden'); };
const hide = (id) => { const e = el(id); if (e) e.classList.add('hidden'); };

function openUpgradeModal() {
  if (state.token) {
    fetchUserPlan().then(function() {
      showPremiumModal();
      updatePremiumModalContent();
    }).catch(function() {
      showPremiumModal();
      updatePremiumModalContent();
    });
  } else {
    showPremiumModal();
  }
}
function showPremiumModal() {
  document.getElementById('premiumModal').classList.remove('hidden');
}
function closePremiumModal() {
  document.getElementById('premiumModal').classList.add('hidden');
}
function openPlanModal() {
  console.log('Credits pill clicked');
  if (state.token && (Number(state.credits) || 0) > 0) {
    fetchUserPlan().then(function() {
      showPlanModal();
      updatePlanModalContent();
    }).catch(function() {
      showPlanModal();
      updatePlanModalContent();
    });
  } else if (state.token) {
    fetchUserPlan().then(function() {
      showPlanModal();
      updatePlanModalContent();
    }).catch(function() {
      showPlanModal();
      updatePlanModalContent();
    });
  } else {
    showPlanModal();
    updatePlanModalContent();
  }
}
function showPlanModal() {
  document.getElementById('planModal').classList.remove('hidden');
}
function closePlanModal() {
  document.getElementById('planModal').classList.add('hidden');
}
function updatePlanModalContent() {
  var plan = state.plan || 'free';
  var credits = Number(state.credits) || 0;
  var planEl = document.getElementById('planCurrentPlan');
  var creditsEl = document.getElementById('planRemainingCredits');
  var usedEl = document.getElementById('planFreeCreditsUsed');
  var paymentEl = document.getElementById('planPaymentStatus');
  var titleEl = document.getElementById('planModalTitle');
  var upgradeBtn = document.getElementById('planUpgradeButton');
  if (planEl) planEl.textContent = String(plan).toUpperCase();
  if (creditsEl) creditsEl.textContent = credits;
  if (usedEl) {
    usedEl.textContent = plan === 'free' ? String(Math.max(0, 5 - credits)) : '0';
  }
  if (paymentEl) {
    if (plan === 'free') paymentEl.textContent = 'Free';
    else if (credits > 0) paymentEl.textContent = 'Paid / Active';
    else paymentEl.textContent = 'Upgrade Required';
  }
  if (titleEl) {
    if (credits > 0) titleEl.textContent = 'Manage Plan / Upgrade';
    else titleEl.textContent = 'Upgrade Required';
  }
  if (upgradeBtn) {
    if (credits > 0) {
      upgradeBtn.textContent = credits > 0 ? 'Manage Plan / Upgrade' : 'Upgrade Required';
    } else {
      upgradeBtn.textContent = 'Upgrade Now';
    }
  }
  var subtitle = document.getElementById('planModalSubtitle');
  if (subtitle) {
    if (credits > 0) subtitle.textContent = 'Manage your subscription';
    else subtitle.textContent = 'Upgrade required to continue';
  }
  qsa('.plan-plan-card').forEach(function(c) {
    c.classList.remove('active');
  });
  var active = document.querySelector('.plan-plan-card[data-plan="' + (state.selectedPremiumPlan || '') + '"]');
  if (active) active.classList.add('active');
}
function updatePremiumModalContent() {
  var plan = state.plan || 'free';
  var credits = Number(state.credits) || 0;
  var titleEl = document.getElementById('premiumTitle');
  if (titleEl) {
    if (credits > 0) titleEl.textContent = 'Upgrade to a better plan';
    else titleEl.textContent = 'Your Free Analyses Are Finished';
  }
  updatePlanModalContent();
}
function choosePremiumPlan(plan) {
  state.selectedPremiumPlan = plan;
  qsa('.premium-plan-card').forEach(function(c) { c.classList.remove('active'); });
  qsa('.plan-plan-card').forEach(function(c) { c.classList.remove('active'); });
  var target = document.querySelector('.premium-plan-card[data-plan="' + plan + '"]');
  if (target) target.classList.add('active');
  var planTarget = document.querySelector('.plan-plan-card[data-plan="' + plan + '"]');
  if (planTarget) planTarget.classList.add('active');
  console.log('Plan selected:', plan);
}
function proceedToUpgrade() {
  var plan = state.selectedPremiumPlan || 'starter';
  window.location.href = 'payment.html?plan=' + encodeURIComponent(plan);
}
window.proceedToUpgrade = proceedToUpgrade;
async function refreshPlanSync() {
  try {
    var data = await api('/payments/me');
    var user = data && data.user;
    if (user) {
      state.credits = user.credits != null ? user.credits : 0;
      state.plan = user.plan || 'free';
      updateCreditsUI(state.credits, state.plan);
    }
  } catch (e) { console.warn('refreshPlanSync failed', e); }
}
function gateAnalysis() {
  if (!state.token) { showToast('Please login first', 'error'); promptLogin(); return false; }
  if ((state.plan || 'free') !== 'pro' && (Number(state.credits) || 0) <= 0) {
    openUpgradeModal();
    return false;
  }
  return true;
}

function updateCreditsUI(count, planName) {
  var nav = document.getElementById('navCredits');
  if (nav) nav.textContent = count != null ? count : '—';
  var badge = document.getElementById('userPlanBadge');
  if (badge && planName) {
    badge.textContent = String(planName).toUpperCase();
    badge.className = 'plan-badge ' + String(planName).toLowerCase();
  }
}

async function fetchUserPlan() {
  try {
    var data = await api('/payments/me');
    var user = data && data.user;
    if (user) {
      state.credits = user.credits != null ? user.credits : 0;
      state.plan = user.plan || 'free';
      updateCreditsUI(state.credits, state.plan);
    }
  } catch (e) {
    console.warn('fetchUserPlan failed', e);
  }
}

function showSection(section) {
  state.currentSection = section;
  qsa('.section').forEach((s) => s.classList.add('hidden'));
  updateAllNavStates(section);
  const sectionMap = {
    dashboard: 'dashboardSection',
    analyze: 'analyzeSection',
    history: 'historySection'
  };
  const sectionEl = el(sectionMap[section]);
  if (sectionEl) {
    sectionEl.classList.remove('hidden');
  }
  if (section === 'dashboard') loadDashboard();
  if (section === 'history') loadHistory();
  updateAuthUI();
}

function showToast(message, type) {
  type = type || 'info';
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.4s'; }, 3000);
  setTimeout(function() { toast.remove(); }, 3500);
}

function getAuthHeaders() {
  var headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  return headers;
}

function updateAuthUI() {
  var authBtn = el('authBtn');
  var userInfo = el('userInfo');
  if (state.user) {
    authBtn.textContent = 'Logout';
    authBtn.className = 'btn btn-outline';
    userInfo.textContent = state.user.email || (state.user.uid || '').slice(0, 8) || '';
  } else {
    authBtn.textContent = 'Login';
    authBtn.className = 'btn btn-outline';
    userInfo.textContent = '';
  }
}

function promptLogin() { openUpgradeModal(); }
function handleAuth() {
  if (state.user) {
    state.token = null;
    state.user = null;
    localStorage.removeItem('tradlys_token');
    localStorage.removeItem('tradlys_user');
    closePremiumModal();
    hide('premiumModal');
    updateAuthUI();
    showSection('dashboard');
    showToast('Logged out successfully', 'info');
  } else {
    handleLoginPrompt();
  }
}

function hideAllOverlays() {
  closePremiumModal();
  hide('premiumModal');
  closePlanModal();
  hide('planModal');
  hide('pwaInstallPopup');
  hide('loginModal');
  document.querySelectorAll('.modal-backdrop, .premium-backdrop, .pwa-popup-backdrop').forEach(function(el) {
    el.style.display = 'none';
    el.style.pointerEvents = 'none';
  });
}

function rebindAllButtons() {
  bindNavigation();
  bindHeroButtons();
  bindQuickActions();
  bindWatchlistAdd();
  bindTrendingTabs();
  bindAnalyzeButtons();
  bindHistoryControls();
  bindHistoryDetailClicks();
  bindPwaButtons();
  bindAuthButton();
  bindMobileMenuButton();
  bindCreditsButton();
  bindPlanCards();
  bindUpgradeModalButtons();
  bindWatchlistRemoveButtons();
  console.log('Buttons rebound');
}

function bindNavigation() {
  document.querySelectorAll('.nav-link').forEach(function(btn) {
    btn.onclick = null;
    btn.addEventListener('click', function(e) {
      var section = btn.getAttribute('data-section') || btn.textContent.trim().toLowerCase();
      showSection(section);
    });
  });
  document.querySelectorAll('.mobile-menu-link').forEach(function(btn) {
    btn.onclick = null;
    btn.addEventListener('click', function(e) {
      var section = btn.getAttribute('data-section');
      if (section) showSection(section);
      closeMobileMenu();
    });
  });
}
function bindHeroButtons() {
  qsa('[data-goto="analyze"]').forEach(function(btn) {
    btn.onclick = null;
    btn.addEventListener('click', function() { showSection('analyze'); });
  });
  qsa('[data-scroll="features"]').forEach(function(btn) {
    btn.onclick = null;
    btn.addEventListener('click', function() { scrollToFeatures(); });
  });
}
function bindQuickActions() {
  qsa('.quick-actions [data-section]').forEach(function(btn) {
    btn.onclick = null;
    btn.addEventListener('click', function() { showSection(btn.getAttribute('data-section')); });
  });
  var refreshBtn = el('refreshMarketBtn');
  if (refreshBtn) {
    refreshBtn.onclick = null;
    refreshBtn.addEventListener('click', function() { refreshMarket(); });
  }
}
function bindWatchlistAdd() {
  qsa('.btn-sm.btn-outline').forEach(function(btn) {
    if (/^\+ Add$/i.test(btn.textContent.trim())) {
      btn.onclick = null;
      btn.addEventListener('click', function() { openWatchlistModal(); });
    }
  });
}
function bindTrendingTabs() {
  qsa('.trend-tab').forEach(function(btn) {
    btn.onclick = null;
    btn.addEventListener('click', function() { loadTrending(btn.getAttribute('data-trend')); });
  });
}
function bindAnalyzeButtons() {
  var imgBtn = el('analyzeImageBtn');
  if (imgBtn) {
    imgBtn.onclick = null;
    imgBtn.addEventListener('click', analyzeImage);
  }
  var txtBtn = el('analyzeTextBtn');
  if (txtBtn) {
    txtBtn.onclick = null;
    txtBtn.addEventListener('click', analyzeText);
  }
  var clearBtn = qs('#uploadPreview .btn-danger');
  if (clearBtn) {
    clearBtn.onclick = null;
    clearBtn.addEventListener('click', clearImage);
  }
}
function bindHistoryDetailClicks() {
  var list = el('historyList');
  if (list && !list.getAttribute('data-history-bound')) {
    list.setAttribute('data-history-bound', 'true');
    list.addEventListener('click', function(e) {
      var item = e.target.closest('.history-item');
      if (item) {
        var reportId = item.getAttribute('data-history-id');
        if (reportId) loadHistoryDetail(reportId);
      }
    });
  }
}
function bindHistoryControls() {
  qsa('.btn-secondary').forEach(function(btn) {
    if (/Refresh/.test(btn.textContent.trim())) {
      btn.onclick = null;
      btn.addEventListener('click', function() { loadHistory(); });
    }
  });
  var searchInput = el('historySearch');
  if (searchInput && !searchInput.getAttribute('data-bound')) {
    searchInput.setAttribute('data-bound', 'true');
    searchInput.addEventListener('input', function() { filterHistory(); });
  }
}
function bindPwaButtons() {
  var installBtn = el('pwaInstallBtn');
  if (installBtn) {
    installBtn.onclick = null;
    installBtn.addEventListener('click', function() { installPwa(); });
  }
  var laterBtn = el('pwaLaterBtn');
  if (laterBtn) {
    laterBtn.onclick = null;
    laterBtn.addEventListener('click', function() { deferPwaPrompt(); });
  }
}
function bindAuthButton() {
  var authBtn = el('authBtn');
  if (authBtn) {
    authBtn.onclick = null;
    authBtn.addEventListener('click', function() { handleAuth(); });
  }
}
function bindMobileMenuButton() {
  var menuBtn = el('mobileMenuBtn');
  if (menuBtn) {
    menuBtn.onclick = null;
    menuBtn.addEventListener('click', function() { toggleMobileMenu(); });
  }
}
function bindCreditsButton() {
  var creditsBtn = el('creditsNavBtn');
  if (creditsBtn) {
    creditsBtn.onclick = null;
    creditsBtn.addEventListener('click', function() { openPlanModal(); });
  }
}
function bindPlanCards() {
  qsa('.premium-plan-card, .plan-plan-card').forEach(function(card) {
    card.onclick = null;
    card.addEventListener('click', function() {
      var plan = card.getAttribute('data-plan');
      if (plan) {
        state.selectedPremiumPlan = plan;
        qsa('.premium-plan-card, .plan-plan-card').forEach(function(c) { c.classList.remove('active'); });
        card.classList.add('active');
        console.log('Plan selected:', plan);
      }
    });
  });
}
function bindUpgradeModalButtons() {
  qsa('#premiumModal .premium-actions button, #planModal .plan-actions button').forEach(function(btn) {
    btn.onclick = null;
    if (/Upgrade Now|Upgrade/.test(btn.textContent || '')) {
      btn.addEventListener('click', function() {
        console.log('Upgrade clicked');
        window.proceedToUpgrade && window.proceedToUpgrade();
      });
    } else if (/Maybe Later|Close/.test(btn.textContent || '')) {
      btn.addEventListener('click', function() {
        var inPlan = btn.closest && btn.closest('#planModal');
        if (inPlan) closePlanModal();
        else closePremiumModal();
      });
    }
  });
}

function bindPlanCards() {
  document.querySelectorAll('.premium-plan-card').forEach(function(card) {
    card.onclick = null;
    card.addEventListener('click', function() {
      var plan = card.getAttribute('data-plan');
      if (plan) {
        state.selectedPremiumPlan = plan;
        document.querySelectorAll('.premium-plan-card').forEach(function(c) { c.classList.remove('active'); });
        card.classList.add('active');
        console.log('Plan selected:', plan);
      }
    });
  });
}

function bindWatchlistRemoveButtons() {
  var list = el('watchlistData');
  if (list && !list.getAttribute('data-watchlist-bound')) {
    list.setAttribute('data-watchlist-bound', 'true');
    list.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-remove-symbol]');
      if (btn) {
        var symbol = btn.getAttribute('data-remove-symbol');
        if (symbol) removeWatchlist(symbol);
      }
    });
  }
}
  // Upgrade Now buttons across all modals
  document.querySelectorAll('[id*="upgrade"], [id*="Upgrade"], .premium-actions, .btn-primary').forEach(function(btn) {
    if (btn.textContent.trim().indexOf('Upgrade Now') !== -1 || btn.textContent.trim().indexOf('Upgrade') !== -1) {
      btn.onclick = null;
      btn.addEventListener('click', function() {
        console.log('Upgrade clicked');
        window.proceedToUpgrade && window.proceedToUpgrade();
      });
    }
  });
}

function handleLoginPrompt() {
  var email = prompt('Enter your email to continue (demo mode):');
  if (email && email.indexOf('@') !== -1) {
    var demoUser = {
      uid: 'demo_' + Date.now(),
      email: email
    };
    state.token = 'demo_token_' + Date.now();
    state.user = demoUser;
    localStorage.setItem('tradlys_token', state.token);
    localStorage.setItem('tradlys_user', JSON.stringify(demoUser));
    updateAuthUI();
    hideAllOverlays();
    rebindAllButtons();
    ;(fetchUserPlan().catch(function(){}));
    showSection('dashboard');
    console.log('Login complete');
    showToast('Demo mode activated. Full auth requires Firebase setup.', 'info');
    ;(api('/admin/track', { method: 'POST', body: JSON.stringify({ type: 'demo_login', userEmail: email, action: 'demo_login', meta: { mode: 'demo' }, timestamp: new Date().toISOString() }) }).catch(function() {}));
  }
}

async function api(url, options) {
  options = options || {};
  var token = localStorage.getItem('tradlys_token');
  var headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  var res = await fetch(CONFIG.API_URL + url, Object.assign({}, options, { headers: headers }));
  var contentType = res.headers.get('content-type');
  if (contentType && contentType.indexOf('application/json') !== -1) {
    var data = await res.json();
  if (!res.ok) {
    var err = new Error(data.message || 'API error');
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res;
}

async function apiMultipart(url, formData) {
  var token = localStorage.getItem('tradlys_token');
  var headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  var res = await fetch(CONFIG.API_URL + url, {
    method: 'POST',
    headers: headers,
    body: formData
  });
  var data = await res.json();
  if (!res.ok) {
    var err = new Error(data.message || 'Upload failed');
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function setupUpload() {
  var zone = el('uploadZone');
  var input = el('chartImage');

  zone.addEventListener('click', function() { input.click(); });
  zone.addEventListener('dragover', function(e) { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', function() { zone.classList.remove('dragover'); });
  zone.addEventListener('drop', function(e) {
    e.preventDefault();
    zone.classList.remove('dragover');
    var file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  input.addEventListener('change', function() {
    if (input.files[0]) handleFile(input.files[0]);
  });
}

function handleFile(file) {
  var allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowed.indexOf(file.type) === -1) {
    showToast('Invalid file type. JPG, PNG, WEBP only.', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('File too large. Max 10MB allowed.', 'error');
    return;
  }
  state.selectedFile = file;
  var reader = new FileReader();
  reader.onload = function(e) {
    el('previewImg').src = e.target.result;
    show('uploadPreview');
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  state.selectedFile = null;
  el('chartImage').value = '';
  hide('uploadPreview');
}

async function analyzeImage() {
  if (state.isAnalyzing) return;
  var btn = el('analyzeImageBtn');
  if (!state.token) {
    showToast('Please login first', 'error');
    promptLogin();
    return;
  }
  if (!gateAnalysis()) return;
  var body = {
    marketName: el('marketName').value || 'Generic',
    timeframe: el('timeframe').value || 'Daily',
    question: el('imageQuestion').value || undefined
  };
  var formData;
  if (state.selectedFile) {
    formData = new FormData();
    formData.append('chartImage', state.selectedFile, state.selectedFile.name);
    formData.append('marketName', body.marketName);
    formData.append('timeframe', body.timeframe);
    formData.append('question', body.question || '');
  } else {
    showToast('Please select a chart image', 'error');
    return;
  }
  setLoading(btn, true);
  try {
    var data = await apiMultipart('/analyze/image', formData);
    console.log('Image Analysis Response:', data);
    ;(api('/admin/track', { method: 'POST', body: JSON.stringify({ type: 'analysis', userEmail: state.user ? state.user.email : null, action: 'image_analysis', meta: { marketName: body.marketName, timeframe: body.timeframe, mode: 'image' }, timestamp: new Date().toISOString() }) }).catch(function() {}));
    if (data && data.report) {
      renderReport(data.report);
      showToast('Analysis complete!', 'success');
    } else {
      showToast('Analysis returned empty report', 'error');
    }
  } catch (err) {
    console.error('analyzeImage error:', err);
    if (err.body && err.body.blocked) {
      state.plan = err.body.plan || state.plan;
      state.credits = err.body.remainingCredits != null ? err.body.remainingCredits : 0;
      updateCreditsUI(state.credits, state.plan);
      openUpgradeModal();
      showToast('No credits remaining. Please upgrade.', 'error');
    } else {
      showToast(err.message, 'error');
    }
  } finally {
    setLoading(btn, false);
  }
}

async function analyzeText() {
  if (state.isAnalyzing) return;
  var btn = el('analyzeTextBtn');
  if (!state.token) {
    showToast('Please login first', 'error');
    promptLogin();
    return;
  }
  if (!gateAnalysis()) return;
  var question = el('textQuestion').value.trim();
  if (!question) {
    showToast('Please enter a question', 'error');
    return;
  }
  var body = {
    question: question,
    marketName: el('textMarketName').value || 'Generic',
    timeframe: el('textTimeframe').value || 'Daily'
  };
  setLoading(btn, true);
  try {
    var data = await api('/analyze/text', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    if (data && data.blocked) {
      state.plan = data.plan || state.plan;
      state.credits = data.remainingCredits != null ? data.remainingCredits : 0;
      updateCreditsUI(state.credits, state.plan);
      openUpgradeModal();
      showToast('No credits remaining. Please upgrade.', 'error');
      return;
    }
    ;(api('/admin/track', { method: 'POST', body: JSON.stringify({ type: 'analysis', userEmail: state.user ? state.user.email : null, action: 'text_analysis', meta: { marketName: body.marketName, timeframe: body.timeframe, mode: 'text' }, timestamp: new Date().toISOString() }) }).catch(function() {}));
    console.log('API response received:', data);
    var report = data && data.report;
    if (!report) {
      console.warn('Report missing in API response', data);
      showToast('Analysis returned empty report', 'error');
      return;
    }
    console.log('renderReport called with text report');
    renderReport(report);
    showToast('Analysis complete!', 'success');
  } catch (err) {
    console.error('analyzeText error:', err);
    if (err.body && err.body.blocked) {
      state.plan = err.body.plan || state.plan;
      state.credits = err.body.remainingCredits != null ? err.body.remainingCredits : 0;
      updateCreditsUI(state.credits, state.plan);
      openUpgradeModal();
      showToast('No credits remaining. Please upgrade.', 'error');
    } else {
      showToast(err.message, 'error');
    }
  } finally {
    setLoading(btn, false);
  }
}

function setLoading(btn, loading) {
  state.isAnalyzing = loading;
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = '⏳ Analyzing...';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || btn.textContent;
  }
}

function getReportContainer() {
  var container = el('reportSection');
  if (!container) {
    console.warn('reportSection not found in DOM, creating new');
    container = document.createElement('div');
    container.id = 'reportSection';
    container.className = 'card report-card full-width';
    container.innerHTML = '<div class="report-card-glow"></div><div class="card-header"><div class="report-header-left"><span class="report-icon">🤖</span><div><h3>AI Analysis Report</h3><p class="report-subtitle">Educational analysis only — not financial advice.</p></div></div><div class="report-badges"><span id="reportBias" class="badge-badge"></span><span id="reportRisk" class="badge-badge"></span><span id="reportConfidence" class="badge-badge"></span></div></div><div class="card-body"><div class="report-hero"><div class="report-hero-item"><span class="report-hero-label">Market</span><span id="reportMarket" class="report-hero-value"></span></div><div class="report-hero-item"><span class="report-hero-label">Timeframe</span><span id="reportTimeframe" class="report-hero-value"></span></div><div class="report-hero-item"><span class="report-hero-label">Trend</span><span id="reportTrend" class="report-hero-value"></span></div></div><div class="report-section-title">📊 Scenarios</div><div class="report-scenarios"><div class="scenario-card bullish-card"><div class="scenario-header"><span class="scenario-dot bullish-dot"></span><strong>Bullish Scenario</strong></div><p id="reportBullish"></p></div><div class="scenario-card bearish-card"><div class="scenario-header"><span class="scenario-dot bearish-dot"></span><strong>Bearish Scenario</strong></div><p id="reportBearish"></p></div><div class="scenario-card sideways-card"><div class="scenario-header"><span class="scenario-dot sideways-dot"></span><strong>Sideways Scenario</strong></div><p id="reportSideways"></p></div></div><div class="report-section-title">📍 Key Levels</div><div class="levels-grid"><div class="level-card bullish-card"><div class="level-card-header"><span class="level-icon">🟢</span><strong>Support Zones</strong></div><ul id="reportSupport" class="level-list"></ul></div><div class="level-card bearish-card"><div class="level-card-header"><span class="level-icon">🔴</span><strong>Resistance Zones</strong></div><ul id="reportResistance" class="level-list"></ul></div><div class="level-card target-card"><div class="level-card-header"><span class="level-icon">🎯</span><strong>Target Zones</strong></div><ul id="reportTargets" class="level-list"></ul></div></div><div class="report-section-title">💡 Entry & Risk</div><div class="logic-grid-2"><div class="logic-card"><div class="logic-card-header">📥 Entry Logic</div><p id="reportEntry"></p></div><div class="logic-card"><div class="logic-card-header">🛑 Stop Loss Logic</div><p id="reportStopLoss"></p></div><div class="logic-card invalid-card"><div class="logic-card-header">⚠️ Invalid Conditions</div><p id="reportInvalid"></p></div></div><div class="report-section-title">🔑 Key Reasons</div><ul id="reportReasons" class="reasons-list"></ul><div class="report-section-title">📰 News Impact</div><div class="news-impact-card"><p id="reportNews"></p></div><div class="report-section-title">🌐 Live Market Context</div><div class="market-context-card"><p id="reportContext"></p></div><div class="report-footer-note"><p>📌 <strong>Final Note:</strong> This is educational analysis only, not financial advice. Always do your own research before trading.</p></div></div>';
    var analyzeSection = el('analyzeSection');
    if (analyzeSection) {
      analyzeSection.appendChild(container);
    } else {
      document.body.appendChild(container);
    }
    console.log('report container created dynamically');
  }
  console.log('report container found:', container.id);
  return container;
}

function renderReport(report, target) {
  console.log('renderReport called');
  if (!report) {
    console.warn('renderReport: missing report');
    return;
  }
  console.log('renderReport: received report for', report.marketName);
  var container = target || getReportContainer();
  console.log('report container found:', container.id);

  el('reportMarket').textContent = report.marketName || '';
  el('reportTimeframe').textContent = report.timeframe || '';
  el('reportTrend').textContent = report.trend || '';

  var bias = (report.overallBias || 'Unclear').toLowerCase();
  var biasEl = el('reportBias');
  biasEl.className = 'badge-badge ' + (bias === 'bullish' ? 'badge-bullish' : bias === 'bearish' ? 'badge-bearish' : 'badge-neutral');
  biasEl.textContent = report.overallBias || 'Unclear';

  var riskLabel = (report.riskLevel || 'Medium').toLowerCase();
  el('reportRisk').className = 'badge-badge risk-' + riskLabel;
  el('reportRisk').textContent = 'Risk: ' + report.riskLevel;

  var confLabel = (report.confidence || 'Low').toLowerCase();
  el('reportConfidence').className = 'badge-badge confidence-' + confLabel;
  el('reportConfidence').textContent = 'Confidence: ' + report.confidence;

  el('reportBullish').textContent = report.bullishScenario || 'No specific bullish scenario defined.';
  el('reportBearish').textContent = report.bearishScenario || 'No specific bearish scenario defined.';
  el('reportSideways').textContent = report.sidewaysScenario || 'No specific sideways scenario defined.';

  var supportHtml = (report.supportZones || []).map(function(z) { return '<li>' + z + '</li>'; }).join('');
  var resistanceHtml = (report.resistanceZones || []).map(function(z) { return '<li>' + z + '</li>'; }).join('');
  var targetsHtml = (report.targetZones || []).map(function(z) { return '<li>' + z + '</li>'; }).join('');
  el('reportSupport').innerHTML = supportHtml || '<li>No support zones defined</li>';
  el('reportResistance').innerHTML = resistanceHtml || '<li>No resistance zones defined</li>';
  el('reportTargets').innerHTML = targetsHtml || '<li>No target zones defined</li>';

  el('reportEntry').textContent = report.entryZoneLogic || 'No entry logic defined.';
  el('reportStopLoss').textContent = report.stopLossLogic || 'No stop loss logic defined.';
  el('reportInvalid').textContent = (report.invalidConditions && report.invalidConditions.length ? report.invalidConditions.join('; ') : 'No invalid conditions defined.');
  el('reportReasons').innerHTML = (report.keyReasons || []).map(function(r) { return '<li>' + r + '</li>'; }).join('');
  el('reportNews').textContent = report.newsImpact || 'No news impact data available.';
  el('reportContext').textContent = report.liveMarketContext || 'No live market context available.';

  if (container) {
    container.classList.remove('hidden');
    console.log('report container visibility restored');
  }
  setTimeout(function() {
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
  console.log('report injected successfully');
}

// ===== PWA INSTALL POPUP =====
function shouldShowPwaPrompt() {
  if (!state.promptCooldown) return true;
  var diff = Date.now() - state.promptCooldown;
  return diff > 7 * 24 * 60 * 60 * 1000;
}

function hidePwaPopup() {
  hide('pwaInstallPopup');
}

function setupPwaInstall() {
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    state.deferredPrompt = e;
    if (shouldShowPwaPrompt()) {
      setTimeout(function() {
        show('pwaInstallPopup');
      }, 1500);
    }
  });

  window.addEventListener('appinstalled', function() {
    state.deferredPrompt = null;
    hidePwaPopup();
    localStorage.removeItem('tradlys_prompt_cooldown');
    showToast('Tradlys installed successfully!', 'success');
    ;(api('/admin/track', { method: 'POST', body: JSON.stringify({ type: 'pwa_install', userEmail: state.user ? state.user.email : null, action: 'installed', meta: {}, timestamp: new Date().toISOString() }) }).catch(function() {}));
  });
}

function installPwa() {
  if (!state.deferredPrompt) {
    showToast('Install not available right now.', 'info');
    return;
  }
  state.deferredPrompt.prompt();
  state.deferredPrompt.userChoice.then(function(choiceResult) {
    if (choiceResult.outcome === 'accepted') {
      showToast('Installing Tradlys...', 'success');
    } else {
      localStorage.setItem('tradlys_prompt_cooldown', String(Date.now()));
      showToast('Install dismissed.', 'info');
    }
    state.deferredPrompt = null;
    hidePwaPopup();
  });
}

function deferPwaPrompt() {
  localStorage.setItem('tradlys_prompt_cooldown', String(Date.now()));
  hidePwaPopup();
}

// ===== HISTORY =====
async function loadHistory() {
  if (!state.user) {
    el('historyList').innerHTML = '<p style="color: var(--text-muted); text-align:center;">Please login to view history</p>';
    return;
  }
  el('historyList').innerHTML = '<div class="loading"><div class="spinner"></div> Loading...</div>';
  try {
    // Backend expects /api/history/:userId
    var userId = state.user.uid || state.user.email || 'demo_user';
    var data = await api('/history/' + userId);
    var list = data && (data.data || data.history) ? (data.data || data.history) : [];
    state.allHistory = list;
    filterHistory();
  } catch (err) {
    // Never show a 404; render empty-state on errors.
    state.allHistory = [];
    filterHistory();
  }
}

function filterHistory() {
  var query = (el('historySearch').value || '').toLowerCase();
  var reports = state.allHistory || [];
  var filtered = reports;
  if (query) {
    filtered = reports.filter(function(r) {
      var text = (r.analysisData && r.analysisData.marketName ? r.analysisData.marketName : '') + ' ' + (r.type || '');
      return text.toLowerCase().indexOf(query) !== -1;
    });
  }
  var container = el('historyList');
  if (!filtered.length) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align:center; padding: 40px;">No analysis history yet</p>';
    return;
  }
  container.innerHTML = filtered.map(function(r) {
    var reportId = r.reportId || r.id;
    return '<div class="history-item" data-history-id="' + reportId + '">' +
      '<span class="history-type-icon">' + (r.type === 'image' ? '📸' : '💬') + '</span>' +
      '<div class="history-info">' +
        '<div class="history-market">' + (r.analysisData && r.analysisData.marketName ? r.analysisData.marketName : 'Unknown') + '</div>' +
        '<div class="history-date">' + new Date(r.createdAt).toLocaleString() + '</div>' +
      '</div>' +
      '<span class="badge-bias ' + ('bias-' + (r.analysisData && r.analysisData.overallBias ? r.analysisData.overallBias.toLowerCase() : 'unclear')) + '">' + (r.analysisData && r.analysisData.overallBias ? r.analysisData.overallBias : '—') + '</span>' +
    '</div>';
  }).join('');
}

async function loadHistoryDetail(reportId) {
  showToast('Loading report details...', 'info');
  try {
    var userId = state.user.uid || state.user.email || 'demo_user';
    var data = await api('/history/' + userId);
    var list = data && (data.data || data.history) ? (data.data || data.history) : [];
    var report = (list || []).find(function(item) { return item.reportId === reportId || item.id === reportId; });
    if (!report) {
      showToast('Report not found', 'error');
      return;
    }
    var result = report.analysisData || report;
    renderReport(result);
    showSection('analyze');
  } catch (err) {
    showToast('Failed to load report details', 'error');
  }
}

// ===== DASHBOARD =====
async function loadDashboard() {
  el('marketData').innerHTML = '<div class="loading"><div class="spinner"></div> Loading market data...</div>';
  el('newsData').innerHTML = '<div class="loading"><div class="spinner"></div> Loading news...</div>';
  try {
    var data = await api('/market/live');
    var marketData = data.data || [];
    el('marketData').innerHTML = marketData.map(function(item) {
      return '<div class="market-item"><div><div class="market-symbol">' + item.symbol + '</div><div class="market-name">' + item.name + '</div></div><div style="text-align:right"><div class="market-price">₹' + (item.ltp != null ? item.ltp.toFixed(2) : '—') + '</div><div class="market-change ' + (item.change >= 0 ? 'up' : 'down') + '">' + (item.change >= 0 ? '+' : '') + (item.change != null ? item.change.toFixed(2) : '0') + ' (' + (item.changePercent != null ? item.changePercent.toFixed(2) : '0') + '%)</div></div></div>';
    }).join('');
  } catch (err) {
    el('marketData').innerHTML = '<p style="color: var(--red);">Failed to load market data: ' + err.message + '</p>';
  }
  try {
    var data = await api('/market/live');
    var news = data.news || data;
    var headlines = news.headlines || [];
    if (headlines.length === 0) {
      el('newsData').innerHTML = '<p style="color: var(--text-muted);">No news available.</p>';
    } else {
      el('newsData').innerHTML = headlines.map(function(n) {
        return '<div class="news-item"><div class="news-title">' + n.title + '</div><div class="news-meta"><span>' + (n.source || 'News') + '</span><span class="sentiment-' + (n.sentiment || 'neutral').toLowerCase() + '">' + (n.sentiment || 'Neutral') + '</span></div></div>';
      }).join('');
    }
  } catch (err) {
    el('newsData').innerHTML = '<p style="color: var(--red);">Failed to load news</p>';
  }
}

function refreshMarket() {
  showToast('Refreshing market data...', 'info');
  loadDashboard();
}

// ===== TICKER =====
function buildTicker(stocks) {
  var track = el('tickerTrack');
  var items = stocks.map(function(s) {
    return '<span class="ticker-item"><strong>' + s.symbol + '</strong> ₹' + (s.ltp != null ? s.ltp.toFixed(2) : '—') + ' <span class="ticker-change ' + (s.change >= 0 ? 'up' : 'down') + '">' + (s.change >= 0 ? '+' : '') + (s.changePercent != null ? s.changePercent.toFixed(2) : '0') + '%</span></span>';
  });
  track.innerHTML = items.join('') + items.join('');
}

function loadTicker() {
  fetch(CONFIG.API_URL + '/market/live')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var stocks = data.data || [];
      if (stocks.length > 0) buildTicker(stocks);
    })
    .catch(function() { buildTicker(getTickerFallback()); });
}

function getTickerFallback() {
  return [
    { symbol: 'NIFTY', ltp: 22045, changePercent: 0.57, change: 125 },
    { symbol: 'BANKNIFTY', ltp: 48250, changePercent: -0.37, change: -180 },
    { symbol: 'RELIANCE', ltp: 2890, changePercent: 1.14, change: 32.5 },
    { symbol: 'TCS', ltp: 3850, changePercent: -0.40, change: -15.3 }
  ];
}

// ===== WATCHLIST =====
function persistWatchlist() {
  localStorage.setItem('tradlys_watchlist', JSON.stringify(state.watchlist));
}

function renderWatchlist() {
  var container = el('watchlistData');
  var empty = el('watchlistEmpty');
  if (!container) return;
  var list = state.watchlist || [];
  if (list.length === 0) {
    container.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');
  container.innerHTML = list.map(function(item) {
    var changeClass = (item.changePercent || 0) >= 0 ? 'bullish' : 'bearish';
    var changeText = item.changePercent != null ? (item.changePercent >= 0 ? '+' : '') + item.changePercent.toFixed(2) + '%' : '—';
    return '<div class="watchlist-item"><span class="symbol">' + (item.symbol || '—') + '</span><div style="display:flex;gap:8px;align-items:center;"><span class="change ' + changeClass + '">' + changeText + '</span><button class="btn btn-sm btn-danger" data-remove-symbol="' + (item.symbol || '') + '" aria-label="Remove ' + (item.symbol || '') + '">✕</button></div></div>';
  }).join('');
}

function addWatchlist(symbol) {
  var clean = String(symbol || '').trim().toUpperCase();
  if (!clean) return;
  var exists = (state.watchlist || []).some(function(item) { return String(item.symbol || '').toUpperCase() === clean; });
  if (exists) {
    showToast('Symbol already in watchlist', 'info');
    return;
  }
  state.watchlist = state.watchlist || [];
  state.watchlist.push({ symbol: clean, changePercent: null, price: null });
  persistWatchlist();
  renderWatchlist();
  syncWatchlistPrice();
  showToast('Added to watchlist', 'success');
  ;(api('/admin/track', { method: 'POST', body: JSON.stringify({ type: 'watchlist', userEmail: state.user ? state.user.email : null, action: 'add', meta: { symbol: clean }, timestamp: new Date().toISOString() }) }).catch(function() {}));
}

function removeWatchlist(symbol) {
  var clean = String(symbol || '').trim().toUpperCase();
  state.watchlist = (state.watchlist || []).filter(function(item) { return String(item.symbol || '').toUpperCase() !== clean; });
  persistWatchlist();
  renderWatchlist();
  ;(api('/admin/track', { method: 'POST', body: JSON.stringify({ type: 'watchlist', userEmail: state.user ? state.user.email : null, action: 'remove', meta: { symbol: clean }, timestamp: new Date().toISOString() }) }).catch(function() {}));
}

function openWatchlistModal() {
  show('watchlistModal');
  var input = el('watchlistInput');
  if (input) { input.value = ''; input.focus(); }
}

function closeWatchlistModal() {
  hide('watchlistModal');
}

function addWatchlistFromModal() {
  var input = el('watchlistInput');
  if (input) {
    addWatchlist(input.value);
    closeWatchlistModal();
  }
}

async function syncWatchlistPrice() {
  if (!state.watchlist.length) return;
  try {
    var data = await api('/market/live');
    var marketData = data.data || [];
    state.watchlist = state.watchlist.map(function(item) {
      var found = marketData.find(function(m) { return String(m.symbol || '').toUpperCase() === String(item.symbol || '').toUpperCase(); });
      if (found) {
        return {
          symbol: found.symbol || item.symbol,
          changePercent: found.changePercent,
          price: found.ltp,
          change: found.change
        };
      }
      return item;
    });
    persistWatchlist();
    renderWatchlist();
    try {
      var symbols = state.watchlist.map(function(item) { return item.symbol; }).join(',');
      await api('/watchlist?symbols=' + encodeURIComponent(symbols), { method: 'GET' });
    } catch (e) {
      console.warn('Backend watchlist sync failed:', e);
    }
  } catch (err) {
    console.warn('Watchlist sync failed:', err);
  }
}

// ===== TRENDING / GAINERS / LOSERS =====
var currentTrendingTab = 'trending';

async function loadTrending(tab) {
  tab = tab || 'trending';
  currentTrendingTab = tab;
  qsa('.trend-tab').forEach(function(btn) {
    var isActive = btn.dataset.trend === tab;
    btn.classList.toggle('active', isActive);
    btn.classList.toggle('btn-primary', isActive);
    btn.classList.toggle('btn-outline', !isActive);
  });
  var container = el('trendingData');
  container.innerHTML = '<div class="loading"><div class="spinner"></div> Loading...</div>';
  try {
    var data = await api('/market/trending');
    var list = data[tab] || [];
    if (!list.length) {
      container.innerHTML = '<p class="empty-state">No data available.</p>';
      return;
    }
    container.innerHTML = list.map(function(item) {
      var badge = (item.changePercent || 0) > 0 ? 'badge-bullish' : (item.changePercent || 0) < 0 ? 'badge-bearish' : 'badge-neutral';
      var pct = item.changePercent != null ? (item.changePercent >= 0 ? '+' : '') + item.changePercent.toFixed(2) + '%' : '—';
      return '<div class="stock-card"><div class="stock-card-header"><span class="stock-symbol">' + item.symbol + '</span><span class="badge-badge ' + badge + '">' + pct + '</span></div><div class="stock-card-body"><div class="stock-name">' + (item.name || item.symbol) + '</div><div class="stock-price">₹' + (item.ltp != null ? item.ltp.toFixed(2) : '—') + '</div></div></div>';
    }).join('');
  } catch (err) {
    container.innerHTML = '<p class="empty-state">Failed to load ' + tab + ' data.</p>';
  }
}

// ===== CANDLESTICK BACKGROUND =====
function buildCandlestickBg() {
  var container = el('candlestickBg');
  if (!container) return;
  for (var i = 0; i < 25; i++) {
    var candle = document.createElement('div');
    candle.className = 'candle';
    var isBullish = Math.random() > 0.45;
    var height = 20 + Math.random() * 120;
    candle.style.cssText = 'left:' + (Math.random() * 100) + '%;height:' + height + 'px;background:' + (isBullish ? 'var(--green)' : 'var(--red)') + ';animation-duration:' + (8 + Math.random() * 18) + 's;animation-delay:' + (-Math.random() * 20) + 's;';
    container.appendChild(candle);
  }
}

function scrollToFeatures() {
  var features = el('featuresSection');
  if (features) features.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== MOBILE NAV =====
function openMobileMenu() {
  show('mobileMenu');
  if (el('mobileMenuBtn')) el('mobileMenuBtn').setAttribute('aria-expanded', 'true');
}

function closeMobileMenu() {
  hide('mobileMenu');
  if (el('mobileMenuBtn')) el('mobileMenuBtn').setAttribute('aria-expanded', 'false');
}

function toggleMobileMenu() {
  if (el('mobileMenu') && el('mobileMenu').classList.contains('hidden')) {
    openMobileMenu();
  } else {
    closeMobileMenu();
  }
}

function updateMobileMenuState(section) {
  qsa('.mobile-menu-link').forEach(function(btn) {
    var isActive = btn.dataset.section === section;
    btn.classList.toggle('active', isActive);
  });
}

function updateAllNavStates(section) {
  updateMobileMenuState(section);
  qsa('.nav-link').forEach(function(btn) {
    btn.classList.toggle('active', btn.textContent.trim().toLowerCase() === section);
  });
}

function openAdminHidden() {
  window.location.hash = '#admin';
}

function handleHash() {
  if (window.location.hash === '#admin') {
    window.location.href = 'admin.html';
  }
}

function setupAdminShortcuts() {
  window.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      openAdminHidden();
    }
  });
  window.addEventListener('hashchange', handleHash);
  if (window.location.hash === '#admin') handleHash();
}

// ===== INIT =====
function init() {
  updateAuthUI();
  setupUpload();
  buildCandlestickBg();
  loadTicker();
      renderWatchlist();
      bindWatchlistRemoveButtons();
      setupPwaInstall();
  setupAdminShortcuts();
  showSection('dashboard');
  setInterval(loadTicker, 60000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.proceedToUpgrade = function () {
  var plan = (window.state && window.state.selectedPremiumPlan) || 'starter';
  window.location.href = 'payment.html?plan=' + encodeURIComponent(plan);
};
