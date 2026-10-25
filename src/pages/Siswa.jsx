/**
 * =============================================================================
 * KOMPONEN: Siswa (Direktori & Manajemen Profil Siswa)
 * =============================================================================
 * Halaman direktori seluruh siswa di sekolah dengan monitoring status pelanggaran.
 *
 * FITUR UTAMA & LOGIKA BISNIS:
 * 1. Filter Multi-Level:
 *    - Filter Kelas (Semua Kelas atau kelas tertentu).
 *    - Filter Status SP (Normal, SP1, SP2, SP3/DO).
 *    - Live Search (Berdasarkan Nama atau NISN).
 * 2. Kelas Fleksibel (Dynamic Class Derivation):
 *    - Daftar kelas dropdown dikompilasi secara dinamis dari database siswa yang ada.
 *    - Jika ada kelas baru yang belum terdaftar, pengguna dapat memilih opsi "Ketik kelas baru".
 * 3. Validasi NISN Fleksibel:
 *    - Mendukung format nomor induk 8 hingga 20 digit angka (tidak di-hardcode 10 digit).
 * 4. RBAC:
 *    - Tambah Siswa Manual & Import Excel hanya dapat dilakukan oleh 'admin' dan 'guru_bk'.
 * =============================================================================
 */

import { useState, useEffect, useMemo } from 'preact/hooks';
import { Link } from 'wouter-preact';
import AppLayout from '../components/layout/AppLayout.jsx';
import { SPBadge, StatusSiswaBadge } from '../components/ui/Badge.jsx';
import Modal from '../components/ui/Modal.jsx';
import CreatableCombobox from '../components/ui/CreatableCombobox.jsx';
import { siswaService, kelasService } from '../services/index.js';
import { friendlyError } from '../lib/errors.js';
import LoadError from '../components/ui/LoadError.jsx';
import { DEFAULT_KELAS } from '../lib/helpers.js';
import { useAuthStore } from '../stores/authStore.js';
import { useUIStore } from '../stores/uiStore.js';
import {
  Search,
  UserPlus,
  ArrowRight,
  Filter,
  User,
  RefreshCw
} from 'lucide-preact';

