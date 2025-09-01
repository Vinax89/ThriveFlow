/**
 * Auto-added by apply-integrated-patch on 2024-08-01T04:50:56.289Z
 * Safe to edit.
 */

import 'server-only';

type Any = any;
let admin: Any = null;
let adminApp: Any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  admin = require('firebase-admin');
  adminApp = admin.apps && admin.apps.length ? admin.app() : admin.initializeApp();
} catch (e) {
  // firebase-admin not installed or not available in this runtime.
}

export const adminAppOrNull = adminApp || null;
export const adminSdkOrNull = admin || null;

export const db = adminApp
  ? admin.firestore()
  : new Proxy({}, {
      get() {
        throw new Error('[firebase-admin] Not configured. Install firebase-admin and set credentials for server-side Firestore usage.');
      }
    });

export default db;
