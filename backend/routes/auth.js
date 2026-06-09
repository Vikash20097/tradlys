const express = require('express');
const router = express.Router();

const isFirebaseConfigured = () => {
  return (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY &&
    !process.env.FIREBASE_PROJECT_ID.includes('your_')
  );
};

router.post('/verify', (req, res) => {
  try {
    const { token, email } = req.body;

    if (!isFirebaseConfigured()) {
      return res.json({
        message: 'Authenticated (demo mode)',
        user: {
          uid: 'demo_firebase_user',
          email: email || 'demo@tradlys.com',
          plan: 'free',
          mode: 'demo'
        }
      });
    }

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    const admin = require('firebase-admin');
    admin
      .auth()
      .verifyIdToken(token)
      .then(decoded => {
        const db = admin.firestore();
        const userRef = db.collection('users').doc(decoded.uid);
        return userRef.get();
      })
      .then(doc => {
        if (doc.exists) {
          res.json({
            message: 'Authenticated',
            user: {
              uid: doc.id,
              email: doc.data().email || 'unknown',
              plan: doc.data().plan || 'free'
            }
          });
        } else {
          res.json({
            message: 'Authenticated',
            user: {
              uid: 'new_demo_uid',
              email: email || 'unknown',
              plan: 'free'
            }
          });
        }
      })
      .catch(error => {
        console.error('Firebase verify error:', error);
        res.status(401).json({ message: 'Invalid token' });
      });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

module.exports = router;
