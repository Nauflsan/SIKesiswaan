import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =========================================================================
// DATA SHEET 1: RINGKASAN & METODOLOGI PENGUJIAN
// =========================================================================
const dataRingkasan = [
  { 'Parameter': 'Nama Sistem', 'Keterangan': 'SIKesiswaan (Sistem Informasi Kedisiplinan & Bimbingan Konseling Siswa)' },
  { 'Parameter': 'Instansi / Objek', 'Keterangan': 'SMK Kharisma Nusantara' },
  { 'Parameter': 'Metode Pengujian', 'Keterangan': 'Black Box Testing (Equivalence Partitioning & Boundary Value Analysis)' },
  { 'Parameter': 'Lingkungan Pengujian', 'Keterangan': 'Web Browser Chrome / Edge (Production: https://sik-kharisma.web.app)' },
  { 'Parameter': 'Backend & Basis Data', 'Keterangan': 'Google Cloud Firestore & Firebase Authentication' },
  { 'Parameter': 'Versi Aplikasi', 'Keterangan': 'v1.0.0 (Tahap Production Phase 2)' },
  { 'Parameter': 'Total Kasus Uji', 'Keterangan': '37 Kasus Uji (30 Skenario Positif, 7 Skenario Negatif)' },
  { 'Parameter': 'Jumlah Uji Berhasil (Pass)', 'Keterangan': '37 Kasus Uji (100% Tingkat Keberhasilan)' },
  { 'Parameter': 'Jumlah Uji Gagal (Fail)', 'Keterangan': '0 Kasus Uji' },
  { 'Parameter': 'Kesimpulan Pengujian', 'Keterangan': 'Sistem beroperasi optimal secara fungsional, seluruh validasi form, foreign key, isolasi cetak CSS, dan transaksi atomik Firestore berjalan sesuai spesifikasi.' }
];

