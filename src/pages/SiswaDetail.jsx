/**
 * =============================================================================
 * KOMPONEN: SiswaDetail (Detail Profil & Riwayat Kedisiplinan Siswa)
 * =============================================================================
 * Halaman komprehensif profil siswa yang menampilkan:
 * 1. Informasi Biodata:
 *    - Nama, NISN, Kelas, Jurusan, dan Angkatan.
 * 2. Visual Point Meter / Gauge:
 *    - Indikator bar visual persentase akumulasi poin relatif terhadap ambang SP3.
 *    - Penanda batas dinamis (Aman, SP1, SP2, SP3) berdasarkan konfigurasi Settings.
 * 3. Tab Kronologi Kasus:
 *    - Riwayat seluruh insiden pelanggaran siswa beserta status penanganannya.
 *    - Termasuk kasus yang telah di-soft-delete (ditandai coret & label Recycle Bin) untuk transparansi audit BK.
 * 4. Tab Arsip Surat Peringatan:
 *    - Seluruh surat resmi SP yang pernah diterbitkan untuk siswa ini lengkap dengan nomor surat resmi.
 * =============================================================================
 */

import { useState, useEffect } from 'preact/hooks';
import { Link, useRoute } from 'wouter-preact';
import AppLayout from '../components/layout/AppLayout.jsx';
import CreatableCombobox from '../components/ui/CreatableCombobox.jsx';
import { SPBadge, KasusStatusBadge, PoinBadge, StatusSiswaBadge } from '../components/ui/Badge.jsx';
import { siswaService, kasusService, suratService, settingsService } from '../services/index.js';
import { friendlyError } from '../lib/errors.js';
import { useAuthStore } from '../stores/authStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { formatTanggal, formatBadgeStatusSiswa } from '../lib/helpers.js';
import {
  ArrowLeft,
  FileText,
  PlusCircle,
  AlertTriangle,
  GraduationCap
} from 'lucide-preact';

