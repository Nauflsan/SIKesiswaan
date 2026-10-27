/**
 * ============================================================================
 * KOMPONEN: BersihkanLulusanPanel (src/components/maintenance/BersihkanLulusanPanel.jsx)
 * ============================================================================
 * Panel pemeliharaan data untuk Administrator:
 * - Pengaturan masa simpan lulusan (1, 3, 6, 12 bulan).
 * - Identifikasi kandidat siswa tidak aktif yang telah melewati masa simpan.
 * - Penghitungan dampak penghapusan (siswa, kasus, soft-deleted kasus, surat).
 * - Pengunduhan arsip spreadsheet (.xlsx) wajib 3-sheet sebelum penghapusan.
 * - Konfirmasi ketik 'HAPUS PERMANEN' dengan proteksi berlapis.
 * - Penghapusan massal atomik bertahap per 400 dokumen via writeBatch.
 */

import { useState, useEffect, useMemo } from 'preact/hooks';
import CreatableCombobox from '../ui/CreatableCombobox.jsx';
import { maintenanceService, settingsService } from '../../services/index.js';
import { formatTanggal, formatBadgeStatusSiswa } from '../../lib/helpers.js';
import { friendlyError } from '../../lib/errors.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useUIStore } from '../../stores/uiStore.js';
import {
  Trash2,
  Search,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Save,
  Clock,
  ShieldAlert,
  Users,
  CheckSquare,
  Square,
  RefreshCw
} from 'lucide-preact';

const OPSI_MASA_SIMPAN = [
  { value: '1', label: '1 Bulan' },
  { value: '3', label: '3 Bulan (Bawaan)' },
  { value: '6', label: '6 Bulan' },
  { value: '12', label: '12 Bulan (1 Tahun)' }
];

