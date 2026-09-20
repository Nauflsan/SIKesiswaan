/**
 * ============================================================================
 * FIREBASE KATEGORI PELANGGARAN SERVICE (src/services/firebase/kategori.js)
 * ============================================================================
 * Mengelola master data kategori pelanggaran dan bobot sanksi poin di Cloud Firestore.
 */

import { db } from '../../lib/firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';

const COLLECTION_NAME = 'kategori';

export const firebaseKategoriService = {
  /**
   * Mengambil seluruh kategori pelanggaran (diurutkan berdasarkan urutan)
   */
  getAll: async () => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('urutan', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /**
   * Mengambil detail satu kategori berdasarkan ID
   */
  getById: async (id) => {
    const snap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (!snap.exists()) throw new Error('Kategori pelanggaran tidak ditemukan');
    return { id: snap.id, ...snap.data() };
  },

  /**
   * Menambah kategori pelanggaran baru (Admin Only)
   */
  create: async (data, currentUser) => {
    const newId = 'k_' + Date.now();
    const newKategori = {
      id: newId,
      nama: data.nama.trim(),
      poin: Number(data.poin),
      deskripsi: data.deskripsi || null,
      isActive: data.isActive !== false,
      urutan: Number(data.urutan || 99),
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, COLLECTION_NAME, newId), newKategori);
    return newKategori;
  },

  /**
   * Memperbarui kategori pelanggaran
   */
  update: async (id, data, currentUser) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData = {
      ...data,
      poin: data.poin !== undefined ? Number(data.poin) : undefined,
      urutan: data.urutan !== undefined ? Number(data.urutan) : undefined,
      updatedAt: new Date().toISOString()
    };

    // Bersihkan properti undefined
    Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

    await updateDoc(docRef, updateData);
    const snap = await getDoc(docRef);
    return { id: snap.id, ...snap.data() };
  },

  /**
   * Menghapus kategori pelanggaran
   */
  delete: async (id, currentUser) => {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    return true;
  }
};
