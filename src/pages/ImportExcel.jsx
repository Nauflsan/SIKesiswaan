/**
 * =============================================================================
 * KOMPONEN: ImportExcel (Import Massal Siswa & Kasus via Excel)
 * =============================================================================
 * Memproses data tabular spreadsheet (.xlsx / .xls) langsung di browser klien
 * menggunakan pustaka SheetJS (xlsx) tanpa membebani server.
 *
 * FITUR UTAMA & LOGIKA BISNIS:
 * 1. Unduh Template Otomatis:
 *    - Membuat file Excel dinamis on-the-fly untuk template Siswa maupun Kasus.
 * 2. Client-Side Parsing (ArrayBuffer):
 *    - Membaca file binary spreadsheet menjadi objek JSON JavaScript murni.
 * 3. Mesin Validasi Pra-Impor (Pre-Import Validation Engine):
 *    - Mode Siswa:
 *        * Validasi NISN numerik fleksibel (6-20 digit).
 *        * Pengecekan duplikasi: Menandai 'new' jika NISN baru, atau 'update' jika NISN sudah ada.
 *    - Mode Kasus:
 *        * Memvalidasi apakah NISN terdaftar di database siswa.
 *        * Mencocokkan nama kategori pelanggaran dengan master kategori yang aktif.
 * 4. Eksekusi Batch Transaksional:
 *    - Menyaring hanya baris yang valid (status !== 'error') untuk disimpan ke database.
 * =============================================================================
 */

import { useState, useEffect } from 'preact/hooks';
import AppLayout from '../components/layout/AppLayout.jsx';
import { siswaService, kategoriService, kasusService, kelasService } from '../services/index.js';
import { friendlyError } from '../lib/errors.js';
import { useAuthStore } from '../stores/authStore.js';
import { useUIStore } from '../stores/uiStore.js';
import {
  UploadCloud,
  Download,
  FileCheck
} from 'lucide-preact';

