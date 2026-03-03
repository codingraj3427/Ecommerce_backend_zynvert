const admin = require('firebase-admin');
const fs = require('fs');

let firebaseApp;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
  const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('Firebase Admin SDK initialized with service account file for local development.');
} else {
  // THIS IS THE CRUCIAL PART FOR CLOUD RUN
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;

  if (!firebaseProjectId) {
    console.error('FIREBASE_PROJECT_ID environment variable is not set. Firebase Admin SDK might not initialize correctly.');
    firebaseApp = admin.initializeApp(); // Fallback, but will likely lead to this error
  } else {
    firebaseApp = admin.initializeApp({
      projectId: firebaseProjectId, // Explicitly setting the Firebase Project ID
    });
    console.log(`Firebase Admin SDK initialized with attached service account and projectId: ${firebaseProjectId}`);
  }
}

module.exports = firebaseApp;
