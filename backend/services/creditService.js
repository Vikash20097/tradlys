const { getStoredUsers, setStoredUsers } = require('./userService');

const PLANS = {
  starter: { name: 'Starter', price: 99, credits: 20, unlimited: false },
  trader:  { name: 'Trader',  price: 299, credits: 100, unlimited: false },
  pro:     { name: 'Pro',     price: 799, credits: 999999, unlimited: true }
};

const ensureUser = (uid, email) => {
  const users = getStoredUsers();
  if (users[uid]) return { uid, ...users[uid] };
  const newUser = {
    email: email || ('user_' + uid.slice(0, 8) + '@tradlys.com'),
    plan: 'free',
    credits: 5,
    totalCreditsPurchased: 0,
    totalAnalyses: 0,
    createdAt: new Date().toISOString(),
    lastAnalysis: null
  };
  users[uid] = newUser;
  setStoredUsers(users);
  return { uid, ...newUser };
};

const getUserProfile = (uid) => {
  const user = getStoredUsers()[uid];
  if (!user) return null;
  return { uid, ...user };
};

const consumeCredit = (uid) => {
  const users = getStoredUsers();
  const user = users[uid];
  if (!user) return { success: false, remaining: 0, plan: 'free' };
  if (user.plan === 'pro' || (user.credits || 0) > 0) {
    if (user.plan !== 'pro') user.credits = Math.max(0, (user.credits || 0) - 1);
    user.totalAnalyses = (user.totalAnalyses || 0) + 1;
    user.lastAnalysis = new Date().toISOString();
    users[uid] = user;
    setStoredUsers(users);
    return { success: true, remaining: user.credits, plan: user.plan, totalAnalyses: user.totalAnalyses };
  }
  return { success: false, remaining: 0, plan: user.plan, totalAnalyses: user.totalAnalyses || 0 };
};

const addPlanCredits = (uid, planKey) => {
  const plan = PLANS[String(planKey).toLowerCase()];
  if (!plan) return null;
  const users = getStoredUsers();
  const user = users[uid];
  if (!user) return null;
  user.plan = plan.name;
  if (!plan.unlimited) {
    user.credits = (user.credits || 0) + plan.credits;
  } else {
    user.credits = 999999;
  }
  user.totalCreditsPurchased = (user.totalCreditsPurchased || 0) + (plan.unlimited ? 999999 : plan.credits);
  users[uid] = user;
  setStoredUsers(users);
  return { credits: user.credits, plan: plan.name, added: plan.credits };
};

module.exports = {
  ensureUser, getUserProfile, consumeCredit, addPlanCredits, PLANS
};