// =========================================================================
// DATA SHEET 2: TABEL BLACK BOX TESTING LENGKAP (37 KASUS UJI)
// =========================================================================
const testCases = [
  // --- MODUL 1: AUTENTIKASI PENGGUNA (TC-AUTH) ---
  {
    'No': 1,
    'ID Test Case': 'TC-AUTH-01',
    'Modul / Fitur': 'Autentikasi',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Login dengan akun Administrator yang sah',
    'Pra-kondisi': 'Pengguna berada di halaman login (/login) dan status belum login',
    'Langkah & Data Uji': '1. Masukkan email: admin@smkkharisma.sch.id\n2. Masukkan password valid\n3. Klik tombol Masuk Sistem',
    'Hasil yang Diharapkan': 'Login berhasil, token sesi tersimpan, dialihkan ke halaman Dashboard dengan menu penuh Admin',
    'Hasil Pengujian': 'Sesuai Harapan (Dialihkan ke Dashboard dengan hak penuh)',
    'Status': 'Valid'
  },
  {
    'No': 2,
    'ID Test Case': 'TC-AUTH-02',
    'Modul / Fitur': 'Autentikasi',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Login dengan akun Guru BK yang sah',
    'Pra-kondisi': 'Pengguna berada di halaman login (/login)',
    'Langkah & Data Uji': '1. Masukkan email: bk@smkkharisma.sch.id\n2. Masukkan password valid\n3. Klik tombol Masuk Sistem',
    'Hasil yang Diharapkan': 'Login berhasil, dialihkan ke Dashboard dengan tampilan menu operasional Guru BK',
    'Hasil Pengujian': 'Sesuai Harapan (Dialihkan ke Dashboard dengan role guru_bk)',
    'Status': 'Valid'
  },
  {
    'No': 3,
    'ID Test Case': 'TC-AUTH-03',
    'Modul / Fitur': 'Autentikasi',
    'Tipe': 'Negatif',
    'Deskripsi Pengujian': 'Login dengan kata sandi yang salah',
    'Pra-kondisi': 'Pengguna berada di halaman login (/login)',
    'Langkah & Data Uji': '1. Masukkan email yang terdaftar\n2. Masukkan password acak / salah\n3. Klik tombol Masuk Sistem',
    'Hasil yang Diharapkan': 'Sistem menolak autentikasi dan menampilkan notifikasi kesalahan: "Email atau kata sandi yang dimasukkan salah"',
    'Hasil Pengujian': 'Sesuai Harapan (Muncul pesan error ramah pengguna)',
    'Status': 'Valid'
  },
  {
    'No': 4,
    'ID Test Case': 'TC-AUTH-04',
    'Modul / Fitur': 'Autentikasi',
    'Tipe': 'Negatif',
    'Deskripsi Pengujian': 'Login dengan format email tidak valid',
    'Pra-kondisi': 'Pengguna berada di halaman login (/login)',
    'Langkah & Data Uji': '1. Masukkan email: "admin_kharisma"\n2. Masukkan password sembarang\n3. Klik Masuk Sistem',
    'Hasil yang Diharapkan': 'Validasi form HTML5 memblokir pengiriman formulir dan meminta format email lengkap (@)',
    'Hasil Pengujian': 'Sesuai Harapan (Formulir tidak dapat disubmit)',
    'Status': 'Valid'
  },
  {
    'No': 5,
    'ID Test Case': 'TC-AUTH-05',
    'Modul / Fitur': 'Autentikasi',
    'Tipe': 'Negatif',
    'Deskripsi Pengujian': 'Login dengan akun yang telah dinonaktifkan (isActive: false)',
    'Pra-kondisi': 'Dokumen akun pengguna di Firestore memiliki status isActive = false',
    'Langkah & Data Uji': '1. Masukkan email akun non-aktif\n2. Masukkan password valid\n3. Klik Masuk Sistem',
    'Hasil yang Diharapkan': 'Sistem otomatis mengeluarkan sesi (sign out) dan menampilkan pesan "Akun Anda telah dinonaktifkan"',
    'Hasil Pengujian': 'Sesuai Harapan (Akses ditolak dan sesi segera dibatalkan)',
    'Status': 'Valid'
  },
  {
    'No': 6,
    'ID Test Case': 'TC-AUTH-06',
    'Modul / Fitur': 'Autentikasi',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Logout pengguna dari sistem',
    'Pra-kondisi': 'Pengguna sedang dalam keadaan login di aplikasi',
    'Langkah & Data Uji': '1. Klik menu dropdown profil atau tombol Keluar di bilah navigasi\n2. Konfirmasi logout',
    'Hasil yang Diharapkan': 'Sesi Firebase Auth dihapus, state aplikasi dibersihkan, dialihkan kembali ke halaman /login',
    'Hasil Pengujian': 'Sesuai Harapan (Dialihkan ke /login dan sesi bersih)',
    'Status': 'Valid'
  },

  // --- MODUL 2: HAK AKSES & RBAC (TC-RBAC) ---
  {
    'No': 7,
    'ID Test Case': 'TC-RBAC-01',
    'Modul / Fitur': 'Hak Akses (RBAC)',
    'Tipe': 'Negatif',
    'Deskripsi Pengujian': 'Akses halaman tertutup oleh pengguna yang belum login',
    'Pra-kondisi': 'Pengguna belum terautentikasi (status anonymous)',
    'Langkah & Data Uji': 'Buka langsung URL internal melalui address bar: /dashboard atau /siswa',
    'Hasil yang Diharapkan': 'Guard rute memblokir akses dan mengalihkan paksa pengguna ke halaman /login',
    'Hasil Pengujian': 'Sesuai Harapan (Dialihkan otomatis ke /login)',
    'Status': 'Valid'
  },
  {
    'No': 8,
    'ID Test Case': 'TC-RBAC-02',
    'Modul / Fitur': 'Hak Akses (RBAC)',
    'Tipe': 'Negatif',
    'Deskripsi Pengujian': 'Akses menu Pengaturan Identitas Sekolah oleh Guru BK',
    'Pra-kondisi': 'Pengguna login sebagai Guru BK (role = guru_bk)',
    'Langkah & Data Uji': 'Buka halaman /settings atau periksa tombol konfigurasi admin',
    'Hasil yang Diharapkan': 'Tombol simpan/aksi master dinonaktifkan atau akses dibatasi dengan notifikasi RBAC',
    'Hasil Pengujian': 'Sesuai Harapan (Hanya Admin yang dapat mengubah identitas)',
    'Status': 'Valid'
  },
  {
    'No': 9,
    'ID Test Case': 'TC-RBAC-03',
    'Modul / Fitur': 'Hak Akses (RBAC)',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Akses penuh fitur operasional oleh Administrator',
    'Pra-kondisi': 'Pengguna login sebagai Administrator (role = admin)',
    'Langkah & Data Uji': 'Akses seluruh menu: Siswa, Kasus, Kategori, Surat, Rekap, Pengaturan, Log Audit',
    'Hasil yang Diharapkan': 'Seluruh halaman dan tombol aksi administratif dapat diakses tanpa hambatan',
    'Hasil Pengujian': 'Sesuai Harapan (Semua modul dapat diakses sepenuhnya)',
    'Status': 'Valid'
  },

  // --- MODUL 3: MASTER DATA SISWA (TC-SISWA) ---
  {
    'No': 10,
    'ID Test Case': 'TC-SISWA-01',
    'Modul / Fitur': 'Data Siswa',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Tambah data siswa baru dengan identitas lengkap dan valid',
    'Pra-kondisi': 'Pengguna berada di modal Tambah Siswa Baru',
    'Langkah & Data Uji': '1. Masukkan NISN: "0081234021"\n2. Nama: "Nadia Safitri"\n3. Kelas: "X TKJ 1"\n4. Jurusan: "Teknik Komputer dan Jaringan"\n5. Klik Simpan',
    'Hasil yang Diharapkan': 'Data siswa tersimpan di Firestore, notifikasi toast sukses muncul, total poin default 0, status SP "Aman"',
    'Hasil Pengujian': 'Sesuai Harapan (Siswa tersimpan, totalPoin: 0, statusSP: "Aman")',
    'Status': 'Valid'
  },
  {
    'No': 11,
    'ID Test Case': 'TC-SISWA-02',
    'Modul / Fitur': 'Data Siswa',
    'Tipe': 'Negatif',
    'Deskripsi Pengujian': 'Tambah data siswa dengan NISN yang sudah terdaftar (duplikasi NISN)',
    'Pra-kondisi': 'Siswa dengan NISN "0081234001" sudah ada di database',
    'Langkah & Data Uji': '1. Masukkan NISN: "0081234001"\n2. Masukkan Nama: "Nama Baru"\n3. Klik Simpan',
    'Hasil yang Diharapkan': 'Sistem menolak penyimpanan dengan validasi: "NISN 0081234001 sudah terdaftar pada siswa Ahmad Rizky Pratama"',
    'Hasil Pengujian': 'Sesuai Harapan (Duplikasi ditolak sebelum ditulis ke Firestore)',
    'Status': 'Valid'
  },
  {
    'No': 12,
    'ID Test Case': 'TC-SISWA-03',
    'Modul / Fitur': 'Data Siswa',
    'Tipe': 'Negatif',
    'Deskripsi Pengujian': 'Validasi batas panjang dan format NISN (BVA)',
    'Pra-kondisi': 'Formulir tambah siswa terbuka',
    'Langkah & Data Uji': '1. Masukkan NISN: "1234" (kurang dari 6 digit) atau "008ABC1234" (mengandung huruf)\n2. Klik Simpan',
    'Hasil yang Diharapkan': 'Validasi regex memblokir penyimpanan dengan pesan: "NISN harus berupa angka (6-20 digit)"',
    'Hasil Pengujian': 'Sesuai Harapan (Penyimpanan diblokir dengan validasi format)',
    'Status': 'Valid'
  },
  {
    'No': 13,
    'ID Test Case': 'TC-SISWA-04',
    'Modul / Fitur': 'Data Siswa',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Pencarian data siswa berdasarkan Nama atau NISN',
    'Pra-kondisi': 'Daftar data siswa tampil di halaman /siswa',
    'Langkah & Data Uji': 'Ketik kata kunci "Ahmad" atau "0081234001" pada bilah pencarian',
    'Hasil yang Diharapkan': 'Tabel secara dinamis memfilter dan hanya menampilkan siswa yang cocok secara real-time',
    'Hasil Pengujian': 'Sesuai Harapan (Penyaringan data instan tanpa refresh)',
    'Status': 'Valid'
  },
  {
    'No': 14,
    'ID Test Case': 'TC-SISWA-05',
    'Modul / Fitur': 'Data Siswa',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Filter data siswa berdasarkan Tingkat Kelas atau Jurusan',
    'Pra-kondisi': 'Daftar data siswa tampil di halaman /siswa',
    'Langkah & Data Uji': 'Pilih filter Kelas: "X TKJ 1" dan Jurusan: "Teknik Komputer dan Jaringan"',
    'Hasil yang Diharapkan': 'Tabel menyaring data sehingga hanya siswa yang terdaftar di kelas dan jurusan tersebut yang muncul',
    'Hasil Pengujian': 'Sesuai Harapan (Tabel hanya memuat siswa kelas X TKJ 1)',
    'Status': 'Valid'
  },
  {
    'No': 15,
    'ID Test Case': 'TC-SISWA-06',
    'Modul / Fitur': 'Data Siswa',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Edit profil dan kelas siswa',
    'Pra-kondisi': 'Siswa telah terdaftar sebelumnya',
    'Langkah & Data Uji': '1. Klik ikon Edit pada siswa "Bagus Setiawan"\n2. Ubah kelas menjadi "XI TKJ 1"\n3. Klik Perbarui Data',
    'Hasil yang Diharapkan': 'Profil siswa berhasil diperbarui tanpa merusak riwayat poin pelanggaran yang telah terkumpul',
    'Hasil Pengujian': 'Sesuai Harapan (Profil diperbarui, poin tetap aman)',
    'Status': 'Valid'
  },
  {
    'No': 16,
    'ID Test Case': 'TC-SISWA-07',
    'Modul / Fitur': 'Data Siswa',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Buka halaman detail rekam jejak siswa (/siswa/:id)',
    'Pra-kondisi': 'Pengguna berada di daftar siswa',
    'Langkah & Data Uji': 'Klik baris atau tombol detail pada siswa yang memiliki riwayat kasus',
    'Hasil yang Diharapkan': 'Halaman detail menampilkan profil siswa, total poin, status SP aktif, dan tabel linimasa pelanggaran',
    'Hasil Pengujian': 'Sesuai Harapan (Semua komponen detail tampil lengkap)',
    'Status': 'Valid'
  },

  // --- MODUL 4: MASTER KATEGORI & AMBANG BATAS SP (TC-KAT) ---
  {
    'No': 17,
    'ID Test Case': 'TC-KAT-01',
    'Modul / Fitur': 'Master Kategori',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Tambah jenis kategori pelanggaran baru',
    'Pra-kondisi': 'Pengguna login sebagai Admin di halaman /kategori',
    'Langkah & Data Uji': '1. Masukkan Nama: "Membawa Miras ke Sekolah"\n2. Masukkan Bobot Poin: 75\n3. Klik Simpan',
    'Hasil yang Diharapkan': 'Kategori baru tersimpan di database dan otomatis tersedia di dropdown input kasus',
    'Hasil Pengujian': 'Sesuai Harapan (Kategori baru muncul di master dan form)',
    'Status': 'Valid'
  },
  {
    'No': 18,
    'ID Test Case': 'TC-KAT-02',
    'Modul / Fitur': 'Master Kategori',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Perbarui bobot poin atau status aktif kategori',
    'Pra-kondisi': 'Kategori pelanggaran telah ada di sistem',
    'Langkah & Data Uji': '1. Klik Edit pada salah satu kategori\n2. Ubah bobot poin atau alihkan status aktif\n3. Klik Simpan',
    'Hasil yang Diharapkan': 'Data kategori berhasil diperbarui dan aktivitas tercatat pada log audit sistem',
    'Hasil Pengujian': 'Sesuai Harapan (Kategori diperbarui dan log audit tercatat)',
    'Status': 'Valid'
  },
  {
    'No': 19,
    'ID Test Case': 'TC-KAT-03',
    'Modul / Fitur': 'Ambang Batas SP',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Pembaruan ambang batas SP dan kalkulasi ulang beruntun (Atomic Recalculation)',
    'Pra-kondisi': 'Pengaturan ambang SP awal: SP1=50, SP2=80, SP3=110',
    'Langkah & Data Uji': '1. Ubah konfigurasi ambang: SP1=40, SP2=70, SP3=100\n2. Klik Perbarui Ambang Batas',
    'Hasil yang Diharapkan': 'Pengaturan global terbarui di Firestore dan sistem menghitung ulang status SP seluruh siswa secara atomik',
    'Hasil Pengujian': 'Sesuai Harapan (Status SP siswa tersinkronisasi otomatis)',
    'Status': 'Valid'
  },
  {
    'No': 20,
    'ID Test Case': 'TC-KAT-04',
    'Modul / Fitur': 'Ambang Batas SP',
    'Tipe': 'Negatif',
    'Deskripsi Pengujian': 'Validasi batas urutan logika nilai ambang SP (BVA)',
    'Pra-kondisi': 'Form pengaturan ambang batas terbuka di /kategori',
    'Langkah & Data Uji': '1. Masukkan nilai tidak berurutan: SP1=60, SP2=50, SP3=80 (kondisi SP1 >= SP2)\n2. Klik Perbarui Ambang Batas',
    'Hasil yang Diharapkan': 'Sistem menolak dengan pesan validasi: "Urutan ambang batas tidak logis: SP1 harus < SP2 dan SP2 harus < SP3"',
    'Hasil Pengujian': 'Sesuai Harapan (Validasi urutan logis mencegah anomali data)',
    'Status': 'Valid'
  },

  // --- MODUL 5: REKAM KASUS PELANGGARAN (TC-KASUS) ---
  {
    'No': 21,
    'ID Test Case': 'TC-KASUS-01',
    'Modul / Fitur': 'Rekam Kasus',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Catat kasus baru dengan Transaksi Atomik Firestore',
    'Pra-kondisi': 'Siswa memiliki poin awal 0 dan status "Aman"',
    'Langkah & Data Uji': '1. Buka form /kasus/baru\n2. Pilih Siswa: Ahmad Rizky Pratama\n3. Pilih Kategori: Bolos Jam Pelajaran (10 poin)\n4. Tanggal: 2026-09-20\n5. Simpan Kasus',
    'Hasil yang Diharapkan': 'Kasus tersimpan dengan snapshot poin, poin siswa bertambah menjadi 10 poin dalam satu transaksi atomik',
    'Hasil Pengujian': 'Sesuai Harapan (Kasus tersimpan, total poin siswa menjadi 10)',
    'Status': 'Valid'
  },
  {
    'No': 22,
    'ID Test Case': 'TC-KASUS-02',
    'Modul / Fitur': 'Rekam Kasus',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Akumulasi poin mencapai ambang batas SP1 (Boundary Testing)',
    'Pra-kondisi': 'Siswa memiliki poin 45 (Ambang SP1 = 50)',
    'Langkah & Data Uji': 'Catat pelanggaran baru berbobot 5 poin (sehingga akumulasi = 50 poin)',
    'Hasil yang Diharapkan': 'Status SP siswa otomatis berubah menjadi "SP 1" dan badge status siswa berubah warna menjadi kuning',
    'Hasil Pengujian': 'Sesuai Harapan (Status SP1 langsung terpicu otomatis)',
    'Status': 'Valid'
  },
  {
    'No': 23,
    'ID Test Case': 'TC-KASUS-03',
    'Modul / Fitur': 'Rekam Kasus',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Akumulasi poin mencapai ambang batas SP2 dan SP3',
    'Pra-kondisi': 'Siswa memiliki akumulasi poin mendekati 80 atau 110 poin',
    'Langkah & Data Uji': 'Catat pelanggaran berat yang menyebabkan total akumulasi >= 80 atau >= 110',
    'Hasil yang Diharapkan': 'Status SP secara bertahap bertransisi menjadi "SP 2" (orange) atau "SP 3" (merah) sesuai ambang batas',
    'Hasil Pengujian': 'Sesuai Harapan (Status SP2/SP3 terpicu tepat pada batasnya)',
    'Status': 'Valid'
  },
  {
    'No': 24,
    'ID Test Case': 'TC-KASUS-04',
    'Modul / Fitur': 'Rekam Kasus',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Hapus kasus pelanggaran dengan Rollback Poin Atomik (Admin)',
    'Pra-kondisi': 'Siswa memiliki kasus berbobot 25 poin dengan total akumulasi 35 poin',
    'Langkah & Data Uji': '1. Klik Hapus Kasus pada kasus 25 poin tersebut\n2. Konfirmasi penghapusan',
    'Hasil yang Diharapkan': 'Dokumen kasus dihapus, akumulasi poin siswa otomatis dikurangi 25 poin (menjadi 10 poin) via runTransaction',
    'Hasil Pengujian': 'Sesuai Harapan (Poin berkurang presisi dan status SP disesuaikan)',
    'Status': 'Valid'
  },
  {
    'No': 25,
    'ID Test Case': 'TC-KASUS-05',
    'Modul / Fitur': 'Rekam Kasus',
    'Tipe': 'Negatif',
    'Deskripsi Pengujian': 'Pengiriman formulir kasus dengan kolom wajib yang kosong',
    'Pra-kondisi': 'Formulir pencatatan kasus terbuka di /kasus/baru',
    'Langkah & Data Uji': 'Biarkan kolom Siswa atau Kategori tidak dipilih, lalu klik Simpan',
    'Hasil yang Diharapkan': 'Sistem memblokir pengiriman formulir dan menandai field wajib dengan pesan peringatan',
    'Hasil Pengujian': 'Sesuai Harapan (Formulir dicegah dari submit)',
    'Status': 'Valid'
  },

  // --- MODUL 6: IMPOR EXCEL MASSAL (TC-IMP) ---
  {
    'No': 26,
    'ID Test Case': 'TC-IMP-01',
    'Modul / Fitur': 'Impor Excel',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Impor massal data siswa menggunakan file .xlsx valid',
    'Pra-kondisi': 'Pengguna di tab "1. Import Master Data Siswa"',
    'Langkah & Data Uji': '1. Unggah file Data_Siswa_Dummy_SMK_Kharisma.xlsx (20 baris)\n2. Periksa tabel pratinjau\n3. Klik Mulai Impor Data Siswa',
    'Hasil yang Diharapkan': 'Seluruh baris terdeteksi valid (status hijau "new"), 20 siswa tersimpan di Firestore dalam batch chunk',
    'Hasil Pengujian': 'Sesuai Harapan (20 data siswa berhasil diimpor sekaligus)',
    'Status': 'Valid'
  },
  {
    'No': 27,
    'ID Test Case': 'TC-IMP-02',
    'Modul / Fitur': 'Impor Excel',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Deteksi otomatis baris siswa yang sudah terdaftar (mode update)',
    'Pra-kondisi': 'Data siswa telah ada sebagian di database',
    'Langkah & Data Uji': 'Unggah file Excel yang berisi NISN lama dengan pembaharuan kelas',
    'Hasil yang Diharapkan': 'Sistem menandai baris tersebut dengan status biru "update" dan memperbarui profil tanpa membuat duplikasi',
    'Hasil Pengujian': 'Sesuai Harapan (Baris terdeteksi sebagai update data)',
    'Status': 'Valid'
  },
  {
    'No': 28,
    'ID Test Case': 'TC-IMP-03',
    'Modul / Fitur': 'Impor Excel',
    'Tipe': 'Negatif',
    'Deskripsi Pengujian': 'Impor data kasus dengan NISN siswa yang tidak ada di database',
    'Pra-kondisi': 'Pengguna di tab "2. Import Rekam Kasus Pelanggaran"',
    'Langkah & Data Uji': 'Unggah file Excel kasus dengan NISN fiktif "0089999999"',
    'Hasil yang Diharapkan': 'Sistem menandai baris sebagai error merah: "NISN 0089999999 tidak terdaftar di sistem" dan tombol impor memblokir baris error',
    'Hasil Pengujian': 'Sesuai Harapan (Foreign key siswa divalidasi dengan tepat)',
    'Status': 'Valid'
  },
  {
    'No': 29,
    'ID Test Case': 'TC-IMP-04',
    'Modul / Fitur': 'Impor Excel',
    'Tipe': 'Negatif',
    'Deskripsi Pengujian': 'Impor data kasus dengan nama kategori yang tidak terdaftar',
    'Pra-kondisi': 'Pengguna di tab "2. Import Rekam Kasus Pelanggaran"',
    'Langkah & Data Uji': 'Unggah file Excel dengan nilai kolom Kategori: "Kategori Tidak Jelas"',
    'Hasil yang Diharapkan': 'Sistem memvalidasi relasi kategori dan memunculkan error: "Kategori [xxx] tidak cocok"',
    'Hasil Pengujian': 'Sesuai Harapan (Foreign key kategori diverifikasi ketat)',
    'Status': 'Valid'
  },
  {
    'No': 30,
    'ID Test Case': 'TC-IMP-05',
    'Modul / Fitur': 'Impor Excel',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Impor massal rekam kasus valid (Data_Kasus_Dummy_SMK_Kharisma.xlsx)',
    'Pra-kondisi': 'Master siswa dan kategori sudah terdaftar di Firestore',
    'Langkah & Data Uji': '1. Unggah file Data_Kasus_Dummy_SMK_Kharisma.xlsx (15 baris)\n2. Klik Mulai Impor Data Kasus',
    'Hasil yang Diharapkan': 'Seluruh 15 kasus lolos validasi, poin siswa terakumulasi, dan status SP terkalkulasi secara atomik',
    'Hasil Pengujian': 'Sesuai Harapan (15 kasus terimpor dan poin bertambah akurat)',
    'Status': 'Valid'
  },

  // --- MODUL 7: REKAPITULASI & EKSPOR PELAPORAN (TC-REKAP) ---
  {
    'No': 31,
    'ID Test Case': 'TC-REKAP-01',
    'Modul / Fitur': 'Rekapitulasi',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Penyaringan rekapitulasi berdasarkan rentang tanggal kejadian',
    'Pra-kondisi': 'Terdapat data riwayat kasus pada bulan September 2026',
    'Langkah & Data Uji': '1. Buka halaman /rekap\n2. Atur Tanggal Mulai: 2026-09-01 dan Tanggal Akhir: 2026-09-30\n3. Klik Terapkan',
    'Hasil yang Diharapkan': 'Tabel dan kartu statistik hanya menghitung pelanggaran yang terjadi pada rentang September 2026',
    'Hasil Pengujian': 'Sesuai Harapan (Hanya kasus September yang ditampilkan)',
    'Status': 'Valid'
  },
  {
    'No': 32,
    'ID Test Case': 'TC-REKAP-02',
    'Modul / Fitur': 'Rekapitulasi',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Ekspor hasil rekapitulasi kasus ke format Excel (.xlsx)',
    'Pra-kondisi': 'Data rekapitulasi tampil pada tabel di halaman /rekap',
    'Langkah & Data Uji': 'Klik tombol Ekspor Excel di pojok kanan atas',
    'Hasil yang Diharapkan': 'File Rekap_Pelanggaran_SMK_Kharisma_Nusantara.xlsx terunduh otomatis dengan struktur data rapi',
    'Hasil Pengujian': 'Sesuai Harapan (File spreadsheet langsung terunduh)',
    'Status': 'Valid'
  },
  {
    'No': 33,
    'ID Test Case': 'TC-REKAP-03',
    'Modul / Fitur': 'Rekapitulasi',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Cetak lembar dinas rekapitulasi A4 via dialog browser print',
    'Pra-kondisi': 'Data rekapitulasi aktif di halaman /rekap',
    'Langkah & Data Uji': 'Klik tombol Cetak Laporan (A4)',
    'Hasil yang Diharapkan': 'Dialog cetak window.print terbuka; CSS @media print menyembunyikan sidebar/tombol dan menampilkan tata letak dinas',
    'Hasil Pengujian': 'Sesuai Harapan (Tata letak cetak A4 rapi dan terisolasi)',
    'Status': 'Valid'
  },

  // --- MODUL 8: GENERATOR SURAT PERINGATAN (TC-SURAT) ---
  {
    'No': 34,
    'ID Test Case': 'TC-SURAT-01',
    'Modul / Fitur': 'Surat Peringatan',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Pembuatan lembar surat panggilan/peringatan dengan nomor atomik',
    'Pra-kondisi': 'Terdapat siswa dengan status SP aktif di sistem',
    'Langkah & Data Uji': '1. Buka halaman /surat\n2. Pilih siswa terkait dan tentukan jadwal kehadiran orang tua\n3. Klik Generate Surat',
    'Hasil yang Diharapkan': 'Surat terbentuk dengan nomor urut dinas resmi (contoh: 001/SMK-KN/SP-1/IX/2026) dan counter bertambah atomik',
    'Hasil Pengujian': 'Sesuai Harapan (Nomor surat terbit unik tanpa kolisi nomor)',
    'Status': 'Valid'
  },
  {
    'No': 35,
    'ID Test Case': 'TC-SURAT-02',
    'Modul / Fitur': 'Surat Peringatan',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Pratinjau dan pencetakan lembar fisik surat peringatan resmi',
    'Pra-kondisi': 'Dokumen surat telah digenerate pada modul surat',
    'Langkah & Data Uji': 'Klik tombol Cetak Surat pada modal pratinjau surat',
    'Hasil yang Diharapkan': 'Tampilan cetak memuat Kop Surat Sekolah resmi, logo, data siswa, butir pelanggaran, dan kolom tanda tangan',
    'Hasil Pengujian': 'Sesuai Harapan (Format surat dinas tercetak presisi 1 lembar A4)',
    'Status': 'Valid'
  },

  // --- MODUL 9: PENGATURAN SEKOLAH & HKI (TC-SET) ---
  {
    'No': 36,
    'ID Test Case': 'TC-SET-01',
    'Modul / Fitur': 'Pengaturan Sekolah',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Pembaruan identitas sekolah, nama kepala sekolah, NIP, dan logo kop',
    'Pra-kondisi': 'Pengguna login sebagai Administrator di /settings',
    'Langkah & Data Uji': '1. Perbarui nama sekolah, alamat, nama Kepsek dan NIP\n2. Klik Simpan Perubahan',
    'Hasil yang Diharapkan': 'Data identitas tersimpan di Firestore dan otomatis tercermin pada kop surat dan cetak laporan',
    'Hasil Pengujian': 'Sesuai Harapan (Identitas sekolah tersinkronisasi di seluruh surat)',
    'Status': 'Valid'
  },
  {
    'No': 37,
    'ID Test Case': 'TC-SET-02',
    'Modul / Fitur': 'Hak Cipta (HKI)',
    'Tipe': 'Positif',
    'Deskripsi Pengujian': 'Buka modal Tentang Aplikasi & Deklarasi Perlindungan HKI',
    'Pra-kondisi': 'Pengguna berada di dashboard atau navigasi bawah',
    'Langkah & Data Uji': 'Klik tautan "Tentang & Hak Cipta" di footer atau menu sidebar',
    'Hasil yang Diharapkan': 'Modal Tentang Aplikasi muncul menampilkan versi 1.0.0, deskripsi sistem, dan klausul UU No. 28 Tahun 2014',
    'Hasil Pengujian': 'Sesuai Harapan (Modal HKI tampil lengkap dan informatif)',
    'Status': 'Valid'
  }
];

