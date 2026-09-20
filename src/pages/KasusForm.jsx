/**
 * =============================================================================
 * KOMPONEN: KasusForm (Formulir Pencatatan Pelanggaran Siswa)
 * =============================================================================
 * Formulir interaktif untuk mencatat insiden pelanggaran siswa baru ke dalam sistem.
 * 
 * FITUR UTAMA & LOGIKA BISNIS:
 * 1. Live Point & SP Projection (Simulasi Realtime):
 *    - Ketika nama siswa dan jenis pelanggaran dipilih, panel kanan secara otomatis
 *      menghitung:
 *        * Akumulasi poin saat ini + poin pelanggaran baru = Proyeksi Total.
 *        * Menghitung apakah siswa akan naik status (Normal -> SP1 / SP2 / SP3).
 *        * Menampilkan peringatan dini jika status SP akan terpicu.
 * 2. RBAC (Role-Based Access Control) pada Poin:
 *    - Default poin diisi sesuai bobot kategori pelanggaran.
 *    - Hanya 'admin' dan 'guru_bk' yang berhak mengedit / melakukan override poin.
 * 3. Atomic Database Transaction:
 *    - Penyimpanan kasus otomatis mencatat riwayat pelanggaran sekaligus
 *      memperbarui total poin & status SP pada dokumen siswa secara atomik.
 * =============================================================================
 */

import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'wouter-preact';
import AppLayout from '../components/layout/AppLayout.jsx';
import { SPBadge } from '../components/ui/Badge.jsx';
import { siswaService, kategoriService, kasusService, settingsService } from '../services/index.js';
import { friendlyError } from '../lib/errors.js';
import { useAuthStore } from '../stores/authStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { hitungStatusSP } from '../lib/helpers.js';
import {
  Save,
  ArrowLeft,
  AlertCircle,
  Sparkles
} from 'lucide-preact';

