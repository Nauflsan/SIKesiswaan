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

import { useState, useEffect, useMemo } from 'preact/hooks';
import { Link, useRoute, useLocation } from 'wouter-preact';
import AppLayout from '../components/layout/AppLayout.jsx';
import Modal from '../components/ui/Modal.jsx';
import CreatableCombobox from '../components/ui/CreatableCombobox.jsx';
import { SPBadge, KasusStatusBadge, PoinBadge, StatusSiswaBadge } from '../components/ui/Badge.jsx';
import { siswaService, kasusService, suratService, settingsService, kelasService, logService } from '../services/index.js';
import { friendlyError } from '../lib/errors.js';
import { useAuthStore } from '../stores/authStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { formatTanggal, formatBadgeStatusSiswa, DEFAULT_KELAS, getRentangPeriodePreset } from '../lib/helpers.js';
import { filterKasusPeriode, eksporLaporanExcel } from '../lib/laporan.js';
import LaporanSiswa from '../components/print/LaporanSiswa.jsx';
import {
  ArrowLeft,
  FileText,
  PlusCircle,
  AlertTriangle,
  GraduationCap,
  Pencil,
  Printer,
  FileSpreadsheet
} from 'lucide-preact';

export default function SiswaDetail() {
  // Tangkap parameter :id dari routing URL /siswa/:id
  const [, params] = useRoute('/siswa/:id');
  const siswaId = params?.id;
  const [, setLocation] = useLocation();

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

  // State Modal Edit Data Siswa
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    nisn: '',
    nama: '',
    kelas: '',
    jurusan: '',
    angkatan: new Date().getFullYear()
  });
  const [syncKasus, setSyncKasus] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // State Modal Konfirmasi Hapus Siswa Permanen
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [kelasList, setKelasList] = useState(DEFAULT_KELAS);

  // State Modal Laporan Kedisiplinan Siswa
  const [showLaporanModal, setShowLaporanModal] = useState(false);
  const [periodePreset, setPeriodePreset] = useState('seluruh');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [exportingExcel, setExportingExcel] = useState(false);

  const canEditStatus = user?.role === 'admin' || user?.role === 'guru_bk';

  // Muat daftar kelas dari kelasService (fallback DEFAULT_KELAS)
  useEffect(() => {
    kelasService.get().then((list) => {
      if (Array.isArray(list) && list.length > 0) {
        setKelasList(list);
      }
    }).catch(() => {
      setKelasList(DEFAULT_KELAS);
    });
  }, []);

  // Opsi dropdown kelas (kelasList digabung kelas saat ini, tanpa duplikat, diurutkan)
  const kelasOptions = useMemo(() => {
    const setK = new Set(kelasList);
    if (siswa?.kelas) setK.add(siswa.kelas);
    return Array.from(setK).sort();
  }, [kelasList, siswa?.kelas]);

  // Cek apakah siswa memiliki riwayat kasus atau surat (termasuk kasus soft-delete)
  const hasHistory = kasusList.length > 0 || suratList.length > 0;

  // Cek apakah nama atau NISN berubah untuk menampilkan checkbox sinkronisasi kasus
  const isNameOrNisnChanged = Boolean(
    siswa &&
      (editForm.nama.trim() !== (siswa.nama || '').trim() ||
        editForm.nisn.trim() !== String(siswa.nisn || '').trim())
  );
  const showSyncCheckbox = isNameOrNisnChanged && kasusList.length > 0;

  const openEditModal = () => {
    if (!siswa) return;
    setEditForm({
      nisn: siswa.nisn || '',
      nama: siswa.nama || '',
      kelas: siswa.kelas || '',
      jurusan: siswa.jurusan || '',
      angkatan: siswa.angkatan || new Date().getFullYear()
    });
    setSyncKasus(true);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!siswa) return;

    setSavingEdit(true);
    try {
      const hasil = await siswaService.updateProfil(
        siswa.id,
        {
          nisn: editForm.nisn,
          nama: editForm.nama,
          kelas: editForm.kelas,
          jurusan: editForm.jurusan,
          angkatan: editForm.angkatan
        },
        { syncKasus },
        user
      );

      setShowEditModal(false);
      setSiswa(hasil.siswa);

      // Jika ada sinkronisasi kasus, perbarui data kasusList di state lokal
      if (hasil.kasusDisinkronkan > 0) {
        setKasusList((prev) =>
          prev.map((k) => ({
            ...k,
            siswaNama: hasil.siswa.nama,
            siswaNisn: hasil.siswa.nisn
          }))
        );
      }

      const isChanged =
        hasil.siswa.nama !== siswa.nama ||
        hasil.siswa.nisn !== siswa.nisn ||
        hasil.siswa.kelas !== siswa.kelas ||
        hasil.siswa.jurusan !== siswa.jurusan ||
        hasil.siswa.angkatan !== siswa.angkatan;

      // Jika kelas berubah dan belum ada di daftar, tambahkan ke meta/kelas
      const newKelas = (hasil.siswa.kelas || '').trim();
      const oldKelas = (siswa.kelas || '').trim();
      const kelasChanged = newKelas && newKelas.toLowerCase() !== oldKelas.toLowerCase();
      const alreadyInList = kelasList.some(k => k.toLowerCase() === newKelas.toLowerCase());

      if (kelasChanged && !alreadyInList) {
        try {
          const updated = await kelasService.add(newKelas);
          setKelasList(updated);
        } catch {
          // Diam bila gagal menambah kelas ke meta/kelas
          setKelasList(prev => [...prev, newKelas].sort());
        }
      }

      if (!isChanged) {
        showToast('Tidak ada perubahan data', 'info');
      } else {
        showToast('Data siswa berhasil diperbarui', 'success');
      }
    } catch (err) {
      showToast(err.message || friendlyError(err, 'Gagal menyimpan perubahan'), 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteSiswaPermanen = async () => {
    if (!siswa) return;
    setDeleting(true);
    try {
      await siswaService.hapusPermanen(siswa.id, user);
      showToast('Siswa dihapus permanen', 'success');
      setShowDeleteConfirm(false);
      setLocation('/siswa');
    } catch (err) {
      showToast(err.message || friendlyError(err, 'Gagal menghapus siswa'), 'error');
    } finally {
      setDeleting(false);
    }
  };

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

  // Filter kasus dan penetapan label periode laporan kedisiplinan siswa
  const { filteredKasus, periodeLabel, isDateInvalid } = useMemo(() => {
    let mulai = '';
    let selesai = '';
    let label = 'Seluruh Riwayat';
    let invalid = false;

    if (periodePreset === 'kustom') {
      mulai = tanggalMulai;
      selesai = tanggalSelesai;
      if (mulai && selesai && mulai > selesai) {
        invalid = true;
      }
      if (mulai && selesai) {
        label = `${formatTanggal(mulai)} s.d. ${formatTanggal(selesai)}`;
      } else if (mulai) {
        label = `Mulai ${formatTanggal(mulai)}`;
      } else if (selesai) {
        label = `Sampai ${formatTanggal(selesai)}`;
      } else {
        label = 'Rentang Kustom (Semua)';
      }
    } else if (periodePreset !== 'seluruh') {
      const presetData = getRentangPeriodePreset(periodePreset, settings?.bulanMulaiTahunAjaran);
      mulai = presetData.tanggalMulai;
      selesai = presetData.tanggalSelesai;
      label = presetData.label;
    }

    const filtered = filterKasusPeriode(kasusList, mulai, selesai);
    return { filteredKasus: filtered, periodeLabel: label, isDateInvalid: invalid };
  }, [kasusList, periodePreset, tanggalMulai, tanggalSelesai, settings?.bulanMulaiTahunAjaran]);

  const handlePrintLaporan = async () => {
    if (isDateInvalid || !siswa) return;
    try {
      await logService.create({
        userId: user?.id,
        userNama: user?.nama,
        aksi: 'cetak_laporan',
        detail: `Mencetak laporan kedisiplinan ${siswa.nama} (periode: ${periodeLabel})`,
        targetId: siswa.id,
        targetType: 'siswa'
      });
    } catch {
      // Intentionally safe
    }
    window.print();
  };

  const handleExportExcelLaporan = async () => {
    if (isDateInvalid || exportingExcel || !siswa) return;
    setExportingExcel(true);
    try {
      await eksporLaporanExcel({
        tipe: 'siswa',
        data: { siswa, kasus: filteredKasus, suratList, settings },
        periodeLabel
      });
      showToast('Laporan Excel berhasil diunduh', 'success');
      await logService.create({
        userId: user?.id,
        userNama: user?.nama,
        aksi: 'cetak_laporan',
        detail: `Mengekspor laporan kedisiplinan ${siswa.nama} ke Excel`,
        targetId: siswa.id,
        targetType: 'siswa'
      });
    } catch (err) {
      showToast('Gagal mengekspor spreadsheet: ' + friendlyError(err, 'Terjadi kesalahan sistem'), 'error');
    } finally {
      setExportingExcel(false);
    }
  };

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
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {canEditStatus && (
              <button
                type="button"
                onClick={openEditModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl border border-gray-200 shadow-xs transition-all cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
                <span>Edit Data</span>
              </button>
            )}
            {canEditStatus && (
              <button
                type="button"
                onClick={() => setShowLaporanModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl border border-gray-200 shadow-xs transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-gray-500" />
                <span>Laporan</span>
              </button>
            )}
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

      {/* Modal Edit Data Siswa */}
      {showEditModal && (
        <Modal
          isOpen={true}
          onClose={() => !savingEdit && setShowEditModal(false)}
          title="Edit Data Siswa"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                NISN / Nomor Induk Siswa <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength="20"
                placeholder="Contoh: 0081234567 atau 11 digit"
                value={editForm.nisn}
                onInput={(e) =>
                  setEditForm({ ...editForm, nisn: e.target.value.replace(/\D/g, '') })
                }
                className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#4A6FA5] font-mono"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Mendukung 6 hingga 20 digit angka
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Nama Lengkap Siswa <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Nama sesuai ijazah/rapor"
                value={editForm.nama}
                onInput={(e) => setEditForm({ ...editForm, nama: e.target.value })}
                className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#4A6FA5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Kelas Siswa <span className="text-red-500">*</span>
              </label>
              <CreatableCombobox
                value={editForm.kelas}
                onChange={(val) => setEditForm({ ...editForm, kelas: val })}
                options={kelasOptions}
                placeholder="Pilih atau ketik kelas baru..."
                creatable={true}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Tahun Angkatan
                </label>
                <input
                  type="number"
                  value={editForm.angkatan}
                  onChange={(e) =>
                    setEditForm({ ...editForm, angkatan: Number(e.target.value) })
                  }
                  className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Jurusan / Konsentrasi Keahlian
              </label>
              <input
                type="text"
                list="jurusan-options-edit"
                placeholder="Ketik atau pilih jurusan (contoh: Teknik Komputer dan Jaringan)"
                value={editForm.jurusan}
                onInput={(e) => setEditForm({ ...editForm, jurusan: e.target.value })}
                className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#4A6FA5]"
              />
              <datalist id="jurusan-options-edit">
                <option value="Teknik Komputer dan Jaringan" />
                <option value="Teknik Kendaraan Ringan" />
              </datalist>
            </div>

            {showSyncCheckbox && (
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-1">
                <label className="flex items-start gap-2 cursor-pointer text-xs font-semibold text-blue-900">
                  <input
                    type="checkbox"
                    checked={syncKasus}
                    onChange={(e) => setSyncKasus(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-[#4A6FA5] focus:ring-[#4A6FA5]"
                  />
                  <span>
                    Perbarui juga nama dan NISN pada riwayat kasus ({kasusList.length} kasus)
                  </span>
                </label>
                <p className="text-[10px] text-gray-500 pl-5 leading-normal">
                  Kelas pada riwayat kasus tidak diubah agar tetap mencerminkan kelas saat kejadian.
                  Surat yang sudah terbit tidak diubah.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
              <div>
                {user?.role === 'admin' &&
                  (hasHistory ? (
                    <div>
                      <button
                        type="button"
                        disabled
                        className="text-xs font-semibold text-gray-400 cursor-not-allowed"
                      >
                        Hapus Siswa
                      </button>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Tidak dapat dihapus karena memiliki riwayat. Gunakan status Keluar, Lulus, atau Pindah.
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => {
                        setShowEditModal(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer disabled:opacity-50"
                    >
                      Hapus Siswa
                    </button>
                  ))}
              </div>

              <div className="flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => !deleting && setShowDeleteConfirm(false)}
          title="Konfirmasi Hapus Siswa"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Apakah Anda yakin ingin menghapus data siswa <strong>{siswa.nama}</strong> (NISN: {siswa.nisn})?
            </p>
            <div className="p-3 bg-red-50 rounded-xl text-xs text-red-800 border border-red-200">
              ⚠️ Data siswa dihapus permanen dan tidak dapat dikembalikan.
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteSiswaPermanen}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Laporan Kedisiplinan Siswa */}
      <Modal
        isOpen={showLaporanModal}
        onClose={() => setShowLaporanModal(false)}
        title="Laporan Kedisiplinan Siswa"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6">
          {/* Bagian Kontrol (no-print) */}
          <div className="no-print bg-gray-50/70 p-4 rounded-xl border border-gray-200/70 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-56 shrink-0">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Pilih Periode
                </label>
                <CreatableCombobox
                  value={periodePreset}
                  onChange={(val) => setPeriodePreset(val)}
                  options={[
                    { value: 'seluruh', label: 'Seluruh Riwayat' },
                    { value: 'tahun_ajaran_ini', label: 'Tahun Ajaran Ini' },
                    { value: 'semester_ganjil', label: 'Semester Ganjil' },
                    { value: 'semester_genap', label: 'Semester Genap' },
                    { value: 'kustom', label: 'Rentang Kustom' }
                  ]}
                  creatable={false}
                  searchable={false}
                  variant="input"
                />
              </div>

              {periodePreset === 'kustom' && (
                <div className="flex flex-wrap items-center gap-2 pt-4 sm:pt-0">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">
                      Tanggal Mulai
                    </label>
                    <input
                      type="date"
                      value={tanggalMulai}
                      onChange={(e) => setTanggalMulai(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-hidden focus:border-[#4A6FA5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">
                      Tanggal Selesai
                    </label>
                    <input
                      type="date"
                      value={tanggalSelesai}
                      onChange={(e) => setTanggalSelesai(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-hidden focus:border-[#4A6FA5]"
                    />
                  </div>
                </div>
              )}
            </div>

            {isDateInvalid && (
              <p className="text-xs text-red-600 font-medium">
                Tanggal mulai tidak boleh melebihi tanggal selesai.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200/60">
              <span className="text-xs text-gray-500">
                Menampilkan <strong>{filteredKasus.length}</strong> kasus ({periodeLabel})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportExcelLaporan}
                  disabled={isDateInvalid || exportingExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{exportingExcel ? 'Mengekspor...' : 'Export Excel'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintLaporan}
                  disabled={isDateInvalid}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowLaporanModal(false)}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-xs font-medium transition-all cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>

          {/* Area Cetak Dokumen */}
          <div
            id="printable-laporan-content"
            className="surat-resmi bg-white text-black p-8 sm:p-12 border border-gray-300 shadow-md rounded-lg max-w-full text-xs leading-normal"
          >
            <LaporanSiswa
              siswa={siswa}
              kasus={filteredKasus}
              suratList={suratList}
              settings={settings}
              user={user}
              periodeLabel={periodeLabel}
            />
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
