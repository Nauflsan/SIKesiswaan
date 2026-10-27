/**
 * ============================================================================
 * KOMPONEN: NaikKelasPanel (src/components/maintenance/NaikKelasPanel.jsx)
 * ============================================================================
 * Panel manajemen pemeliharaan data untuk Admin:
 * - Pemindahan tingkat kelas massal (X -> XI -> XII -> Lulus) di awal tahun ajaran.
 * - Saran otomatis kelas tujuan berikutnya berdasarkan penamaan rombel.
 * - Pencadangan spreadsheet (.xlsx) wajib sebelum proses dijalankan.
 * - Konfirmasi ketik 'NAIK KELAS' untuk proteksi kesalahan operasional.
 * - Riwayat dan mekanisme rollback (pembatalan) pemindahan kelas terakhir.
 */

import { useState, useEffect, useMemo } from 'preact/hooks';
import CreatableCombobox from '../ui/CreatableCombobox.jsx';
import { siswaService, kelasService } from '../../services/index.js';
import { sarankanKelasBaru, formatTanggal, formatBadgeStatusSP } from '../../lib/helpers.js';
import { friendlyError } from '../../lib/errors.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useUIStore } from '../../stores/uiStore.js';
import {
  GraduationCap,
  RefreshCw,
  FileSpreadsheet,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  ShieldAlert
} from 'lucide-preact';

