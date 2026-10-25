/**
 * ============================================================================
 * FIREBASE SURAT PERINGATAN SERVICE (src/services/firebase/surat.js)
 * ============================================================================
 * Mengelola pembuatan, counter nomor surat otomatis, dan arsip dokumen Surat Peringatan.
 */

import { db } from '../../lib/firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { formatRomawi } from '../../lib/helpers.js';
import { defaultSchoolSettings } from './settings.js';
import { firebaseLogService } from './log.js';

const COLLECTION_NAME = 'surat';
const SETTINGS_REF = doc(db, 'settings', 'global');

export const firebaseSuratService = {
  /**
   * Mengambil seluruh arsip surat peringatan
   */
  getAll: async ({ siswaId, jenis } = {}) => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (siswaId) {
      list = list.filter(s => s.siswaId === siswaId);
    }
    if (jenis && jenis !== 'semua') {
      list = list.filter(s => s.jenis === jenis);
    }

    return list;
  },

  /**
   * Mengambil riwayat surat peringatan milik satu siswa tertentu (Query Firestore langsung).
   * Mencegah full-scan koleksi surat saat membuka profil siswa di SiswaDetail.
   *
   * @param {string} siswaId
   * @returns {Promise<Array>}
   */
  getBySiswaId: async (siswaId) => {
    if (!siswaId) return [];
    const q = query(
      collection(db, COLLECTION_NAME),
      where('siswaId', '==', siswaId)
    );
    const snap = await getDocs(q);
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  /**
   * Mengambil detail surat berdasarkan ID
   */
  getById: async (id) => {
    const snap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (!snap.exists()) throw new Error('Surat tidak ditemukan');
    return { id: snap.id, ...snap.data() };
  },

  /**
   * LOGIKA UTAMA: Pembuatan Surat Peringatan dengan penomoran atomik.
   * Counter nomor surat dan dokumen surat ditulis dalam SATU transaksi, sehingga
   * dua pengguna yang menerbitkan surat bersamaan tidak akan mendapat nomor yang sama,
   * dan nomor tidak hangus bila penyimpanan surat gagal.
   */
  create: async (suratData, currentUser) => {
    const siswaRef = doc(db, 'siswa', suratData.siswaId);
    const newId = 'srt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const suratRef = doc(db, COLLECTION_NAME, newId);

    // Ambil jabatan penandatangan dari profil pengguna pembuat surat.
    // Jika pembacaan gagal atau jabatan belum diisi, gunakan jabatan bawaan sesuai peran akun.
    // Kegagalan membaca profil tidak boleh menggagalkan proses penerbitan surat.
    let jabatan = '';
    if (currentUser?.id) {
      try {
        const profil = await getDoc(doc(db, 'users', currentUser.id));
        jabatan = String(profil.data()?.jabatan || '').trim();
      } catch {
        jabatan = '';
      }
    }
    if (!jabatan) {
      jabatan = currentUser?.role === 'guru_bk' ? 'Guru Bimbingan Konseling (BK)' : currentUser?.role === 'admin' ? 'Kesiswaan' : '';
    }

    const newSurat = await runTransaction(db, async (tx) => {
      // Semua pembacaan harus dilakukan sebelum penulisan pertama
      const siswaSnap = await tx.get(siswaRef);
      if (!siswaSnap.exists()) throw new Error('Siswa tidak ditemukan');
      const settingsSnap = await tx.get(SETTINGS_REF);
      if (!settingsSnap.exists()) {
        throw new Error('Pengaturan sekolah belum diinisialisasi. Minta Administrator membuka menu Pengaturan terlebih dahulu.');
      }

      const siswa = siswaSnap.data();
      const settings = { ...defaultSchoolSettings, ...settingsSnap.data() };

      const now = new Date();
      const currentCounter = Number(settings.nomorSuratCounter || 1);
      const bulanRomawi = formatRomawi(now.getMonth() + 1);
      const tahun = now.getFullYear();
      const urutStr = String(currentCounter).padStart(3, '0');

      // Format penomoran otomatis
      const formatTpl = settings.formatNomorSurat || '{{urut}}/{{jenis}}/{{kode}}/{{bulan-romawi}}/{{tahun}}';
      const nomorSurat = formatTpl
        .replace('{{urut}}', urutStr)
        .replace('{{jenis}}', String(suratData.jenis || 'SP1').toUpperCase().replace('_', '-'))
        .replace('{{kode}}', settings.kodeSekolah || 'SMK-KHP')
        .replace('{{bulan-romawi}}', bulanRomawi)
        .replace('{{tahun}}', tahun);

      const surat = {
        id: newId,
        siswaId: siswaSnap.id,
        siswaNama: siswa.nama || '',
        siswaNisn: siswa.nisn || '',
        siswaKelas: siswa.kelas || '',
        totalPoin: Number(siswa.totalPoin || 0),
        jenis: suratData.jenis || 'sp1',
        nomorSurat,
        nomorUrut: currentCounter,
        perihal: suratData.perihal || `Surat Peringatan ${String(suratData.jenis || 'SP1').toUpperCase()}`,
        tanggalSurat: suratData.tanggalSurat || now.toISOString().split('T')[0],
        kasusIds: Array.isArray(suratData.kasusIds) ? suratData.kasusIds : [],
        keteranganTambahan: suratData.keteranganTambahan || '',
        panggilanOrtu: Boolean(suratData.panggilanOrtu),
        keteranganPanggilan: suratData.keteranganPanggilan || '',
        status: suratData.status || 'draft',
        createdBy: currentUser?.id || 'sys',
        createdByNama: currentUser?.nama || 'Sistem',
        createdByNip: currentUser?.nip || '-',
        createdByJabatan: jabatan,
        createdAt: now.toISOString()
      };

      // Update PARSIAL (hanya counter): satu-satunya perubahan settings yang boleh dilakukan Guru BK
      tx.update(SETTINGS_REF, {
        nomorSuratCounter: currentCounter + 1,
        updatedAt: now.toISOString()
      });
      tx.set(suratRef, surat);

      return surat;
    });

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'buat_surat',
      detail: `Menerbitkan ${newSurat.perihal} No: ${newSurat.nomorSurat} untuk ${newSurat.siswaNama}`,
      targetId: newId,
      targetType: 'surat'
    });

    return newSurat;
  }
};
