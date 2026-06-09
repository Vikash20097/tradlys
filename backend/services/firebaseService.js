const isFirebaseConfigured = () => {
  return (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY &&
    !process.env.FIREBASE_PROJECT_ID.includes('your_')
  );
};

let admin;
let memoryStore = {};

const tryInitFirebase = async () => {
  if (admin) return admin;
  if (!isFirebaseConfigured()) return null;
  try {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
      });
    }
    return admin;
  } catch (e) {
    console.warn('Firebase init failed, using in-memory store:', e.message);
    return null;
  }
};

const saveAnalysis = async (userId, analysisData, type, imageUrl) => {
  const dbAdmin = await tryInitFirebase();
  if (dbAdmin) {
    const reportId = 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const report = {
      reportId,
      userId,
      type,
      analysisData,
      imageUrl: imageUrl || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await dbAdmin.firestore().collection('analysis').doc(reportId).set(report);
    return { reportId, ...report };
  }

  const reportId = 'mem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  const report = {
    reportId,
    userId,
    type,
    analysisData,
    imageUrl: imageUrl || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!memoryStore[userId]) memoryStore[userId] = [];
  memoryStore[userId].push(report);
  return { reportId, ...report };
};

const getAnalysisHistory = async (userId) => {
  const dbAdmin = await tryInitFirebase();
  if (dbAdmin) {
    const snapshot = await dbAdmin
      .firestore()
      .collection('analysis')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  const list = (memoryStore[userId] || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return list.map(item => ({ id: item.reportId, ...item }));
};

const deleteAnalysis = async (reportId, userId) => {
  const dbAdmin = await tryInitFirebase();
  if (dbAdmin) {
    const doc = await dbAdmin.firestore().collection('analysis').doc(reportId).get();
    if (!doc.exists) throw new Error('Report not found');
    if (doc.data().userId !== userId) throw new Error('Unauthorized');
    await doc.ref.delete();
    return;
  }

  const list = memoryStore[userId] || [];
  const index = list.findIndex(item => item.reportId === reportId);
  if (index === -1) throw new Error('Report not found');
  list.splice(index, 1);
};

const getAdminStats = async () => {
  const dbAdmin = await tryInitFirebase();
  if (dbAdmin) {
    const usersSnapshot = await dbAdmin.firestore().collection('users').count().get();
    const reportsSnapshot = await dbAdmin.firestore().collection('analysis').count().get();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySnapshot = await dbAdmin
      .firestore()
      .collection('analysis')
      .where('createdAt', '>=', today.toISOString())
      .count()
      .get();
    return {
      totalUsers: usersSnapshot.data().count,
      totalReports: reportsSnapshot.data().count,
      reportsToday: todaySnapshot.data().count
    };
  }

  const users = Object.keys(memoryStore).length;
  const allReports = Object.values(memoryStore).flat();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayReports = allReports.filter(item => new Date(item.createdAt) >= today).length;

  return {
    totalUsers: users,
    totalReports: allReports.length,
    reportsToday: todayReports
  };
};

module.exports = {
  saveAnalysis,
  getAnalysisHistory,
  deleteAnalysis,
  getAdminStats
};
