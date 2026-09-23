import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =========================================================================
// DATA SHEET 1: PETUNJUK PENGUJIAN MANDIRI
// =========================================================================
const petunjuk = [
  { 'Panduan Pengujian': 'Tujuan Lembar Uji', 'Penjelasan': 'Menjadi instrumen uji mandiri bagi penguji/developer untuk memverifikasi fungsionalitas aplikasi SIKesiswaan yang sudah tayang di Firebase Production.' },
  { 'Panduan Pengujian': 'URL Aplikasi Live', 'Penjelasan': 'https://sik-kharisma.web.app (dan mirror: https://sik-kharisma.firebaseapp.com)' },
  { 'Panduan Pengujian': 'Cara Mengisi Lembar', 'Penjelasan': 'Jalankan langkah uji pada browser Anda. Kolom "Hasil Pengujian" dan "Status" telah dikosongkan. Isi "Valid" pada kolom Status jika sistem berjalan sesuai ekspektasi, atau tulis "Bug" / catatan jika menemukan kendala.' },
  { 'Panduan Pengujian': 'Penggunaan Laporan', 'Penjelasan': 'Setelah pengujian selesai dicentang/diisi, tabel pada Sheet "Lembar Uji Checklist" dapat langsung diblok dan disalin (Copy-Paste) ke dokumen Microsoft Word laporan PKM / Skripsi Anda.' },
  { 'Panduan Pengujian': 'Akun untuk Pengujian', 'Penjelasan': 'Gunakan akun Administrator dan Guru BK yang telah Anda buat pada Firebase Authentication Console.' }
];