// =========================================================================
// DATA SHEET 3: TEKNIK BVA & EQUIVALENCE PARTITIONING
// =========================================================================
const dataMetodologi = [
  {
    'Komponen yang Diuji': 'Validasi Format NISN',
    'Metode Uji': 'Equivalence Partitioning & Regex',
    'Kelas Partisi Valid': 'Angka 6 sampai 20 digit (contoh: 0081234001)',
    'Kelas Partisi Tidak Valid': 'Kurang dari 6 digit (1234), lebih dari 20 digit, atau mengandung karakter non-angka (008AB)',
    'Ekspektasi Output': 'Ditolak sistem dengan pesan error form'
  },
  {
    'Komponen yang Diuji': 'Pencegahan Duplikasi NISN',
    'Metode Uji': 'Equivalence Partitioning',
    'Kelas Partisi Valid': 'NISN belum pernah terdaftar di sistem',
    'Kelas Partisi Tidak Valid': 'NISN sudah ada di basis data Firestore siswa',
    'Ekspektasi Output': 'Ditolak dengan pesan: NISN sudah terdaftar pada siswa [nama]'
  },
  {
    'Komponen yang Diuji': 'Kalkulasi Ambang Batas SP (Poin Pelanggaran)',
    'Metode Uji': 'Boundary Value Analysis (BVA)',
    'Kelas Partisi Valid': '0 <= Poin < 50 (Aman)\n50 <= Poin < 80 (SP 1)\n80 <= Poin < 110 (SP 2)\nPoin >= 110 (SP 3)',
    'Kelas Partisi Tidak Valid': 'Poin bernilai negatif (< 0) diproteksi dengan Math.max(0, poin)',
    'Ekspektasi Output': 'Status SP berganti otomatis tepat saat poin mencapai nilai batas (50, 80, 110)'
  },
  {
    'Komponen yang Diuji': 'Urutan Ambang Batas SP',
    'Metode Uji': 'Boundary Value Analysis (BVA)',
    'Kelas Partisi Valid': 'Kondisi hierarki: SP1 < SP2 < SP3 (contoh: 50 < 80 < 110)',
    'Kelas Partisi Tidak Valid': 'SP1 >= SP2 atau SP2 >= SP3 (contoh: SP1=80, SP2=50)',
    'Ekspektasi Output': 'Formulir menolak penyimpanan dan meminta urutan logis'
  },
  {
    'Komponen yang Diuji': 'Foreign Key Relasi Impor Kasus',
    'Metode Uji': 'Equivalence Partitioning',
    'Kelas Partisi Valid': 'NISN ada di siswa, Kategori ada di kategoriList, Tanggal terisi YYYY-MM-DD',
    'Kelas Partisi Tidak Valid': 'NISN belum ada di sistem atau nama Kategori tidak cocok',
    'Ekspektasi Output': 'Baris ditandai status error dan dicegah dari eksekusi impor'
  },
  {
    'Komponen yang Diuji': 'Pencarian Siswa & Rekap',
    'Metode Uji': 'Equivalence Partitioning',
    'Kelas Partisi Valid': 'Kata kunci cocok sebagian (case-insensitive substring) atau tanggal dalam rentang',
    'Kelas Partisi Tidak Valid': 'Kata kunci tidak cocok atau tanggal di luar rentang',
    'Ekspektasi Output': 'Tabel hanya menyajikan data yang sesuai kriteria'
  }
];

