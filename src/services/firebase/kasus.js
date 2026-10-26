/**
 * ============================================================================
 * FIREBASE KASUS SERVICE (src/services/firebase/kasus.js)
 * ============================================================================
 * Mengelola pencatatan kasus pelanggaran, Point Snapshot,
 * dan pembaruan akumulasi poin kedisiplinan & status SP.
 *
 * Tambah/hapus kasus dan penyesuaian poin siswa dijalankan dalam SATU transaksi
 * Firestore (runTransaction), sehingga keduanya berhasil bersama atau gagal bersama.
 * Poin siswa diperbarui dengan selisih (delta) dari dokumen siswa yang dibaca di
 * dalam transaksi, karena SDK klien tidak mendukung query di dalam transaksi.
 */

import { db } from '../../lib/firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  runTransaction,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { hitungStatusSP } from '../../lib/helpers.js';
import { defaultSchoolSettings } from './settings.js';
import { firebaseLogService } from './log.js';
import { siswaCache } from './siswaCache.js';

const COLLECTION_NAME = 'kasus';
const SETTINGS_REF = doc(db, 'settings', 'global');

// Field kasus yang boleh diedit. Poin, siswa, dan kategori terkunci (snapshot):
// untuk mengoreksinya, hapus kasus lalu buat ulang.
const UPDATABLE_FIELDS = ['status', 'deskripsi', 'tanggal'];

/**
 * Menghitung total poin dan status SP baru setelah ada selisih poin (delta).
 */
const applyPoinDelta = (siswa, delta, settingsSnap) => {
  const settings = {
    ...defaultSchoolSettings,
    ...(settingsSnap.exists() ? settingsSnap.data() : {})
  };
  const totalPoin = Math.max(0, Number(siswa.totalPoin || 0) + delta);
  return { totalPoin, statusSP: hitungStatusSP(totalPoin, settings) };
};

