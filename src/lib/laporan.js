/**
 * ============================================================================
 * HELPER & UTILITAS LAPORAN KEDISIPLINAN (src/lib/laporan.js)
 * ============================================================================
 * Logika murni untuk pemfilteran periode, perangkuman kategori pelanggaran,
 * pemformatan label status/surat, dan ekspor spreadsheet multi-sheet SheetJS.
 */

import { formatTanggal, formatBadgeStatusSP, formatBadgeStatusSiswa } from './helpers.js';

/**
 * Menyaring kasus berdasarkan rentang tanggal dan membuang kasus terhapus (soft-delete).
 *
 * @param {Array} kasusList - Daftar dokumen kasus
 * @param {string} [tanggalMulai] - Format YYYY-MM-DD (opsional)
 * @param {string} [tanggalSelesai] - Format YYYY-MM-DD (opsional)
 * @returns {Array} Kasus terfilter, diurutkan tanggal menaik (kronologis dari lama ke baru)
 */
export function filterKasusPeriode(kasusList, tanggalMulai, tanggalSelesai) {
  if (!Array.isArray(kasusList)) return [];

  let list = kasusList.filter(k => !k.deletedAt);

  if (tanggalMulai) {
    list = list.filter(k => k.tanggal && k.tanggal >= tanggalMulai);
  }
  if (tanggalSelesai) {
    list = list.filter(k => k.tanggal && k.tanggal <= tanggalSelesai);
  }

  return list.sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));
}

/**
 * Merangkum frekuensi dan akumulasi poin per kategori pelanggaran.
 *
 * @param {Array} kasusList - Daftar kasus yang sudah difilter periode
 * @returns {Array<{ nama: string, jumlah: number, poin: number }>} Diurutkan poin menurun
 */
export function ringkasKategori(kasusList) {
  if (!Array.isArray(kasusList) || kasusList.length === 0) return [];

  const map = new Map();
  kasusList.forEach(k => {
    const nama = k.kategoriNama || 'Lainnya';
    const poin = Number(k.poin) || 0;
    if (map.has(nama)) {
      const entry = map.get(nama);
      entry.jumlah += 1;
      entry.poin += poin;
    } else {
      map.set(nama, { nama, jumlah: 1, poin });
    }
  });

  return Array.from(map.values()).sort((a, b) => b.poin - a.poin);
}

/**
 * Mengubah kode status penanganan kasus menjadi teks yang ramah dibaca.
 *
 * @param {string} status - 'baru' | 'ditangani' | 'selesai'
 * @returns {string}
 */
export function labelStatusKasus(status) {
  switch (status) {
    case 'baru':
      return 'Baru';
    case 'ditangani':
      return 'Sedang Ditangani';
    case 'selesai':
      return 'Selesai';
    default:
      return status ? String(status) : 'Baru';
  }
}

/**
 * Mengubah kode jenis surat peringatan menjadi label dokumen resmi.
 *
 * @param {string} jenis - 'sp1' | 'sp2' | 'sp3' | 'panggilan_orang_tua'
 * @returns {string}
 */
export function labelJenisSurat(jenis) {
  switch (jenis) {
    case 'sp1':
      return 'Surat Peringatan I';
    case 'sp2':
      return 'Surat Peringatan II';
    case 'sp3':
      return 'Surat Peringatan III';
    case 'panggilan_orang_tua':
      return 'Surat Panggilan Orang Tua';
    default:
      return jenis ? String(jenis) : '-';
  }
}

/**
 * Menghitung total poin seluruh kasus dalam daftar.
 *
 * @param {Array} kasusList
 * @returns {number}
 */
export function hitungPoinPeriode(kasusList) {
  if (!Array.isArray(kasusList)) return 0;
  return kasusList.reduce((acc, k) => acc + (Number(k.poin) || 0), 0);
}

/**
 * Ekspor spreadsheet laporan kedisiplinan (.xlsx) dengan SheetJS (dynamic import).
 *
 * @param {Object} params
 * @param {'siswa' | 'kelas'} params.tipe
 * @param {Object} params.data
 * @param {string} params.periodeLabel
 */
