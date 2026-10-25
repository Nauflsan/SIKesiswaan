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
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { firebaseLogService } from './log.js';

const COLLECTION_NAME = 'siswa';

export const firebaseSiswaService = {
  /**
   * Mengambil daftar siswa dengan kriteria filter kelas, status SP, dan pencarian teks.
   */
  getAll: async ({ kelas, search, statusSP, statusSiswa } = {}) => {
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
    if (statusSiswa && statusSiswa !== 'semua') {
      // Siswa lama tanpa field statusSiswa dianggap 'aktif'
      list = list.filter(s => (s.statusSiswa || 'aktif') === statusSiswa);
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
      statusSiswa: 'aktif',
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
            statusSiswa: 'aktif',
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
  },

  /**
   * Mengoreksi data profil siswa (Admin dan Guru BK).
   * Memvalidasi format, mengecek duplikasi NISN, dan secara opsional menyinkronkan nama/NISN ke kasus.
   *
   * @param {string} id - ID dokumen siswa
   * @param {Object} data - { nisn, nama, kelas, jurusan, angkatan }
   * @param {Object} [options] - { syncKasus: boolean }
   * @param {Object} currentUser - Pengguna yang sedang login
   * @returns {Promise<{ siswa: Object, kasusDisinkronkan: number }>}
   */
  updateProfil: async (id, data, options = {}, currentUser) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Siswa tidak ditemukan');
    const oldData = snap.data();

    // 1. Normalisasi
    const cleanSpaces = (str) => String(str ?? '').trim().replace(/\s+/g, ' ');
    const nisn = String(data.nisn ?? '').replace(/\D/g, '');
    const nama = cleanSpaces(data.nama);
    const kelas = cleanSpaces(data.kelas);
    const jurusan = cleanSpaces(data.jurusan) || 'Umum';
    const angkatan = Number(data.angkatan);

    // 2. Validasi
    if (!/^\d{6,20}$/.test(nisn)) {
      throw new Error('NISN harus berupa angka (6-20 digit)');
    }
    if (!nama || nama.length > 100) {
      throw new Error('Nama siswa wajib diisi dan maksimal 100 karakter');
    }
    if (!kelas || kelas.length > 30) {
      throw new Error('Kelas wajib diisi dan maksimal 30 karakter');
    }
    if (!Number.isInteger(angkatan) || angkatan < 2000 || angkatan > 2100) {
      throw new Error('Tahun angkatan harus berupa angka antara 2000 dan 2100');
    }

    // 3. Cek duplikasi NISN bila NISN berubah
    if (nisn !== String(oldData.nisn ?? '')) {
      const qNisn = query(
        collection(db, COLLECTION_NAME),
        where('nisn', '==', nisn)
      );
      const snapNisn = await getDocs(qNisn);
      const duplicate = snapNisn.docs.find(
        (d) => d.id !== id && d.data().isActive !== false && !d.data().deletedAt
      );
      if (duplicate) {
        const dupData = duplicate.data();
        throw new Error(
          `NISN ${nisn} sudah terdaftar atas nama ${dupData.nama} (${dupData.kelas})`
        );
      }
    }

    // 4. Hitung daftar perubahan
    const changes = [];
    const fieldsToUpdate = {};

    if (nama !== oldData.nama) {
      changes.push(`Nama: "${oldData.nama}" -> "${nama}"`);
      fieldsToUpdate.nama = nama;
    }
    if (nisn !== String(oldData.nisn ?? '')) {
      changes.push(`NISN: ${oldData.nisn} -> ${nisn}`);
      fieldsToUpdate.nisn = nisn;
    }
    if (kelas !== oldData.kelas) {
      changes.push(`Kelas: ${oldData.kelas} -> ${kelas}`);
      fieldsToUpdate.kelas = kelas;
    }
    if (jurusan !== (oldData.jurusan || 'Umum')) {
      changes.push(`Jurusan: ${oldData.jurusan || 'Umum'} -> ${jurusan}`);
      fieldsToUpdate.jurusan = jurusan;
    }
    if (angkatan !== Number(oldData.angkatan)) {
      changes.push(`Angkatan: ${oldData.angkatan} -> ${angkatan}`);
      fieldsToUpdate.angkatan = angkatan;
    }

    // Jika tidak ada perubahan data, return tanpa menulis ke Firestore atau log
    if (changes.length === 0) {
      return { siswa: { id, ...oldData }, kasusDisinkronkan: 0 };
    }

    // 5. Update dokumen siswa
    const nowIso = new Date().toISOString();
    fieldsToUpdate.updatedAt = nowIso;
    await updateDoc(docRef, fieldsToUpdate);

    // 6. Sinkronkan kasus jika diminta dan nama/nisn berubah
    let kasusDisinkronkan = 0;
    const syncKasus = options?.syncKasus !== false;
    const nameOrNisnChanged =
      fieldsToUpdate.nama !== undefined || fieldsToUpdate.nisn !== undefined;

    if (syncKasus && nameOrNisnChanged) {
      const qKasus = query(
        collection(db, 'kasus'),
        where('siswaId', '==', id)
      );
      const snapKasus = await getDocs(qKasus);
      const kasusDocs = snapKasus.docs;

      if (kasusDocs.length > 0) {
        kasusDisinkronkan = kasusDocs.length;
        const kasusUpdate = {};
        if (fieldsToUpdate.nama !== undefined) kasusUpdate.siswaNama = nama;
        if (fieldsToUpdate.nisn !== undefined) kasusUpdate.siswaNisn = nisn;

        for (let i = 0; i < kasusDocs.length; i += 400) {
          const chunk = kasusDocs.slice(i, i + 400);
          const batch = writeBatch(db);
          for (const docSnap of chunk) {
            batch.update(doc(db, 'kasus', docSnap.id), kasusUpdate);
          }
          await batch.commit();
        }
      }
    }

    // 7. Catat audit log
    let detailLog = `Mengubah data siswa ${oldData.nama}: ${changes.join('; ')}`;
    if (kasusDisinkronkan > 0) {
      detailLog += ` (${kasusDisinkronkan} kasus ikut diperbarui)`;
    }

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'edit_siswa',
      detail: detailLog,
      targetId: id,
      targetType: 'siswa'
    });

    const updatedSiswa = { id, ...oldData, ...fieldsToUpdate };
    return { siswa: updatedSiswa, kasusDisinkronkan };
  },

  /**
   * Menghapus siswa secara permanen (Khusus Admin).
   * Hanya diizinkan jika siswa belum memiliki riwayat kasus atau surat sama sekali.
   *
   * @param {string} id - ID dokumen siswa
   * @param {Object} currentUser - Pengguna yang sedang login
   * @returns {Promise<boolean>}
   */
  hapusPermanen: async (id, currentUser) => {
    if (currentUser?.role !== 'admin') {
      throw new Error('Hanya Administrator yang memiliki izin menghapus siswa secara permanen');
    }

    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Data siswa tidak ditemukan');
    const siswa = snap.data();

    // Pastikan tidak ada riwayat kasus (termasuk yang soft-deleted)
    const qKasus = query(
      collection(db, 'kasus'),
      where('siswaId', '==', id),
      limit(1)
    );
    const snapKasus = await getDocs(qKasus);
    if (!snapKasus.empty) {
      throw new Error(
        'Siswa masih memiliki riwayat kasus. Gunakan status Keluar, Lulus, atau Pindah.'
      );
    }

    // Pastikan tidak ada riwayat surat
    const qSurat = query(
      collection(db, 'surat'),
      where('siswaId', '==', id),
      limit(1)
    );
    const snapSurat = await getDocs(qSurat);
    if (!snapSurat.empty) {
      throw new Error(
        'Siswa masih memiliki riwayat surat. Gunakan status Keluar, Lulus, atau Pindah.'
      );
    }

    await deleteDoc(docRef);

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'hapus_permanen_siswa',
      detail: `Menghapus permanen data siswa: ${siswa.nama} (${siswa.nisn}), tanpa riwayat kasus/surat`,
      targetId: id,
      targetType: 'siswa'
    });

    return true;
  }
};
