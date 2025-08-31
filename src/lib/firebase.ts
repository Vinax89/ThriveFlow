import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  } catch (e) {
    console.warn("Already connected to emulators")
  }
}

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.warn(
      'Firestore persistence failed. This happens when multiple tabs are open.'
    );
  } else if (err.code == 'unimplemented') {
    console.warn(
      'Firestore persistence is not available in this browser.'
    );
  }
});