export default function BersihkanLulusanPanel() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  // Pengaturan Masa Simpan
  const [masaSimpan, setMasaSimpan] = useState('3');
  const [savingMasaSimpan, setSavingMasaSimpan] = useState(false);

  // Status Pencarian Kandidat
  const [loadingKandidat, setLoadingKandidat] = useState(false);
  const [kandidatLoaded, setKandidatLoaded] = useState(false);
  const [kandidatLayak, setKandidatLayak] = useState([]);
  const [kandidatBelum, setKandidatBelum] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Status Dampak & Arsip
  const [loadingDampak, setLoadingDampak] = useState(false);
  const [dampakData, setDampakData] = useState(null);
  const [exportingArsip, setExportingArsip] = useState(false);
  const [arsipDownloaded, setArsipDownloaded] = useState(false);

  // Status Konfirmasi & Eksekusi Hapus
  const [confirmText, setConfirmText] = useState('');
  const [processingHapus, setProcessingHapus] = useState(false);
  const [progressInfo, setProgressInfo] = useState(null);

  // Inisialisasi pengaturan masa simpan saat komponen dimuat
  useEffect(() => {
    async function loadSettings() {
      try {
        const s = await settingsService.get();
        if (s?.masaSimpanLulusanBulan) {
          setMasaSimpan(String(s.masaSimpanLulusanBulan));
        }
      } catch {
        // Abaikan kegagalan inisialisasi settings awal
      }
    }
    loadSettings();
  }, []);

  // Simpan pengaturan masa simpan ke settings/global
  const handleSaveMasaSimpan = async () => {
    if (savingMasaSimpan || processingHapus) return;
    setSavingMasaSimpan(true);
    try {
      await settingsService.update({ masaSimpanLulusanBulan: Number(masaSimpan) }, user);
      showToast('Masa simpan lulusan berhasil disimpan', 'success');
    } catch (err) {
      showToast('Gagal menyimpan masa simpan: ' + friendlyError(err, 'Terjadi kesalahan sistem'), 'error');
    } finally {
      setSavingMasaSimpan(false);
    }
  };

  // Cari kandidat siswa tidak aktif berdasarkan masa simpan
  const handleCariKandidat = async () => {
    if (loadingKandidat || processingHapus) return;
    setLoadingKandidat(true);
    try {
      const res = await maintenanceService.getKandidat(Number(masaSimpan));
      setKandidatLayak(res.layak || []);
      setKandidatBelum(res.belum || []);
      setKandidatLoaded(true);

      // Bawaan: semua siswa yang layak dibersihkan langsung tercentang
      const allLayakIds = new Set((res.layak || []).map(s => s.id));
      setSelectedIds(allLayakIds);

      // Reset alur verifikasi & dampak
      setDampakData(null);
      setArsipDownloaded(false);
      setConfirmText('');
      setProgressInfo(null);

      if ((res.layak || []).length === 0) {
        showToast('Tidak ada siswa tidak aktif yang memenuhi syarat masa simpan', 'info');
      } else {
        showToast(`Ditemukan ${res.layak.length} siswa layak dibersihkan`, 'success');
      }
    } catch (err) {
      showToast('Gagal mencari kandidat: ' + friendlyError(err, 'Terjadi kesalahan sistem'), 'error');
    } finally {
      setLoadingKandidat(false);
    }
  };

  // Toggle pilihan kotak centang per baris
  const handleToggleSelect = (id) => {
    if (processingHapus) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setDampakData(null);
    setArsipDownloaded(false);
    setConfirmText('');
  };

  // Toggle Pilih Semua
  const handleToggleSelectAll = () => {
    if (processingHapus) return;
    if (selectedIds.size === kandidatLayak.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(kandidatLayak.map(s => s.id)));
    }
    setDampakData(null);
    setArsipDownloaded(false);
    setConfirmText('');
  };

  // Hitung sisa hari tunggu terdekat pada kandidat belum layak
  const minSisaHari = useMemo(() => {
    if (kandidatBelum.length === 0) return null;
    return Math.min(...kandidatBelum.map(b => b.sisaHari));
  }, [kandidatBelum]);

  // Daftar siswa terpilih
  const terpilihList = useMemo(() => {
    return kandidatLayak.filter(s => selectedIds.has(s.id));
  }, [kandidatLayak, selectedIds]);

  // Hitung dampak penghapusan (baca kasus & surat)
  const handleHitungDampak = async () => {
    if (selectedIds.size === 0 || loadingDampak || processingHapus) return;
    setLoadingDampak(true);
    try {
      const res = await maintenanceService.hitungDampak(terpilihList);
      setDampakData(res);
      setArsipDownloaded(false);
      setConfirmText('');
      showToast('Perhitungan dampak penghapusan selesai', 'info');
    } catch (err) {
      showToast('Gagal menghitung dampak: ' + friendlyError(err, 'Terjadi kesalahan sistem'), 'error');
    } finally {
      setLoadingDampak(false);
    }
  };

  // Unduh Arsip Excel (Siswa, Kasus, Surat)
  const handleUnduhArsip = async () => {
    if (!dampakData || exportingArsip || processingHapus) return;
    setExportingArsip(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Sheet 1: Siswa
      const rowsSiswa = terpilihList.map((s, idx) => ({
        'No': idx + 1,
        'NISN': s.nisn || '-',
        'Nama Siswa': s.nama || '-',
        'Kelas': s.kelas || '-',
        'Jurusan': s.jurusan || '-',
        'Angkatan': s.angkatan || '-',
        'Status Siswa': s.statusSiswa || '-',
        'Tanggal Nonaktif': s.tanggalNonaktifEfektif
          ? (s.isPerkiraan ? `${formatTanggal(s.tanggalNonaktifEfektif)} (perkiraan)` : formatTanggal(s.tanggalNonaktifEfektif))
          : '-',
        'Total Poin': Number(s.totalPoin || 0),
        'Status SP': s.statusSP || 'normal'
      }));
      const wsSiswa = XLSX.utils.json_to_sheet(rowsSiswa);
      wsSiswa['!cols'] = [
        { wch: 5 }, { wch: 16 }, { wch: 28 }, { wch: 12 },
        { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 24 },
        { wch: 12 }, { wch: 12 }
      ];
      XLSX.utils.book_append_sheet(wb, wsSiswa, 'Siswa');

      // Sheet 2: Kasus
      const rowsKasus = (dampakData.kasusDocs || []).map((k, idx) => ({
        'No': idx + 1,
        'Tanggal': k.tanggal || '-',
        'NISN': k.siswaNisn || '-',
        'Nama Siswa': k.siswaNama || '-',
        'Kelas Kejadian': k.siswaKelas || '-',
        'Kategori': k.kategoriNama || '-',
        'Poin': Number(k.poin || 0),
        'Deskripsi': k.deskripsi || '-',
        'Status Kasus': k.status || 'baru',
        'Status Arsip': k.deletedAt ? `Dihapus Lunak (${formatTanggal(k.deletedAt)})` : 'Aktif',
        'Dicatat Oleh': k.createdByNama || '-'
      }));
      const wsKasus = XLSX.utils.json_to_sheet(rowsKasus);
      wsKasus['!cols'] = [
        { wch: 5 }, { wch: 14 }, { wch: 16 }, { wch: 28 },
        { wch: 16 }, { wch: 24 }, { wch: 8 }, { wch: 32 },
        { wch: 14 }, { wch: 24 }, { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, wsKasus, 'Kasus');

      // Sheet 3: Surat
      const rowsSurat = (dampakData.suratDocs || []).map((srt, idx) => ({
        'No': idx + 1,
        'Tanggal Surat': srt.tanggalSurat || '-',
        'Nomor Surat': srt.nomorSurat || '-',
        'NISN': srt.siswaNisn || '-',
        'Nama Siswa': srt.siswaNama || '-',
        'Kelas': srt.siswaKelas || '-',
        'Jenis': (srt.jenis || '').toUpperCase(),
        'Perihal': srt.perihal || '-',
        'Total Poin': Number(srt.totalPoin || 0),
        'Panggilan Orang Tua': srt.panggilanOrtu ? 'Ya' : 'Tidak',
        'Keterangan Panggilan': srt.keteranganPanggilan || '-',
        'Keterangan Tambahan': srt.keteranganTambahan || '-',
        'Penandatangan': srt.createdByNama || '-'
      }));
      const wsSurat = XLSX.utils.json_to_sheet(rowsSurat);
      wsSurat['!cols'] = [
        { wch: 5 }, { wch: 14 }, { wch: 28 }, { wch: 16 },
        { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 30 },
        { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, wsSurat, 'Surat');

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const filename = `Arsip_Lulusan_${yyyy}${mm}${dd}.xlsx`;

      XLSX.writeFile(wb, filename);
      setArsipDownloaded(true);
      showToast('Arsip Excel berhasil diunduh. Simpan berkas ini dengan aman.', 'success');
    } catch (err) {
      showToast('Gagal mengunduh arsip: ' + friendlyError(err, 'Terjadi kesalahan sistem'), 'error');
    } finally {
      setExportingArsip(false);
    }
  };

  // Eksekusi Hapus Permanen
  const handleHapusPermanen = async () => {
    if (
      confirmText !== 'HAPUS PERMANEN' ||
      !arsipDownloaded ||
      !dampakData ||
      selectedIds.size === 0 ||
      processingHapus
    ) {
      return;
    }

    setProcessingHapus(true);
    setProgressInfo({ tahap: 'Verifikasi', selesai: 0, total: selectedIds.size });

    try {
      const res = await maintenanceService.hapusPermanenLulusan(
        {
          siswaIds: Array.from(selectedIds),
          kasusIds: (dampakData.kasusDocs || []).map(k => k.id),
          suratIds: (dampakData.suratDocs || []).map(s => s.id),
          masaSimpanBulan: Number(masaSimpan)
        },
        user,
        (progress) => {
          setProgressInfo(progress);
        }
      );

      showToast(
        `Pembersihan selesai: ${res.siswa} siswa, ${res.kasus} kasus, dan ${res.surat} surat peringatan berhasil dihapus permanen.`,
        'success',
        8000
      );

      // Reset state form setelah berhasil
      setSelectedIds(new Set());
      setDampakData(null);
      setArsipDownloaded(false);
      setConfirmText('');
      setProgressInfo(null);

      // Muat ulang daftar kandidat
      await handleCariKandidat();
    } catch (err) {
      showToast(
        'Gagal membersihkan data: ' + friendlyError(err, 'Terjadi kesalahan sistem'),
        'error',
        10000
      );
    } finally {
      setProcessingHapus(false);
    }
  };

  const isAllSelected = kandidatLayak.length > 0 && selectedIds.size === kandidatLayak.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < kandidatLayak.length;

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs space-y-6">
      {/* Header Panel */}
      <div>
        <h4 className="font-bold font-heading text-sm text-gray-900 mb-1 flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-rose-600" />
          <span>Masa Simpan & Bersihkan Lulusan (Hapus Permanen)</span>
        </h4>
        <p className="text-xs text-gray-500 leading-relaxed">
          Admin dapat menghapus permanen data siswa tidak aktif (lulus, pindah, keluar) yang sudah melewati masa simpan, beserta seluruh riwayat kasus dan arsip surat peringatan miliknya. Penghapusan ini selalu didahului pengunduhan arsip spreadsheet.
        </p>

        {/* Kotak Peringatan Merah (Section 10.3) */}
        <div className="mt-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5 text-rose-900">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Peringatan Penting Pembersihan Permanen</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-rose-700 ml-1">
            <li>Tindakan ini tidak dapat dibatalkan.</li>
            <li>Kasus siswa ini tidak akan lagi muncul di Rekap periode lama.</li>
            <li>Arsip Excel hanya untuk dibaca dan tidak bisa dipulihkan ke aplikasi.</li>
          </ul>
        </div>
      </div>

      {/* Bagian 1: Pengaturan Masa Simpan */}
      <div className="p-4 bg-gray-50/70 border border-gray-200/70 rounded-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="w-full sm:w-64">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Masa Simpan Data Lulusan
            </label>
            <CreatableCombobox
              value={masaSimpan}
              onChange={(val) => {
                setMasaSimpan(val);
                setKandidatLoaded(false);
                setKandidatLayak([]);
                setKandidatBelum([]);
                setSelectedIds(new Set());
                setDampakData(null);
                setArsipDownloaded(false);
                setConfirmText('');
              }}
              options={OPSI_MASA_SIMPAN}
              creatable={false}
              disabled={savingMasaSimpan || processingHapus}
              variant="input"
            />
          </div>
          <div className="flex items-center gap-2 pt-0 sm:pt-5">
            <button
              type="button"
              onClick={handleSaveMasaSimpan}
              disabled={savingMasaSimpan || processingHapus}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className={`w-3.5 h-3.5 ${savingMasaSimpan ? 'animate-spin' : ''}`} />
              <span>{savingMasaSimpan ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
            </button>
            <button
              type="button"
              onClick={handleCariKandidat}
              disabled={loadingKandidat || processingHapus}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <Search className={`w-3.5 h-3.5 ${loadingKandidat ? 'animate-spin' : ''}`} />
              <span>{loadingKandidat ? 'Mencari...' : 'Cari Kandidat'}</span>
            </button>
          </div>
        </div>
        <p className="text-[11px] text-gray-500">
          Siswa tidak aktif baru dapat dibersihkan setelah <strong>{masaSimpan} bulan</strong> sejak dinonaktifkan.
        </p>
      </div>

      {/* Bagian 2: Hasil Pencarian Kandidat */}
      {kandidatLoaded && (
        <div className="space-y-6 pt-2">
          {/* Subbagian 2A: Layak Dibersihkan */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-gray-900">
                  Layak Dibersihkan ({kandidatLayak.length})
                </span>
                {kandidatLayak.length > 0 && (
                  <span className="text-[11px] text-gray-500 font-medium">
                    • {selectedIds.size} dipilih
                  </span>
                )}
              </div>
              {kandidatLayak.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  disabled={processingHapus}
                  className="text-xs text-[#4A6FA5] hover:underline font-semibold inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  {isAllSelected ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Batal Pilih Semua</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      <span>Pilih Semua ({kandidatLayak.length})</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {kandidatLayak.length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-xl text-center text-xs text-gray-500 italic">
                Tidak ada siswa tidak aktif yang telah melewati masa simpan {masaSimpan} bulan.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-semibold sticky top-0 z-10">
                    <tr>
                      <th className="py-2 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = isPartiallySelected;
                          }}
                          onChange={handleToggleSelectAll}
                          disabled={processingHapus}
                          className="rounded border-gray-300 text-[#4A6FA5] focus:ring-[#4A6FA5] cursor-pointer"
                        />
                      </th>
                      <th className="py-2 px-3">Nama Siswa</th>
                      <th className="py-2 px-3">NISN</th>
                      <th className="py-2 px-3">Kelas</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Tanggal Nonaktif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {kandidatLayak.map((s) => {
                      const isSelected = selectedIds.has(s.id);
                      const statusBadge = formatBadgeStatusSiswa(s.statusSiswa);
                      return (
                        <tr
                          key={s.id}
                          onClick={() => handleToggleSelect(s.id)}
                          className={`hover:bg-gray-50/60 cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          <td
                            className="py-2 px-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(s.id)}
                              disabled={processingHapus}
                              className="rounded border-gray-300 text-[#4A6FA5] focus:ring-[#4A6FA5] cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3 font-semibold text-gray-900">
                            {s.nama}
                          </td>
                          <td className="py-2 px-3 font-mono text-gray-600">
                            {s.nisn || '-'}
                          </td>
                          <td className="py-2 px-3 text-gray-700">
                            {s.kelas || '-'}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${statusBadge.color}`}
                            >
                              {statusBadge.label}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                            <span>{formatTanggal(s.tanggalNonaktifEfektif)}</span>
                            {s.isPerkiraan && (
                              <span className="ml-1 text-[10px] text-gray-400 italic">
                                (perkiraan)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Subbagian 2B: Belum Layak Dibersihkan */}
          {kandidatBelum.length > 0 && (
            <div className="p-3.5 bg-gray-50 border border-gray-200/80 rounded-xl flex items-center justify-between text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                <span>
                  <strong>{kandidatBelum.length} siswa</strong> belum melewati masa simpan {masaSimpan} bulan
                  {minSisaHari !== null && ` (sisa waktu tunggu terdekat: ${minSisaHari} hari)`}.
                </span>
              </div>
              <span className="text-[11px] text-gray-400 font-medium">Belum Layak</span>
            </div>
          )}

          {/* Bagian 3: Hitung Dampak */}
          {kandidatLayak.length > 0 && (
            <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-200/70 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h5 className="font-bold text-xs text-gray-900">
                    Langkah 1: Hitung Dampak Penghapusan
                  </h5>
                  <p className="text-[11px] text-gray-500">
                    Memeriksa seluruh berkas kasus pelanggaran dan surat peringatan yang terkait dengan siswa terpilih.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleHitungDampak}
                  disabled={selectedIds.size === 0 || loadingDampak || processingHapus}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDampak ? 'animate-spin' : ''}`} />
                  <span>{loadingDampak ? 'Menghitung...' : 'Hitung Dampak'}</span>
                </button>
              </div>

              {/* Ringkasan Dampak */}
              {dampakData && (
                <div className="p-3 bg-white rounded-lg border border-indigo-100 text-xs text-indigo-950 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-indigo-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Hasil Analisis Dampak:</span>
                  </div>
                  <p>
                    Akan dihapus permanen: <strong>{dampakData.siswa}</strong> siswa,{' '}
                    <strong>{dampakData.kasus}</strong> kasus{' '}
                    <span className="text-gray-500">
                      (termasuk {dampakData.kasusSoftDeleted} yang sudah dihapus lunak)
                    </span>
                    , dan <strong>{dampakData.surat}</strong> surat.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Bagian 4: Unduh Arsip Wajib */}
          {dampakData && (
            <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-200/70 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h5 className="font-bold text-xs text-gray-900">
                    Langkah 2: Unduh Berkas Arsip (Wajib)
                  </h5>
                  <p className="text-[11px] text-gray-500">
                    Unduh spreadsheet Excel berisi 3 sheet (Siswa, Kasus, Surat) sebelum tombol konfirmasi aktif.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleUnduhArsip}
                  disabled={exportingArsip || processingHapus}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <FileSpreadsheet className={`w-3.5 h-3.5 ${exportingArsip ? 'animate-spin' : ''}`} />
                  <span>{exportingArsip ? 'Mengunduh...' : 'Unduh Arsip (Excel)'}</span>
                </button>
              </div>

              {arsipDownloaded && (
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Arsip Excel telah berhasil diunduh untuk sesi pembersihan ini.</span>
                </div>
              )}
            </div>
          )}

          {/* Bagian 5: Konfirmasi Ketik & Eksekusi Hapus */}
          {dampakData && (
            <div className="p-4 bg-rose-50/40 rounded-xl border border-rose-200 space-y-4">
              <div>
                <h5 className="font-bold text-xs text-rose-950">
                  Langkah 3: Konfirmasi & Hapus Permanen
                </h5>
                <p className="text-[11px] text-rose-700">
                  Ketik persis <strong className="font-mono bg-white px-1 py-0.5 rounded border border-rose-200">HAPUS PERMANEN</strong> di bawah ini untuk membuka kunci tombol eksekusi.
                </p>
              </div>

              {/* Progress Bar Eksekusi */}
              {processingHapus && progressInfo && (
                <div className="p-3.5 bg-white border border-rose-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-rose-950 font-semibold">
                    <span>Sedang memproses pembersihan...</span>
                    <span>
                      {progressInfo.tahap && progressInfo.total > 0
                        ? `Menghapus ${progressInfo.tahap} ${progressInfo.selesai}/${progressInfo.total}`
                        : progressInfo.tahap || 'Menyiapkan verifikasi...'}
                    </span>
                  </div>
                  <div className="w-full bg-rose-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-rose-600 h-2 transition-all duration-300 rounded-full"
                      style={{
                        width:
                          progressInfo.total > 0
                            ? `${Math.round((progressInfo.selesai / progressInfo.total) * 100)}%`
                            : '100%'
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  value={confirmText}
                  onInput={(e) => setConfirmText(e.target.value)}
                  placeholder="Ketik HAPUS PERMANEN"
                  disabled={!arsipDownloaded || processingHapus}
                  className="px-3 py-2 text-xs bg-white border border-rose-300 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-rose-500 font-mono flex-1 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleHapusPermanen}
                  disabled={
                    confirmText !== 'HAPUS PERMANEN' ||
                    !arsipDownloaded ||
                    !dampakData ||
                    selectedIds.size === 0 ||
                    processingHapus
                  }
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                >
                  <Trash2 className={`w-3.5 h-3.5 ${processingHapus ? 'animate-spin' : ''}`} />
                  <span>{processingHapus ? 'Memproses Hapus...' : 'Hapus Permanen'}</span>
                </button>
              </div>

              {!arsipDownloaded && (
                <p className="text-[11px] text-gray-500 italic">
                  * Tombol Hapus Permanen terkunci hingga berkas arsip Excel berhasil diunduh.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
