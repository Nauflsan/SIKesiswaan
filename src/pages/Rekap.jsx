/**
 * ============================================================================
 * HALAMAN: REKAPITULASI PELANGGARAN & EKSPOR LAPORAN (src/pages/Rekap.jsx)
 * ============================================================================
 * Fitur analisis periodik dan pelaporan ketertiban siswa:
 * 1. Filter periode fleksibel (Bulan Ini, Semester Ganjil, Semester Genap, Tahun Ajaran, Kustom)
 *    yang dihitung dinamis berdasarkan konfigurasi bulanMulaiTahunAjaran.
 * 2. Query Firestore hemat kuota (getByPeriode) yang HANYA membaca kasus pada rentang waktu terpilih.
 * 3. Filter kelas, kategori, status kasus, dan pencarian instan di memori (useMemo) tanpa kuota tambahan.
 * 4. Empat Kartu Statistik Ringkasan Periode.
 * 5. Dua Mode Tampilan: Detail Kronologis Kasus vs Rekapitulasi per Siswa.
 * 6. Ekspor Excel multi-sheet (.xlsx) dengan dynamic import SheetJS (0 KB initial load).
 * 7. Cetak Laporan Resmi A4 lengkap dengan Kop Surat Sekolah & Lembar Tanda Tangan Kedinasan.
 */

import { useState, useEffect, useMemo } from 'preact/hooks';
import AppLayout from '../components/layout/AppLayout.jsx';
import Modal from '../components/ui/Modal.jsx';
import CreatableCombobox from '../components/ui/CreatableCombobox.jsx';
import LoadError from '../components/ui/LoadError.jsx';
import { KasusStatusBadge, PoinBadge } from '../components/ui/Badge.jsx';
import { kasusService, kategoriService, settingsService } from '../services/index.js';
import {
  formatTanggal,
  getRentangPeriodePreset
} from '../lib/helpers.js';
import { friendlyError } from '../lib/errors.js';
import { useAuthStore } from '../stores/authStore.js';
import { useUIStore } from '../stores/uiStore.js';
import {
  Calendar,
  Filter,
  Printer,
  Search,
  FileSpreadsheet,
  Users,
  AlertTriangle,
  TrendingUp,
  Clock,
  Layers,
  RefreshCw,
  FileText
} from 'lucide-preact';