export async function eksporLaporanExcel({ tipe, data, periodeLabel }) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const tanggalStempel = `${yyyy}${mm}${dd}`;

  if (tipe === 'siswa') {
    const { siswa, kasus, suratList } = data;

    // Sheet 1: Identitas & Ringkasan
    const ringkasanData = [
      { 'Keterangan': 'Nama Siswa', 'Nilai': siswa?.nama || '-' },
      { 'Keterangan': 'NISN', 'Nilai': siswa?.nisn || '-' },
      { 'Keterangan': 'Kelas', 'Nilai': siswa?.kelas || '-' },
      { 'Keterangan': 'Jurusan / Kompetensi Keahlian', 'Nilai': siswa?.jurusan || 'Umum' },
      { 'Keterangan': 'Angkatan', 'Nilai': siswa?.angkatan || '-' },
      { 'Keterangan': 'Status Siswa', 'Nilai': formatBadgeStatusSiswa(siswa?.statusSiswa).label },
      { 'Keterangan': 'Status SP Terkini', 'Nilai': formatBadgeStatusSP(siswa?.statusSP).label },
      { 'Keterangan': 'Akumulasi Poin Seluruh Waktu', 'Nilai': Number(siswa?.totalPoin || 0) },
      { 'Keterangan': 'Poin Periode Ini', 'Nilai': hitungPoinPeriode(kasus) },
      { 'Keterangan': 'Jumlah Kasus Periode Ini', 'Nilai': (kasus || []).length },
      { 'Keterangan': 'Periode Laporan', 'Nilai': periodeLabel || 'Seluruh Riwayat' }
    ];
    const wsIdentitas = XLSX.utils.json_to_sheet(ringkasanData);
    wsIdentitas['!cols'] = [{ wch: 30 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, wsIdentitas, 'Identitas & Ringkasan');

    // Sheet 2: Kronologi
    const kronologiRows = (kasus || []).map((k, idx) => ({
      'No': idx + 1,
      'Tanggal': formatTanggal(k.tanggal),
      'Bentuk Pelanggaran': k.kategoriNama || '-',
      'Poin': Number(k.poin) || 0,
      'Deskripsi / Catatan': k.deskripsi || '-',
      'Status Penanganan': labelStatusKasus(k.status),
      'Petugas Pencatat': k.createdByNama || '-'
    }));
    const wsKronologi = XLSX.utils.json_to_sheet(
      kronologiRows.length > 0
        ? kronologiRows
        : [{ 'Keterangan': 'Tidak ada catatan pelanggaran pada periode ini' }]
    );
    if (kronologiRows.length > 0) {
      wsKronologi['!cols'] = [
        { wch: 5 }, { wch: 12 }, { wch: 28 }, { wch: 8 },
        { wch: 35 }, { wch: 20 }, { wch: 20 }
      ];
    }
    XLSX.utils.book_append_sheet(wb, wsKronologi, 'Kronologi');

    // Sheet 3: Riwayat Surat
    const suratRows = (suratList || []).map((s, idx) => ({
      'No': idx + 1,
      'Nomor Surat': s.nomorSurat || '-',
      'Jenis Surat': labelJenisSurat(s.jenis),
      'Perihal': s.perihal || '-',
      'Tanggal Surat': formatTanggal(s.tanggalSurat || (s.createdAt ? s.createdAt.slice(0, 10) : '')),
      'Poin Saat Terbit': Number(s.totalPoin) || 0
    }));
    const wsSurat = XLSX.utils.json_to_sheet(
      suratRows.length > 0
        ? suratRows
        : [{ 'Keterangan': 'Belum pernah diterbitkan surat peringatan' }]
    );
    if (suratRows.length > 0) {
      wsSurat['!cols'] = [
        { wch: 5 }, { wch: 24 }, { wch: 24 }, { wch: 32 }, { wch: 14 }, { wch: 16 }
      ];
    }
    XLSX.utils.book_append_sheet(wb, wsSurat, 'Riwayat Surat');

    const namaBersih = (siswa?.nama || 'Siswa').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const filename = `Laporan_Kedisiplinan_${namaBersih}_${tanggalStempel}.xlsx`;
    XLSX.writeFile(wb, filename);
  } else if (tipe === 'kelas') {
    const { kelas, daftar } = data;

    // Sheet 1: Ringkasan Kelas
    const ringkasanKelasRows = (daftar || []).map((item, idx) => ({
      'No': idx + 1,
      'Nama': item.siswa?.nama || '-',
      'NISN': item.siswa?.nisn || '-',
      'Status SP': formatBadgeStatusSP(item.siswa?.statusSP).label,
      'Total Poin (Akumulasi)': Number(item.siswa?.totalPoin || 0),
      'Poin Periode': hitungPoinPeriode(item.kasus),
      'Jumlah Kasus': (item.kasus || []).length
    }));
    const wsRingkasan = XLSX.utils.json_to_sheet(ringkasanKelasRows);
    wsRingkasan['!cols'] = [
      { wch: 5 }, { wch: 28 }, { wch: 14 }, { wch: 22 },
      { wch: 22 }, { wch: 14 }, { wch: 14 }
    ];
    XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan Kelas');

    // Sheet 2: Kronologi (semua kasus kelas itu pada periode ini)
    const semuaKasus = [];
    (daftar || []).forEach(item => {
      (item.kasus || []).forEach(k => {
        semuaKasus.push({
          ...k,
          siswaNama: k.siswaNama || item.siswa?.nama || '-',
          siswaNisn: k.siswaNisn || item.siswa?.nisn || '-'
        });
      });
    });
    semuaKasus.sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));

    const kronologiKelasRows = semuaKasus.map((k, idx) => ({
      'No': idx + 1,
      'Tanggal': formatTanggal(k.tanggal),
      'NISN': k.siswaNisn || '-',
      'Nama Siswa': k.siswaNama || '-',
      'Bentuk Pelanggaran': k.kategoriNama || '-',
      'Poin': Number(k.poin) || 0,
      'Deskripsi / Catatan': k.deskripsi || '-',
      'Status Penanganan': labelStatusKasus(k.status),
      'Petugas Pencatat': k.createdByNama || '-'
    }));
    const wsKronologiKelas = XLSX.utils.json_to_sheet(
      kronologiKelasRows.length > 0
        ? kronologiKelasRows
        : [{ 'Keterangan': 'Tidak ada catatan pelanggaran pada periode ini untuk kelas ini' }]
    );
    if (kronologiKelasRows.length > 0) {
      wsKronologiKelas['!cols'] = [
        { wch: 5 }, { wch: 12 }, { wch: 14 }, { wch: 25 },
        { wch: 28 }, { wch: 8 }, { wch: 35 }, { wch: 20 }, { wch: 20 }
      ];
    }
    XLSX.utils.book_append_sheet(wb, wsKronologiKelas, 'Kronologi');

    const kelasBersih = String(kelas || 'Kelas').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const filename = `Laporan_Kedisiplinan_${kelasBersih}_${tanggalStempel}.xlsx`;
    XLSX.writeFile(wb, filename);
  }
}
