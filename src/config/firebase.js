const admin = require("firebase-admin");

let firebaseApp;

// Check if GOOGLE_APPLICATION_CREDENTIALS is set (typically for local development)
// and if the service account file exists.
if (
  process.env.GOOGLE_APPLICATION_CREDENTIALS &&
  require("fs").existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)
) {
  const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin SDK initialized with service account file.");
} else {
  // Otherwise, initialize without explicit credentials.
  // This will automatically use Application Default Credentials (ADC),
  // which means:
  // - On Cloud Run: it uses the service account attached to the Cloud Run service.
  // - Locally (if you run `gcloud auth application-default login`): it uses your gcloud user credentials.
  firebaseApp = admin.initializeApp();
  console.log(
    "Firebase Admin SDK initialized with Application Default Credentials.",
  );
}

module.exports = firebaseApp;
