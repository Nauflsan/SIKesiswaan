/**
 * ============================================================================
 * FIREBASE SISWA SERVICE (src/services/firebase/siswa.js)
 * ============================================================================
 * Mengelola pangkalan data master siswa, filter pencarian, dan impor massal Excel.
 */

import { db } from '../../lib/firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  orderBy
} from 'firebase/firestore';
import { firebaseLogService } from './log.js';

const COLLECTION_NAME = 'siswa';

export const firebaseSiswaService = {
  /**
   * Mengambil daftar siswa dengan kriteria filter kelas, status SP, dan pencarian teks.
   */
  getAll: async ({ kelas, search, statusSP } = {}) => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('nama', 'asc'));
    const snap = await getDocs(q);
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter: Hanya siswa yang belum di-soft delete
    list = list.filter(s => s.isActive !== false && !s.deletedAt);

    if (kelas && kelas !== 'semua') {
      list = list.filter(s => s.kelas === kelas);
    }
    if (statusSP && statusSP !== 'semua') {
      list = list.filter(s => s.statusSP === statusSP);
    }
    if (search) {
      const queryStr = search.toLowerCase();
      list = list.filter(s =>
        (s.nama && s.nama.toLowerCase().includes(queryStr)) ||
        (s.nisn && s.nisn.includes(queryStr))
      );
    }

    return list;
  },

  /**
   * Mengambil detail satu siswa berdasarkan ID dokumen
   */
  getById: async (id) => {
    const snap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (!snap.exists()) throw new Error('Data siswa tidak ditemukan');
    return { id: snap.id, ...snap.data() };
  },

  /**
   * Mendaftarkan data siswa baru secara manual
   */
  create: async (siswaData, currentUser) => {
    const newId = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const newSiswa = {
      id: newId,
      nisn: String(siswaData.nisn).trim(),
      nama: siswaData.nama.trim(),
      kelas: siswaData.kelas.trim(),
      jurusan: siswaData.jurusan || 'Umum',
      angkatan: Number(siswaData.angkatan || new Date().getFullYear()),
      totalPoin: 0,
      statusSP: 'normal',
      isActive: true,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, COLLECTION_NAME, newId), newSiswa);

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'tambah_siswa',
      detail: `Mendaftarkan siswa baru: ${newSiswa.nama} (${newSiswa.kelas})`,
      targetId: newId,
      targetType: 'siswa'
    });

    return newSiswa;
  },

  /**
   * Memperbarui data informasi siswa
   */
  update: async (id, data, currentUser) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    await updateDoc(docRef, updateData);
    const snap = await getDoc(docRef);
    const updated = { id: snap.id, ...snap.data() };

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'edit_siswa',
      detail: `Memperbarui data siswa: ${updated.nama}`,
      targetId: id,
      targetType: 'siswa'
    });

    return updated;
  },

  /**
   * Menghapus siswa menggunakan konsep Soft Delete
   */
  delete: async (id, currentUser) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Siswa tidak ditemukan');
    const nama = snap.data().nama;

    await updateDoc(docRef, {
      isActive: false,
      deletedAt: new Date().toISOString()
    });

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'hapus_siswa',
      detail: `Menghapus data siswa: ${nama}`,
      targetId: id,
      targetType: 'siswa'
    });

    return true;
  },

  /**
   * Import batch dari hasil parsing berkas Excel SheetJS (UPSERT)
   */
  importBatch: async (siswaList, currentUser) => {
    const allExistingSnap = await getDocs(collection(db, COLLECTION_NAME));
    const existingMap = new Map();
    allExistingSnap.docs.forEach(d => {
      const s = d.data();
      if (s.nisn && s.isActive !== false && !s.deletedAt) {
        existingMap.set(String(s.nisn), { id: d.id, ...s });
      }
    });

    let imported = 0;
    let updated = 0;
    const nowIso = new Date().toISOString();

    // Firestore membatasi 500 operasi per batch: proses bertahap per 400 dokumen
    for (let i = 0; i < siswaList.length; i += 400) {
      const chunk = siswaList.slice(i, i + 400);
      const batch = writeBatch(db);

      for (const item of chunk) {
        const nisnKey = String(item.nisn);
        if (existingMap.has(nisnKey)) {
          // Update data siswa yang sudah ada
          const existing = existingMap.get(nisnKey);
          const ref = doc(db, COLLECTION_NAME, existing.id);
          batch.update(ref, {
            nama: item.nama || existing.nama,
            kelas: item.kelas || existing.kelas,
            jurusan: item.jurusan || existing.jurusan,
            updatedAt: nowIso
          });
          updated++;
        } else {
          // Insert siswa baru
          const newId = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
          const ref = doc(db, COLLECTION_NAME, newId);
          batch.set(ref, {
            id: newId,
            nisn: item.nisn,
            nama: item.nama,
            kelas: item.kelas,
            jurusan: item.jurusan || 'Umum',
            angkatan: item.angkatan || new Date().getFullYear(),
            totalPoin: 0,
            statusSP: 'normal',
            isActive: true,
            deletedAt: null,
            createdAt: nowIso,
            updatedAt: nowIso
          });
          imported++;
        }
      }

      await batch.commit();
    }

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'import_siswa',
      detail: `Import data Excel: ${imported} siswa baru, ${updated} diperbarui`,
      targetId: null,
      targetType: 'siswa'
    });

    return { success: true, imported, updated };
  }
};
