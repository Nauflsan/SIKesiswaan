/**
 * ============================================================================
 * FIREBASE PENGATURAN SEKOLAH SERVICE (src/services/firebase/settings.js)
 * ============================================================================
 * Mengelola konfigurasi profil sekolah, kop dinas, dan ambang batas SP
 * yang tersimpan pada dokumen singleton 'settings/global' di Cloud Firestore.
 */

import { db } from '../../lib/firebase.js';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { hitungStatusSP } from '../../lib/helpers.js';

const SETTINGS_DOC_REF = doc(db, 'settings', 'global');

export const defaultSchoolSettings = {
  // Identitas sekolah dikosongkan: wajib diisi Administrator lewat menu Pengaturan
  pemerintahDaerah: '',
  dinasPendidikan: '',
  namaSekolah: 'SMKS Kharisma Panongan',
  alamatSekolah: '',
  kotaSekolah: '',
  teleponSekolah: '',
  emailSekolah: '',
  websiteSekolah: '',
  namaKepsek: '',
  nipKepsek: '',
  // Parameter sistem
  ambangSp1: 50,
  ambangSp2: 80,
  ambangSp3: 110,
  formatNomorSurat: '{{urut}}/{{jenis}}/{{kode}}/{{bulan-romawi}}/{{tahun}}',
  kodeSekolah: 'SMK-KHP',
  nomorSuratCounter: 1,
  updatedAt: new Date().toISOString()
};

export const firebaseSettingsService = {
  /**
   * Mengambil konfigurasi profil sekolah dari dokumen singleton 'settings/global'
   */
  get: async () => {
    try {
      const snap = await getDoc(SETTINGS_DOC_REF);
      if (snap.exists()) {
        return { ...defaultSchoolSettings, ...snap.data() };
      }
      // Inisialisasi dokumen settings/global awal jika belum ada
      await setDoc(SETTINGS_DOC_REF, defaultSchoolSettings);
      return defaultSchoolSettings;
    } catch (err) {
      console.warn('Gagal membaca settings Firestore:', err.message);
      return defaultSchoolSettings;
    }
  },

  /**
   * Memperbarui informasi sekolah & ambang batas SP
   */
  update: async (data, currentUser) => {
    const currentSettings = await firebaseSettingsService.get();
    const updatedSettings = {
      ...currentSettings,
      ...data,
      ambangSp1: Number(data.ambangSp1 ?? currentSettings.ambangSp1),
      ambangSp2: Number(data.ambangSp2 ?? currentSettings.ambangSp2),
      ambangSp3: Number(data.ambangSp3 ?? currentSettings.ambangSp3),
      updatedAt: new Date().toISOString()
    };

    await setDoc(SETTINGS_DOC_REF, updatedSettings);

    // Jika ada perubahan ambang batas SP, lakukan rekalkulasi status SP seluruh siswa
    const ambangChanged =
      currentSettings.ambangSp1 !== updatedSettings.ambangSp1 ||
      currentSettings.ambangSp2 !== updatedSettings.ambangSp2 ||
      currentSettings.ambangSp3 !== updatedSettings.ambangSp3;

    if (ambangChanged) {
      try {
        const siswaSnap = await getDocs(collection(db, 'siswa'));
        const batch = writeBatch(db);
        let batchCount = 0;

        siswaSnap.docs.forEach(docSnap => {
          const s = docSnap.data();
          const newStatusSP = hitungStatusSP(s.totalPoin || 0, updatedSettings);
          if (newStatusSP !== s.statusSP) {
            batch.update(docSnap.ref, {
              statusSP: newStatusSP,
              updatedAt: new Date().toISOString()
            });
            batchCount++;
          }
        });

        if (batchCount > 0) {
          await batch.commit();
        }
      } catch (e) {
        console.warn('Gagal rekalkulasi batch status SP siswa:', e.message);
      }
    }

    return updatedSettings;
  }
};
