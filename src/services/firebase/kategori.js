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
  orderBy,
  serverTimestamp
} from 'firebase/firestore';

const COLLECTION_NAME = 'kategori';

export const firebaseKategoriService = {
  /**
   * Mengambil seluruh kategori pelanggaran (diurutkan berdasarkan urutan)
   */
  getAll: async () => {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('urutan', 'asc'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Jika koleksi masih kosong di Firestore (proyek baru), inisialisasi kategori standar
      if (list.length === 0) {
        return await firebaseKategoriService.seedInitial();
      }

      return list;
    } catch (err) {
      console.warn('Gagal memuat kategori dari Firestore:', err.message);
      return [];
    }
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
  },

  /**
   * Seeding kategori standar awal untuk sekolah baru
   */
  seedInitial: async () => {
    const initialKategori = [
      { id: 'k1', nama: 'Terlambat Masuk (> 15 menit)', poin: 5, deskripsi: 'Hadir melebihi jam masuk resmi sekolah', isActive: true, urutan: 1 },
      { id: 'k2', nama: 'Atribut Seragam Tidak Lengkap', poin: 5, deskripsi: 'Tidak memakai dasi, sabuk, atau badge resmi', isActive: true, urutan: 2 },
      { id: 'k3', nama: 'Bermain Gadget / Game saat KBM', poin: 5, deskripsi: 'Menggunakan HP tanpa instruksi guru pengajar', isActive: true, urutan: 3 },
      { id: 'k4', nama: 'Bolos Jam Pelajaran', poin: 10, deskripsi: 'Meninggalkan kelas atau bersembunyi di toilet/kantin', isActive: true, urutan: 4 },
      { id: 'k5', nama: 'Keluar Lingkungan Sekolah Tanpa Izin', poin: 15, deskripsi: 'Melompat pagar atau keluar gerbang tanpa surat izin', isActive: true, urutan: 5 },
      { id: 'k6', nama: 'Merokok / Vape di Area Sekolah', poin: 25, deskripsi: 'Membawa, menghisap rokok konvensional atau elektrik', isActive: true, urutan: 6 },
      { id: 'k7', nama: 'Berkelahi / Pertikaian Fisik', poin: 40, deskripsi: 'Adu fisik baik perorangan maupun kelompok', isActive: true, urutan: 7 },
      { id: 'k8', nama: 'Tindakan Bullying / Perundungan', poin: 50, deskripsi: 'Kekerasan verbal, psikologis, atau intimidasi', isActive: true, urutan: 8 },
      { id: 'k9', nama: 'Membawa Senjata Tajam / Benda Bahaya', poin: 75, deskripsi: 'Benda berbahaya tanpa keterkaitan praktikum', isActive: true, urutan: 9 }
    ];

    const promises = initialKategori.map(k => setDoc(doc(db, COLLECTION_NAME, k.id), k));
    await Promise.all(promises);
    return initialKategori;
  }
};
