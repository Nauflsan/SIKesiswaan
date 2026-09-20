/**
 * ============================================================================
 * FIREBASE KASUS SERVICE (src/services/firebase/kasus.js)
 * ============================================================================
 * Mengelola pencatatan kasus pelanggaran, Point Snapshot,
 * dan rekalkulasi akumulasi poin kedisiplinan & status SP secara atomik.
 */

import { db } from '../../lib/firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { hitungStatusSP } from '../../lib/helpers.js';
import { firebaseSettingsService } from './settings.js';
import { firebaseLogService } from './log.js';

const COLLECTION_NAME = 'kasus';

export const firebaseKasusService = {
  /**
   * Mengambil riwayat pelanggaran dengan filter lengkap
   */
  getAll: async ({ siswaId, kelas, kategoriId, status, search, includeDeleted = false } = {}) => {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('tanggal', 'desc'));
      const snap = await getDocs(q);
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (!includeDeleted) {
        list = list.filter(k => !k.deletedAt);
      }
      if (siswaId) {
        list = list.filter(k => k.siswaId === siswaId);
      }
      if (kelas && kelas !== 'semua') {
        list = list.filter(k => k.siswaKelas === kelas);
      }
      if (kategoriId && kategoriId !== 'semua') {
        list = list.filter(k => k.kategoriId === kategoriId);
      }
      if (status && status !== 'semua') {
        list = list.filter(k => k.status === status);
      }
      if (search) {
        const queryStr = search.toLowerCase();
        list = list.filter(k =>
          (k.siswaNama && k.siswaNama.toLowerCase().includes(queryStr)) ||
          (k.siswaNisn && k.siswaNisn.includes(queryStr)) ||
          (k.kategoriNama && k.kategoriNama.toLowerCase().includes(queryStr)) ||
          (k.deskripsi && k.deskripsi.toLowerCase().includes(queryStr))
        );
      }

      return list;
    } catch (err) {
      console.warn('Gagal memuat kasus dari Firestore:', err.message);
      return [];
    }
  },

  /**
   * Mengambil detail satu kasus berdasarkan ID
   */
  getById: async (id) => {
    const snap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (!snap.exists()) throw new Error('Kasus tidak ditemukan');
    return { id: snap.id, ...snap.data() };
  },

  /**
   * LOGIKA UTAMA: Pencatatan Kasus Baru (Point Snapshot & Atomic Recalculation).
   */
  create: async (kasusData, currentUser) => {
    // 1. Validasi keberadaan siswa
    const siswaRef = doc(db, 'siswa', kasusData.siswaId);
    const siswaSnap = await getDoc(siswaRef);
    if (!siswaSnap.exists()) throw new Error('Siswa tidak ditemukan');
    const siswa = siswaSnap.data();

    // 2. Validasi kategori untuk snapshot poin
    const kategoriRef = doc(db, 'kategori', kasusData.kategoriId);
    const kategoriSnap = await getDoc(kategoriRef);
    if (!kategoriSnap.exists()) throw new Error('Kategori pelanggaran tidak ditemukan');
    const kategori = kategoriSnap.data();

    // Snapshot poin: mengunci poin saat kejadian berlangsung
    const poinSnapshot = Number(kasusData.poin !== undefined ? kasusData.poin : kategori.poin);
    const newId = 'ks_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    const newKasus = {
      id: newId,
      siswaId: siswaSnap.id,
      siswaNama: siswa.nama,
      siswaNisn: siswa.nisn,
      siswaKelas: siswa.kelas,
      kategoriId: kategoriSnap.id,
      kategoriNama: kategori.nama,
      poin: poinSnapshot,
      tanggal: kasusData.tanggal || new Date().toISOString().split('T')[0],
      deskripsi: kasusData.deskripsi || null,
      status: kasusData.status || 'baru',
      createdBy: currentUser?.id || 'sys',
      createdByNama: currentUser?.nama || 'Sistem',
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 3. Simpan dokumen kasus ke Firestore
    await setDoc(doc(db, COLLECTION_NAME, newId), newKasus);

    // 4. Rekalkulasi atomik total poin siswa dari seluruh kasus aktifnya
    await firebaseKasusService.recalculateSiswaPoints(siswaSnap.id);

    // 5. Catat audit trail log aktivitas
    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'tambah_kasus',
      detail: `Menambah kasus ${siswa.nama} — ${kategori.nama} (${poinSnapshot} poin)`,
      targetId: newId,
      targetType: 'kasus'
    });

    return newKasus;
  },

  /**
   * Memperbarui status penanganan kasus atau keterangan kronologi
   */
  update: async (id, data, currentUser) => {
    const kasusRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(kasusRef);
    if (!snap.exists()) throw new Error('Kasus tidak ditemukan');
    const oldKasus = snap.data();

    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    await updateDoc(kasusRef, updateData);

    // Rekalkulasi poin siswa jika ada perubahan poin
    await firebaseKasusService.recalculateSiswaPoints(oldKasus.siswaId);

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'edit_kasus',
      detail: `Memperbarui kasus ${oldKasus.siswaNama} — ${oldKasus.kategoriNama}`,
      targetId: id,
      targetType: 'kasus'
    });

    return { id, ...oldKasus, ...updateData };
  },

  /**
   * SOFT DELETE: Menghapus kasus tanpa memusnahkan riwayat audit
   */
  delete: async (id, currentUser) => {
    const kasusRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(kasusRef);
    if (!snap.exists()) throw new Error('Kasus tidak ditemukan');
    const oldKasus = snap.data();

    // Beri tanda soft delete
    await updateDoc(kasusRef, {
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser?.id || 'sys'
    });

    // Otomatis kurangi poin aktif siswa
    await firebaseKasusService.recalculateSiswaPoints(oldKasus.siswaId);

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'hapus_kasus',
      detail: `Menghapus kasus ${oldKasus.siswaNama} — ${oldKasus.kategoriNama} (${oldKasus.poin} poin)`,
      targetId: id,
      targetType: 'kasus'
    });

    return true;
  },

  /**
   * Fungsi pembantu: Menghitung ulang total poin aktif siswa dan memperbarui status SP
   */
  recalculateSiswaPoints: async (siswaId) => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('siswaId', '==', siswaId)
      );
      const snap = await getDocs(q);
      const activeKasus = snap.docs
        .map(d => d.data())
        .filter(k => !k.deletedAt);

      const totalPoin = activeKasus.reduce((sum, k) => sum + Number(k.poin || 0), 0);
      const settings = await firebaseSettingsService.get();
      const statusSP = hitungStatusSP(totalPoin, settings);

      const siswaRef = doc(db, 'siswa', siswaId);
      await updateDoc(siswaRef, {
        totalPoin,
        statusSP,
        updatedAt: new Date().toISOString()
      });

      return { totalPoin, statusSP };
    } catch (err) {
      console.warn('Gagal rekalkulasi poin siswa:', err.message);
      return null;
    }
  }
};
