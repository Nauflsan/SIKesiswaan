/**
 * =============================================================================
 * KOMPONEN: Kasus (Daftar & Manajemen Kasus Pelanggaran)
 * =============================================================================
 * Halaman ini menangani pemantauan, pencarian, filtering, dan manajemen status
 * kasus pelanggaran siswa di sekolah.
 *
 * FITUR UTAMA & LOGIKA BISNIS:
 * 1. Filter Multi-Kriteria:
 *    - Kelas (Semua Kelas atau kelas tertentu).
 *    - Kategori Pelanggaran (Ringan, Sedang, Berat, dsb).
 *    - Status Penanganan ('baru', 'ditangani', 'selesai').
 *    - Search bar (Nama siswa, NISN, atau kronologi).
 * 2. RBAC (Role-Based Access Control):
 *    - Admin: Akses penuh termasuk menghapus kasus (soft delete).
 *    - Guru BK: Dapat melihat semua kasus, mengubah status penanganan, & cetak SP.
 * 3. Soft Delete & Point Rollback:
 *    - Menghapus kasus tidak menghapus baris dari database fisik, melainkan menandai
 *      isDeleted: true, serta secara atomik mengurangi poin dari total akumulasi siswa.
 * =============================================================================
 */

import { useState, useEffect } from 'preact/hooks';
import { Link } from 'wouter-preact';
import AppLayout from '../components/layout/AppLayout.jsx';
import { KasusStatusBadge, PoinBadge } from '../components/ui/Badge.jsx';
import Modal from '../components/ui/Modal.jsx';
import { kasusService, siswaService, kategoriService } from '../services/index.js';
import { useAuthStore } from '../stores/authStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { formatTanggal } from '../lib/helpers.js';
import {
  Search,
  Filter,
  PlusCircle,
  Eye,
  Trash2,
  FileText,
  RotateCcw,
  CheckSquare,
  Square,
  Download,
  AlertTriangle
} from 'lucide-preact';

