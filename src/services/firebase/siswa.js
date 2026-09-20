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
    try {
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
    } catch (err) {
      console.warn('Gagal memuat siswa dari Firestore:', err.message);
      return [];
    }
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
    const newId = 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
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
      if (s.nisn) existingMap.set(String(s.nisn), { id: d.id, ...s });
    });

    const batch = writeBatch(db);
    let imported = 0;
    let updated = 0;

    for (const item of siswaList) {
      const nisnKey = String(item.nisn);
      if (existingMap.has(nisnKey)) {
        // Update data siswa yang sudah ada
        const existing = existingMap.get(nisnKey);
        const ref = doc(db, COLLECTION_NAME, existing.id);
        batch.update(ref, {
          nama: item.nama || existing.nama,
          kelas: item.kelas || existing.kelas,
          jurusan: item.jurusan || existing.jurusan,
          updatedAt: new Date().toISOString()
        });
        updated++;
      } else {
        // Insert siswa baru
        const newId = 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        imported++;
      }
    }

    await batch.commit();

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'import_siswa',
      detail: `Import data Excel: ${imported} siswa baru, ${updated} diperbarui`,
      targetId: null,
      targetType: 'siswa'
    });

    return { success: true, imported, updated };
  },

  /**
   * Seeding data master siswa awal SMKS Kharisma Panongan
   */
  seedInitial: async () => {
    const initialSiswa = [
      { id: 's1', nisn: '0089123401', nama: 'Dimas Aditya Pratama', kelas: 'XI TKJ 1', jurusan: 'Teknik Komputer dan Jaringan', angkatan: 2024, totalPoin: 0, statusSP: 'normal', isActive: true, deletedAt: null },
      { id: 's2', nisn: '0089123402', nama: 'Fajar Ramadhan', kelas: 'X TKR 1', jurusan: 'Teknik Kendaraan Ringan', angkatan: 2025, totalPoin: 0, statusSP: 'normal', isActive: true, deletedAt: null },
      { id: 's3', nisn: '0089123403', nama: 'Rizky Wahyu Nugroho', kelas: 'XII TKR 1', jurusan: 'Teknik Kendaraan Ringan', angkatan: 2023, totalPoin: 0, statusSP: 'normal', isActive: true, deletedAt: null },
      { id: 's4', nisn: '0089123404', nama: 'Aldi Bagus Setiawan', kelas: 'XI TKJ 1', jurusan: 'Teknik Komputer dan Jaringan', angkatan: 2024, totalPoin: 0, statusSP: 'normal', isActive: true, deletedAt: null },
      { id: 's5', nisn: '0089123405', nama: 'Bayu Arya Mahendra', kelas: 'X TKR 1', jurusan: 'Teknik Kendaraan Ringan', angkatan: 2025, totalPoin: 0, statusSP: 'normal', isActive: true, deletedAt: null },
      { id: 's6', nisn: '0089123406', nama: 'Doni Saputra', kelas: 'XII TKJ 1', jurusan: 'Teknik Komputer dan Jaringan', angkatan: 2023, totalPoin: 0, statusSP: 'normal', isActive: true, deletedAt: null },
      { id: 's7', nisn: '0089123407', nama: 'Galang Rambu Anarki', kelas: 'XI TKR 1', jurusan: 'Teknik Kendaraan Ringan', angkatan: 2024, totalPoin: 0, statusSP: 'normal', isActive: true, deletedAt: null },
      { id: 's8', nisn: '0089123408', nama: 'Hendra Gunawan', kelas: 'XII TKR 1', jurusan: 'Teknik Kendaraan Ringan', angkatan: 2023, totalPoin: 0, statusSP: 'normal', isActive: true, deletedAt: null }
    ];

    const batch = writeBatch(db);
    initialSiswa.forEach(s => {
      const ref = doc(db, COLLECTION_NAME, s.id);
      batch.set(ref, {
        ...s,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    await batch.commit();
    return initialSiswa;
  }
};