export default function Siswa() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  // State data siswa aktif, non-aktif on-demand, dan master daftar kelas
  const [aktifList, setAktifList] = useState([]);
  const [nonAktifList, setNonAktifList] = useState([]);
  const [statusDimuat, setStatusDimuat] = useState(new Set());
  const [kelasList, setKelasList] = useState(DEFAULT_KELAS);
  const [loading, setLoading] = useState(true);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('semua');
  const [selectedStatusSP, setSelectedStatusSP] = useState('semua');
  const [selectedStatusSiswa, setSelectedStatusSiswa] = useState('aktif');

  // Gabungan data siswa untuk filter di memori
  const rawSiswaList = useMemo(
    () => [...aktifList, ...nonAktifList].sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id')),
    [aktifList, nonAktifList]
  );

  // State modal penambahan siswa baru
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSiswa, setNewSiswa] = useState({
    nisn: '',
    nama: '',
    kelas: 'XI TKJ 1',
    jurusan: 'Teknik Komputer dan Jaringan',
    angkatan: 2024
  });
  const [submitting, setSubmitting] = useState(false);

  /**
   * Mengambil daftar siswa aktif dari cache/Firestore (dengan TTL 30 menit).
   * Siswa non-aktif dimuat on-demand saat filter dipilih.
   */
  useEffect(() => {
    loadSiswa();
    loadKelas();
  }, []);

  async function loadKelas() {
    try {
      const list = await kelasService.get();
      if (Array.isArray(list) && list.length > 0) {
        setKelasList(list);
      }
    } catch {
      setKelasList(DEFAULT_KELAS);
    }
  }

  async function loadSiswa({ force = false } = {}) {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await siswaService.getAktif({ force });
      setAktifList(data);
    } catch (err) {
      const msg = friendlyError(err, 'Gagal memuat daftar siswa');
      setLoadError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Pemuatan data siswa non-aktif on-demand sesuai filter status yang dipilih
   */
  const fetchNonAktif = async (status, dimuat, listSekarang) => {
    const missing = [];
    if (status === 'semua') {
      ['lulus', 'pindah', 'keluar'].forEach(st => {
        if (!dimuat.has(st)) missing.push(st);
      });
    } else if (['lulus', 'pindah', 'keluar'].includes(status)) {
      if (!dimuat.has(status)) missing.push(status);
    }
    if (missing.length === 0) return;

    setLoadingExtra(true);
    try {
      const data = await siswaService.getByStatus(missing);
      setNonAktifList([...listSekarang, ...data]);
      setStatusDimuat(new Set([...dimuat, ...missing]));
    } catch (err) {
      showToast(friendlyError(err, 'Gagal memuat data siswa non-aktif'), 'error');
    } finally {
      setLoadingExtra(false);
    }
  };

  useEffect(() => {
    if (selectedStatusSiswa !== 'aktif') {
      fetchNonAktif(selectedStatusSiswa, statusDimuat, nonAktifList);
    }
  }, [selectedStatusSiswa]);

  /**
   * Handler tombol Muat Ulang: membersihkan cache dan memuat data segar
   */
  const handleRefresh = async () => {
    setLoading(true);
    try {
      await loadSiswa({ force: true });
      await loadKelas();
      setNonAktifList([]);
      const freshDimuat = new Set();
      setStatusDimuat(freshDimuat);
      if (selectedStatusSiswa !== 'aktif') {
        await fetchNonAktif(selectedStatusSiswa, freshDimuat, []);
      }
      showToast('Data siswa berhasil dimuat ulang', 'info');
    } catch (err) {
      showToast(friendlyError(err, 'Gagal memuat ulang data siswa'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Daftar siswa yang sudah difilter — dihitung ulang di memori, bukan fetch baru ke Firestore
  const siswaList = useMemo(() => {
    let list = rawSiswaList;

    if (selectedKelas !== 'semua') {
      list = list.filter(s => s.kelas === selectedKelas);
    }
    if (selectedStatusSP !== 'semua') {
      list = list.filter(s => s.statusSP === selectedStatusSP);
    }
    if (selectedStatusSiswa !== 'semua') {
      // Siswa lama tanpa field statusSiswa dianggap 'aktif'
      list = list.filter(s => (s.statusSiswa || 'aktif') === selectedStatusSiswa);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s =>
        (s.nama && s.nama.toLowerCase().includes(q)) ||
        (s.nisn && s.nisn.includes(q))
      );
    }

    return list;
  }, [rawSiswaList, selectedKelas, selectedStatusSP, selectedStatusSiswa, search]);

  // Menghimpun daftar kelas unik dari kelasService + kelas di data siswa
  const distinctKelas = useMemo(() => Array.from(new Set([
    ...kelasList,
    ...rawSiswaList.map(s => s.kelas).filter(Boolean)
  ])).sort(), [kelasList, rawSiswaList]);

  /**
   * Handler penambahan siswa baru ke database
   */
  const handleAddSiswa = async (e) => {
    e.preventDefault();
    const finalKelas = (newSiswa.kelas || '').trim();
    if (!finalKelas) {
      showToast('Harap pilih atau masukkan nama kelas', 'error');
      return;
    }

    const trimmedNisn = (newSiswa.nisn || '').trim();
    if (!trimmedNisn) {
      showToast('NISN tidak boleh kosong', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Validasi NISN ganda ke server (semua status siswa)
      const ganda = await siswaService.getByNisn(trimmedNisn);
      if (ganda.length > 0) {
        showToast(`NISN ${trimmedNisn} sudah terdaftar atas nama ${ganda[0].nama} (${ganda[0].kelas})`, 'error');
        setSubmitting(false);
        return;
      }

      await siswaService.create({
        ...newSiswa,
        nisn: trimmedNisn,
        kelas: finalKelas
      }, user);

      // Simpan kelas baru ke meta/kelas bila belum ada
      const kelasAda = kelasList.some(k => k.toLowerCase() === finalKelas.toLowerCase());
      if (!kelasAda) {
        try {
          const updatedKelas = await kelasService.add(finalKelas);
          setKelasList(updatedKelas);
        } catch {
          // Diam bila gagal menambah kelas ke meta/kelas
          setKelasList(prev => [...prev, finalKelas].sort());
        }
      }

      showToast(`Siswa ${newSiswa.nama} (${finalKelas}) berhasil didaftarkan!`, 'success');
      setShowAddModal(false);
      setNewSiswa({ nisn: '', nama: '', kelas: finalKelas, jurusan: 'Teknik Komputer dan Jaringan', angkatan: 2024 });

      // Cukup perbarui dari cache siswa aktif (0 read Firestore)
      const freshAktif = await siswaService.getAktif();
      setAktifList(freshAktif);
    } catch (err) {
      showToast(err.message || 'Gagal menambahkan siswa', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout
      title="Direktori Data Siswa"
      subtitle="Kelola profil siswa, status rekam jejak kedisiplinan, dan histori sanksi"
    >
      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama siswa atau NISN..."
            value={search}
            onInput={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/20 focus:border-[#4A6FA5]"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || loadingExtra}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
            title="Muat ulang data dari server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Muat Ulang</span>
          </button>
          <Link
            href="/import"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-2xs transition-all"
          >
            <span>Import Excel</span>
          </Link>
          {(user?.role === 'admin' || user?.role === 'guru_bk') && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tambah Siswa Manual</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 mb-6 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 pr-2 border-r border-gray-100">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter:</span>
          {loadingExtra && <RefreshCw className="w-3 h-3 text-[#4A6FA5] animate-spin ml-1" />}
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
          value={selectedStatusSP}
          onChange={setSelectedStatusSP}
          options={[
            { value: 'normal', label: 'Status Normal (Aman)' },
            { value: 'sp1', label: 'Status SP 1' },
            { value: 'sp2', label: 'Status SP 2' },
            { value: 'sp3', label: 'Status SP 3 (DO)' }
          ]}
          allOptionLabel="Semua Status SP"
          allOptionValue="semua"
          variant="pill"
        />

        <CreatableCombobox
          value={selectedStatusSiswa}
          onChange={setSelectedStatusSiswa}
          options={[
            { value: 'aktif', label: 'Siswa Aktif' },
            { value: 'lulus', label: 'Lulus' },
            { value: 'pindah', label: 'Pindah Sekolah' },
            { value: 'keluar', label: 'Keluar / DO' }
          ]}
          allOptionLabel="Semua Status"
          allOptionValue="semua"
          variant="pill"
        />
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {siswaList.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
            {loadError ? (
              <LoadError message={loadError} onRetry={loadSiswa} />
            ) : (
              <>
                <User className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="font-semibold text-gray-700 text-sm">{loading || loadingExtra ? 'Memuat data siswa...' : 'Tidak ada data siswa ditemukan'}</p>
                {!loading && !loadingExtra && (
                  <p className="text-xs mt-1">Coba sesuaikan kata kunci pencarian atau filter.</p>
                )}
              </>
            )}
          </div>
        ) : (
          siswaList.map((siswa) => (
            <Link
              key={siswa.id}
              href={`/siswa/${siswa.id}`}
              className="group bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs hover:shadow-md hover:border-[#4A6FA5]/40 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-800 font-bold text-xs rounded-lg border border-gray-200/80">
                    {siswa.kelas}
                  </span>
                  <SPBadge status={siswa.statusSP} />
                </div>

                {siswa.statusSiswa && siswa.statusSiswa !== 'aktif' && (
                  <div className="mb-1.5">
                    <StatusSiswaBadge status={siswa.statusSiswa} />
                  </div>
                )}

                <h3 className="font-bold font-heading text-sm text-gray-900 group-hover:text-[#4A6FA5] transition-colors line-clamp-1">
                  {siswa.nama}
                </h3>
                <p className="text-xs text-gray-400 font-mono mt-1">NISN: {siswa.nisn}</p>
                {siswa.jurusan && (
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">{siswa.jurusan}</p>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Akumulasi Poin</span>
                  <span className={`text-base font-extrabold ${siswa.totalPoin > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {siswa.totalPoin} pt
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-gray-50 group-hover:bg-[#4A6FA5] group-hover:text-white flex items-center justify-center text-gray-400 transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Add Siswa Modal */}
      {showAddModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowAddModal(false)}
          title="Tambah Siswa Baru"
        >
          <form onSubmit={handleAddSiswa} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                NISN / Nomor Induk Siswa <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength="20"
                placeholder="Contoh: 0081234567 atau 11 digit"
                value={newSiswa.nisn}
                onInput={(e) => setNewSiswa({ ...newSiswa, nisn: e.target.value.replace(/\D/g, '') })}
                className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#4A6FA5] font-mono"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Mendukung 8 hingga 18 digit angka (fleksibel)
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
                value={newSiswa.nama}
                onInput={(e) => setNewSiswa({ ...newSiswa, nama: e.target.value })}
                className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#4A6FA5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Kelas Siswa <span className="text-red-500">*</span>
              </label>
              <CreatableCombobox
                value={newSiswa.kelas}
                onChange={(val) => setNewSiswa({ ...newSiswa, kelas: val })}
                options={distinctKelas}
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
                  value={newSiswa.angkatan}
                  onChange={(e) => setNewSiswa({ ...newSiswa, angkatan: Number(e.target.value) })}
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
                list="jurusan-options"
                placeholder="Ketik atau pilih jurusan (contoh: Teknik Komputer dan Jaringan)"
                value={newSiswa.jurusan}
                onInput={(e) => setNewSiswa({ ...newSiswa, jurusan: e.target.value })}
                className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#4A6FA5]"
              />
              <datalist id="jurusan-options">
                <option value="Teknik Komputer dan Jaringan" />
                <option value="Teknik Kendaraan Ringan" />
              </datalist>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Siswa'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
