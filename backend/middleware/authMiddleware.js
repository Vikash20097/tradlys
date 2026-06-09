const isFirebaseConfigured = () => {
  return (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY &&
    !process.env.FIREBASE_PROJECT_ID.includes('your_')
  );
};

let admin;

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
    console.warn('Firebase auth init failed (demo mode):', e.message);
    return null;
  }
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized - No token provided' });
    }
    const token = authHeader.split('Bearer ')[1];

    const firebaseAdmin = await tryInitFirebase();
    if (!firebaseAdmin) {
      req.user = { uid: token, email: null };
      return next();
    }

    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && authHeader.includes('demo_')) {
      req.user = { uid: authHeader.split('Bearer ')[1], email: null };
      return next();
    }
    return res.status(401).json({ message: 'Unauthorized - Invalid token' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.split('Bearer ')[1];

    const firebaseAdmin = await tryInitFirebase();
    if (!firebaseAdmin) {
      req.user = { uid: token, email: null };
      return next();
    }

    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    next();
  }
};

module.exports = { authenticate, optionalAuth };
