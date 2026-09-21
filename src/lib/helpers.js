/**
 * ============================================================================
 * MODUL HELPER & FUNGSI UTILITAS BISNIS (src/lib/helpers.js)
 * ============================================================================
 * Berisi logika bisnis inti, aturan perhitungan ambang batas sanksi SP,
 * format penomoran surat kedinasan, dan pemformatan tanggal standar Indonesia.
 */

/**
 * LOGIKA: Menghitung status Surat Peringatan (SP) siswa berdasarkan total poin aktif.
 * 
 * Aturan Bisnis:
 * - Total Poin >= SP3 (Default: 110 pt) -> Status 'sp3' (Rekomendasi DO / Dikembalikan ke Orang Tua)
 * - Total Poin >= SP2 (Default: 80 pt)  -> Status 'sp2' (Peringatan II)
 * - Total Poin >= SP1 (Default: 50 pt)  -> Status 'sp1' (Peringatan I)
 * - Total Poin < SP1                   -> Status 'normal' (Kondisi Disiplin Aman)
 *
 * @param {number} totalPoin - Akumulasi poin pelanggaran aktif siswa saat ini
 * @param {object} settings - Konfigurasi ambang batas dari pengaturan sistem (ambangSp1, ambangSp2, ambangSp3)
 * @returns {'normal' | 'sp1' | 'sp2' | 'sp3'} Status SP hasil kalkulasi
 */
export function hitungStatusSP(totalPoin, settings = {}) {
  const sp1 = settings.ambangSp1 ?? 50;
  const sp2 = settings.ambangSp2 ?? 80;
  const sp3 = settings.ambangSp3 ?? 110;

  if (totalPoin >= sp3) return 'sp3';
  if (totalPoin >= sp2) return 'sp2';
  if (totalPoin >= sp1) return 'sp1';
  return 'normal';
}

/**
 * TAMPILAN: Menghasilkan label teks dan kelas warna Tailwind untuk badge status SP.
 * 
 * @param {'normal' | 'sp1' | 'sp2' | 'sp3'} statusSP - Kode status SP siswa
 * @returns {{ label: string, color: string }} Objek label dan class styling CSS
 */
export function formatBadgeStatusSP(statusSP) {
  switch (statusSP) {
    case 'sp3':
      return { 
        label: 'SP 3 (Terancam DO)', 
        color: 'bg-red-100 text-red-700 border-red-200' 
      };
    case 'sp2':
      return { 
        label: 'SP 2 (Peringatan II)', 
        color: 'bg-orange-100 text-orange-700 border-orange-200' 
      };
    case 'sp1':
      return { 
        label: 'SP 1 (Peringatan I)', 
        color: 'bg-amber-100 text-amber-700 border-amber-200' 
      };
    default:
      return { 
        label: 'Normal', 
        color: 'bg-emerald-100 text-emerald-700 border-emerald-200' 
      };
  }
}

/**
 * TAMPILAN: Menghasilkan label teks dan warna status penanganan pembinaan kasus.
 * 
 * @param {'baru' | 'ditangani' | 'selesai'} status - Status alur tindak lanjut kasus
 * @returns {{ label: string, color: string }} Objek label dan class styling CSS
 */
export function formatBadgeKasus(status) {
  switch (status) {
    case 'selesai':
      return { 
        label: 'Selesai / Dibina', 
        color: 'bg-emerald-100 text-emerald-700 border-emerald-200' 
      };
    case 'ditangani':
      return { 
        label: 'Sedang Ditangani', 
        color: 'bg-blue-100 text-blue-700 border-blue-200' 
      };
    default:
      return { 
        label: 'Baru (Belum Ditangani)', 
        color: 'bg-rose-100 text-rose-700 border-rose-200' 
      };
  }
}

/**
 * UTILITAS: Mengubah string tanggal ISO (YYYY-MM-DD) menjadi format tanggal resmi Indonesia.
 * Contoh: "2026-09-19" -> "19 Sep 2026"
 * 
 * @param {string} dateStr - Tanggal dalam bentuk string atau ISO date
 * @returns {string} Tanggal terformat bahasa Indonesia
 */
export function formatTanggal(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(d);
}

/**
 * UTILITAS: Mengubah timestamp waktu menjadi format lengkap tanggal dan jam WIB.
 * Contoh: "2026-09-19T10:30:00.000Z" -> "19 Sep 2026, 17.30"
 * 
 * @param {string} timestamp - Timestamp ISO string
 * @returns {string} Waktu terformat lengkap
 */
export function formatWaktu(timestamp) {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

/**
 * Pustaka angka romawi untuk penulisan bulan pada nomor surat kedinasan.
 */
const ROMAWI_BULAN = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 
  'VII', 'VIII', 'IX', 'X', 'XI', 'XII'
];

/**
 * Mengubah angka bulan (1-12) menjadi angka romawi.
 */
export function formatRomawi(bulanNumber) {
  const idx = Math.max(1, Math.min(12, Number(bulanNumber) || 1)) - 1;
  return ROMAWI_BULAN[idx] || 'I';
}
