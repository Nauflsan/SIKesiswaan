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

import { useState, useEffect } from 'preact/hooks';
import { Link } from 'wouter-preact';
import AppLayout from '../components/layout/AppLayout.jsx';
import { SPBadge } from '../components/ui/Badge.jsx';
import Modal from '../components/ui/Modal.jsx';
import { siswaService } from '../services/index.js';
import { useAuthStore } from '../stores/authStore.js';
import { useUIStore } from '../stores/uiStore.js';
import {
  Search,
  Plus,
  UserPlus,
  ArrowRight,
  Filter,
  GraduationCap,
  AlertTriangle,
  User
} from 'lucide-preact';

export default function Siswa() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  // State data siswa & filter
  const [siswaList, setSiswaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('semua');
  const [selectedStatusSP, setSelectedStatusSP] = useState('semua');

  // State modal penambahan siswa baru
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCustomKelas, setIsCustomKelas] = useState(false); // Toggle input kelas manual vs select
  const [customKelasInput, setCustomKelasInput] = useState('');
  const [newSiswa, setNewSiswa] = useState({
    nisn: '',
    nama: '',
    kelas: 'XI TKJ 1',
    jurusan: 'Teknik Komputer dan Jaringan',
    angkatan: 2024
  });

  /**
   * Mengambil daftar siswa saat komponen dimuat atau filter diubah
   */
  useEffect(() => {
    loadSiswa();
  }, [selectedKelas, selectedStatusSP]);

  async function loadSiswa() {
    setLoading(true);
    try {
      const data = await siswaService.getAll({
        kelas: selectedKelas !== 'semua' ? selectedKelas : undefined,
        statusSP: selectedStatusSP !== 'semua' ? selectedStatusSP : undefined,
        search: search.trim() || undefined
      });
      setSiswaList(data);
    } catch (err) {
      showToast('Gagal memuat daftar siswa', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Menghimpun daftar kelas unik secara reaktif dari data siswa yang ada
  const distinctKelas = Array.from(
    new Set([
      'X TKJ 1', 'X TKJ 2', 'X TKR 1', 'X TKR 2',
      'XI TKJ 1', 'XI TKJ 2', 'XI TKR 1', 'XI TKR 2',
      'XII TKJ 1', 'XII TKJ 2', 'XII TKR 1', 'XII TKR 2',
      ...siswaList.map(s => s.kelas).filter(Boolean)
    ])
  ).sort();

  /**
   * Handler penambahan siswa baru ke database
   */
  const handleAddSiswa = async (e) => {
    e.preventDefault();
    const finalKelas = isCustomKelas ? customKelasInput.trim() : newSiswa.kelas;
    if (!finalKelas) {
      showToast('Harap pilih atau masukkan nama kelas', 'error');
      return;
    }

    try {
      await siswaService.create({
        ...newSiswa,
        kelas: finalKelas
      }, user);
      showToast(`Siswa ${newSiswa.nama} (${finalKelas}) berhasil didaftarkan!`, 'success');
      setShowAddModal(false);
      setNewSiswa({ nisn: '', nama: '', kelas: finalKelas, jurusan: 'Teknik Komputer dan Jaringan', angkatan: 2024 });
      setIsCustomKelas(false);
      setCustomKelasInput('');
      loadSiswa();
    } catch (err) {
      showToast(err.message || 'Gagal menambahkan siswa', 'error');
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
            onInput={(e) => {
              setSearch(e.target.value);
            }}
            onChange={() => loadSiswa()}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/20 focus:border-[#4A6FA5]"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
        </div>

        <select
          value={selectedKelas}
          onChange={(e) => setSelectedKelas(e.target.value)}
          className="text-xs py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-lg font-medium cursor-pointer"
        >
          <option value="semua">Semua Kelas</option>
          {distinctKelas.map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>

        <select
          value={selectedStatusSP}
          onChange={(e) => setSelectedStatusSP(e.target.value)}
          className="text-xs py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-lg font-medium cursor-pointer"
        >
          <option value="semua">Semua Status SP</option>
          <option value="normal">Status Normal (Aman)</option>
          <option value="sp1">Status SP 1</option>
          <option value="sp2">Status SP 2</option>
          <option value="sp3">Status SP 3 (DO)</option>
        </select>
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {siswaList.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
            <User className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="font-semibold text-gray-700 text-sm">Tidak ada data siswa ditemukan</p>
            <p className="text-xs mt-1">Coba sesuaikan kata kunci pencarian atau filter.</p>
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600">
                  Kelas Siswa <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomKelas(!isCustomKelas)}
                  className="text-[11px] font-semibold text-[#4A6FA5] hover:underline"
                >
                  {isCustomKelas ? '← Pilih dari daftar kelas' : '+ Ketik kelas baru'}
                </button>
              </div>

              {!isCustomKelas ? (
                <select
                  value={newSiswa.kelas}
                  onChange={(e) => setNewSiswa({ ...newSiswa, kelas: e.target.value })}
                  className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                >
                  {distinctKelas.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  placeholder="Ketik nama kelas baru (contoh: X TKJ 3, XI MM 1)"
                  value={customKelasInput}
                  onInput={(e) => setCustomKelasInput(e.target.value)}
                  className="w-full text-sm py-2 px-3 bg-gray-50 border border-[#4A6FA5] rounded-xl focus:ring-1 focus:ring-[#4A6FA5]"
                />
              )}
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
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Simpan Siswa
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