export default function ImportExcel() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  // State mode impor: 'siswa' atau 'kasus'
  const [mode, setMode] = useState('siswa');
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [existingSiswa, setExistingSiswa] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);

  useEffect(() => {
    loadPrerequisites();
  }, []);

  /**
   * Mengambil data master siswa & kategori untuk keperluan verifikasi/validasi baris Excel.
   * Tetap memakai getAll() karena operasi import ini langka dan butuh seluruh data untuk validasi duplikasi NISN.
   */
  async function loadPrerequisites() {
    try {
      // Membaca seluruh data siswa untuk validasi duplikasi NISN lokal saat upload Excel
      const [siswaData, katData] = await Promise.all([
        siswaService.getAll(),
        kategoriService.getAll()
      ]);
      setExistingSiswa(siswaData);
      setKategoriList(katData);
    } catch (err) {
      showToast(friendlyError(err, 'Gagal memuat data awal'), 'error');
    }
  }

  /**
   * Menghasilkan dan mengunduh file template .xlsx contoh secara instan di browser
   */
  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      if (mode === 'siswa') {
        const sampleData = [
          { NISN: '0089990001', Nama: 'Ahmad Fauzan', Kelas: 'XI TKJ 1', Jurusan: 'Teknik Komputer dan Jaringan', Angkatan: 2024 },
          { NISN: '0089990002', Nama: 'Budi Santoso', Kelas: 'X TKR 1', Jurusan: 'Teknik Kendaraan Ringan', Angkatan: 2025 },
          { NISN: '0089990003', Nama: 'Citra Dewi', Kelas: 'XII TKR 1', Jurusan: 'Teknik Kendaraan Ringan', Angkatan: 2023 }
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');
        XLSX.writeFile(wb, 'Template_Data_Siswa_SIKesiswaan.xlsx');
      } else {
        const sampleData = [
          { NISN: '0081234561', Kategori: 'Terlambat Masuk (> 15 menit)', Tanggal: '2026-09-18', Deskripsi: 'Terlambat 20 menit' },
          { NISN: '0081234562', Kategori: 'Bolos Jam Pelajaran', Tanggal: '2026-09-18', Deskripsi: 'Meninggalkan jam olahraga' }
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        XLSX.utils.book_append_sheet(wb, ws, 'Template Kasus');
        XLSX.writeFile(wb, 'Template_Data_Kasus_SIKesiswaan.xlsx');
      }
      showToast('Template Excel berhasil diunduh', 'success');
    } catch (err) {
      showToast('Gagal mengunduh template: ' + err.message, 'error');
    }
  };

  /**
   * Handler pembacaan & validasi file Excel yang diunggah
   */
  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setParsing(true);

    try {
      const XLSX = await import('xlsx');
      const buffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rawJson.length === 0) {
        showToast('File Excel kosong atau tidak terbaca', 'error');
        setParsedRows([]);
        return;
      }

      // Validasi Baris demi Baris secara cerdas
      if (mode === 'siswa') {
        const validated = rawJson.map((row, idx) => {
          const errors = [];
          const nisn = String(row['NISN'] || '').trim();
          const nama = String(row['Nama'] || '').trim();
          const kelas = String(row['Kelas'] || '').trim();

          if (!nisn) errors.push('NISN wajib diisi');
          else if (!/^\d{6,20}$/.test(nisn)) errors.push('NISN harus berupa angka (6-20 digit)');
          if (!nama) errors.push('Nama wajib diisi');
          if (!kelas) errors.push('Kelas wajib diisi');

          // Cek apakah siswa dengan NISN ini sudah terdaftar sebelumnya
          const isExisting = existingSiswa.some(s => s.nisn === nisn);

          return {
            rowNum: idx + 2, // Indeks baris Excel (header = baris 1)
            data: {
              nisn,
              nama,
              kelas,
              jurusan: String(row['Jurusan'] || '').trim() || 'Umum',
              angkatan: Number(row['Angkatan']) || new Date().getFullYear()
            },
            status: errors.length > 0 ? 'error' : isExisting ? 'update' : 'new',
            errors
          };
        });
        setParsedRows(validated);
      } else {
        const validated = rawJson.map((row, idx) => {
          const errors = [];
          const nisn = String(row['NISN'] || '').trim();
          const kategoriStr = String(row['Kategori'] || '').trim();
          const tanggal = String(row['Tanggal'] || '').trim();

          // Verifikasi relasi foreign key ke siswa
          const matchedSiswa = existingSiswa.find(s => s.nisn === nisn);
          if (!nisn) errors.push('NISN wajib diisi');
          else if (!matchedSiswa) errors.push(`NISN ${nisn} tidak terdaftar di sistem`);

          // Verifikasi relasi ke kategori pelanggaran
          const matchedKategori = kategoriList.find(k => k.nama.toLowerCase() === kategoriStr.toLowerCase());
          if (!kategoriStr) errors.push('Kategori wajib diisi');
          else if (!matchedKategori) errors.push(`Kategori "${kategoriStr}" tidak cocok`);

          if (!tanggal) errors.push('Tanggal wajib diisi');

          return {
            rowNum: idx + 2,
            data: {
              siswaId: matchedSiswa?.id,
              siswaNama: matchedSiswa?.nama,
              siswaKelas: matchedSiswa?.kelas,
              nisn,
              kategoriId: matchedKategori?.id,
              kategoriNama: matchedKategori?.nama,
              poin: matchedKategori?.poin || 0,
              tanggal,
              deskripsi: String(row['Deskripsi'] || '').trim()
            },
            status: errors.length > 0 ? 'error' : 'new',
            errors
          };
        });
        setParsedRows(validated);
      }
      showToast(`${rawJson.length} baris berhasil diproses dari Excel`, 'info');
    } catch (err) {
      showToast('Gagal membaca file Excel: ' + err.message, 'error');
    } finally {
      setParsing(false);
    }
  };

  /**
   * Eksekusi impor batch ke database:
   * Hanya baris yang lolos validasi (bukan error) yang akan diproses.
   */
  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.status !== 'error');
    if (validRows.length === 0) {
      showToast('Tidak ada data valid yang dapat diimpor', 'error');
      return;
    }

    setImporting(true);
    try {
      if (mode === 'siswa') {
        const payload = validRows.map(r => r.data);
        const res = await siswaService.importBatch(payload, user);

        // Ekstrak dan normalisasi kelas unik dari payload untuk didaftarkan ke meta/kelas
        const kelasUnik = Array.from(
          new Set(
            payload
              .map(p => String(p.kelas ?? '').trim().replace(/\s+/g, ' '))
              .filter(Boolean)
          )
        );

        if (kelasUnik.length > 0) {
          try {
            await kelasService.addMany(kelasUnik);
          } catch {
            // Impor batch sudah sukses; kegagalan mendaftarkan kelas ke meta tidak membatalkan proses
          }
        }

        showToast(`Berhasil mengimpor ${res.imported} siswa baru dan memperbarui ${res.updated} siswa!`, 'success');
      } else {
        for (const row of validRows) {
          await kasusService.create(row.data, user);
        }
        showToast(`Berhasil mengimpor ${validRows.length} data kasus ke dalam sistem!`, 'success');
      }
      // Reset state
      setFile(null);
      setParsedRows([]);
      loadPrerequisites();
    } catch (err) {
      showToast(err.message || 'Gagal melakukan proses impor', 'error');
    } finally {
      setImporting(false);
    }
  };

  const errorCount = parsedRows.filter(r => r.status === 'error').length;
  const newCount = parsedRows.filter(r => r.status === 'new').length;
  const updateCount = parsedRows.filter(r => r.status === 'update').length;

  return (
    <AppLayout
      title="Import Data Excel (.xlsx)"
      subtitle="Unggah dan impor data massal siswa atau riwayat kasus secara otomatis"
    >
      {/* Mode Selector Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-6">
        <button
          onClick={() => { setMode('siswa'); setFile(null); setParsedRows([]); }}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            mode === 'siswa'
              ? 'border-[#4A6FA5] text-[#4A6FA5]'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          1. Import Master Data Siswa
        </button>
        <button
          onClick={() => { setMode('kasus'); setFile(null); setParsedRows([]); }}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            mode === 'kasus'
              ? 'border-[#4A6FA5] text-[#4A6FA5]'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          2. Import Rekam Kasus Pelanggaran
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Upload Box */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold font-heading text-gray-900">
                Pilih File Spreadsheet
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Format file yang didukung: .xlsx, .xls</p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-semibold border border-emerald-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Template Format</span>
            </button>
          </div>

          {/* Drag & Drop Area */}
          <label className="border-2 border-dashed border-gray-300 hover:border-[#4A6FA5] rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-gray-50/50 hover:bg-blue-50/20 block">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <UploadCloud className="w-12 h-12 text-gray-400 mb-2" />
            <span className="text-sm font-bold text-gray-700 block">
              {parsing ? 'Membaca file...' : file ? file.name : 'Klik untuk memilih file Excel'}
            </span>
            <span className="text-xs text-gray-400 mt-1 block">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Atau seret dan lepas file ke area ini'}
            </span>
          </label>
        </div>

        {/* Info & Validation Summary */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              Ringkasan Validasi
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between p-2.5 bg-gray-50 rounded-xl">
                <span className="text-gray-500">Total Baris:</span>
                <span className="font-bold text-gray-900">{parsedRows.length}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-emerald-50 text-emerald-800 rounded-xl">
                <span>Data Baru Siap Tambah:</span>
                <span className="font-bold">{newCount}</span>
              </div>
              {mode === 'siswa' && (
                <div className="flex justify-between p-2.5 bg-amber-50 text-amber-800 rounded-xl">
                  <span>Data Duplikat (Akan Update):</span>
                  <span className="font-bold">{updateCount}</span>
                </div>
              )}
              <div className="flex justify-between p-2.5 bg-rose-50 text-rose-800 rounded-xl">
                <span>Baris Error (Dilewati):</span>
                <span className="font-bold">{errorCount}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={importing || parsedRows.length === 0 || parsedRows.length === errorCount}
            className="w-full mt-4 py-2.5 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <FileCheck className="w-4 h-4" />
            <span>{importing ? 'Sedang Memproses...' : `Impor ${parsedRows.length - errorCount} Data Valid`}</span>
          </button>
        </div>
      </div>

      {/* Preview Table */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-900">
              Pratinjau Data Sebelum Impor
            </h4>
            <span className="text-xs text-gray-400">
              Baris dengan tanda merah tidak akan dimasukkan ke database
            </span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                <tr className="text-gray-500 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-4">Baris</th>
                  <th className="py-2.5 px-4">Status</th>
                  {mode === 'siswa' ? (
                    <>
                      <th className="py-2.5 px-4">NISN</th>
                      <th className="py-2.5 px-4">Nama Siswa</th>
                      <th className="py-2.5 px-4">Kelas</th>
                      <th className="py-2.5 px-4">Jurusan</th>
                    </>
                  ) : (
                    <>
                      <th className="py-2.5 px-4">NISN</th>
                      <th className="py-2.5 px-4">Nama Siswa</th>
                      <th className="py-2.5 px-4">Kategori Pelanggaran</th>
                      <th className="py-2.5 px-4">Tanggal</th>
                    </>
                  )}
                  <th className="py-2.5 px-4">Keterangan / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedRows.map((row) => (
                  <tr
                    key={row.rowNum}
                    className={`transition-colors ${
                      row.status === 'error'
                        ? 'bg-rose-50/60 text-rose-900'
                        : row.status === 'update'
                        ? 'bg-amber-50/40 text-amber-900'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono text-gray-400 font-bold">
                      #{row.rowNum}
                    </td>
                    <td className="py-2.5 px-4">
                      {row.status === 'error' ? (
                        <span className="px-2 py-0.5 bg-rose-200 text-rose-800 rounded font-bold text-[10px]">
                          Error
                        </span>
                      ) : row.status === 'update' ? (
                        <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded font-bold text-[10px]">
                          Update
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                          Baru
                        </span>
                      )}
                    </td>
                    {mode === 'siswa' ? (
                      <>
                        <td className="py-2.5 px-4 font-mono font-medium">{row.data.nisn}</td>
                        <td className="py-2.5 px-4 font-bold">{row.data.nama}</td>
                        <td className="py-2.5 px-4">{row.data.kelas}</td>
                        <td className="py-2.5 px-4 text-gray-500">{row.data.jurusan}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 px-4 font-mono">{row.data.nisn}</td>
                        <td className="py-2.5 px-4 font-bold">{row.data.siswaNama || '-'}</td>
                        <td className="py-2.5 px-4">{row.data.kategoriNama || '-'}</td>
                        <td className="py-2.5 px-4 text-gray-500">{row.data.tanggal}</td>
                      </>
                    )}
                    <td className="py-2.5 px-4">
                      {row.errors.length > 0 ? (
                        <span className="text-rose-600 font-semibold">{row.errors.join(', ')}</span>
                      ) : row.status === 'update' ? (
                        <span className="text-amber-700">Memperbarui data siswa lama</span>
                      ) : (
                        <span className="text-emerald-700">Valid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
