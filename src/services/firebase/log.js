/**
 * ============================================================================
 * FIREBASE LOG AKTIVITAS SERVICE (src/services/firebase/log.js)
 * ============================================================================
 * Mengelola rekam jejak audit trail aktivitas di koleksi Firestore 'logAktivitas'.
 */

import { auth, db } from '../../lib/firebase.js';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit
} from 'firebase/firestore';

const COLLECTION_NAME = 'logAktivitas';

export const firebaseLogService = {
  /**
   * Mengambil riwayat log aktivitas terbaru
   */
  getAll: async ({ limitCount = 100 } = {}) => {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /**
   * Menambahkan entri log baru ke audit trail
   */
  create: async (logData) => {
    try {
      const id = 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const entry = {
        id,
        userId: auth.currentUser?.uid || logData.userId || 'sys',
        userNama: logData.userNama || 'Sistem',
        aksi: logData.aksi,
        detail: logData.detail,
        targetId: logData.targetId || null,
        targetType: logData.targetType || null,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, COLLECTION_NAME, id), entry);
      return entry;
    } catch (err) {
      // Disengaja: kegagalan mencatat log tidak boleh membatalkan aksi utama
      console.warn('Gagal menulis log aktivitas:', err.message);
      return null;
    }
  }
};
