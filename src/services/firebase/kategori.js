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
import { firebaseLogService } from './log.js';

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

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'tambah_kategori',
      detail: `Menambahkan kategori: ${newKategori.nama} (${newKategori.poin} pt)`,
      targetId: newId,
      targetType: 'kategori'
    });

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
    const updated = { id: snap.id, ...snap.data() };

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'edit_kategori',
      detail: updateData.isActive !== undefined && Object.keys(updateData).length <= 2
        ? `${updateData.isActive ? 'Mengaktifkan' : 'Menonaktifkan'} kategori: ${updated.nama}`
        : `Memperbarui kategori: ${updated.nama}`,
      targetId: id,
      targetType: 'kategori'
    });

    return updated;
  },

  /**
   * Menghapus kategori pelanggaran
   */
  delete: async (id, currentUser) => {
    let nama = id;
    try {
      const snap = await getDoc(doc(db, COLLECTION_NAME, id));
      if (snap.exists()) nama = snap.data().nama || id;
    } catch (_) {}

    await deleteDoc(doc(db, COLLECTION_NAME, id));

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'hapus_kategori',
      detail: `Menghapus kategori: ${nama}`,
      targetId: id,
      targetType: 'kategori'
    });

    return true;
  }
};
