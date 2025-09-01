if (typeof window === 'undefined') {
  throw new Error("Don't import '@/lib/firebase' on the server. Use '@/lib/firebase-admin'.")
}
export * from './firebase-client';
