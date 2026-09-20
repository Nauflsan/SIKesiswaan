/**
 * ============================================================================
 * INISIALISASI GOOGLE FIREBASE SDK (src/lib/firebase.js)
 * ============================================================================
 * Menginisialisasi Firebase App, Firebase Auth, dan Cloud Firestore
 * menggunakan konfigurasi kredensial lingkungan dari .env.local.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Pastikan inisialisasi aplikasi Firebase hanya terjadi sekali (Singleton)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

// Dukungan Firebase Local Emulator (jika dinyalakan untuk pengujian offline)
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099');
    console.info('Connected to Firebase Local Emulator (Firestore:8080, Auth:9099)');
  } catch (err) {
    console.warn('Firebase Emulator already connected or unavailable:', err.message);
  }
}

export default app;
