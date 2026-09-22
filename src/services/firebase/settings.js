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
import { firebaseLogService } from './log.js';

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
  // Bulan mulai tahun ajaran (1-12). Dipakai untuk menurunkan label tahun ajaran
  // dari tanggal kasus secara on-the-fly — tidak disimpan per-kasus.
  bulanMulaiTahunAjaran: 7,
  nomorSuratCounter: 1,
  updatedAt: new Date().toISOString()
};

export const firebaseSettingsService = {
  /**
   * Mengambil konfigurasi profil sekolah dari dokumen singleton 'settings/global'
   */
  get: async () => {
    const snap = await getDoc(SETTINGS_DOC_REF);
    if (snap.exists()) {
      return { ...defaultSchoolSettings, ...snap.data() };
    }

    // Dokumen belum ada: inisialisasi dengan nilai bawaan. Hanya Administrator yang berhak
    // membuatnya, sehingga penolakan izin untuk Guru BK diabaikan.
    try {
      await setDoc(SETTINGS_DOC_REF, defaultSchoolSettings);
    } catch (err) {
      if (err?.code !== 'permission-denied') throw err;
    }
    return defaultSchoolSettings;
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
        const nowIso = new Date().toISOString();

        // Firestore membatasi 500 operasi per batch: proses bertahap 400 dokumen
        const changed = siswaSnap.docs.filter(docSnap => {
          const s = docSnap.data();
          return hitungStatusSP(s.totalPoin || 0, updatedSettings) !== s.statusSP;
        });

        for (let i = 0; i < changed.length; i += 400) {
          const batch = writeBatch(db);
          changed.slice(i, i + 400).forEach(docSnap => {
            batch.update(docSnap.ref, {
              statusSP: hitungStatusSP(docSnap.data().totalPoin || 0, updatedSettings),
              updatedAt: nowIso
            });
          });
          await batch.commit();
        }
      } catch (err) {
        throw new Error(
          'Ambang batas tersimpan, tetapi pembaruan status SP siswa gagal. Simpan ulang untuk mencoba lagi.'
        );
      }
    }

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'ubah_settings',
      detail: ambangChanged
        ? `Memperbarui profil sekolah & ambang batas SP (${updatedSettings.ambangSp1}/${updatedSettings.ambangSp2}/${updatedSettings.ambangSp3})`
        : 'Memperbarui profil sekolah dan pengaturan sistem',
      targetId: 'global',
      targetType: 'settings'
    });

    return updatedSettings;
  }
};