// =========================================================================
// DATA SHEET 2: CHECKLIST PENGUJIAN LENGKAP (KOLOM HASIL & STATUS KOSONG)
// =========================================================================
const checklist = [
  // --- 1. AUTENTIKASI & MANAJEMEN SESI ---
  {
    'No': 1,
    'ID Test': 'TC-AUTH-01',
    'Modul / Fitur': 'Autentikasi',
    'Skenario & Langkah Uji': 'Buka /login -> Masukkan email Admin dan password yang benar -> Klik "Masuk Sistem"',
    'Hasil yang Diharapkan': 'Login berhasil, muncul toast selamat datang, dialihkan ke /dashboard dengan menu lengkap Admin',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 2,
    'ID Test': 'TC-AUTH-02',
    'Modul / Fitur': 'Autentikasi',
    'Skenario & Langkah Uji': 'Buka /login -> Masukkan email Guru BK dan password yang benar -> Klik "Masuk Sistem"',
    'Hasil yang Diharapkan': 'Login berhasil, dialihkan ke /dashboard dengan role Guru BK (menu admin disembunyikan)',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 3,
    'ID Test': 'TC-AUTH-03',
    'Modul / Fitur': 'Autentikasi',
    'Skenario & Langkah Uji': 'Buka /login -> Masukkan email yang terdaftar namun password sembarang/salah -> Klik "Masuk Sistem"',
    'Hasil yang Diharapkan': 'Login ditolak, tombol kembali aktif, muncul notifikasi: "Email atau kata sandi yang dimasukkan salah"',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 4,
    'ID Test': 'TC-AUTH-04',
    'Modul / Fitur': 'Autentikasi',
    'Skenario & Langkah Uji': 'Buka /login -> Masukkan teks tanpa format email (misal: "admin_test") -> Klik "Masuk Sistem"',
    'Hasil yang Diharapkan': 'Formulir diblokir oleh browser sebelum terkirim, meminta simbol "@" pada input email',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 5,
    'ID Test': 'TC-AUTH-05',
    'Modul / Fitur': 'Autentikasi',
    'Skenario & Langkah Uji': 'Di form login, ketik password lalu klik ikon "Mata" (Show/Hide Password)',
    'Hasil yang Diharapkan': 'Karakter password berubah antara bintang/titik (password) dan teks terbaca (plain text)',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 6,
    'ID Test': 'TC-AUTH-06',
    'Modul / Fitur': 'Autentikasi',
    'Skenario & Langkah Uji': 'Dalam posisi login di Dashboard -> Tekan F5 (Refresh halaman)',
    'Hasil yang Diharapkan': 'Sesi pengguna tetap aktif (persist), pengguna tidak terlempar kembali ke login',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 7,
    'ID Test': 'TC-AUTH-07',
    'Modul / Fitur': 'Autentikasi',
    'Skenario & Langkah Uji': 'Klik dropdown profil di pojok kanan atas -> Klik tombol "Keluar / Logout"',
    'Hasil yang Diharapkan': 'Sesi dibersihkan, pengguna dialihkan ke halaman /login, tombol back browser tidak bisa masuk lagi',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },

  // --- 2. HAK AKSES & PROTEKSI RUTE (RBAC) ---
  {
    'No': 8,
    'ID Test': 'TC-RBAC-01',
    'Modul / Fitur': 'Hak Akses (RBAC)',
    'Skenario & Langkah Uji': 'Saat belum login -> Buka URL langsung melalui address bar: https://sik-kharisma.web.app/dashboard',
    'Hasil yang Diharapkan': 'Akses otomatis diblokir oleh ProtectedRoute dan diarahkan ke /login',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 9,
    'ID Test': 'TC-RBAC-02',
    'Modul / Fitur': 'Hak Akses (RBAC)',
    'Skenario & Langkah Uji': 'Login sebagai Guru BK -> Buka URL https://sik-kharisma.web.app/settings',
    'Hasil yang Diharapkan': 'Akses ditolak atau tombol simpan identitas dinonaktifkan dengan peringatan khusus Admin',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 10,
    'ID Test': 'TC-RBAC-03',
    'Modul / Fitur': 'Hak Akses (RBAC)',
    'Skenario & Langkah Uji': 'Login sebagai Guru BK -> Periksa halaman /siswa dan /kasus',
    'Hasil yang Diharapkan': 'Guru BK dapat melihat data, mencatat kasus, namun tombol "Hapus Data" tidak tersedia/disembunyikan',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },

  // --- 3. DASHBOARD & STATISTIK ---
  {
    'No': 11,
    'ID Test': 'TC-DASH-01',
    'Modul / Fitur': 'Dashboard',
    'Skenario & Langkah Uji': 'Buka halaman /dashboard -> Periksa kartu metrik utama (Total Siswa, Kasus Bulan Ini, Siswa SP)',
    'Hasil yang Diharapkan': 'Kartu statistik memuat angka riil dari Firestore secara akurat',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 12,
    'ID Test': 'TC-DASH-02',
    'Modul / Fitur': 'Dashboard',
    'Skenario & Langkah Uji': 'Periksa grafik batang (Kategori Pelanggaran Terbanyak) dan grafik donat status SP',
    'Hasil yang Diharapkan': 'Grafik ter-render dengan rapi, label terbaca jelas, dan tooltip muncul saat kursor diarahkan ke grafik',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 13,
    'ID Test': 'TC-DASH-03',
    'Modul / Fitur': 'Dashboard',
    'Skenario & Langkah Uji': 'Periksa bagian "Kasus Terbaru" di bagian bawah Dashboard',
    'Hasil yang Diharapkan': 'Menampilkan daftar pelanggaran terkini yang diurutkan dari yang paling baru dicatat',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 14,
    'ID Test': 'TC-DASH-04',
    'Modul / Fitur': 'Dashboard',
    'Skenario & Langkah Uji': 'Klik tombol pintasan "+ Catat Kasus" di Dashboard',
    'Hasil yang Diharapkan': 'Halaman berpindah langsung ke formulir pencatatan kasus baru (/kasus/baru)',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },

  // --- 4. MASTER DATA SISWA ---
  {
    'No': 15,
    'ID Test': 'TC-SISWA-01',
    'Modul / Fitur': 'Data Siswa',
    'Skenario & Langkah Uji': 'Buka menu Siswa -> Klik "+ Tambah Siswa" -> Isi NISN: "0081234999", Nama: "Tes Siswa Baru", Kelas: "X TKJ 1", Jurusan: "Teknik Komputer dan Jaringan" -> Klik Simpan',
    'Hasil yang Diharapkan': 'Data tersimpan ke Firestore, notifikasi sukses muncul, siswa muncul di tabel dengan total poin 0 dan status "Aman"',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 16,
    'ID Test': 'TC-SISWA-02',
    'Modul / Fitur': 'Data Siswa',
    'Skenario & Langkah Uji': 'Tambah siswa baru dengan NISN yang sudah terdaftar (misal: "0081234999") -> Klik Simpan',
    'Hasil yang Diharapkan': 'Sistem menolak penyimpanan dengan pesan peringatan: "NISN ... sudah terdaftar pada siswa ..."',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 17,
    'ID Test': 'TC-SISWA-03',
    'Modul / Fitur': 'Data Siswa',
    'Skenario & Langkah Uji': 'Tambah siswa dengan NISN kurang dari 6 digit (misal: "123") atau mengandung huruf -> Klik Simpan',
    'Hasil yang Diharapkan': 'Penyimpanan dicegah dengan pesan validasi regex: "NISN harus berupa angka (6-20 digit)"',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 18,
    'ID Test': 'TC-SISWA-04',
    'Modul / Fitur': 'Data Siswa',
    'Skenario & Langkah Uji': 'Di halaman daftar siswa, ketik nama atau sebagian NISN pada kotak pencarian (search bar)',
    'Hasil yang Diharapkan': 'Tabel secara instan memfilter baris siswa tanpa perlu memuat ulang (refresh) halaman',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 19,
    'ID Test': 'TC-SISWA-05',
    'Modul / Fitur': 'Data Siswa',
    'Skenario & Langkah Uji': 'Pilih opsi filter dropdown Kelas (misal: "X TKJ 1") dan/atau Jurusan',
    'Hasil yang Diharapkan': 'Tabel hanya menyajikan siswa yang berada di kelas atau jurusan yang dipilih',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 20,
    'ID Test': 'TC-SISWA-06',
    'Modul / Fitur': 'Data Siswa',
    'Skenario & Langkah Uji': 'Klik ikon Edit (Pensil) pada salah satu baris siswa -> Ubah nama atau kelas -> Klik Perbarui Data',
    'Hasil yang Diharapkan': 'Data siswa terbarui di tabel dan Firestore, akumulasi poin dan histori kasus tidak berubah',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 21,
    'ID Test': 'TC-SISWA-07',
    'Modul / Fitur': 'Data Siswa',
    'Skenario & Langkah Uji': 'Klik baris siswa atau tombol detail (mata/panah) untuk membuka halaman /siswa/:id',
    'Hasil yang Diharapkan': 'Terbuka halaman detail: Profil lengkap, kartu total poin, status SP aktif, dan riwayat linimasa kasus siswa',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 22,
    'ID Test': 'TC-SISWA-08',
    'Modul / Fitur': 'Data Siswa',
    'Skenario & Langkah Uji': 'Sebagai Admin, klik tombol Hapus pada siswa uji coba -> Konfirmasi dialog "Apakah Anda yakin?"',
    'Hasil yang Diharapkan': 'Dokumen siswa terhapus dari tabel dan database Firestore',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },

  // --- 5. REKAM KASUS PELANGGARAN ---
  {
    'No': 23,
    'ID Test': 'TC-KASUS-01',
    'Modul / Fitur': 'Rekam Kasus',
    'Skenario & Langkah Uji': 'Buka /kasus/baru -> Pilih Siswa -> Cari kategori via CreatableCombobox -> Tanggal hari ini -> Klik Simpan',
    'Hasil yang Diharapkan': 'Kasus tersimpan, point snapshot tersimpan, total poin siswa bertambah sesuai bobot kategori secara atomik',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 24,
    'ID Test': 'TC-KASUS-02',
    'Modul / Fitur': 'Rekam Kasus',
    'Skenario & Langkah Uji': 'Di form kasus, coba ketik nama kategori baru pada CreatableCombobox yang belum ada di master',
    'Hasil yang Diharapkan': 'CreatableCombobox menampilkan filter opsi atau opsi pembuatan kategori baru jika diaktifkan',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 25,
    'ID Test': 'TC-KASUS-03',
    'Modul / Fitur': 'Rekam Kasus',
    'Skenario & Langkah Uji': 'Catat kasus baru dengan poin yang menyebabkan total akumulasi siswa mencapai atau melebihi 50 poin',
    'Hasil yang Diharapkan': 'Status SP siswa otomatis berganti dari "Aman" menjadi "SP 1" dan badge berubah kuning',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 26,
    'ID Test': 'TC-KASUS-04',
    'Modul / Fitur': 'Rekam Kasus',
    'Skenario & Langkah Uji': 'Catat pelanggaran berat yang menyebabkan total akumulasi siswa mencapai 80 atau 110 poin',
    'Hasil yang Diharapkan': 'Status SP otomatis naik menjadi "SP 2" (oranye) atau "SP 3" (merah)',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 27,
    'ID Test': 'TC-KASUS-05',
    'Modul / Fitur': 'Rekam Kasus',
    'Skenario & Langkah Uji': 'Di tabel /kasus, klik tombol Hapus pada salah satu kasus pelanggaran (sebagai Admin)',
    'Hasil yang Diharapkan': 'Dokumen kasus dihapus, akumulasi poin siswa dikurangi sebesar poin kasus tersebut secara atomik (rollback)',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 28,
    'ID Test': 'TC-KASUS-06',
    'Modul / Fitur': 'Rekam Kasus',
    'Skenario & Langkah Uji': 'Di tabel /kasus, gunakan filter Kategori dan filter Status Kasus',
    'Hasil yang Diharapkan': 'Tabel kasus menyaring baris sesuai kategori dan status yang dipilih',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },

  // --- 6. MASTER KATEGORI & AMBANG BATAS SP ---
  {
    'No': 29,
    'ID Test': 'TC-KAT-01',
    'Modul / Fitur': 'Master Kategori',
    'Skenario & Langkah Uji': 'Buka /kategori -> Klik "+ Tambah Kategori" -> Nama: "Uji Kategori Baru", Poin: 15 -> Klik Simpan',
    'Hasil yang Diharapkan': 'Kategori baru tersimpan di tabel dan otomatis muncul pada opsi form input kasus',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 30,
    'ID Test': 'TC-KAT-02',
    'Modul / Fitur': 'Master Kategori',
    'Skenario & Langkah Uji': 'Klik Edit pada kategori -> Ubah bobot poin -> Klik Simpan',
    'Hasil yang Diharapkan': 'Data kategori terbarui di sistem dan perubahan tercatat ke halaman log audit',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 31,
    'ID Test': 'TC-KAT-03',
    'Modul / Fitur': 'Ambang Batas SP',
    'Skenario & Langkah Uji': 'Di form Ambang Batas SP, masukkan nilai tidak logis (misal SP1=70, SP2=50) -> Klik Perbarui',
    'Hasil yang Diharapkan': 'Sistem menolak simpan dengan pesan validasi: "SP1 harus < SP2 dan SP2 harus < SP3"',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 32,
    'ID Test': 'TC-KAT-04',
    'Modul / Fitur': 'Ambang Batas SP',
    'Skenario & Langkah Uji': 'Ubah ambang batas yang valid (misal SP1=50, SP2=80, SP3=110) -> Klik Perbarui Ambang Batas',
    'Hasil yang Diharapkan': 'Nilai ambang tersimpan di Firestore dan memicu recalculation status SP seluruh siswa secara atomik',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },

  // --- 7. IMPOR MASSAL EXCEL (.XLSX) ---
  {
    'No': 33,
    'ID Test': 'TC-IMP-01',
    'Modul / Fitur': 'Impor Excel',
    'Skenario & Langkah Uji': 'Buka menu Import Excel -> Klik tombol "Unduh Format Excel" pada tab Siswa',
    'Hasil yang Diharapkan': 'File template Template_Data_Siswa_SIKesiswaan.xlsx terunduh otomatis ke perangkat',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 34,
    'ID Test': 'TC-IMP-02',
    'Modul / Fitur': 'Impor Excel',
    'Skenario & Langkah Uji': 'Unggah file Data_Siswa_Dummy_SMK_Kharisma.xlsx pada tab 1 (Import Master Data Siswa)',
    'Hasil yang Diharapkan': 'Excel terbaca, pratinjau menampilkan 20 baris dengan status hijau "new", ringkasan validasi valid',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 35,
    'ID Test': 'TC-IMP-03',
    'Modul / Fitur': 'Impor Excel',
    'Skenario & Langkah Uji': 'Klik tombol "Mulai Impor Data Siswa"',
    'Hasil yang Diharapkan': 'Batch import berjalan dengan loading state, notifikasi sukses muncul, 20 siswa tersimpan di Firestore',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 36,
    'ID Test': 'TC-IMP-04',
    'Modul / Fitur': 'Impor Excel',
    'Skenario & Langkah Uji': 'Unggah ulang file data siswa yang sama setelah diimpor',
    'Hasil yang Diharapkan': 'Sistem cerdas mendeteksi baris siswa yang sudah terdaftar dengan status biru "update"',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 37,
    'ID Test': 'TC-IMP-05',
    'Modul / Fitur': 'Impor Excel',
    'Skenario & Langkah Uji': 'Buka tab 2 (Import Rekam Kasus Pelanggaran) -> Unggah file kasus dengan NISN fiktif',
    'Hasil yang Diharapkan': 'Baris ditandai status merah "error": "NISN ... tidak terdaftar di sistem", tombol impor memblokir baris error',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 38,
    'ID Test': 'TC-IMP-06',
    'Modul / Fitur': 'Impor Excel',
    'Skenario & Langkah Uji': 'Unggah file Data_Kasus_Dummy_SMK_Kharisma.xlsx pada tab 2 -> Klik "Mulai Impor Data Kasus"',
    'Hasil yang Diharapkan': 'Seluruh 15 kasus lolos validasi, terimpor ke sistem, dan poin siswa terakumulasi secara atomik',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },

  // --- 8. REKAPITULASI PELANGGARAN & PELAPORAN ---
  {
    'No': 39,
    'ID Test': 'TC-REKAP-01',
    'Modul / Fitur': 'Rekapitulasi',
    'Skenario & Langkah Uji': 'Buka /rekap -> Pilih rentang tanggal (misal 01/09/2026 s/d 30/09/2026) -> Klik Terapkan',
    'Hasil yang Diharapkan': 'Tabel dan kartu ringkasan memuat hanya data kasus yang tanggal kejadiannya dalam rentang tersebut',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 40,
    'ID Test': 'TC-REKAP-02',
    'Modul / Fitur': 'Rekapitulasi',
    'Skenario & Langkah Uji': 'Klik tombol "Export Excel" di pojok kanan atas halaman Rekap',
    'Hasil yang Diharapkan': 'File Rekap_Pelanggaran_SMK_Kharisma_Nusantara.xlsx langsung terunduh rapi dengan struktur data tabel',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 41,
    'ID Test': 'TC-REKAP-03',
    'Modul / Fitur': 'Rekapitulasi',
    'Skenario & Langkah Uji': 'Klik tombol "Cetak Rekap (A4)"',
    'Hasil yang Diharapkan': 'Muncul dialog cetak browser (window.print); tombol, navbar, dan sidebar disembunyikan rapi oleh @media print',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },

  // --- 9. GENERATOR SURAT PERINGATAN (SP) ---
  {
    'No': 42,
    'ID Test': 'TC-SURAT-01',
    'Modul / Fitur': 'Surat Peringatan',
    'Skenario & Langkah Uji': 'Buka /surat -> Pilih siswa berstatus SP -> Isi jadwal kehadiran orang tua -> Klik "Generate Surat"',
    'Hasil yang Diharapkan': 'Surat dibuat dengan nomor urut dinas atomik (format: 001/SMK-KN/SP-1/IX/2026)',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 43,
    'ID Test': 'TC-SURAT-02',
    'Modul / Fitur': 'Surat Peringatan',
    'Skenario & Langkah Uji': 'Generate surat kedua secara berurutan',
    'Hasil yang Diharapkan': 'Nomor surat bertambah secara atomik (002/SMK-KN/...) tanpa terjadi nomor ganda / kolisi',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 44,
    'ID Test': 'TC-SURAT-03',
    'Modul / Fitur': 'Surat Peringatan',
    'Skenario & Langkah Uji': 'Klik "Pratinjau Surat" pada salah satu surat yang telah terbit',
    'Hasil yang Diharapkan': 'Modal pratinjau surat dinas terbuka memuat Kop Sekolah, detail siswa, kasus pemicu, dan tanda tangan',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 45,
    'ID Test': 'TC-SURAT-04',
    'Modul / Fitur': 'Surat Peringatan',
    'Skenario & Langkah Uji': 'Klik tombol "Cetak Surat" pada modal pratinjau (Save as PDF / Print)',
    'Hasil yang Diharapkan': 'Layout surat pas 1 lembar A4 tanpa terpotong (*page-break* aman dan bersih dari elemen web)',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },

  // --- 10. PENGATURAN SEKOLAH & LOG AUDIT ---
  {
    'No': 46,
    'ID Test': 'TC-SET-01',
    'Modul / Fitur': 'Pengaturan Sekolah',
    'Skenario & Langkah Uji': 'Buka /settings sebagai Admin -> Ubah nama Kepala Sekolah atau NIP -> Klik "Simpan Pengaturan"',
    'Hasil yang Diharapkan': 'Data identitas tersimpan di Firestore dan otomatis terbarui pada kop surat serta lembar cetak rekap',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 47,
    'ID Test': 'TC-SET-02',
    'Modul / Fitur': 'Pengaturan Sekolah',
    'Skenario & Langkah Uji': 'Unggah file gambar logo sekolah baru pada tab Identitas Sekolah',
    'Hasil yang Diharapkan': 'Logo terkonversi ke format web base64 dan tampil sebagai pratinjau logo kop resmi',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 48,
    'ID Test': 'TC-LOG-01',
    'Modul / Fitur': 'Log Audit',
    'Skenario & Langkah Uji': 'Buka menu /log -> Periksa catatan histori aktivitas sistem',
    'Hasil yang Diharapkan': 'Menampilkan histori kegiatan terkini: aksi tambah siswa, input kasus, edit kategori, user pencatat, dan timestamp',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },

  // --- 11. HKI, UI/UX & RESPONSIVITAS MOBILE ---
  {
    'No': 49,
    'ID Test': 'TC-UI-01',
    'Modul / Fitur': 'Hak Cipta (HKI)',
    'Skenario & Langkah Uji': 'Klik menu "Tentang & Hak Cipta" pada bagian bawah sidebar / footer',
    'Hasil yang Diharapkan': 'Modal Tentang Aplikasi muncul menampilkan versi sistem v1.0.0 dan klausul UU No. 28 Tahun 2014',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 50,
    'ID Test': 'TC-UI-02',
    'Modul / Fitur': 'Sistem Notifikasi Toast',
    'Skenario & Langkah Uji': 'Lakukan aksi simpan/error pada salah satu form -> Amati notifikasi pop-up toast',
    'Hasil yang Diharapkan': 'Toast muncul di pojok dengan warna yang sesuai (hijau/sukses, merah/error) dan hilang otomatis',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 51,
    'ID Test': 'TC-UI-03',
    'Modul / Fitur': 'Responsivitas Mobile',
    'Skenario & Langkah Uji': 'Buka aplikasi melalui layar smartphone atau ubah ukuran browser ke mode responsif mobile (lebar < 768px)',
    'Hasil yang Diharapkan': 'Sidebar desktop tersembunyi, muncul bilah navigasi bawah (bottom bar) & menu drawer samping yang berfungsi mulus',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  },
  {
    'No': 52,
    'ID Test': 'TC-UI-04',
    'Modul / Fitur': 'Responsivitas Mobile',
    'Skenario & Langkah Uji': 'Di layar mobile, klik tombol menu "Lainnya" pada navigasi bawah',
    'Hasil yang Diharapkan': 'Drawer menu terbuka menyajikan menu sekunder: Log Audit, Pengaturan, Tentang Aplikasi, dan tombol Logout',
    'Hasil Pengujian (Isi Sendiri)': '',
    'Status': '',
    'Catatan / Bug Temuan': ''
  }
];