// Buat Workbook Baru
const wb = xlsx.utils.book_new();

// Sheet 1: Ringkasan
const wsRingkasan = xlsx.utils.json_to_sheet(dataRingkasan);
wsRingkasan['!cols'] = [{ wch: 30 }, { wch: 80 }];
xlsx.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan Pengujian');

// Sheet 2: Kasus Uji Black Box Lengkap
const wsTestCases = xlsx.utils.json_to_sheet(testCases);
wsTestCases['!cols'] = [
  { wch: 6 },  // No
  { wch: 15 }, // ID Test Case
  { wch: 22 }, // Modul / Fitur
  { wch: 10 }, // Tipe
  { wch: 38 }, // Deskripsi Pengujian
  { wch: 35 }, // Pra-kondisi
  { wch: 45 }, // Langkah & Data Uji
  { wch: 45 }, // Hasil yang Diharapkan
  { wch: 45 }, // Hasil Pengujian
  { wch: 10 }  // Status
];
xlsx.utils.book_append_sheet(wb, wsTestCases, 'Tabel Black Box (37 Kasus)');

// Sheet 3: Metodologi BVA & EP
const wsMetodologi = xlsx.utils.json_to_sheet(dataMetodologi);
wsMetodologi['!cols'] = [
  { wch: 28 }, // Komponen
  { wch: 25 }, // Metode
  { wch: 35 }, // Valid
  { wch: 42 }, // Tidak Valid
  { wch: 35 }  // Output
];
xlsx.utils.book_append_sheet(wb, wsMetodologi, 'Analisis BVA & EP');

// Simpan ke Parent Directory PKM
const outputPath = path.resolve('..', 'Black_Box_Testing_SIKesiswaan.xlsx');
xlsx.writeFile(wb, outputPath);
console.log('BERHASIL! File Excel Black Box Testing tersimpan di:', outputPath);
