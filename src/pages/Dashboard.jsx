/**
 * ============================================================================
 * HALAMAN: DASHBOARD UTAMA KESISWAAN (src/pages/Dashboard.jsx)
 * ============================================================================
 * Menampilkan ringkasan eksekutif ketertiban sekolah:
 * 1. Empat Kartu Statistik Utama (Kasus Bulan Ini, Kasus Baru, Siswa SP1, Siswa SP2/SP3).
 * 2. Grafik Batang Distribusi Pelanggaran Terbanyak.
 * 3. Daftar Top 5 Siswa dengan Poin Tertinggi (Perlu Perhatian Khusus BK).
 * 4. Tabel Riwayat Kasus Terbaru yang masuk ke sistem.
 */

import { useState, useEffect } from 'preact/hooks';
import { Link } from 'wouter-preact';
import AppLayout from '../components/layout/AppLayout.jsx';
import { SPBadge, KasusStatusBadge, PoinBadge } from '../components/ui/Badge.jsx';
import { kasusService, siswaService, kategoriService } from '../services/index.js';
import { formatTanggal } from '../lib/helpers.js';
import { friendlyError } from '../lib/errors.js';
import LoadError from '../components/ui/LoadError.jsx';
import {
  AlertCircle,
  Clock,
  Flame,
  PlusCircle,
  FileText,
  TrendingUp,
  ArrowRight
} from 'lucide-preact';