// Buat Workbook Baru
const wb = xlsx.utils.book_new();

// Sheet 1: Petunjuk Pengisian
const wsPetunjuk = xlsx.utils.json_to_sheet(petunjuk);
wsPetunjuk['!cols'] = [{ wch: 25 }, { wch: 85 }];
xlsx.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk Pengujian');

// Sheet 2: Checklist Pengujian 52 Kasus Uji
const wsChecklist = xlsx.utils.json_to_sheet(checklist);
wsChecklist['!cols'] = [
  { wch: 6 },  // No
  { wch: 14 }, // ID Test
  { wch: 20 }, // Modul / Fitur
  { wch: 45 }, // Skenario & Langkah Uji
  { wch: 45 }, // Hasil yang Diharapkan
  { wch: 35 }, // Hasil Pengujian (Isi Sendiri)
  { wch: 15 }, // Status
  { wch: 30 }  // Catatan / Bug Temuan
];
xlsx.utils.book_append_sheet(wb, wsChecklist, 'Lembar Uji Checklist (52 Item)');

// Simpan ke Parent Directory PKM
const outputPath = path.resolve('..', 'Lembar_Uji_Black_Box_SIKesiswaan.xlsx');
xlsx.writeFile(wb, outputPath);
console.log('BERHASIL! Lembar Uji Checklist tersimpan di:', outputPath);