export default function Rekap() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  // State konfigurasi & master data
  const [settings, setSettings] = useState({});
  const [kategoriList, setKategoriList] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  // State Periode Tanggal
  const [preset, setPreset] = useState('semester_ganjil');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');

  // State Data Mentah Kasus (Hasil query Firestore rentang tanggal)
  const [rawKasusList, setRawKasusList] = useState([]);

  // State Filter In-Memory
  const [selectedKelas, setSelectedKelas] = useState('semua');
  const [selectedKategori, setSelectedKategori] = useState('semua');
  const [selectedStatus, setSelectedStatus] = useState('semua');
  const [search, setSearch] = useState('');

  // State Tampilan & Modal
  const [viewTab, setViewTab] = useState('detail'); // 'detail' | 'siswa'
  const [showPrintModal, setShowPrintModal] = useState(false);

  /**
   * Muat pengaturan sekolah & kategori saat halaman dibuka perdana
   */
  useEffect(() => {
    initPage();
  }, []);

  async function initPage() {
    setLoadingInitial(true);
    setLoadError(null);
    try {
      const [settingsData, katData] = await Promise.all([
        settingsService.get(),
        kategoriService.getAll()
      ]);
      setSettings(settingsData);
      setKategoriList(katData);

      // Hitung tanggal awal berdasarkan bulan mulai tahun ajaran
      const bulanMulai = settingsData.bulanMulaiTahunAjaran || 7;
      const initialRange = getRentangPeriodePreset('semester_ganjil', bulanMulai);
      setTanggalMulai(initialRange.tanggalMulai);
      setTanggalSelesai(initialRange.tanggalSelesai);

      // Ambil data perdana untuk periode tersebut
      await loadKasusByDate(initialRange.tanggalMulai, initialRange.tanggalSelesai);
    } catch (err) {
      const msg = friendlyError(err, 'Gagal memuat data awal rekapitulasi');
      setLoadError(msg);
      showToast(msg, 'error');
    } finally {
      setLoadingInitial(false);
    }
  }

  /**
   * Mengambil data kasus dari Firestore berdasarkan rentang tanggal
   */
  async function loadKasusByDate(start, end) {
    if (!start || !end) {
      showToast('Harap tentukan tanggal mulai dan tanggal selesai', 'error');
      return;
    }
    if (start > end) {
      showToast('Tanggal mulai tidak boleh melebihi tanggal selesai', 'error');
      return;
    }

    setFetching(true);
    try {
      const data = await kasusService.getByPeriode({
        tanggalMulai: start,
        tanggalSelesai: end
      });
      setRawKasusList(data);
    } catch (err) {
      const msg = friendlyError(err, 'Gagal mengambil data kasus untuk periode ini');
      showToast(msg, 'error');
    } finally {
      setFetching(false);
    }
  }

  /**
   * Handler perubahan preset periode (Bulan ini, Semester, dll.)
   */
  const handlePresetChange = (newPreset) => {
    setPreset(newPreset);
    if (newPreset === 'custom') return;

    const bulanMulai = settings.bulanMulaiTahunAjaran || 7;
    const range = getRentangPeriodePreset(newPreset, bulanMulai);
    setTanggalMulai(range.tanggalMulai);
    setTanggalSelesai(range.tanggalSelesai);
    loadKasusByDate(range.tanggalMulai, range.tanggalSelesai);
  };

  /**
   * Submit manual untuk filter tanggal kustom
   */
  const handleApplyCustomFilter = (e) => {
    e.preventDefault();
    loadKasusByDate(tanggalMulai, tanggalSelesai);
  };

  // Daftar kelas unik dari dataset kasus yang ditarik
  const distinctKelas = useMemo(() => {
    const list = new Set([
      'X TKJ 1', 'X TKJ 2', 'X TKR 1', 'X TKR 2',
      'XI TKJ 1', 'XI TKJ 2', 'XI TKR 1', 'XI TKR 2',
      'XII TKJ 1', 'XII TKJ 2', 'XII TKR 1', 'XII TKR 2',
      ...rawKasusList.map(k => k.siswaKelas).filter(Boolean)
    ]);
    return Array.from(list).sort();
  }, [rawKasusList]);

  // Filter in-memory: tidak melakukan pembacaan Firestore tambahan
  const filteredKasus = useMemo(() => {
    let list = rawKasusList;

    if (selectedKelas !== 'semua') {
      list = list.filter(k => k.siswaKelas === selectedKelas);
    }
    if (selectedKategori !== 'semua') {
      list = list.filter(k => k.kategoriId === selectedKategori);
    }
    if (selectedStatus !== 'semua') {
      list = list.filter(k => k.status === selectedStatus);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(k =>
        (k.siswaNama && k.siswaNama.toLowerCase().includes(q)) ||
        (k.siswaNisn && k.siswaNisn.includes(q)) ||
        (k.kategoriNama && k.kategoriNama.toLowerCase().includes(q)) ||
        (k.deskripsi && k.deskripsi.toLowerCase().includes(q))
      );
    }

    return list;
  }, [rawKasusList, selectedKelas, selectedKategori, selectedStatus, search]);

  // Statistik Ringkasan Periode
  const stats = useMemo(() => {
    const totalKasus = filteredKasus.length;
    const totalPoin = filteredKasus.reduce((sum, k) => sum + (Number(k.poin) || 0), 0);

    // Kategori terbanyak
    const katCount = {};
    filteredKasus.forEach(k => {
      const name = k.kategoriNama || 'Lainnya';
      katCount[name] = (katCount[name] || 0) + 1;
    });
    let topKatNama = '-';
    let topKatCount = 0;
    Object.entries(katCount).forEach(([name, count]) => {
      if (count > topKatCount) {
        topKatCount = count;
        topKatNama = name;
      }
    });

    // Siswa dengan kasus terbanyak
    const siswaCount = {};
    filteredKasus.forEach(k => {
      const key = k.siswaId || k.siswaNama;
      if (!siswaCount[key]) {
        siswaCount[key] = {
          nama: k.siswaNama,
          kelas: k.siswaKelas,
          count: 0,
          poin: 0
        };
      }
      siswaCount[key].count += 1;
      siswaCount[key].poin += Number(k.poin) || 0;
    });
    let topSiswa = null;
    let maxSiswaKasus = 0;
    Object.values(siswaCount).forEach(item => {
      if (item.count > maxSiswaKasus) {
        maxSiswaKasus = item.count;
        topSiswa = item;
      }
    });

    return {
      totalKasus,
      totalPoin,
      topKatNama: topKatCount > 0 ? `${topKatNama} (${topKatCount}x)` : '-',
      topSiswa: topSiswa ? `${topSiswa.nama} (${topSiswa.kelas} - ${topSiswa.count} kasus)` : '-'
    };
  }, [filteredKasus]);

  // Rekapitulasi per Siswa (Grouped)
  const rekapSiswaList = useMemo(() => {
    const map = new Map();
    filteredKasus.forEach(k => {
      const id = k.siswaId || `${k.siswaNisn}_${k.siswaNama}`;
      if (!map.has(id)) {
        map.set(id, {
          siswaId: k.siswaId,
          nama: k.siswaNama || '-',
          nisn: k.siswaNisn || '-',
          kelas: k.siswaKelas || '-',
          jumlahKasus: 0,
          totalPoin: 0,
          kasusTerakhir: k.tanggal
        });
      }
      const item = map.get(id);
      item.jumlahKasus += 1;
      item.totalPoin += Number(k.poin) || 0;
      if (k.tanggal > item.kasusTerakhir) {
        item.kasusTerakhir = k.tanggal;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalPoin - a.totalPoin || b.jumlahKasus - a.jumlahKasus);
  }, [filteredKasus]);

  /**
   * Ekspor data ke format Excel (.xlsx) menggunakan dynamic import SheetJS
   */
  const handleExportExcel = async () => {
    if (filteredKasus.length === 0) {
      showToast('Tidak ada data kasus pada periode ini untuk diekspor', 'warning');
      return;
    }

    setExportingExcel(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Sheet 1: Detail Kronologis Kasus
      const rowsDetail = filteredKasus.map((k, idx) => ({
        'No': idx + 1,
        'Tanggal': k.tanggal,
        'NISN': k.siswaNisn || '-',
        'Nama Siswa': k.siswaNama || '-',
        'Kelas': k.siswaKelas || '-',
        'Kategori Pelanggaran': k.kategoriNama || '-',
        'Poin': Number(k.poin) || 0,
        'Deskripsi / Catatan': k.deskripsi || '-',
        'Status Penanganan': k.status === 'selesai' ? 'Selesai' : k.status === 'ditangani' ? 'Sedang Ditangani' : 'Baru',
        'Guru Pencatat': k.createdByNama || '-'
      }));
      const wsDetail = XLSX.utils.json_to_sheet(rowsDetail);
      wsDetail['!cols'] = [
        { wch: 5 }, { wch: 12 }, { wch: 14 }, { wch: 25 }, { wch: 12 },
        { wch: 30 }, { wch: 8 }, { wch: 35 }, { wch: 18 }, { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Pelanggaran');

      // Sheet 2: Rekapitulasi per Siswa
      const rowsSiswa = rekapSiswaList.map((s, idx) => ({
        'No': idx + 1,
        'NISN': s.nisn,
        'Nama Siswa': s.nama,
        'Kelas': s.kelas,
        'Jumlah Pelanggaran': s.jumlahKasus,
        'Total Poin Periode Ini': s.totalPoin,
        'Tanggal Pelanggaran Terakhir': s.kasusTerakhir
      }));
      const wsSiswa = XLSX.utils.json_to_sheet(rowsSiswa);
      wsSiswa['!cols'] = [
        { wch: 5 }, { wch: 14 }, { wch: 25 }, { wch: 12 },
        { wch: 20 }, { wch: 22 }, { wch: 22 }
      ];
      XLSX.utils.book_append_sheet(wb, wsSiswa, 'Rekap per Siswa');

      // Unduh File
      const filename = `Laporan_Pelanggaran_${tanggalMulai}_sd_${tanggalSelesai}.xlsx`;
      XLSX.writeFile(wb, filename);
      showToast('Laporan Excel berhasil diunduh', 'success');
    } catch (err) {
      showToast('Gagal mengekspor spreadsheet: ' + err.message, 'error');
    } finally {
      setExportingExcel(false);
    }
  };

  /**
   * Handler print dokumen A4
   */
  const handlePrint = () => {
    window.print();
  };

  return (
    <AppLayout
      title="Rekapitulasi & Laporan"
      subtitle="Analisis periodik ketertiban siswa, cetak lembar rekapitulasi resmi, dan ekspor spreadsheet"
    >
      {/* FILTER PERIODE UTAMA (FIRESTORE QUERY TRIGGER) */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200/80 mb-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#4A6FA5]" />
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider font-heading">
              Pilihan Periode Laporan
            </span>
          </div>

          {/* Shortcut Presets */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { id: 'bulan_ini', label: 'Bulan Ini' },
              { id: 'semester_ganjil', label: 'Semester Ganjil' },
              { id: 'semester_genap', label: 'Semester Genap' },
              { id: 'tahun_ajaran_ini', label: 'Tahun Ajaran Penuh' },
              { id: 'custom', label: 'Kustom Tanggal' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetChange(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  preset === p.id
                    ? 'bg-[#4A6FA5] text-white shadow-xs'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Inputs & Submit Action */}
        <form onSubmit={handleApplyCustomFilter} className="flex flex-wrap items-end gap-3 pt-1">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
              Dari Tanggal
            </label>
            <input
              type="date"
              value={tanggalMulai}
              onChange={(e) => {
                setTanggalMulai(e.target.value);
                setPreset('custom');
              }}
              required
              className="w-full text-xs py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#4A6FA5]"
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={tanggalSelesai}
              onChange={(e) => {
                setTanggalSelesai(e.target.value);
                setPreset('custom');
              }}
              required
              className="w-full text-xs py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#4A6FA5]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={fetching}
              className="flex items-center gap-2 px-4 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} />
              <span>{fetching ? 'Memuat...' : 'Tampilkan Rekap'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              disabled={filteredKasus.length === 0}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-3.5 h-3.5 text-gray-600" />
              <span>Cetak A4</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredKasus.length === 0 || exportingExcel}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{exportingExcel ? 'Mengekspor...' : 'Ekspor Excel'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 4 STAT CARDS SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-[#4A6FA5] rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Total Pelanggaran
            </span>
            <span className="text-xl font-black text-gray-900 font-heading">
              {stats.totalKasus} <span className="text-xs font-normal text-gray-500">Kasus</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Akumulasi Poin
            </span>
            <span className="text-xl font-black text-amber-900 font-heading">
              +{stats.totalPoin} <span className="text-xs font-normal text-gray-500">Poin</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-purple-50 text-purple-700 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Kategori Terbanyak
            </span>
            <span className="text-xs font-bold text-gray-900 truncate block">
              {stats.topKatNama}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-700 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Kasus Terbanyak
            </span>
            <span className="text-xs font-bold text-gray-900 truncate block">
              {stats.topSiswa}
            </span>
          </div>
        </div>
      </div>

      {/* FILTER IN-MEMORY & TABS */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 mb-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Tabs View Mode */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewTab('detail')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewTab === 'detail'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Detail Kronologis ({filteredKasus.length})</span>
            </button>
            <button
              onClick={() => setViewTab('siswa')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewTab === 'siswa'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Rekap per Siswa ({rekapSiswaList.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari siswa, NISN, atau keterangan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#4A6FA5]"
            />
          </div>
        </div>

        {/* Sub-Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs">
          <div className="flex items-center gap-1.5 text-gray-400 font-semibold pr-2 border-r border-gray-200">
            <Filter className="w-3 h-3" />
            <span>Saring:</span>
          </div>

          <CreatableCombobox
            value={selectedKelas}
            onChange={setSelectedKelas}
            options={distinctKelas}
            allOptionLabel="Semua Kelas"
            allOptionValue="semua"
            variant="pill"
          />

          <CreatableCombobox
            value={selectedKategori}
            onChange={setSelectedKategori}
            options={kategoriList.map(k => ({ value: k.id, label: k.nama }))}
            allOptionLabel="Semua Kategori"
            allOptionValue="semua"
            variant="pill"
          />

          <CreatableCombobox
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={[
              { value: 'baru', label: 'Baru' },
              { value: 'ditangani', label: 'Sedang Ditangani' },
              { value: 'selesai', label: 'Selesai' }
            ]}
            allOptionLabel="Semua Status"
            allOptionValue="semua"
            variant="pill"
          />
        </div>
      </div>

      {/* TABEL DATA HASIL */}
      <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-xs">
        {loadingInitial || fetching ? (
          <div className="py-16 text-center text-gray-400">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-[#4A6FA5]" />
            <p className="text-xs">Mengambil data rekapitulasi dari database...</p>
          </div>
        ) : loadError ? (
          <div className="p-8">
            <LoadError message={loadError} onRetry={() => loadKasusByDate(tanggalMulai, tanggalSelesai)} />
          </div>
        ) : filteredKasus.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700">Tidak ada data pelanggaran</p>
            <p className="text-xs text-gray-400 mt-1">
              Tidak ada catatan kasus pada rentang {formatTanggal(tanggalMulai)} s/d {formatTanggal(tanggalSelesai)} dengan filter terpilih.
            </p>
          </div>
        ) : viewTab === 'detail' ? (
          /* TABEL DETAIL KRONOLOGIS */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Siswa</th>
                  <th className="py-3 px-4">Bentuk Pelanggaran</th>
                  <th className="py-3 px-4 text-center">Poin</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredKasus.map((k, idx) => (
                  <tr key={k.id || idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-4 text-center text-gray-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-medium text-gray-800 whitespace-nowrap">
                      {formatTanggal(k.tanggal)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{k.siswaNama}</div>
                      <div className="text-[11px] text-gray-500">
                        {k.siswaKelas} • NISN: {k.siswaNisn}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-gray-800">{k.kategoriNama}</span>
                      {k.deskripsi && (
                        <p className="text-[11px] text-gray-500 line-clamp-1 italic mt-0.5">
                          "{k.deskripsi}"
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <PoinBadge poin={k.poin} />
                    </td>
                    <td className="py-3 px-4">
                      <KasusStatusBadge status={k.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-[11px] whitespace-nowrap">
                      {k.createdByNama || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* TABEL REKAPITULASI PER SISWA */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">NISN</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4 text-center">Jumlah Kasus</th>
                  <th className="py-3 px-4 text-center">Poin Periode Ini</th>
                  <th className="py-3 px-4">Kasus Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rekapSiswaList.map((s, idx) => (
                  <tr key={s.siswaId || idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-4 text-center text-gray-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-gray-900">
                      {s.nama}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-600">{s.nisn}</td>
                    <td className="py-3 px-4 font-medium text-gray-800">{s.kelas}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
                        {s.jumlahKasus}x
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <PoinBadge poin={s.totalPoin} />
                    </td>
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                      {formatTanggal(s.kasusTerakhir)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL PRATINJAU CETAK LAPORAN RESMI (A4)                                  */}
      {/* ========================================================================= */}
      {showPrintModal && (
        <Modal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          title="Pratinjau Lembar Cetak Laporan Resmi"
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 no-print">
              <p className="text-xs text-gray-500">
                Laporan siap dicetak pada kertas A4 standar dengan kop dinas resmi.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Sekarang</span>
                </button>
              </div>
            </div>

            {/* AREA DOKUMEN CETAK RESMI */}
            <div
              id="printable-rekap-content"
              className="surat-resmi bg-white text-black p-8 sm:p-12 border border-gray-300 shadow-md rounded-lg max-w-full text-xs leading-normal"
            >
              {/* Kop Surat Resmi */}
              <div className="kop-surat text-center pb-3 mb-5 border-b-[3px] border-double border-black">
                {settings.pemerintahDaerah && (
                  <h3 className="text-sm font-bold uppercase tracking-wider leading-tight">
                    {settings.pemerintahDaerah}
                  </h3>
                )}
                {settings.dinasPendidikan && (
                  <h4 className="text-sm font-bold uppercase tracking-wider leading-tight">
                    {settings.dinasPendidikan}
                  </h4>
                )}
                <h1 className="text-xl sm:text-2xl font-black uppercase text-black tracking-wide my-1">
                  {settings.namaSekolah || 'SMKS Kharisma Panongan'}
                </h1>
                <p className="text-[12px] text-black leading-tight">
                  {settings.alamatSekolah || '(Alamat sekolah belum diisi di Pengaturan)'}
                  {settings.teleponSekolah ? ` • Telp: ${settings.teleponSekolah}` : ''}
                </p>
                {(settings.websiteSekolah || settings.emailSekolah) && (
                  <p className="text-[11px] text-black leading-tight italic">
                    {settings.websiteSekolah ? `Laman: ${settings.websiteSekolah}` : ''}
                    {settings.websiteSekolah && settings.emailSekolah ? ' • ' : ''}
                    {settings.emailSekolah ? `Pos-el: ${settings.emailSekolah}` : ''}
                  </p>
                )}
              </div>

              {/* Judul Laporan */}
              <div className="text-center my-5">
                <h2 className="text-base font-black uppercase tracking-wide underline">
                  LAPORAN REKAPITULASI PELANGGARAN & KETERTIBAN SISWA
                </h2>
                <p className="text-xs font-bold mt-1">
                  Periode: {formatTanggal(tanggalMulai)} s/d {formatTanggal(tanggalSelesai)}
                </p>
                <p className="text-[11px] text-gray-700">
                  Filter Kelas: {selectedKelas === 'semua' ? 'Semua Kelas' : selectedKelas} • Status: {selectedStatus === 'semua' ? 'Semua Status' : selectedStatus}
                </p>
              </div>

              {/* Ringkasan Angka */}
              <div className="grid grid-cols-3 gap-2 border border-black p-2 my-4 text-center text-xs">
                <div>
                  <span className="block text-[10px] uppercase font-bold">Total Pelanggaran</span>
                  <strong className="text-sm">{filteredKasus.length} Kasus</strong>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold">Total Akumulasi Poin</span>
                  <strong className="text-sm">+{stats.totalPoin} Poin</strong>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold">Siswa Melanggar</span>
                  <strong className="text-sm">{rekapSiswaList.length} Siswa</strong>
                </div>
              </div>

              {/* Tabel Laporan Formal */}
              <div className="my-4">
                <p className="font-bold text-[11px] mb-1.5">
                  {viewTab === 'detail' ? 'Daftar Kronologis Pelanggaran:' : 'Daftar Rekapitulasi per Siswa:'}
                </p>
                {viewTab === 'detail' ? (
                  <table className="w-full border-collapse border border-black text-[11px]">
                    <thead>
                      <tr className="bg-gray-100 text-left">
                        <th className="border border-black px-2 py-1 w-8 text-center">No</th>
                        <th className="border border-black px-2 py-1 w-20">Tanggal</th>
                        <th className="border border-black px-2 py-1">Nama Siswa</th>
                        <th className="border border-black px-2 py-1 w-16">Kelas</th>
                        <th className="border border-black px-2 py-1">Bentuk Pelanggaran</th>
                        <th className="border border-black px-2 py-1 w-12 text-center">Poin</th>
                        <th className="border border-black px-2 py-1 w-24">Petugas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredKasus.map((k, idx) => (
                        <tr key={k.id || idx}>
                          <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                          <td className="border border-black px-2 py-1 whitespace-nowrap">{formatTanggal(k.tanggal)}</td>
                          <td className="border border-black px-2 py-1 font-semibold">{k.siswaNama}</td>
                          <td className="border border-black px-2 py-1">{k.siswaKelas}</td>
                          <td className="border border-black px-2 py-1">
                            {k.kategoriNama}
                            {k.deskripsi ? ` (${k.deskripsi})` : ''}
                          </td>
                          <td className="border border-black px-2 py-1 text-center font-bold">+{k.poin}</td>
                          <td className="border border-black px-2 py-1">{k.createdByNama || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full border-collapse border border-black text-[11px]">
                    <thead>
                      <tr className="bg-gray-100 text-left">
                        <th className="border border-black px-2 py-1 w-8 text-center">No</th>
                        <th className="border border-black px-2 py-1 w-24">NISN</th>
                        <th className="border border-black px-2 py-1">Nama Siswa</th>
                        <th className="border border-black px-2 py-1 w-20">Kelas</th>
                        <th className="border border-black px-2 py-1 w-24 text-center">Jml Kasus</th>
                        <th className="border border-black px-2 py-1 w-24 text-center">Total Poin</th>
                        <th className="border border-black px-2 py-1 w-24">Kasus Terakhir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rekapSiswaList.map((s, idx) => (
                        <tr key={s.siswaId || idx}>
                          <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                          <td className="border border-black px-2 py-1">{s.nisn}</td>
                          <td className="border border-black px-2 py-1 font-semibold">{s.nama}</td>
                          <td className="border border-black px-2 py-1">{s.kelas}</td>
                          <td className="border border-black px-2 py-1 text-center font-bold">{s.jumlahKasus}x</td>
                          <td className="border border-black px-2 py-1 text-center font-bold">+{s.totalPoin}</td>
                          <td className="border border-black px-2 py-1 whitespace-nowrap">{formatTanggal(s.kasusTerakhir)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Tanda Tangan Resmi */}
              <div className="tanda-tangan grid grid-cols-2 gap-8 pt-10 mt-6 text-xs">
                <div>
                  <p>Mengetahui,</p>
                  <p className="font-bold">Waka Kesiswaan / Guru BK</p>
                  <div className="h-20"></div>
                  <p className="font-bold underline uppercase">{user?.nama || 'Guru Bimbingan Konseling'}</p>
                  <p className="text-[11px]">NIP. {user?.nip || '-'}</p>
                </div>

                <div className="text-right">
                  <p>{settings.kotaSekolah || 'Tangerang'}, {formatTanggal(new Date().toISOString().slice(0, 10))}</p>
                  <p className="font-bold">Kepala Sekolah,</p>
                  <div className="h-20"></div>
                  <p className="font-bold underline uppercase">{settings.namaKepsek || '(Nama Kepala Sekolah)'}</p>
                  <p className="text-[11px]">NIP. {settings.nipKepsek || '-'}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 no-print">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Lembar A4</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
