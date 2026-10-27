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
 * TAMPILAN: Menghasilkan label teks dan kelas warna Tailwind untuk badge status keaktifan siswa.
 *
 * @param {'aktif' | 'lulus' | 'pindah' | 'keluar'} statusSiswa
 * @returns {{ label: string, color: string }}
 */
export function formatBadgeStatusSiswa(statusSiswa) {
  switch (statusSiswa) {
    case 'lulus':
      return { label: 'Lulus', color: 'bg-blue-100 text-blue-700 border-blue-200' };
    case 'pindah':
      return { label: 'Pindah Sekolah', color: 'bg-amber-100 text-amber-700 border-amber-200' };
    case 'keluar':
      return { label: 'Keluar / DO', color: 'bg-gray-200 text-gray-700 border-gray-300' };
    default:
      return { label: 'Aktif', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }
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

/**
 * UTILITAS: Menghitung rentang tanggal (YYYY-MM-DD) berdasarkan preset periode
 * dan bulan mulai tahun ajaran dinamis (default Juli / 7).
 *
 * @param {'bulan_ini' | 'semester_ganjil' | 'semester_genap' | 'tahun_ajaran_ini'} tipe
 * @param {number} [bulanMulai=7] - Bulan mulai tahun ajaran (1-12, default 7)
 * @param {Date} [refDate=new Date()] - Tanggal acuan
 * @returns {{ tanggalMulai: string, tanggalSelesai: string, label: string }}
 */
export function getRentangPeriodePreset(tipe, bulanMulai = 7, refDate = new Date()) {
  const formatYmd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const currYear = refDate.getFullYear();
  const currMonth = refDate.getMonth() + 1; // 1-12
  const bm = Math.max(1, Math.min(12, Number(bulanMulai) || 7));

  // Tentukan tahun kalender dimulainya tahun ajaran aktif saat ini
  const tahunMulai = currMonth >= bm ? currYear : currYear - 1;
  const tahunSelesai = tahunMulai + 1;
  const labelTahunAjaran = `${tahunMulai}/${tahunSelesai}`;

  if (tipe === 'bulan_ini') {
    const dStart = new Date(currYear, currMonth - 1, 1);
    const dEnd = new Date(currYear, currMonth, 0);
    return {
      tanggalMulai: formatYmd(dStart),
      tanggalSelesai: formatYmd(dEnd),
      label: `Bulan Ini (${dStart.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})`
    };
  }

  // Semester Ganjil (6 bulan pertama sejak bulanMulai)
  const dGanjilStart = new Date(tahunMulai, bm - 1, 1);
  const dGanjilEnd = new Date(tahunMulai, bm + 5, 0);

  if (tipe === 'semester_ganjil') {
    return {
      tanggalMulai: formatYmd(dGanjilStart),
      tanggalSelesai: formatYmd(dGanjilEnd),
      label: `Semester Ganjil TA ${labelTahunAjaran}`
    };
  }

  // Semester Genap (6 bulan berikutnya)
  const dGenapStart = new Date(tahunMulai, bm + 5, 1);
  const dGenapEnd = new Date(tahunMulai, bm + 11, 0);

  if (tipe === 'semester_genap') {
    return {
      tanggalMulai: formatYmd(dGenapStart),
      tanggalSelesai: formatYmd(dGenapEnd),
      label: `Semester Genap TA ${labelTahunAjaran}`
    };
  }

  // Default: 'tahun_ajaran_ini'
  return {
    tanggalMulai: formatYmd(dGanjilStart),
    tanggalSelesai: formatYmd(dGenapEnd),
    label: `Tahun Ajaran ${labelTahunAjaran}`
  };
}

/** Daftar kelas bawaan sekolah (dipakai sebagai opsi awal dropdown kelas). */
export const DEFAULT_KELAS = [
  'X TKJ 1', 'X TKJ 2', 'X TKR 1', 'X TKR 2',
  'XI TKJ 1', 'XI TKJ 2', 'XI TKR 1', 'XI TKR 2',
  'XII TKJ 1', 'XII TKJ 2', 'XII TKR 1', 'XII TKR 2'
];

/**
 * Mengambil kode jurusan dari nama kelas.
 * 'XI TKJ 1' -> 'TKJ', 'XII MM 2' -> 'MM'. Tidak cocok pola -> null.
 */
export const ambilKodeKelas = (kelas) => {
  const m = String(kelas || "")
    .trim()
    .match(/^(?:XII|XI|X)\s+(.+?)(?:\s+\d+)?$/i);
  return m ? m[1].trim().toUpperCase() : null;
};

/**
 * Membangun peta { KODE: 'Nama Jurusan' } dari daftar siswa.
 * Jurusan kosong atau 'Umum' diabaikan. Bila satu kode punya beberapa
 * jurusan, dipilih yang paling banyak (seri: urut abjad).
 */
export const bangunPetaJurusan = (daftarSiswa) => {
  const hitung = {};
  for (const s of daftarSiswa || []) {
    const kode = ambilKodeKelas(s.kelas);
    const jur = String(s.jurusan || "")
      .trim()
      .replace(/\s+/g, " ");
    if (!kode || !jur || jur.toLowerCase() === "umum") continue;
    (hitung[kode] ||= {})[jur] = (hitung[kode][jur] || 0) + 1;
  }
  const peta = {};
  for (const [kode, jurs] of Object.entries(hitung)) {
    peta[kode] = Object.entries(jurs).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id"),
    )[0][0];
  }
  return peta;
};

/**
 * Menyarankan kelas tujuan saat naik kelas.
 * 'X TKJ 1' -> 'XI TKJ 1', 'XI TKJ 1' -> 'XII TKJ 1', 'XII ...' -> null (lulus).
 * Kelas yang tidak cocok pola dikembalikan sebagai undefined (pengguna memilih sendiri).
 *
 * @param {string} kelas - Nama kelas asal
 * @returns {string|null|undefined}
 */
export const sarankanKelasBaru = (kelas) => {
  const m = String(kelas || '').trim().match(/^(XII|XI|X)(\s+.*)?$/i);
  if (!m) return undefined;
  const tingkat = m[1].toUpperCase();
  const sisa = m[2] || '';
  if (tingkat === 'X') return 'XI' + sisa;
  if (tingkat === 'XI') return 'XII' + sisa;
  return null; // XII -> lulus
};