export default function Kasus() {
  // Ambil state user yang sedang login & fungsi trigger notifikasi toast
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  // State penyimpanan data dari API / Service
  const [kasusList, setKasusList] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);
  const [loading, setLoading] = useState(true);

  // State Filter
  const [search, setSearch] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('semua');
  const [selectedKategori, setSelectedKategori] = useState('semua');
  const [selectedStatus, setSelectedStatus] = useState('semua');

  // State Pengendali Modal Interaktif (Detail Kasus & Konfirmasi Hapus)
  const [activeKasusModal, setActiveKasusModal] = useState(null);
  const [deleteConfirmKasus, setDeleteConfirmKasus] = useState(null);

  // Daftar opsi kelas dinamis yang diekstrak dari master data siswa
  const [distinctKelas, setDistinctKelas] = useState([
    'X TKJ 1', 'X TKJ 2', 'X TKR 1', 'X TKR 2',
    'XI TKJ 1', 'XI TKJ 2', 'XI TKR 1', 'XI TKR 2',
    'XII TKJ 1', 'XII TKJ 2', 'XII TKR 1', 'XII TKR 2'
  ]);

  /**
   * Hook pemuatan data: Berjalan saat komponen dipasang atau saat filter berubah.
   */
  useEffect(() => {
    loadData();
  }, [user, selectedKelas, selectedKategori, selectedStatus]);

  /**
   * Mengambil data kasus, kategori, dan siswa dari service layer.
   * Parameter query filter dikirim ke service Firestore.
   */
  async function loadData() {
    setLoading(true);
    try {
      const [kategoriData, data, siswaData] = await Promise.all([
        kategoriService.getAll(),
        kasusService.getAll({
          kelas: selectedKelas !== 'semua' ? selectedKelas : undefined,
          kategoriId: selectedKategori !== 'semua' ? selectedKategori : undefined,
          status: selectedStatus !== 'semua' ? selectedStatus : undefined,
          search: search.trim() || undefined
        }),
        siswaService.getAll()
      ]);
      setKategoriList(kategoriData);
      setKasusList(data);

      // Kumpulkan semua kelas unik yang ada di database siswa untuk opsi dropdown filter
      const uniqueClasses = Array.from(
        new Set([
          'X TKJ 1', 'X TKJ 2', 'X TKR 1', 'X TKR 2',
          'XI TKJ 1', 'XI TKJ 2', 'XI TKR 1', 'XI TKR 2',
          'XII TKJ 1', 'XII TKJ 2', 'XII TKR 1', 'XII TKR 2',
          ...siswaData.map(s => s.kelas).filter(Boolean)
        ])
      ).sort();
      setDistinctKelas(uniqueClasses);
    } catch (err) {
      showToast('Gagal memuat data kasus', 'error');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Handler submit form pencarian teks
   */
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  /**
   * Handler perubahan status pembinaan ('baru' -> 'ditangani' -> 'selesai')
   * Mencatat jejak audit (updatedAt) dan memperbarui tampilan modal jika sedang terbuka.
   */
  const handleStatusChange = async (kasusId, newStatus) => {
    try {
      await kasusService.update(kasusId, { status: newStatus }, user);
      showToast(`Status berhasil diubah menjadi ${newStatus}`, 'success');
      loadData();
      if (activeKasusModal && activeKasusModal.id === kasusId) {
        setActiveKasusModal(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      showToast(err.message || 'Gagal mengubah status', 'error');
    }
  };

  /**
   * Handler soft-delete kasus pelanggaran:
   * Hanya diizinkan untuk Admin.
   * Mengurangi poin siswa secara otomatis di layer database/service.
   */
  const handleDeleteKasus = async () => {
    if (!deleteConfirmKasus) return;
    try {
      await kasusService.delete(deleteConfirmKasus.id, user);
      showToast('Kasus berhasil dihapus (soft delete) dan poin siswa telah dikurangi otomatis', 'success');
      setDeleteConfirmKasus(null);
      if (activeKasusModal?.id === deleteConfirmKasus.id) setActiveKasusModal(null);
      loadData();
    } catch (err) {
      showToast(err.message || 'Gagal menghapus kasus', 'error');
    }
  };

  return (
    <AppLayout
      title="Data Kasus & Pelanggaran Siswa"
      subtitle="Kelola pencatatan pelanggaran tata tertib dan tindakan pembinaan"
    >
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari siswa, NISN, atau jenis pelanggaran..."
            value={search}
            onInput={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/20 focus:border-[#4A6FA5]"
          />
        </form>

        {/* Action Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/kasus/tambah"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Catat Kasus Baru</span>
          </Link>
        </div>
      </div>

      {/* Filter Chips / Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 mb-6 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 pr-2 border-r border-gray-100">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter:</span>
        </div>

        {/* Kelas Filter */}
        <select
          value={selectedKelas}
          onChange={(e) => setSelectedKelas(e.target.value)}
          className="text-xs py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-lg font-medium focus:ring-1 focus:ring-[#4A6FA5] cursor-pointer"
        >
          <option value="semua">Semua Kelas</option>
          {distinctKelas.map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>

        {/* Kategori Filter */}
        <select
          value={selectedKategori}
          onChange={(e) => setSelectedKategori(e.target.value)}
          className="text-xs py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-lg font-medium focus:ring-1 focus:ring-[#4A6FA5] cursor-pointer"
        >
          <option value="semua">Semua Kategori</option>
          {kategoriList.map(kat => (
            <option key={kat.id} value={kat.id}>{kat.nama}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="text-xs py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-lg font-medium focus:ring-1 focus:ring-[#4A6FA5] cursor-pointer"
        >
          <option value="semua">Semua Status</option>
          <option value="baru">Baru</option>
          <option value="ditangani">Sedang Ditangani</option>
          <option value="selesai">Selesai</option>
        </select>

        {(selectedKelas !== 'semua' || selectedKategori !== 'semua' || selectedStatus !== 'semua' || search) && (
          <button
            onClick={() => {
              setSearch('');
              setSelectedKelas('semua');
              setSelectedKategori('semua');
              setSelectedStatus('semua');
            }}
            className="text-xs text-rose-600 hover:text-rose-800 font-semibold ml-auto flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filter</span>
          </button>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/75 text-gray-500 uppercase tracking-wider text-[11px] font-semibold">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Siswa</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Kategori Pelanggaran</th>
                <th className="py-3 px-4">Poin</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kasusList.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <div className="max-w-sm mx-auto space-y-2">
                      <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto" />
                      <p className="font-semibold text-gray-600">Tidak ada data kasus yang cocok</p>
                      <p className="text-[11px]">Coba ubah kata kunci pencarian atau bersihkan filter di atas.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                kasusList.map((kasus) => (
                  <tr key={kasus.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                      {formatTanggal(kasus.tanggal)}
                    </td>
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/siswa/${kasus.siswaId}`}
                        className="font-bold text-gray-900 hover:text-[#4A6FA5] hover:underline"
                      >
                        {kasus.siswaNama}
                      </Link>
                      <span className="block text-[10px] text-gray-400">NISN: {kasus.siswaNisn}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 font-medium rounded text-[11px]">
                        {kasus.siswaKelas}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-800 max-w-xs truncate">
                      {kasus.kategoriNama}
                      {kasus.deskripsi && (
                        <span className="block text-[11px] text-gray-400 truncate max-w-xs">
                          {kasus.deskripsi}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <PoinBadge poin={kasus.poin} />
                    </td>
                    <td className="py-3.5 px-4">
                      <KasusStatusBadge status={kasus.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setActiveKasusModal(kasus)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Lihat Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/surat?siswaId=${kasus.siswaId}`}
                          className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Buat Surat SP"
                        >
                          <FileText className="w-4 h-4" />
                        </Link>
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => setDeleteConfirmKasus(kasus)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus Kasus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail Kasus & Status Handler */}
      {activeKasusModal && (
        <Modal
          isOpen={true}
          onClose={() => setActiveKasusModal(null)}
          title="Detail Penanganan Kasus Siswa"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-5">
            {/* Header info */}
            <div className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-gray-900">{activeKasusModal.siswaNama}</h4>
                <p className="text-xs text-gray-500">{activeKasusModal.siswaKelas} • NISN: {activeKasusModal.siswaNisn}</p>
              </div>
              <div className="text-right">
                <PoinBadge poin={activeKasusModal.poin} className="text-sm px-3 py-1" />
                <span className="block text-[11px] text-gray-400 mt-1">{formatTanggal(activeKasusModal.tanggal)}</span>
              </div>
            </div>

            {/* Violation Details */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Jenis Pelanggaran</label>
              <p className="text-sm font-semibold text-gray-900">{activeKasusModal.kategoriNama}</p>
              
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block pt-2">Kronologi / Catatan Kejadian</label>
              <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-700 leading-relaxed border border-gray-100">
                {activeKasusModal.deskripsi || 'Tidak ada catatan kronologi tambahan.'}
              </div>
            </div>

            {/* Status Update Actions */}
            <div className="pt-3 border-t border-gray-100">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">Ubah Status Pembinaan</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeKasusModal.id, 'baru')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    activeKasusModal.status === 'baru'
                      ? 'bg-rose-50 border-rose-400 text-rose-700 ring-2 ring-rose-200'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Belum Ditangani (Baru)
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeKasusModal.id, 'ditangani')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    activeKasusModal.status === 'ditangani'
                      ? 'bg-blue-50 border-blue-400 text-blue-700 ring-2 ring-blue-200'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Sedang Ditangani
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeKasusModal.id, 'selesai')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    activeKasusModal.status === 'selesai'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700 ring-2 ring-emerald-200'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Selesai / Dibina
                </button>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="text-[11px] text-gray-400">
                Dicatat oleh: <strong>{activeKasusModal.createdByNama}</strong>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/surat?siswaId=${activeKasusModal.siswaId}`}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold"
                >
                  Buat Surat SP
                </Link>
                <button
                  onClick={() => setActiveKasusModal(null)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmKasus && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirmKasus(null)}
          title="Konfirmasi Hapus Kasus"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Apakah Anda yakin ingin menghapus catatan pelanggaran <strong>{deleteConfirmKasus.siswaNama}</strong> ({deleteConfirmKasus.kategoriNama})?
            </p>
            <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 border border-amber-200">
              ⚠️ <strong>Sistem Atomik:</strong> Menghapus kasus ini akan otomatis mengurangi <strong>{deleteConfirmKasus.poin} poin</strong> dari total akumulasi siswa dan menghitung ulang status SP-nya.
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteConfirmKasus(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteKasus}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-xs"
              >
                Ya, Hapus Kasus
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
