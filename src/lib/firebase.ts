import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAddvTvJAz5KcsBW3ebtWvSgFZtd7gj7oQ",
  authDomain: "thriveflow-xbtmh.firebaseapp.com",
  projectId: "thriveflow-xbtmh",
  storageBucket: "thriveflow-xbtmh.firebasestorage.app",
  messagingSenderId: "432158874114",
  appId: "1:432158874114:web:57cad19b0afaffa014651b",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