export default function NaikKelasPanel() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Data master & pemetaan
  const [siswaAktifList, setSiswaAktifList] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [pemetaan, setPemetaan] = useState({}); // { [kelasAsal]: kelasTujuan }
  const [riwayatTerakhir, setRiwayatTerakhir] = useState(null);
  const [hasilPromosi, setHasilPromosi] = useState(null);

  // Muat riwayat terakhir saat komponen pertama kali dipasang
  useEffect(() => {
    loadRiwayatTerakhir();
  }, []);

  async function loadRiwayatTerakhir() {
    try {
      const r = await siswaService.getRiwayatNaikKelasTerakhir();
      setRiwayatTerakhir(r);
    } catch {
      // Intentionally silent on initial metadata fetch
    }
  }

  // Hitung sebaran jumlah siswa per kelas asal
  const countPerKelas = useMemo(() => {
    const map = {};
    siswaAktifList.forEach(s => {
      const k = s.kelas || 'Tanpa Kelas';
      map[k] = (map[k] || 0) + 1;
    });
    return map;
  }, [siswaAktifList]);

  // Daftar kelas unik dari siswa aktif
  const daftarKelasAsal = useMemo(() => {
    return Object.keys(countPerKelas).sort();
  }, [countPerKelas]);

  // Opsi dropdown kelas tujuan
  const opsiKelasTujuan = useMemo(() => {
    const defaultOptions = [
      { value: '__SKIP__', label: 'Tidak diproses' },
      { value: '__LULUS__', label: 'Lulus' }
    ];

    const cleanKelasList = Array.from(new Set(kelasList.filter(Boolean))).sort();
    cleanKelasList.forEach(k => {
      defaultOptions.push({ value: k, label: k });
    });

    return defaultOptions;
  }, [kelasList]);

  /**
   * Mengambil data siswa aktif terbaru langsung ke server (force: true) dan master kelas.
   */
  const handleLoadDataKelas = async () => {
    setLoading(true);
    setHasilPromosi(null);
    setBackupDownloaded(false);
    setConfirmText('');
    try {
      const [aktif, kList, riwayat] = await Promise.all([
        siswaService.getAktif({ force: true }),
        kelasService.get(),
        siswaService.getRiwayatNaikKelasTerakhir()
      ]);

      setSiswaAktifList(aktif);
      setKelasList(kList);
      setRiwayatTerakhir(riwayat);

      // Hitung pemetaan awal dengan saran otomatis
      const initialPemetaan = {};
      const uniqueKelas = Array.from(new Set(aktif.map(s => s.kelas).filter(Boolean))).sort();

      uniqueKelas.forEach(kelasAsal => {
        const saran = sarankanKelasBaru(kelasAsal);
        if (typeof saran === 'string') {
          initialPemetaan[kelasAsal] = saran;
        } else if (saran === null) {
          initialPemetaan[kelasAsal] = '__LULUS__';
        } else {
          initialPemetaan[kelasAsal] = '__SKIP__';
        }
      });

      setPemetaan(initialPemetaan);
      setDataLoaded(true);
      showToast(`Berhasil memuat ${aktif.length} siswa aktif pada ${uniqueKelas.length} kelas`, 'success');
    } catch (err) {
      showToast(friendlyError(err, 'Gagal memuat data kelas siswa'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePemetaan = (kelasAsal, kelasTujuan) => {
    setPemetaan(prev => ({
      ...prev,
      [kelasAsal]: kelasTujuan
    }));
  };

  // Ringkasan pratinjau kalkulasi pemindahan kelas
  const ringkasanPratinjau = useMemo(() => {
    let naikCount = 0;
    let lulusCount = 0;
    let skipCount = 0;
    let sameCount = 0;

    daftarKelasAsal.forEach(asal => {
      const count = countPerKelas[asal] || 0;
      const tujuan = pemetaan[asal] || '__SKIP__';

      if (tujuan === '__SKIP__') {
        skipCount += count;
      } else if (tujuan === asal) {
        sameCount += count;
        skipCount += count;
      } else if (tujuan === '__LULUS__') {
        lulusCount += count;
      } else {
        naikCount += count;
      }
    });

    const totalDiproses = naikCount + lulusCount;
    const isValid = totalDiproses > 0;

    return {
      naikCount,
      lulusCount,
      skipCount,
      sameCount,
      totalDiproses,
      isValid
    };
  }, [daftarKelasAsal, countPerKelas, pemetaan]);

  /**
   * Mengunduh lembar spreadsheet cadangan seluruh siswa aktif sebelum pemrosesan.
   */
  const handleDownloadBackup = async () => {
    if (siswaAktifList.length === 0) {
      showToast('Tidak ada data siswa aktif untuk dicadangkan', 'info');
      return;
    }

    setExportingBackup(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const rows = siswaAktifList.map((s, idx) => ({
        'No': idx + 1,
        'Nama Siswa': s.nama || '-',
        'NISN': s.nisn || '-',
        'Kelas': s.kelas || '-',
        'Jurusan': s.jurusan || '-',
        'Angkatan': s.angkatan || '-',
        'Total Poin': Number(s.totalPoin || 0),
        'Status SP': formatBadgeStatusSP(s.statusSP).label
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 5 }, { wch: 28 }, { wch: 16 }, { wch: 14 },
        { wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Siswa Aktif');

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const filename = `Cadangan_Siswa_Aktif_${yyyy}${mm}${dd}.xlsx`;

      XLSX.writeFile(wb, filename);
      setBackupDownloaded(true);
      showToast('Cadangan data siswa aktif berhasil diunduh', 'success');
    } catch (err) {
      showToast('Gagal mengunduh cadangan: ' + friendlyError(err, 'Terjadi kesalahan sistem'), 'error');
    } finally {
      setExportingBackup(false);
    }
  };

  /**
   * Menjalankan eksekusi kenaikan kelas massal ke database Firestore.
   */
  const handleProsesNaikKelas = async () => {
    if (!backupDownloaded || confirmText.trim() !== 'NAIK KELAS' || processing) return;
    if (!ringkasanPratinjau.isValid) {
      showToast('Tidak ada siswa yang diproses', 'error');
      return;
    }

    setProcessing(true);
    try {
      const pemetaanList = daftarKelasAsal.map(asal => ({
        kelasAsal: asal,
        kelasTujuan: pemetaan[asal] || '__SKIP__'
      }));

      const res = await siswaService.naikKelasMassal(pemetaanList, user);

      // Kumpulkan kelas tujuan baru untuk didaftarkan ke master kelas (meta/kelas)
      const kelasBaruDaftar = [];
      pemetaanList.forEach(p => {
        if (p.kelasTujuan && p.kelasTujuan !== '__SKIP__' && p.kelasTujuan !== '__LULUS__') {
          kelasBaruDaftar.push(p.kelasTujuan);
        }
      });
      if (kelasBaruDaftar.length > 0) {
        try {
          await kelasService.addMany(kelasBaruDaftar);
        } catch {
          // Abaikan bila sinkronisasi daftar kelas gagal
        }
      }

      setHasilPromosi(res);
      showToast('Naik kelas selesai', 'success');
      setConfirmText('');
      setBackupDownloaded(false);
      setDataLoaded(false);

      // Refresh riwayat pembatalan
      await loadRiwayatTerakhir();
    } catch (err) {
      showToast(
        'Gagal memproses naik kelas: ' +
        friendlyError(err, 'Terjadi kesalahan sistem.') +
        ' Jika proses terputus di tengah jalan, gunakan tombol Batalkan Naik Kelas Terakhir.',
        'error',
        8000
      );
      await loadRiwayatTerakhir();
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Membatalkan proses naik kelas massal terakhir.
   */
  const handleBatalkanNaikKelas = async () => {
    if (undoing || !riwayatTerakhir || riwayatTerakhir.dibatalkan) return;

    const yakin = window.confirm(
      'Apakah Anda yakin ingin membatalkan naik kelas terakhir? Perubahan kelas yang dilakukan secara manual setelah naik kelas akan tertimpa.'
    );
    if (!yakin) return;

    setUndoing(true);
    try {
      const res = await siswaService.batalkanNaikKelasTerakhir(user);
      showToast(
        `Pembatalan berhasil: ${res.dipulihkan} siswa dipulihkan` +
        (res.dilewati > 0 ? `, ${res.dilewati} dilewati (sudah tidak ada)` : ''),
        'success'
      );
      await loadRiwayatTerakhir();
      if (dataLoaded) {
        await handleLoadDataKelas();
      }
    } catch (err) {
      showToast('Gagal membatalkan naik kelas: ' + friendlyError(err, 'Terjadi kesalahan sistem'), 'error');
    } finally {
      setUndoing(false);
    }
  };

  // Status riwayat pembatalan
  const riwayatInfo = useMemo(() => {
    if (!riwayatTerakhir) return null;
    const waktuMillis = new Date(riwayatTerakhir.waktu).getTime();
    const diffDays = (Date.now() - waktuMillis) / (1000 * 60 * 60 * 24);
    const isExpired = isNaN(diffDays) || diffDays > 30;
    const canUndo = !riwayatTerakhir.dibatalkan && !isExpired;

    return {
      ...riwayatTerakhir,
      isExpired,
      canUndo,
      formattedWaktu: formatTanggal(riwayatTerakhir.waktu ? riwayatTerakhir.waktu.slice(0, 10) : '')
    };
  }, [riwayatTerakhir]);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Kartu Utama: Naik Kelas Massal */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs space-y-6">
        <div>
          <h4 className="font-bold font-heading text-sm text-gray-900 mb-1 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-[#4A6FA5]" />
            <span>Naik Kelas Massal</span>
          </h4>
          <p className="text-xs text-gray-500 leading-relaxed">
            Lakukan di awal tahun ajaran. Poin kedisiplinan tidak direset (tetap akumulatif hingga kelulusan). Disarankan dilakukan di luar jam sibuk.
          </p>
          <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-800">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Perhatian:</strong> Pastikan hanya satu Admin yang menjalankan proses ini dalam satu waktu untuk menghindari tumpang tindih data.
            </span>
          </div>
        </div>

        {/* Tombol Muat Data */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleLoadDataKelas}
            disabled={loading || processing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Memuat Data Siswa...' : dataLoaded ? 'Muat Ulang Data Kelas' : 'Muat Data Kelas'}</span>
          </button>
        </div>

        {/* Tabel Pemetaan & Kontrol Kenaikan Kelas */}
        {dataLoaded && (
          <div className="space-y-6 pt-4 border-t border-gray-100">
            {daftarKelasAsal.length === 0 ? (
              <p className="text-xs text-gray-500 italic">
                Tidak ada data siswa aktif yang ditemukan pada sistem.
              </p>
            ) : (
              <>
                <div>
                  <table className="w-full text-left text-xs border border-gray-200 rounded-xl">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Kelas Asal</th>
                        <th className="py-2.5 px-3 text-center">Jumlah Siswa</th>
                        <th className="py-2.5 px-3 w-48 sm:w-64">Kelas Tujuan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {daftarKelasAsal.map(asal => (
                        <tr key={asal} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-3 font-semibold text-gray-900">{asal}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-gray-700">
                            {countPerKelas[asal] || 0}
                          </td>
                          <td className="py-2.5 px-3">
                            <CreatableCombobox
                              value={pemetaan[asal] || '__SKIP__'}
                              onChange={(val) => handleUpdatePemetaan(asal, val)}
                              options={opsiKelasTujuan}
                              creatable={true}
                              variant="input"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Ringkasan Pratinjau */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
                  <p className="font-semibold text-gray-800">
                    Pratinjau Hasil Pemrosesan:
                  </p>
                  <p className="text-gray-600">
                    <strong>{ringkasanPratinjau.naikCount}</strong> siswa naik kelas,{' '}
                    <strong>{ringkasanPratinjau.lulusCount}</strong> siswa lulus,{' '}
                    <strong>{ringkasanPratinjau.skipCount}</strong> siswa tidak diproses.
                  </p>

                  {ringkasanPratinjau.sameCount > 0 && (
                    <div className="flex items-center gap-2 text-amber-700 text-[11px] font-medium pt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Terdapat {ringkasanPratinjau.sameCount} siswa dengan kelas tujuan sama dengan kelas asal (akan diabaikan).
                      </span>
                    </div>
                  )}

                  {!ringkasanPratinjau.isValid && (
                    <div className="flex items-center gap-2 text-red-600 text-[11px] font-medium pt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Tidak ada siswa yang akan diproses. Pilih minimal satu kelas tujuan kenaikan atau kelulusan.
                      </span>
                    </div>
                  )}
                </div>

                {/* Cadangan Wajib & Konfirmasi Eksekusi */}
                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200/80 space-y-4 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900">
                        Langkah 1: Unduh Cadangan Data Siswa (Wajib)
                      </p>
                      <p className="text-gray-500 text-[11px] mt-0.5">
                        Unduh berkas Excel profil siswa aktif saat ini sebagai cadangan sebelum data diubah.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadBackup}
                      disabled={exportingBackup}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold shadow-xs transition-all cursor-pointer shrink-0 ${
                        backupDownloaded
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>
                        {exportingBackup ? 'Mengekspor...' : backupDownloaded ? 'Cadangan Sudah Diunduh ✓' : 'Unduh Cadangan (Excel)'}
                      </span>
                    </button>
                  </div>

                  <div className="pt-3 border-t border-blue-200/60 space-y-3">
                    <div>
                      <p className="font-bold text-gray-900">
                        Langkah 2: Konfirmasi Tindakan
                      </p>
                      <p className="text-gray-500 text-[11px] mt-0.5">
                        Ketik <strong className="text-red-600 font-mono">NAIK KELAS</strong> pastikan capslock aktif pada kolom di bawah ini untuk mengaktifkan tombol eksekusi:
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <input
                        type="text"
                        placeholder="Ketik NAIK KELAS"
                        value={confirmText}
                        onInput={(e) => setConfirmText(e.target.value)}
                        className="px-3.5 py-2 text-xs border border-gray-300 rounded-xl bg-white focus:outline-hidden focus:border-[#4A6FA5] uppercase tracking-wider font-mono font-bold sm:w-64"
                      />
                      <button
                        type="button"
                        onClick={handleProsesNaikKelas}
                        disabled={
                          !backupDownloaded ||
                          confirmText.trim() !== 'NAIK KELAS' ||
                          !ringkasanPratinjau.isValid ||
                          processing
                        }
                        className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>{processing ? 'Memproses Naik Kelas...' : 'Proses Naik Kelas'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Ringkasan Hasil Eksekusi Sukses */}
        {hasilPromosi && (
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-800 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Proses Kenaikan Kelas Berhasil Dijalankan!</span>
            </div>
            <p className="text-emerald-700">
              Total {hasilPromosi.total} siswa telah berhasil diproses ({hasilPromosi.naik} naik kelas, {hasilPromosi.lulus} lulus).
            </p>
            {Array.isArray(hasilPromosi.rincian) && hasilPromosi.rincian.length > 0 && (
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left text-xs bg-white rounded-lg border border-emerald-200 overflow-hidden">
                  <thead className="bg-emerald-100/60 text-emerald-900 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2 px-3">Kelas Asal</th>
                      <th className="py-2 px-3">Tujuan</th>
                      <th className="py-2 px-3 text-center">Jumlah Siswa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100">
                    {hasilPromosi.rincian.map((r, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 px-3 font-medium text-gray-800">{r.asal}</td>
                        <td className="py-1.5 px-3 font-semibold text-gray-900">{r.tujuan}</td>
                        <td className="py-1.5 px-3 text-center font-mono text-gray-700">{r.jumlah}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bagian Pembatalan (Rollback) Naik Kelas */}
      {riwayatInfo && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
          <div>
            <h4 className="font-bold font-heading text-sm text-gray-900 mb-1 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <span>Pembatalan Naik Kelas Terakhir</span>
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Memulihkan kembali kelas dan status siswa ke kondisi sebelum proses naik kelas terakhir dijalankan.
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-2">
            <p className="text-gray-800 font-medium">
              Riwayat Kenaikan Kelas:
            </p>
            <p className="text-gray-600">
              Naik kelas terakhir: <strong>{riwayatInfo.formattedWaktu}</strong> oleh <strong>{riwayatInfo.oleh || 'Admin'}</strong> ({riwayatInfo.jumlah} siswa).
            </p>
            {riwayatInfo.ringkasan && (
              <p className="text-gray-500 text-[11px] italic">
                {riwayatInfo.ringkasan}
              </p>
            )}

            {riwayatInfo.dibatalkan ? (
              <div className="pt-2 flex items-center gap-2 text-emerald-700 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Proses naik kelas ini sudah dibatalkan sebelumnya.</span>
              </div>
            ) : riwayatInfo.isExpired ? (
              <div className="pt-2 flex items-center gap-2 text-gray-500 font-medium text-xs">
                <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />
                <span>Masa pembatalan telah kedaluwarsa (lebih dari 30 hari).</span>
              </div>
            ) : (
              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleBatalkanNaikKelas}
                  disabled={undoing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${undoing ? 'animate-spin' : ''}`} />
                  <span>{undoing ? 'Membatalkan...' : 'Batalkan Naik Kelas Terakhir'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