export default function KasusForm() {
  const [, setLocation] = useLocation();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  // Master data yang diperlukan formulir
  const [siswaList, setSiswaList] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Field state formulir
  const [selectedSiswaId, setSelectedSiswaId] = useState('');
  const [selectedKategoriId, setSelectedKategoriId] = useState('');
  const [customPoin, setCustomPoin] = useState(null);
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [deskripsi, setDeskripsi] = useState('');

  /**
   * Mengambil data prasyarat formulir: daftar siswa, kategori pelanggaran, dan konfigurasi ambang batas SP.
   */
  useEffect(() => {
    loadPrerequisites();
  }, []);

  async function loadPrerequisites() {
    setLoading(true);
    try {
      const [siswaData, kategoriData, settingsData] = await Promise.all([
        siswaService.getAll(),
        kategoriService.getAll(),
        settingsService.get()
      ]);

      setSiswaList(siswaData);
      setKategoriList(kategoriData.filter(k => k.isActive));
      setSettings(settingsData);

      // Cek apakah ada query param ?siswaId=... (misal diarahkan dari halaman SiswaDetail)
      const params = new URLSearchParams(window.location.search);
      const preselectedSiswaId = params.get('siswaId');
      if (preselectedSiswaId) {
        setSelectedSiswaId(preselectedSiswaId);
      }
    } catch (err) {
      showToast(friendlyError(err, 'Gagal memuat data formulir'), 'error');
    } finally {
      setLoading(false);
    }
  }

  // Objek referensi siswa & kategori yang sedang dipilih di form
  const selectedSiswa = siswaList.find(s => s.id === selectedSiswaId);
  const selectedKategori = kategoriList.find(k => k.id === selectedKategoriId);

  // Poin aktif: gunakan custom poin jika telah diubah oleh Admin/BK, atau poin default kategori
  const activePoin = customPoin !== null ? customPoin : (selectedKategori?.poin || 0);

  // LOGIKA SIMULASI PROYEKSI REAL-TIME:
  // Menghitung akumulasi baru dan status SP yang akan diterima siswa jika form ini disimpan
  const currentTotal = selectedSiswa?.totalPoin || 0;
  const projectedTotal = currentTotal + activePoin;
  const projectedSP = hitungStatusSP(projectedTotal, settings);

  /**
   * Handler saat kategori pelanggaran dipilih:
   * Mengisi otomatis bobot poin default sesuai kategori yang dipilih.
   */
  const handleKategoriChange = (e) => {
    const kId = e.target.value;
    setSelectedKategoriId(kId);
    const found = kategoriList.find(k => k.id === kId);
    if (found) {
      setCustomPoin(found.poin);
    } else {
      setCustomPoin(0);
    }
  };

  /**
   * Handler penyimpanan formulir kasus pelanggaran
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSiswaId) {
      showToast('Silakan pilih siswa terlebih dahulu', 'error');
      return;
    }
    if (!selectedKategoriId) {
      showToast('Silakan pilih jenis pelanggaran', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await kasusService.create({
        siswaId: selectedSiswaId,
        kategoriId: selectedKategoriId,
        poin: activePoin,
        tanggal,
        deskripsi,
        status: 'baru'
      }, user);

      showToast(`Kasus berhasil dicatat! Akumulasi poin ${selectedSiswa.nama} kini ${projectedTotal} poin.`, 'success');
      setLocation('/kasus');
    } catch (err) {
      showToast(err.message || 'Gagal mencatat kasus', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout
      title="Catat Pelanggaran Siswa Baru"
      subtitle="Input laporan insiden ketertiban siswa ke dalam sistem database"
    >
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 mb-5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Kasus</span>
        </button>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Input Form */}
          <div className="lg:col-span-2 space-y-5 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
            {/* Siswa Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                Pilih Siswa Terlapor <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSiswaId}
                onChange={(e) => setSelectedSiswaId(e.target.value)}
                required
                className="w-full text-sm py-2.5 px-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4A6FA5]/20 focus:border-[#4A6FA5] font-medium"
              >
                <option value="">-- Pilih Nama Siswa / NISN --</option>
                {siswaList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nama} ({s.kelas} • NISN: {s.nisn})
                  </option>
                ))}
              </select>
            </div>

            {/* Kategori Pelanggaran */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                Jenis Pelanggaran <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedKategoriId}
                onChange={handleKategoriChange}
                required
                className="w-full text-sm py-2.5 px-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4A6FA5]/20 focus:border-[#4A6FA5] font-medium"
              >
                <option value="">-- Pilih Jenis Pelanggaran --</option>
                {kategoriList.map(k => (
                  <option key={k.id} value={k.id}>
                    {k.nama} (+{k.poin} Poin)
                  </option>
                ))}
              </select>
            </div>

            {/* Tanggal & Poin Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                  Tanggal Kejadian <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={tanggal}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setTanggal(e.target.value)}
                    required
                    className="w-full text-sm py-2.5 px-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4A6FA5]/20 focus:border-[#4A6FA5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                  Poin Pelanggaran
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={activePoin}
                    onChange={(e) => setCustomPoin(Number(e.target.value))}
                    disabled={user?.role !== 'admin' && user?.role !== 'guru_bk'}
                    className="w-full text-sm py-2.5 px-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4A6FA5]/20 focus:border-[#4A6FA5] font-bold text-rose-600"
                  />
                  <span className="text-xs font-semibold text-gray-500 shrink-0">Poin</span>
                </div>
              </div>
            </div>

            {/* Deskripsi / Kronologi */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                Kronologi / Catatan Khusus
              </label>
              <textarea
                rows="4"
                placeholder="Tuliskan keterangan tempat kejadian, saksi, barang bukti, atau kronologi singkat..."
                value={deskripsi}
                onInput={(e) => setDeskripsi(e.target.value)}
                className="w-full text-sm py-2.5 px-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4A6FA5]/20 focus:border-[#4A6FA5] resize-none"
              />
            </div>

            {/* Submit Buttons */}
            <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setLocation('/kasus')}
                className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || loading}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{submitting ? 'Menyimpan...' : 'Simpan Kasus Pelanggaran'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Live Projection / Realtime Simulation */}
          <div className="space-y-5">
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100 text-[#4A6FA5]">
                <Sparkles className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Simulasi Dampak Poin</h3>
              </div>

              {selectedSiswa ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-[11px] text-gray-400 block">Siswa Terpilih</span>
                    <p className="text-sm font-bold text-gray-900">{selectedSiswa.nama}</p>
                    <p className="text-xs text-gray-500">{selectedSiswa.kelas} • NISN: {selectedSiswa.nisn}</p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Akumulasi Sekarang:</span>
                      <span className="font-bold text-gray-900">{currentTotal} Poin</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Status Sekarang:</span>
                      <SPBadge status={selectedSiswa.statusSP} />
                    </div>
                  </div>

                  <div className="p-3.5 bg-blue-50 border border-blue-200/80 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-blue-900 font-medium">Tambahan Poin:</span>
                      <span className="font-extrabold text-rose-600">+{activePoin} Poin</span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-blue-200/60">
                      <span className="text-blue-950 font-bold">Proyeksi Total:</span>
                      <span className="text-base font-extrabold text-blue-950">{projectedTotal} Poin</span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-blue-950 font-bold">Proyeksi Status:</span>
                      <SPBadge status={projectedSP} />
                    </div>
                  </div>

                  {projectedSP !== selectedSiswa.statusSP && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Perhatian:</strong> Pelanggaran ini akan memicu peningkatan status SP siswa menjadi <strong>{projectedSP.toUpperCase()}</strong>.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400 text-xs">
                  Pilih siswa di formulir untuk melihat simulasi dampak poin dan status SP secara otomatis.
                </div>
              )}
            </div>

            {/* Threshold Guide Card */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs text-xs space-y-3">
              <h4 className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">
                Pedoman Ambang Batas SP
              </h4>
              <div className="space-y-1.5 text-gray-600">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span>Normal</span>
                  <span className="font-bold text-emerald-600">&lt; {settings.ambangSp1 || 50} pt</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span>Surat Peringatan 1 (SP1)</span>
                  <span className="font-bold text-amber-600">≥ {settings.ambangSp1 || 50} pt</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span>Surat Peringatan 2 (SP2)</span>
                  <span className="font-bold text-orange-600">≥ {settings.ambangSp2 || 80} pt</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Surat Peringatan 3 (SP3/DO)</span>
                  <span className="font-bold text-red-600">≥ {settings.ambangSp3 || 110} pt</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
