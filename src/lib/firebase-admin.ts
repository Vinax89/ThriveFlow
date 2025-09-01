import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import 'dotenv/config';

const apps = getApps();

if (!apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
    });
  } else {
    // When running locally, the Admin SDK will automatically use
    // Application Default Credentials if they are set up.
    // Otherwise, it might fall back to other discovery methods.
    initializeApp();
  }
}

export const db = getFirestore();
