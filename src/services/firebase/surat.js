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
  setDoc,
  updateDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { formatRomawi } from '../../lib/helpers.js';
import { firebaseSettingsService } from './settings.js';
import { firebaseLogService } from './log.js';

const COLLECTION_NAME = 'surat';

export const firebaseSuratService = {
  /**
   * Mengambil seluruh arsip surat peringatan
   */
  getAll: async ({ siswaId, jenis } = {}) => {
    try {
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
    } catch (err) {
      console.warn('Gagal memuat surat dari Firestore:', err.message);
      return [];
    }
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
   * LOGIKA UTAMA: Pembuatan Dokumen Surat Peringatan dengan Penomoran Atomik
   */
  create: async (suratData, currentUser) => {
    // 1. Ambil data siswa dari Firestore untuk snapshot identitas di surat
    const siswaRef = doc(db, 'siswa', suratData.siswaId);
    const siswaSnap = await getDoc(siswaRef);
    if (!siswaSnap.exists()) throw new Error('Siswa tidak ditemukan');
    const siswa = siswaSnap.data();

    // 2. Ambil pengaturan penomoran surat
    const settings = await firebaseSettingsService.get();

    // Inkremen counter penomoran surat
    const currentCounter = Number(settings.nomorSuratCounter || 1);
    const newCounter = currentCounter + 1;

    // Perbarui counter di settings
    await firebaseSettingsService.update({ nomorSuratCounter: newCounter }, currentUser);

    const now = new Date();
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

    const newId = 'srt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const newSurat = {
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
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, COLLECTION_NAME, newId), newSurat);

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'buat_surat',
      detail: `Menerbitkan ${newSurat.perihal} No: ${nomorSurat} untuk ${newSurat.siswaNama}`,
      targetId: newId,
      targetType: 'surat'
    });

    return newSurat;
  },

  /**
   * Memperbarui status surat (misal: dari draft menjadi dicetak)
   */
  update: async (id, data, currentUser) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Surat tidak ditemukan');

    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    await updateDoc(docRef, updateData);
    return { id, ...snap.data(), ...updateData };
  }
};
