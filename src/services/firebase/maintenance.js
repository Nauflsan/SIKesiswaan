/**
 * ============================================================================
 * FIREBASE MAINTENANCE SERVICE (src/services/firebase/maintenance.js)
 * ============================================================================
 * Mengelola pemeliharaan data berkala dan pembersihan permanen data siswa
 * tidak aktif (lulus, pindah, keluar) yang telah melampaui masa simpan.
 */

import { db } from '../../lib/firebase.js';
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  documentId,
  writeBatch
} from 'firebase/firestore';
import { firebaseSiswaService } from './siswa.js';
import { firebaseKasusService } from './kasus.js';
import { firebaseSuratService } from './surat.js';
import { firebaseLogService } from './log.js';
import { siswaCache } from './siswaCache.js';

/**
 * Menambahkan bulan kalender dengan pembatasan hari maksimum di bulan tujuan
 * (clamping: misal 31 Jan + 1 bulan = 28/29 Feb, bukan meluber ke Maret).
 *
 * @param {Date|string|number} dateInput
 * @param {number} bulan
 * @returns {Date}
 */
export function tambahBulanKalender(dateInput, bulan) {
  const d = new Date(dateInput);
  const targetYear = d.getFullYear();
  const targetMonth = d.getMonth() + Number(bulan);
  const targetDay = d.getDate();

  const result = new Date(d);
  result.setFullYear(targetYear);
  result.setMonth(targetMonth, 1);

  // Cari tanggal terakhir bulan tujuan
  const daysInTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  const clampedDay = Math.min(targetDay, daysInTargetMonth);
  result.setDate(clampedDay);

  return result;
}

