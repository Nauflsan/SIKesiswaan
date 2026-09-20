/**
 * =============================================================================
 * KOMPONEN: Kategori (Master Kategori Pelanggaran & Ambang Batas SP)
 * =============================================================================
 * Mengelola master data jenis-jenis pelanggaran dan pengaturan ambang batas
 * akumulasi poin yang memicu status Surat Peringatan (SP1, SP2, SP3).
 *
 * FITUR UTAMA & LOGIKA BISNIS:
 * 1. Manajemen Kategori Pelanggaran (CRUD):
 *    - Tambah, Edit, dan Nonaktifkan jenis pelanggaran beserta bobot poin bakunya.
 * 2. Konfigurasi Ambang Batas SP:
 *    - Penentuan poin pemicu SP1, SP2, dan SP3.
 *    - Validasi Urutan Logis: SP1 < SP2 < SP3.
 * 3. Atomic Recalculation:
 *    - Ketika ambang batas diubah, service secara otomatis menghitung ulang
 *      status SP seluruh siswa yang ada di sistem agar tetap konsisten.
 * 4. RBAC:
 *    - Hanya 'admin' dan 'guru_bk' yang memiliki otoritas mengubah aturan ini.
 * =============================================================================
 */

import { useState, useEffect } from 'preact/hooks';
import AppLayout from '../components/layout/AppLayout.jsx';
import Modal from '../components/ui/Modal.jsx';
import { PoinBadge } from '../components/ui/Badge.jsx';
import { kategoriService, settingsService } from '../services/index.js';
import { useAuthStore } from '../stores/authStore.js';
import { useUIStore } from '../stores/uiStore.js';
import {
  Plus,
  Edit2,
  Trash2,
  Tag,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  MoveUp,
  MoveDown
} from 'lucide-preact';