export default function SiswaDetail() {
  // Tangkap parameter :id dari routing URL /siswa/:id
  const [, params] = useRoute('/siswa/:id');
  const siswaId = params?.id;

  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  // State profil siswa, daftar kasus, surat terbitan, dan konfigurasi ambang batas
  const [siswa, setSiswa] = useState(null);
  const [kasusList, setKasusList] = useState([]);
  const [suratList, setSuratList] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('riwayat'); // 'riwayat' | 'surat'
  const [savingStatus, setSavingStatus] = useState(false);

  const canEditStatus = user?.role === 'admin' || user?.role === 'guru_bk';

  /**
   * Mengubah status keaktifan siswa (aktif/lulus/pindah/keluar)
   */
  async function handleChangeStatusSiswa(newStatus) {
    if (!siswa || newStatus === (siswa.statusSiswa || 'aktif')) return;

    // Konfirmasi hanya saat siswa dikeluarkan dari status aktif (Lulus/Pindah/Keluar),
    // supaya klik tidak sengaja di dropdown tidak langsung menulis ke Firestore.
    if (newStatus !== 'aktif') {
      const label = formatBadgeStatusSiswa(newStatus).label;
      const konfirmasi = window.confirm(
        `Ubah status ${siswa.nama} menjadi "${label}"?\n\nSiswa dengan status ini tidak akan muncul lagi di daftar siswa aktif maupun pilihan "Catat Pelanggaran".`
      );
      if (!konfirmasi) return;
    }

    setSavingStatus(true);
    try {
      const updated = await siswaService.update(siswa.id, { statusSiswa: newStatus }, user);
      setSiswa(updated);
      showToast('Status siswa berhasil diperbarui', 'success');
    } catch (err) {
      showToast(err.message || 'Gagal mengubah status siswa', 'error');
    } finally {
      setSavingStatus(false);
    }
  }

  useEffect(() => {
    if (siswaId) loadData();
  }, [siswaId]);

  /**
   * Mengambil data siswa, seluruh riwayat kasus (termasuk soft delete), dan riwayat surat
   */
  async function loadData() {
    setLoading(true);
    try {
      const [siswaData, kasusData, suratData, settingsData] = await Promise.all([
        siswaService.getById(siswaId),
        kasusService.getBySiswaId(siswaId, { includeDeleted: true }),
        suratService.getBySiswaId(siswaId),
        settingsService.get()
      ]);

      setSiswa(siswaData);
      setKasusList(kasusData);
      setSuratList(suratData);
      setSettings(settingsData);
    } catch (err) {
      showToast(friendlyError(err, 'Gagal memuat profil siswa'), 'error');
    } finally {
      setLoading(false);
    }
  }

  if (loading || !siswa) {
    return (
      <AppLayout title="Memuat Profil Siswa...">
        <div className="py-20 text-center text-gray-400">Memuat data siswa...</div>
      </AppLayout>
    );
  }

  // Ambang batas dinamis dari pengaturan sekolah (fallback: 50, 80, 110)
  const ambang1 = settings.ambangSp1 || 50;
  const ambang2 = settings.ambangSp2 || 80;
  const ambang3 = settings.ambangSp3 || 110;

  // Persentase perhitungan progress meter visual (dibatasi maksimal 100%)
  const progressPercent = Math.min(Math.round((siswa.totalPoin / ambang3) * 100), 100);

  return (
    <AppLayout
      title={`Profil Siswa: ${siswa.nama}`}
      subtitle={`${siswa.kelas} • NISN: ${siswa.nisn}`}
    >
      <button
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Kembali</span>
      </button>

      {/* Top Profile Summary Card */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#4A6FA5]/10 text-[#4A6FA5] flex items-center justify-center font-bold text-xl font-heading border border-[#4A6FA5]/20 shrink-0">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold font-heading text-gray-900">{siswa.nama}</h2>
                <SPBadge status={siswa.statusSP} />
                {canEditStatus ? (
                  <CreatableCombobox
                    value={siswa.statusSiswa || 'aktif'}
                    disabled={savingStatus}
                    onChange={handleChangeStatusSiswa}
                    options={[
                      { value: 'aktif', label: 'Aktif' },
                      { value: 'lulus', label: 'Lulus' },
                      { value: 'pindah', label: 'Pindah Sekolah' },
                      { value: 'keluar', label: 'Keluar / DO' }
                    ]}
                    variant="pill"
                  />
                ) : (
                  siswa.statusSiswa && siswa.statusSiswa !== 'aktif' && (
                    <StatusSiswaBadge status={siswa.statusSiswa} />
                  )
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                NISN: <span className="font-semibold font-mono text-gray-700">{siswa.nisn}</span> • Kelas: <span className="font-bold text-gray-800">{siswa.kelas}</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Jurusan: {siswa.jurusan} (Angkatan {siswa.angkatan})
              </p>
            </div>
          </div>

          {/* Quick Actions for this student */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href={`/kasus/tambah?siswaId=${siswa.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Catat Pelanggaran</span>
            </Link>
            <Link
              href={`/surat?siswaId=${siswa.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
            >
              <FileText className="w-4 h-4" />
              <span>Buat Surat SP</span>
            </Link>
          </div>
        </div>

        {/* Visual Point Meter / Gauge */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs mb-2">
            <div>
              <span className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] block">
                Akumulasi Poin Pelanggaran Aktif
              </span>
              <span className="text-2xl font-extrabold text-red-600 font-heading">
                {siswa.totalPoin} <span className="text-xs font-normal text-gray-400">/ max {ambang3} Poin SP3</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-gray-500">
                {siswa.totalPoin >= ambang3
                  ? '⚠️ Telah melewati ambang batas SP3 (Rekomendasi DO/Dikembalikan)'
                  : siswa.totalPoin >= ambang2
                  ? `Sisa ${ambang3 - siswa.totalPoin} poin menuju SP3`
                  : siswa.totalPoin >= ambang1
                  ? `Sisa ${ambang2 - siswa.totalPoin} poin menuju SP2`
                  : `Sisa ${ambang1 - siswa.totalPoin} poin menuju SP1`}
              </span>
            </div>
          </div>

          {/* Progress bar with markers */}
          <div className="relative w-full h-4 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                siswa.totalPoin >= ambang3
                  ? 'bg-red-600'
                  : siswa.totalPoin >= ambang2
                  ? 'bg-orange-500'
                  : siswa.totalPoin >= ambang1
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Threshold markers */}
          <div className="flex justify-between text-[10px] text-gray-400 font-semibold mt-1 px-1">
            <span>0 (Aman)</span>
            <span>SP1 ({ambang1} pt)</span>
            <span>SP2 ({ambang2} pt)</span>
            <span>SP3 ({ambang3} pt)</span>
          </div>
        </div>
      </div>

      {/* Tabs: Riwayat Kasus & Arsip Surat */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="flex border-b border-gray-100 px-6 pt-4 gap-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab('riwayat')}
            className={`pb-3 border-b-2 transition-all ${
              activeTab === 'riwayat'
                ? 'border-[#4A6FA5] text-[#4A6FA5]'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            Kronologi Kasus ({kasusList.filter(k => !k.deletedAt).length})
          </button>
          <button
            onClick={() => setActiveTab('surat')}
            className={`pb-3 border-b-2 transition-all ${
              activeTab === 'surat'
                ? 'border-[#4A6FA5] text-[#4A6FA5]'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            Arsip Surat Peringatan ({suratList.length})
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'riwayat' ? (
            <div className="space-y-4">
              {kasusList.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  Siswa ini bersih dan belum memiliki riwayat catatan pelanggaran.
                </div>
              ) : (
                kasusList.map((kasus) => (
                  <div
                    key={kasus.id}
                    className={`p-4 rounded-xl border transition-all ${
                      kasus.deletedAt
                        ? 'bg-gray-50 border-gray-200 opacity-60'
                        : 'bg-white border-gray-100 hover:border-gray-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className={`text-sm font-bold ${kasus.deletedAt ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                              {kasus.kategoriNama}
                            </h4>
                            <PoinBadge poin={kasus.poin} />
                            <KasusStatusBadge status={kasus.status} />
                            {kasus.deletedAt && (
                              <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-[10px] font-semibold">
                                Dihapus (Recycle Bin)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {kasus.deskripsi || 'Tidak ada catatan kronologi.'}
                          </p>
                          <div className="flex items-center gap-4 text-[11px] text-gray-400 mt-2">
                            <span>Tanggal: {formatTanggal(kasus.tanggal)}</span>
                            <span>Pelapor: {kasus.createdByNama}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {suratList.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  Belum ada surat peringatan yang diterbitkan untuk siswa ini.
                </div>
              ) : (
                suratList.map((surat) => (
                  <div key={surat.id} className="p-4 bg-gray-50 rounded-xl flex items-center justify-between border border-gray-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">
                          {surat.nomorSurat}
                        </span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[10px] uppercase">
                          {surat.jenis}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Status: {surat.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Diterbitkan tanggal: {formatTanggal(surat.tanggalSurat)} • Akumulasi Poin: {surat.totalPoin} pt
                      </p>
                    </div>
                    <Link
                      href={`/surat?id=${surat.id}`}
                      className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-semibold"
                    >
                      Lihat Surat
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