export const firebaseMaintenanceService = {
  /**
   * Mengambil kandidat siswa tidak aktif (lulus, pindah, keluar) dan mengelompokkannya
   * menjadi layak dan belum layak dibersihkan berdasarkan masa simpan.
   *
   * @param {number} masaSimpanBulan - Masa simpan dalam bulan (1, 3, 6, 12)
   * @returns {Promise<{ layak: Array, belum: Array }>}
   */
  getKandidat: async (masaSimpanBulan = 3) => {
    const masa = Number(masaSimpanBulan || 3);
    const daftarSiswa = await firebaseSiswaService.getByStatus(['lulus', 'pindah', 'keluar']);

    const now = new Date();
    const layak = [];
    const belum = [];

    daftarSiswa.forEach(s => {
      const isPerkiraan = !s.tanggalNonaktif;
      const batasIso = s.tanggalNonaktif || s.updatedAt || s.createdAt || now.toISOString();
      const batas = new Date(batasIso);
      const layakSejak = tambahBulanKalender(batas, masa);
      const isLayak = layakSejak.getTime() <= now.getTime();

      let sisaHari = 0;
      if (!isLayak) {
        const diffMs = layakSejak.getTime() - now.getTime();
        sisaHari = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      const item = {
        ...s,
        tanggalNonaktifEfektif: batasIso,
        isPerkiraan,
        layakSejak: layakSejak.toISOString(),
        sisaHari
      };

      if (isLayak) {
        layak.push(item);
      } else {
        belum.push(item);
      }
    });

    // Urutan: kelas, lalu nama
    const sorter = (a, b) => {
      const k = (a.kelas || '').localeCompare(b.kelas || '', 'id');
      if (k !== 0) return k;
      return (a.nama || '').localeCompare(b.nama || '', 'id');
    };

    layak.sort(sorter);
    belum.sort(sorter);

    return { layak, belum };
  },

  /**
   * Menghitung dampak penghapusan dan mengembalikan dokumen mentah kasus dan surat
   * untuk keperluan arsip Excel dan penghapusan massal tanpa pembacaan ulang.
   *
   * @param {Array} siswaList - Daftar objek siswa terpilih
   * @returns {Promise<{ siswa: number, kasus: number, kasusSoftDeleted: number, surat: number, kasusDocs: Array, suratDocs: Array }>}
   */
  hitungDampak: async (siswaList) => {
    if (!Array.isArray(siswaList) || siswaList.length === 0) {
      return {
        siswa: 0,
        kasus: 0,
        kasusSoftDeleted: 0,
        surat: 0,
        kasusDocs: [],
        suratDocs: []
      };
    }

    const ids = siswaList.map(s => s.id).filter(Boolean);
    if (ids.length === 0) {
      return {
        siswa: 0,
        kasus: 0,
        kasusSoftDeleted: 0,
        surat: 0,
        kasusDocs: [],
        suratDocs: []
      };
    }

    const [kasusDocs, suratDocs] = await Promise.all([
      firebaseKasusService.getBySiswaIds(ids, { includeDeleted: true }),
      firebaseSuratService.getBySiswaIds(ids)
    ]);

    const totalDokumen = kasusDocs.length + suratDocs.length + siswaList.length;
    if (totalDokumen > 15000) {
      throw new Error(
        'Terlalu banyak dokumen untuk sekali proses (batas harian hapus 20.000). Pilih lebih sedikit siswa.'
      );
    }

    const kasusSoftDeleted = kasusDocs.filter(k => Boolean(k.deletedAt)).length;

    return {
      siswa: siswaList.length,
      kasus: kasusDocs.length,
      kasusSoftDeleted,
      surat: suratDocs.length,
      kasusDocs,
      suratDocs
    };
  },

  /**
   * Menghapus permanen siswa terpilih beserta seluruh kasus dan surat peringatan miliknya.
   *
   * Sebelum menghapus apa pun, melakukan verifikasi ulang membaca dokumen siswa di server
   * untuk memastikan tidak ada siswa aktif atau data yang berubah sejak pencarian.
   *
   * Urutan penghapusan: (1) seluruh kasus -> (2) seluruh surat -> (3) seluruh siswa.
   *
   * @param {Object} paket - { siswaIds: string[], kasusIds: string[], suratIds: string[], masaSimpanBulan?: number }
   * @param {Object} currentUser - Pengguna yang sedang login (harus role 'admin')
   * @param {Function} [onProgress] - Callback progres: ({ tahap, selesai, total }) => void
   * @param {number} [masaSimpanBulanOpt] - Masa simpan dalam bulan
   * @returns {Promise<{ siswa: number, kasus: number, surat: number }>}
   */
  hapusPermanenLulusan: async (paket, currentUser, onProgress, masaSimpanBulanOpt) => {
    if (currentUser?.role !== 'admin') {
      throw new Error('Hanya Administrator yang memiliki izin menghapus siswa secara permanen');
    }

    const siswaIds = Array.isArray(paket?.siswaIds) ? paket.siswaIds : [];
    const kasusIds = Array.isArray(paket?.kasusIds) ? paket.kasusIds : [];
    const suratIds = Array.isArray(paket?.suratIds) ? paket.suratIds : [];
    const masaSimpanBulan = Number(paket?.masaSimpanBulan ?? masaSimpanBulanOpt ?? 3);

    if (siswaIds.length === 0) {
      throw new Error('Daftar siswa untuk dibersihkan tidak boleh kosong');
    }

    // 1. Verifikasi Ulang Sebelum Hapus (Section 10.1)
    // Baca ulang dokumen siswa terpilih via chunk 30 in-query
    const chunks = [];
    for (let i = 0; i < siswaIds.length; i += 30) {
      chunks.push(siswaIds.slice(i, i + 30));
    }

    const colRef = collection(db, 'siswa');
    const snaps = await Promise.all(
      chunks.map(chunk =>
        getDocs(query(colRef, where(documentId(), 'in', chunk)))
      )
    );

    const fetchedMap = new Map();
    snaps.forEach(snap => {
      snap.docs.forEach(d => {
        fetchedMap.set(d.id, d.data());
      });
    });

    const now = new Date();
    for (const id of siswaIds) {
      const data = fetchedMap.get(id);
      if (!data) {
        throw new Error('Data berubah sejak pencarian. Muat ulang kandidat lalu coba lagi.');
      }
      const status = data.statusSiswa;
      if (!['lulus', 'pindah', 'keluar'].includes(status)) {
        throw new Error('Data berubah sejak pencarian. Muat ulang kandidat lalu coba lagi.');
      }
      // Hitung ulang masa simpan
      const batasIso = data.tanggalNonaktif || data.updatedAt || data.createdAt || now.toISOString();
      const layakSejak = tambahBulanKalender(new Date(batasIso), masaSimpanBulan);
      // Pola !(<=) sengaja: tanggal rusak (NaN) harus ditolak, bukan lolos
      if (!(layakSejak.getTime() <= now.getTime())) {
        throw new Error('Data berubah sejak pencarian. Muat ulang kandidat lalu coba lagi.');
      }
    }

    // 2. Penghapusan Bertahap (writeBatch per 400 dokumen)
    let kasusTerhapus = 0;
    let suratTerhapus = 0;
    let siswaTerhapus = 0;
    let currentTahap = 'kasus';

    try {
      // Tahap 1: Hapus Kasus
      currentTahap = 'kasus';
      const totalKasus = kasusIds.length;
      if (totalKasus > 0) {
        for (let i = 0; i < totalKasus; i += 400) {
          const chunk = kasusIds.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach(id => {
            batch.delete(doc(db, 'kasus', id));
          });
          await batch.commit();
          kasusTerhapus += chunk.length;
          if (onProgress) {
            onProgress({ tahap: 'kasus', selesai: kasusTerhapus, total: totalKasus });
          }
        }
      } else if (onProgress) {
        onProgress({ tahap: 'kasus', selesai: 0, total: 0 });
      }

      // Tahap 2: Hapus Surat
      currentTahap = 'surat';
      const totalSurat = suratIds.length;
      if (totalSurat > 0) {
        for (let i = 0; i < totalSurat; i += 400) {
          const chunk = suratIds.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach(id => {
            batch.delete(doc(db, 'surat', id));
          });
          await batch.commit();
          suratTerhapus += chunk.length;
          if (onProgress) {
            onProgress({ tahap: 'surat', selesai: suratTerhapus, total: totalSurat });
          }
        }
      } else if (onProgress) {
        onProgress({ tahap: 'surat', selesai: 0, total: 0 });
      }

      // Tahap 3: Hapus Siswa
      currentTahap = 'siswa';
      const totalSiswa = siswaIds.length;
      if (totalSiswa > 0) {
        for (let i = 0; i < totalSiswa; i += 400) {
          const chunk = siswaIds.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach(id => {
            batch.delete(doc(db, 'siswa', id));
          });
          await batch.commit();
          siswaTerhapus += chunk.length;
          if (onProgress) {
            onProgress({ tahap: 'siswa', selesai: siswaTerhapus, total: totalSiswa });
          }
        }
      } else if (onProgress) {
        onProgress({ tahap: 'siswa', selesai: 0, total: 0 });
      }
    } catch (err) {
      // Bersihkan cache siswa aktif saat terjadi kegagalan parsial
      siswaCache.clear();

      // Catat log GAGAL SEBAGIAN (Section 10.2)
      try {
        await firebaseLogService.create({
          userId: currentUser?.id,
          userNama: currentUser?.nama,
          aksi: 'bersihkan_lulusan',
          detail: `GAGAL SEBAGIAN pada tahap ${currentTahap}: ${kasusTerhapus} kasus, ${suratTerhapus} surat, ${siswaTerhapus} siswa sudah terhapus`,
          targetId: 'pemeliharaan',
          targetType: 'siswa'
        });
      } catch {
        // Jangan menutupi error asli
      }

      throw new Error(
        `Penghapusan gagal pada tahap ${currentTahap} (${kasusTerhapus} kasus, ${suratTerhapus} surat, ${siswaTerhapus} siswa sudah terhapus): ${err?.message || 'Terjadi kesalahan sistem'}`
      );
    }

    // 3. Setelah Sukses Selesai
    siswaCache.clear();

    const nisnList = siswaIds.map(id => fetchedMap.get(id)?.nisn).filter(Boolean);
    let nisnStr = '';
    if (nisnList.length <= 50) {
      nisnStr = nisnList.join(', ');
    } else {
      nisnStr = `${nisnList.slice(0, 50).join(', ')} (dan ${nisnList.length - 50} lainnya)`;
    }

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'bersihkan_lulusan',
      detail: `Membersihkan ${siswaTerhapus} siswa, ${kasusTerhapus} kasus, ${suratTerhapus} surat (masa simpan: ${masaSimpanBulan} bulan). NISN: ${nisnStr}`,
      targetId: 'pemeliharaan',
      targetType: 'siswa'
    });

    return {
      siswa: siswaTerhapus,
      kasus: kasusTerhapus,
      surat: suratTerhapus
    };
  }
};