export const firebaseKasusService = {
  /**
   * Mengambil riwayat pelanggaran dengan filter lengkap
   */
  getAll: async ({ siswaId, kelas, kategoriId, status, search, includeDeleted = false } = {}) => {
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
  },

  /**
   * Mengambil riwayat kasus berdasarkan rentang tanggal (level query Firestore).
   * Menjaga kuota read Spark dengan HANYA mengambil dokumen dalam periode terkait.
   *
   * @param {Object} params
   * @param {string} params.tanggalMulai - Format YYYY-MM-DD
   * @param {string} params.tanggalSelesai - Format YYYY-MM-DD
   * @param {boolean} [params.includeDeleted=false]
   * @returns {Promise<Array>}
   */
  getByPeriode: async ({ tanggalMulai, tanggalSelesai, includeDeleted = false } = {}) => {
    if (!tanggalMulai || !tanggalSelesai) {
      throw new Error('Parameter tanggalMulai dan tanggalSelesai wajib diisi');
    }

    const q = query(
      collection(db, COLLECTION_NAME),
      where('tanggal', '>=', tanggalMulai),
      where('tanggal', '<=', tanggalSelesai),
      orderBy('tanggal', 'desc')
    );

    const snap = await getDocs(q);
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!includeDeleted) {
      list = list.filter(k => !k.deletedAt);
    }

    return list;
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
   * LOGIKA UTAMA: Pencatatan Kasus Baru (Point Snapshot + update poin siswa dalam satu transaksi).
   */
  create: async (kasusData, currentUser) => {
    const siswaRef = doc(db, 'siswa', kasusData.siswaId);
    const kategoriRef = doc(db, 'kategori', kasusData.kategoriId);
    const newId = 'ks_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const kasusRef = doc(db, COLLECTION_NAME, newId);
    const nowIso = new Date().toISOString();

    let nilaiBaru = null;
    const { newKasus, siswa, kategori } = await runTransaction(db, async (tx) => {
      // Semua pembacaan harus dilakukan sebelum penulisan pertama
      const siswaSnap = await tx.get(siswaRef);
      if (!siswaSnap.exists()) throw new Error('Siswa tidak ditemukan');
      const kategoriSnap = await tx.get(kategoriRef);
      if (!kategoriSnap.exists()) throw new Error('Kategori pelanggaran tidak ditemukan');
      const settingsSnap = await tx.get(SETTINGS_REF);

      const siswa = siswaSnap.data();
      const kategori = kategoriSnap.data();

      // Snapshot poin: mengunci poin saat kejadian berlangsung
      const poin = Number(kasusData.poin !== undefined ? kasusData.poin : kategori.poin);
      if (!Number.isFinite(poin) || poin < 0) throw new Error('Poin pelanggaran tidak valid');

      const newKasus = {
        id: newId,
        siswaId: siswaSnap.id,
        siswaNama: siswa.nama,
        siswaNisn: siswa.nisn,
        siswaKelas: siswa.kelas,
        kategoriId: kategoriSnap.id,
        kategoriNama: kategori.nama,
        poin,
        tanggal: kasusData.tanggal || nowIso.split('T')[0],
        deskripsi: kasusData.deskripsi || null,
        status: kasusData.status || 'baru',
        createdBy: currentUser?.id || 'sys',
        createdByNama: currentUser?.nama || 'Sistem',
        deletedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      const { totalPoin, statusSP } = applyPoinDelta(siswa, poin, settingsSnap);
      nilaiBaru = { totalPoin, statusSP };

      tx.set(kasusRef, newKasus);
      tx.update(siswaRef, { totalPoin, statusSP, updatedAt: nowIso });

      return { newKasus, siswa, kategori };
    });

    if (nilaiBaru) {
      siswaCache.patch(newKasus.siswaId, nilaiBaru);
    }

    // Audit trail dicatat setelah transaksi berhasil (kegagalan log tidak membatalkan kasus)
    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'tambah_kasus',
      detail: `Menambah kasus ${siswa.nama} — ${kategori.nama} (${newKasus.poin} poin)`,
      targetId: newId,
      targetType: 'kasus'
    });

    return newKasus;
  },

  /**
   * Memperbarui status penanganan, kronologi, atau tanggal kasus.
   * Poin tidak bisa diubah di sini (lihat UPDATABLE_FIELDS).
   */
  update: async (id, data, currentUser) => {
    const kasusRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(kasusRef);
    if (!snap.exists()) throw new Error('Kasus tidak ditemukan');
    const oldKasus = snap.data();

    const updateData = { updatedAt: new Date().toISOString() };
    for (const key of UPDATABLE_FIELDS) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }

    await updateDoc(kasusRef, updateData);

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
   * SOFT DELETE: menandai kasus terhapus dan mengurangi poin siswa dalam satu transaksi.
   */
  delete: async (id, currentUser) => {
    const kasusRef = doc(db, COLLECTION_NAME, id);
    const nowIso = new Date().toISOString();

    let nilaiBaru = null;
    const deleted = await runTransaction(db, async (tx) => {
      const kasusSnap = await tx.get(kasusRef);
      if (!kasusSnap.exists()) throw new Error('Kasus tidak ditemukan');
      const kasus = kasusSnap.data();

      // Sudah terhapus sebelumnya: jangan kurangi poin dua kali
      if (kasus.deletedAt) return null;

      const siswaRef = doc(db, 'siswa', kasus.siswaId);
      const siswaSnap = await tx.get(siswaRef);
      const settingsSnap = await tx.get(SETTINGS_REF);

      tx.update(kasusRef, {
        deletedAt: nowIso,
        deletedBy: currentUser?.id || 'sys',
        updatedAt: nowIso
      });

      if (siswaSnap.exists()) {
        const { totalPoin, statusSP } = applyPoinDelta(
          siswaSnap.data(),
          -Number(kasus.poin || 0),
          settingsSnap
        );
        nilaiBaru = { totalPoin, statusSP };
        tx.update(siswaRef, { totalPoin, statusSP, updatedAt: nowIso });
      }

      return kasus;
    });

    if (deleted && nilaiBaru) {
      siswaCache.patch(deleted.siswaId, nilaiBaru);
    }

    if (deleted) {
      await firebaseLogService.create({
        userId: currentUser?.id,
        userNama: currentUser?.nama,
        aksi: 'hapus_kasus',
        detail: `Menghapus kasus ${deleted.siswaNama} — ${deleted.kategoriNama} (${deleted.poin} poin)`,
        targetId: id,
        targetType: 'kasus'
      });
    }

    return true;
  },

  /**
   * Mengambil riwayat kasus milik satu siswa tertentu berdasarkan ID (Query Firestore langsung).
   * Mencegah full-scan koleksi kasus saat membuka detail siswa atau membuat surat.
   *
   * @param {string} siswaId - ID dokumen siswa
   * @param {Object} [options]
   * @param {boolean} [options.includeDeleted=false]
   * @returns {Promise<Array>}
   */
  getBySiswaId: async (siswaId, { includeDeleted = false } = {}) => {
    if (!siswaId) return [];
    const q = query(
      collection(db, COLLECTION_NAME),
      where('siswaId', '==', siswaId)
    );
    const snap = await getDocs(q);
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!includeDeleted) {
      list = list.filter(k => !k.deletedAt);
    }
    return list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
  },

  /**
   * Mengambil riwayat kasus untuk banyak siswa sekaligus (batch chunks max 30 per in-query).
   * Menghindari full-scan koleksi saat membuat laporan kedisiplinan satu kelas.
   * Query sengaja tanpa orderBy untuk mencegah kebutuhan indeks komposit Firestore.
   *
   * @param {string[]} daftarId - Array ID siswa
   * @param {Object} [options]
   * @param {boolean} [options.includeDeleted=false]
   * @returns {Promise<Array>}
   */
  getBySiswaIds: async (daftarId, { includeDeleted = false } = {}) => {
    if (!Array.isArray(daftarId) || daftarId.length === 0) return [];

    const validIds = Array.from(new Set(daftarId.filter(Boolean)));
    if (validIds.length === 0) return [];

    const chunks = [];
    for (let i = 0; i < validIds.length; i += 30) {
      chunks.push(validIds.slice(i, i + 30));
    }

    const snaps = await Promise.all(
      chunks.map(chunk =>
        getDocs(
          query(
            collection(db, COLLECTION_NAME),
            where('siswaId', 'in', chunk)
          )
        )
      )
    );

    let list = [];
    snaps.forEach(snap => {
      snap.docs.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
    });

    if (!includeDeleted) {
      list = list.filter(k => !k.deletedAt);
    }

    return list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
  },

  /**
   * Mengambil kasus berdasarkan status tertentu (misal: 'baru' untuk dashboard).
   *
   * @param {string} status - 'baru' | 'dalam_pembinaan' | 'selesai'
   * @returns {Promise<Array>}
   */
  getByStatus: async (status = 'baru') => {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('status', '==', status)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(k => !k.deletedAt);
  },

  /**
   * Mengambil N kasus terbaru yang aktif (dipakai ringkasan Dashboard).
   * Menggunakan limit() Firestore agar tidak menarik seluruh data historis.
   *
   * @param {number} [limitCount=5]
   * @returns {Promise<Array>}
   */
  getRecent: async (limitCount = 5) => {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('tanggal', 'desc'),
      limit(limitCount + 3)
    );
    const snap = await getDocs(q);
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(k => !k.deletedAt);
    return list.slice(0, limitCount);
  }
};