export default function Kategori() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  const [kategoriList, setKategoriList] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  // State pengaturan form ambang batas SP
  const [ambang, setAmbang] = useState({ sp1: 50, sp2: 80, sp3: 110 });
  const [savingAmbang, setSavingAmbang] = useState(false);

  // State modal penambahan / pengubahan kategori
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formKategori, setFormKategori] = useState({ nama: '', poin: 10, deskripsi: '' });

  useEffect(() => {
    loadData();
  }, []);

  /**
   * Memuat data seluruh kategori pelanggaran dan konfigurasi settings sekolah
   */
  async function loadData() {
    setLoading(true);
    try {
      const [kategoriData, settingsData] = await Promise.all([
        kategoriService.getAll(),
        settingsService.get()
      ]);
      setKategoriList(kategoriData);
      setSettings(settingsData);
      setAmbang({
        sp1: settingsData.ambangSp1 || 50,
        sp2: settingsData.ambangSp2 || 80,
        sp3: settingsData.ambangSp3 || 110
      });
    } catch (err) {
      showToast('Gagal memuat data kategori', 'error');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Menyimpan konfigurasi ambang batas SP baru.
   * Melakukan validasi berjenjang (SP1 < SP2 < SP3).
   * Memicu perhitungan ulang status seluruh siswa secara atomik di database.
   */
  const handleSaveAmbang = async (e) => {
    e.preventDefault();
    if (ambang.sp1 >= ambang.sp2 || ambang.sp2 >= ambang.sp3) {
      showToast('Urutan ambang batas harus: SP1 < SP2 < SP3', 'error');
      return;
    }
    setSavingAmbang(true);
    try {
      await settingsService.update({
        ambangSp1: Number(ambang.sp1),
        ambangSp2: Number(ambang.sp2),
        ambangSp3: Number(ambang.sp3)
      }, user);
      showToast('Ambang batas SP berhasil diperbarui! Status siswa telah dihitung ulang secara atomik.', 'success');
      loadData();
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan ambang batas', 'error');
    } finally {
      setSavingAmbang(false);
    }
  };

  /**
   * Menyimpan perubahan atau penambahan data kategori pelanggaran
   */
  const handleSaveKategori = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await kategoriService.update(editingItem.id, {
          nama: formKategori.nama,
          poin: Number(formKategori.poin),
          deskripsi: formKategori.deskripsi
        }, user);
        showToast('Kategori pelanggaran berhasil diperbarui', 'success');
      } else {
        await kategoriService.create({
          nama: formKategori.nama,
          poin: Number(formKategori.poin),
          deskripsi: formKategori.deskripsi
        }, user);
        showToast('Kategori pelanggaran baru berhasil ditambahkan', 'success');
      }
      setShowModal(false);
      setEditingItem(null);
      setFormKategori({ nama: '', poin: 10, deskripsi: '' });
      loadData();
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan kategori', 'error');
    }
  };

  const handleDeleteKategori = async (id, nama) => {
    if (!confirm(`Hapus kategori "${nama}"?`)) return;
    try {
      await kategoriService.delete(id, user);
      showToast('Kategori berhasil dihapus', 'success');
      loadData();
    } catch (err) {
      showToast(err.message || 'Gagal menghapus kategori', 'error');
    }
  };

  const handleToggleActive = async (item) => {
    try {
      await kategoriService.update(item.id, { isActive: !item.isActive }, user);
      showToast(`Kategori ${item.isActive ? 'dinonaktifkan' : 'diaktifkan'}`, 'info');
      loadData();
    } catch (err) {
      showToast('Gagal mengubah status kategori', 'error');
    }
  };

  return (
    <AppLayout
      title="Kategori Pelanggaran & Ambang Poin"
      subtitle="Konfigurasi bobot poin pelanggaran dan ambang batas penerbitan surat peringatan"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Category Management List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold font-heading text-gray-900">
                  Daftar Master Kategori Pelanggaran
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Setiap perubahan poin tidak akan merubah poin kasus lama (historical snapshot).
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setFormKategori({ nama: '', poin: 10, deskripsi: '' });
                  setShowModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Kategori</span>
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {kategoriList.map((item, idx) => (
                <div
                  key={item.id}
                  className={`py-3.5 flex items-center justify-between gap-4 transition-colors ${
                    !item.isActive ? 'opacity-50 bg-gray-50/50 px-2 rounded-xl' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 text-center text-xs font-bold text-gray-400">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 truncate">
                          {item.nama}
                        </span>
                        {!item.isActive && (
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-[10px] font-semibold">
                            Nonaktif
                          </span>
                        )}
                      </div>
                      {item.deskripsi && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {item.deskripsi}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <PoinBadge poin={item.poin} />

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleActive(item)}
                        className={`text-[11px] px-2 py-1 rounded-lg font-semibold transition-colors ${
                          item.isActive
                            ? 'text-gray-500 hover:bg-gray-100'
                            : 'text-emerald-700 bg-emerald-50'
                        }`}
                      >
                        {item.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>

                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setFormKategori({ nama: item.nama, poin: item.poin, deskripsi: item.deskripsi || '' });
                          setShowModal(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {user?.role === 'admin' && (
                        <button
                          onClick={() => handleDeleteKategori(item.id, item.nama)}
                          className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: SP Threshold Form */}
        <div className="space-y-5">
          <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100 text-[#4A6FA5]">
              <Sliders className="w-5 h-5" />
              <h3 className="text-sm font-bold font-heading text-gray-900">
                Ambang Batas Surat Peringatan
              </h3>
            </div>

            <form onSubmit={handleSaveAmbang} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Ambang SP 1 (Peringatan I)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={ambang.sp1}
                    onInput={(e) => setAmbang({ ...ambang, sp1: Number(e.target.value) })}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-amber-600 focus:ring-1 focus:ring-[#4A6FA5]"
                  />
                  <span className="font-semibold text-gray-400 shrink-0">Poin</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Ambang SP 2 (Peringatan II)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={ambang.sp2}
                    onInput={(e) => setAmbang({ ...ambang, sp2: Number(e.target.value) })}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-orange-600 focus:ring-1 focus:ring-[#4A6FA5]"
                  />
                  <span className="font-semibold text-gray-400 shrink-0">Poin</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Ambang SP 3 (Peringatan Terakhir / DO)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={ambang.sp3}
                    onInput={(e) => setAmbang({ ...ambang, sp3: Number(e.target.value) })}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-red-600 focus:ring-1 focus:ring-[#4A6FA5]"
                  />
                  <span className="font-semibold text-gray-400 shrink-0">Poin</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-xl text-blue-900 leading-relaxed text-[11px]">
                ℹ️ <strong>Auto-Recalculate:</strong> Mengubah ambang batas akan langsung memicu perhitungan ulang status SP seluruh siswa di database secara instan.
              </div>

              <button
                type="submit"
                disabled={savingAmbang}
                className="w-full py-2.5 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white font-bold rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50"
              >
                {savingAmbang ? 'Menyimpan...' : 'Perbarui Ambang Batas'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Modal Add / Edit Category */}
      {showModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowModal(false)}
          title={editingItem ? 'Edit Kategori Pelanggaran' : 'Tambah Kategori Baru'}
        >
          <form onSubmit={handleSaveKategori} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Nama Kategori Pelanggaran <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Terlambat Masuk Sekolah"
                value={formKategori.nama}
                onInput={(e) => setFormKategori({ ...formKategori, nama: e.target.value })}
                className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#4A6FA5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Bobot Poin Pelanggaran <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={formKategori.poin}
                onInput={(e) => setFormKategori({ ...formKategori, poin: Number(e.target.value) })}
                className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-rose-600 focus:ring-1 focus:ring-[#4A6FA5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Keterangan / Definisi Pelanggaran
              </label>
              <textarea
                rows="3"
                placeholder="Deskripsi batasan pelanggaran..."
                value={formKategori.deskripsi}
                onInput={(e) => setFormKategori({ ...formKategori, deskripsi: e.target.value })}
                className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl resize-none focus:ring-1 focus:ring-[#4A6FA5]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Simpan
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