export default function Dashboard() {
  // Status loading data halaman
  const [loading, setLoading] = useState(true);

  // State: 4 Angka ringkasan kartu statistik
  const [stats, setStats] = useState({
    totalKasusBulanIni: 0,
    belumDitangani: 0,
    siswaSP1: 0,
    siswaKritis: 0
  });

  // State: Daftar 5 siswa dengan akumulasi poin terbanyak
  const [topSiswa, setTopSiswa] = useState([]);

  // State: 5 kasus terakhir yang dicatat
  const [recentKasus, setRecentKasus] = useState([]);
  const [loadError, setLoadError] = useState(null);

  // State: Data distribusi kategori pelanggaran untuk grafik batang
  const [kategoriStats, setKategoriStats] = useState([]);

  // Muat data dashboard saat halaman dibuka
  useEffect(() => {
    loadDashboardData();
  }, []);

  /**
   * LOGIKA PENGAMBILAN & AGREGASI DATA DASHBOARD (HEMAT KUOTA)
   * Menghindari full-scan koleksi kasus yang terus membesar seiring waktu.
   */
  async function loadDashboardData() {
    setLoading(true);
    setLoadError(null);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // Ambil data teroptimasi: server-side range, status 'baru', limit(5)
      const [kasusBulanIni, belumDitanganiList, recentList, allSiswa, allKategori] = await Promise.all([
        kasusService.getByPeriode({ tanggalMulai: startDate, tanggalSelesai: endDate }),
        kasusService.getByStatus('baru'),
        kasusService.getRecent(5),
        siswaService.getAll(),
        kategoriService.getAll()
      ]);

      // 1. Hitung siswa berstatus SP 1 (Peringatan awal)
      const siswaSP1 = allSiswa.filter(s => s.statusSP === 'sp1');

      // 2. Hitung siswa berstatus SP 2 atau SP 3 (Zona kritis/terancam DO)
      const siswaKritis = allSiswa.filter(s => s.statusSP === 'sp2' || s.statusSP === 'sp3');

      setStats({
        totalKasusBulanIni: kasusBulanIni.length,
        belumDitangani: belumDitanganiList.length,
        siswaSP1: siswaSP1.length,
        siswaKritis: siswaKritis.length
      });

      // 3. Ambil 5 siswa dengan total poin tertinggi
      const sortedSiswa = [...allSiswa]
        .filter(s => s.totalPoin > 0)
        .sort((a, b) => b.totalPoin - a.totalPoin)
        .slice(0, 5);
      setTopSiswa(sortedSiswa);

      // 4. 5 catatan pelanggaran paling baru
      setRecentKasus(recentList);

      // 5. Hitung frekuensi kejadian per kategori bulan ini
      const counts = allKategori.map(kat => {
        const count = kasusBulanIni.filter(k => k.kategoriId === kat.id).length;
        return { nama: kat.nama, count, poin: kat.poin };
      }).filter(item => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 6);

      setKategoriStats(counts);
    } catch (err) {
      setLoadError(friendlyError(err, 'Gagal memuat data dashboard.'));
    } finally {
      setLoading(false);
    }
  }

  // Nilai maksimum untuk menghitung persentase lebar bar chart
  const maxCategoryCount = Math.max(...kategoriStats.map(k => k.count), 1);

  return (
    <AppLayout
      title="Dashboard Kesiswaan"
      subtitle="Ringkasan data ketertiban dan kedisiplinan siswa"
    >
      {loadError && (
        <div className="mb-6 bg-white rounded-2xl border border-red-200">
          <LoadError message={loadError} onRetry={loadDashboardData} />
        </div>
      )}

      {/* Baris Tombol Aksi Cepat (Quick Actions) */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Aksi Cepat:</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/kasus/tambah"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Catat Kasus Baru</span>
          </Link>
          <Link
            href="/surat"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-2xs transition-all active:scale-95"
          >
            <FileText className="w-4 h-4 text-amber-600" />
            <span>Buat Surat SP</span>
          </Link>
        </div>
      </div>

      {/* Bagian 1: 4 Kartu Statistik Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
        {/* Kartu 1: Total Kasus Bulan Berjalan */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs flex items-center justify-between card-hover-lift">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Kasus Bulan Ini</p>
            <h3 className="text-2xl font-bold font-heading text-gray-900 mt-1">{stats.totalKasusBulanIni}</h3>
            <span className="text-[11px] text-gray-400 mt-1 block">Periode bulan berjalan</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#4A6FA5] flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Kartu 2: Kasus yang Belum Ditangani */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs flex items-center justify-between card-hover-lift">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Perlu Ditangani</p>
            <h3 className="text-2xl font-bold font-heading text-rose-600 mt-1">{stats.belumDitangani}</h3>
            <span className="text-[11px] text-rose-400 mt-1 block">Status masih Baru</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Kartu 3: Siswa Status SP 1 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs flex items-center justify-between card-hover-lift">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status SP 1</p>
            <h3 className="text-2xl font-bold font-heading text-amber-600 mt-1">{stats.siswaSP1}</h3>
            <span className="text-[11px] text-amber-600/80 mt-1 block">Peringatan awal</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Kartu 4: Siswa Status Kritis (SP 2 & SP 3) */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs flex items-center justify-between card-hover-lift">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status SP 2 & 3</p>
            <h3 className="text-2xl font-bold font-heading text-red-600 mt-1">{stats.siswaKritis}</h3>
            <span className="text-[11px] text-red-400 mt-1 block">Kategori berisiko DO</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <Flame className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Bagian 2: Grid Grafik Distribusi & Daftar Siswa Berisiko */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Kolom Kiri: Visualisasi Bar Chart Pelanggaran Terbanyak */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold font-heading text-gray-900">
                Statistik Pelanggaran Terbanyak
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Distribusi kasus berdasarkan kategori pelanggaran</p>
            </div>
            <Link href="/kategori" className="text-xs font-semibold text-[#4A6FA5] hover:underline flex items-center gap-1">
              <span>Kelola</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {kategoriStats.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">{loading ? 'Memuat data...' : 'Belum ada data pelanggaran'}</p>
            ) : (
              kategoriStats.map((item, idx) => {
                // Hitung persentase panjang batang relatif terhadap nilai tertinggi
                const percentage = Math.round((item.count / maxCategoryCount) * 100);
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-800 truncate max-w-[70%]">
                        {item.nama}
                      </span>
                      <span className="font-semibold text-gray-600">
                        {item.count} kejadian
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-linear-to-r from-[#4A6FA5] to-blue-400 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Kolom Kanan: Top 5 Siswa Akumulasi Poin Tertinggi */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold font-heading text-gray-900">
                Siswa Akumulasi Poin Tertinggi
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Perlu perhatian intensif guru BK</p>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {topSiswa.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">{loading ? 'Memuat data...' : 'Tidak ada siswa berpoin'}</p>
            ) : (
              topSiswa.map((siswa, idx) => (
                <Link
                  key={siswa.id}
                  href={`/siswa/${siswa.id}`}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-gray-50/80 px-2 rounded-xl transition-colors block"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 text-center font-bold text-xs text-gray-400">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">
                        {siswa.nama}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {siswa.kelas} • {siswa.nisn}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-extrabold text-red-600 block">
                      {siswa.totalPoin} pt
                    </span>
                    <SPBadge status={siswa.statusSP} />
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-center">
            <Link href="/siswa" className="text-xs font-semibold text-[#4A6FA5] hover:underline inline-flex items-center gap-1">
              <span>Lihat Semua Siswa</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Bagian 3: Tabel Feed Catatan Kasus Terbaru */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold font-heading text-gray-900">
              Catatan Kasus Terbaru
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Riwayat laporan pelanggaran terakhir yang masuk ke sistem</p>
          </div>
          <Link href="/kasus" className="text-xs font-semibold text-[#4A6FA5] hover:underline inline-flex items-center gap-1">
            <span>Buka Seluruh Kasus</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Nama Siswa</th>
                <th className="py-2.5 px-3">Kelas</th>
                <th className="py-2.5 px-3">Pelanggaran</th>
                <th className="py-2.5 px-3">Poin</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Pelapor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentKasus.map((kasus) => (
                <tr key={kasus.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="py-3 px-3 text-gray-500 whitespace-nowrap">
                    {formatTanggal(kasus.tanggal)}
                  </td>
                  <td className="py-3 px-3 font-semibold text-gray-900">
                    <Link href={`/siswa/${kasus.siswaId}`} className="hover:text-[#4A6FA5] hover:underline">
                      {kasus.siswaNama}
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-gray-600">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-[11px] font-medium">
                      {kasus.siswaKelas}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-800 font-medium">
                    {kasus.kategoriNama}
                  </td>
                  <td className="py-3 px-3">
                    <PoinBadge poin={kasus.poin} />
                  </td>
                  <td className="py-3 px-3">
                    <KasusStatusBadge status={kasus.status} />
                  </td>
                  <td className="py-3 px-3 text-gray-500">
                    {kasus.createdByNama}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
