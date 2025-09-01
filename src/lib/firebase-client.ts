/**
 * Auto-added by apply-integrated-patch on 2024-08-01T04:50:56.289Z
 * Safe to edit.
 */

'use client';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const cfg = {
  apiKey: "AIzaSyAddvTvJAz5KcsBW3ebtWvSgFZtd7gj7oQ",
  authDomain: "thriveflow-xbtmh.firebaseapp.com",
  projectId: "thriveflow-xbtmh",
  storageBucket: "thriveflow-xbtmh.appspot.com",
  messagingSenderId: "432158874114",
  appId: "1:432158874114:web:57cad19b0afaffa014651b"
};

export const app = getApps().length ? getApp() : initializeApp(cfg);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Optional but recommended: client persistence (guarded)
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch(() => {/* multi-tab or private mode; ignore */});
}
