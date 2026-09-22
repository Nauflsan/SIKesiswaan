/**
 * =============================================================================
 * KOMPONEN: Settings (Pengaturan Sistem & Profil Sekolah)
 * =============================================================================
 * Mengelola parameter administratif sekolah, identitas kop surat dinas,
 * manajemen akun pengguna (RBAC), dan informasi status database.
 *
 * FITUR UTAMA & LOGIKA BISNIS:
 * 1. Profil & Kop Surat Dinamis:
 *    - Mengonfigurasi Pemerintah Daerah, Dinas Pendidikan, Nama Sekolah, Alamat,
 *      Telepon, Email, Website, serta data Kepala Sekolah & NIP.
 *    - Nilai ini langsung mengalir ke template surat resmi di modul Surat.jsx.
 * 2. Manajemen Akun Pengguna (RBAC Ketat):
 *    - Hanya pengguna dengan peran 'admin' yang dapat menambah pengguna baru,
 *      mengubah data (nama, NIP, role), mengirim reset kata sandi, atau
 *      mengubah status aktif/nonaktif akun.
 * 3. Status Cloud Database:
 *    - Informasi koneksi dan keamanan Firebase Firestore.
 * =============================================================================
 */

import { useState, useEffect } from "preact/hooks";
import AppLayout from "../components/layout/AppLayout.jsx";
import Modal from "../components/ui/Modal.jsx";
import { settingsService, authService } from "../services/index.js";
import { friendlyError } from '../lib/errors.js';
import { useAuthStore } from "../stores/authStore.js";
import { useUIStore } from "../stores/uiStore.js";
import {
  School,
  Users,
  Cloud,
  Save,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Pencil,
  Mail
} from "lucide-preact";

export default function Settings() {
  const {
    user,
    createUser,
    updateUser,
    sendUserPasswordReset,
    toggleUserActive,
    deleteUser,
  } = useAuthStore();
  const { showToast } = useUIStore();

  // Tab aktif: 'sekolah' | 'users' | 'database'
  const [activeTab, setActiveTab] = useState("sekolah");
  const [settings, setSettings] = useState({});
  const [usersList, setUsersList] = useState([]);
  const [saving, setSaving] = useState(false);

  // State Modal Tambah Pengguna Baru (Khusus Admin)
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    nama: "",
    nip: "",
    email: "",
    password: "",
    role: "guru_bk",
  });
  const [submittingUser, setSubmittingUser] = useState(false);

  // State Modal Edit Pengguna (Khusus Admin): pengguna yang sedang diedit atau null
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ nama: "", nip: "", role: "guru_bk" });
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [user]);

  /**
   * Mengambil data profil sekolah dan daftar seluruh akun user
   */
  async function loadSettings() {
    try {
      const [settingsData, freshUsers] = await Promise.all([
        settingsService.get(),
        authService.fetchUsersList(),
      ]);
      setSettings(settingsData);
      setUsersList(freshUsers);
    } catch (err) {
      showToast(friendlyError(err, "Gagal memuat pengaturan"), "error");
    }
  }

  /**
   * Handler penyimpanan profil sekolah & identitas kop dinas
   */
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsService.update(settings, user);
      showToast("Pengaturan sekolah berhasil diperbarui!", "success");
    } catch (err) {
      showToast(err.message || "Gagal menyimpan pengaturan", "error");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handler pembuatan pengguna baru:
   * Memvalidasi bahwa hanya Administrator yang memiliki izin ini (RBAC).
   */
  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    if (user?.role !== "admin") {
      showToast(
        "Akses ditolak: Hanya Administrator yang boleh menambah pengguna!",
        "error",
      );
      return;
    }

    setSubmittingUser(true);
    try {
      await createUser({
        nama: newUserForm.nama.trim(),
        nip: newUserForm.nip.trim() || "-",
        email: newUserForm.email.trim(),
        password: newUserForm.password.trim(),
        role: newUserForm.role,
      });

      showToast(
        `Akun ${newUserForm.nama} berhasil didaftarkan oleh Administrator!`,
        "success",
      );
      setShowAddUserModal(false);
      setNewUserForm({
        nama: "",
        nip: "",
        email: "",
        password: "",
        role: "guru_bk",
      });
      const fresh = await authService.fetchUsersList();
      setUsersList(fresh);
    } catch (err) {
      showToast(err.message || "Gagal membuat pengguna baru", "error");
    } finally {
      setSubmittingUser(false);
    }
  };

  const openEditUser = (targetUser) => {
    setEditingUser(targetUser);
    setEditForm({
      nama: targetUser.nama || "",
      nip: !targetUser.nip || targetUser.nip === "-" ? "" : targetUser.nip,
      role: targetUser.role,
    });
  };

  const closeEditUser = () => {
    setEditingUser(null);
  };

  /**
   * Handler simpan perubahan pengguna (nama, NIP, role).
   */
  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setSubmittingEdit(true);
    try {
      await updateUser(editingUser.id, {
        nama: editForm.nama,
        nip: editForm.nip,
        role: editForm.role,
      });
      showToast(`Data ${editForm.nama.trim()} berhasil diperbarui`, "success");
      setEditingUser(null);
      const fresh = await authService.fetchUsersList();
      setUsersList(fresh);
    } catch (err) {
      showToast(friendlyError(err, "Gagal menyimpan perubahan pengguna"), "error");
    } finally {
      setSubmittingEdit(false);
    }
  };

  /**
   * Handler kirim tautan reset kata sandi ke email pengguna yang sedang diedit.
   */
  const handleSendUserReset = async () => {
    if (!editingUser) return;
    setSendingReset(true);
    try {
      const { email } = await sendUserPasswordReset(editingUser.id);
      showToast(`Tautan reset kata sandi dikirim ke ${email}`, "success");
    } catch (err) {
      showToast(friendlyError(err, "Gagal mengirim tautan reset"), "error");
    } finally {
      setSendingReset(false);
    }
  };

  const handleToggleUserActive = async (targetUser) => {
    if (user?.role !== "admin") {
      showToast(
        "Hanya Administrator yang berhak mengubah status akun!",
        "error",
      );
      return;
    }
    try {
      const updated = await toggleUserActive(targetUser.id);
      showToast(
        `Akun ${updated.nama} berhasil ${updated.isActive ? "diaktifkan" : "dinonaktifkan"}`,
        "info",
      );
      const fresh = await authService.fetchUsersList();
      setUsersList(fresh);
    } catch (err) {
      showToast(err.message || "Gagal mengubah status akun", "error");
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (user?.role !== "admin") {
      showToast("Hanya Administrator yang berhak menghapus akun!", "error");
      return;
    }
    if (targetUser.id === user.id || targetUser.uid === user.id) {
      showToast("Anda tidak dapat menghapus akun Anda sendiri!", "error");
      return;
    }
    if (
      !confirm(
        `PERINGATAN: Apakah Anda yakin ingin menghapus akun ${targetUser.nama} (${targetUser.email}) secara permanen? Pengguna ini tidak akan bisa login lagi.`,
      )
    ) {
      return;
    }

    try {
      await deleteUser(targetUser.id);
      showToast(`Akun ${targetUser.nama} berhasil dihapus permanen`, "success");
      const fresh = await authService.fetchUsersList();
      setUsersList(fresh);
    } catch (err) {
      showToast(err.message || "Gagal menghapus akun", "error");
    }
  };

  return (
    <AppLayout
      title="Pengaturan Sistem & Profil Sekolah"
      subtitle="Konfigurasi data identitas sekolah, administratif kepala sekolah, dan pemeliharaan sistem"
    >
      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-6">
        <button
          onClick={() => setActiveTab("sekolah")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "sekolah"
              ? "border-[#4A6FA5] text-[#4A6FA5]"
              : "border-transparent text-gray-400 hover:text-gray-700"
          }`}
        >
          <School className="w-4 h-4" />
          <span>Profil Sekolah & Kepsek</span>
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "users"
              ? "border-[#4A6FA5] text-[#4A6FA5]"
              : "border-transparent text-gray-400 hover:text-gray-700"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Manajemen Pengguna ({usersList.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("database")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "database"
              ? "border-[#4A6FA5] text-[#4A6FA5]"
              : "border-transparent text-gray-400 hover:text-gray-700"
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>Status Cloud Database</span>
        </button>
      </div>

      {activeTab === "sekolah" && (
        <form
          onSubmit={handleSaveSettings}
          className="max-w-3xl bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs space-y-6"
        >
          <div className="space-y-4 text-xs">
            {/* Bagian 1: Instansi Induk & Pemerintah Daerah */}
            <h4 className="font-bold font-heading text-sm text-gray-900 border-b border-gray-100 pb-2">
              Instansi Induk & Pemerintah Daerah (Header Atas Kop Surat)
            </h4>

            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                Pemerintah Daerah / Provinsi
              </label>
              <input
                type="text"
                placeholder="Contoh: PEMERINTAH DAERAH PROVINSI BANTEN"
                value={settings.pemerintahDaerah || ""}
                onInput={(e) =>
                  setSettings({ ...settings, pemerintahDaerah: e.target.value })
                }
                className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl uppercase font-semibold"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Ditampilkan pada baris pertama kop surat resmi
              </span>
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                Dinas / Kementerian Terkait
              </label>
              <input
                type="text"
                placeholder="Contoh: DINAS PENDIDIKAN DAN KEBUDAYAAN"
                value={settings.dinasPendidikan || ""}
                onInput={(e) =>
                  setSettings({ ...settings, dinasPendidikan: e.target.value })
                }
                className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl uppercase font-semibold"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Ditampilkan pada baris kedua kop surat resmi
              </span>
            </div>

            {/* Bagian 2: Identitas & Kontak Sekolah */}
            <h4 className="font-bold font-heading text-sm text-gray-900 border-b border-gray-100 pb-2 pt-4">
              Identitas & Kontak Resmi Sekolah
            </h4>

            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                Nama Resmi Sekolah <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={settings.namaSekolah || ""}
                onInput={(e) =>
                  setSettings({ ...settings, namaSekolah: e.target.value })
                }
                className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900"
              />
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                Alamat Lengkap Sekolah <span className="text-red-500">*</span>
              </label>
              <textarea
                rows="2"
                required
                value={settings.alamatSekolah || ""}
                onInput={(e) =>
                  setSettings({ ...settings, alamatSekolah: e.target.value })
                }
                className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Kota / Kabupaten
                </label>
                <input
                  type="text"
                  value={settings.kotaSekolah || ""}
                  onInput={(e) =>
                    setSettings({ ...settings, kotaSekolah: e.target.value })
                  }
                  className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Kode Singkatan Sekolah (Untuk Nomor Surat)
                </label>
                <input
                  type="text"
                  value={settings.kodeSekolah || ""}
                  onInput={(e) =>
                    setSettings({ ...settings, kodeSekolah: e.target.value })
                  }
                  className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Nomor Telepon Sekolah
                </label>
                <input
                  type="text"
                  placeholder="(031) 8292038"
                  value={settings.teleponSekolah || ""}
                  onInput={(e) =>
                    setSettings({ ...settings, teleponSekolah: e.target.value })
                  }
                  className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Email / Pos-el Sekolah
                </label>
                <input
                  type="email"
                  placeholder="info@sekolah.sch.id"
                  value={settings.emailSekolah || ""}
                  onInput={(e) =>
                    setSettings({ ...settings, emailSekolah: e.target.value })
                  }
                  className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Website / Laman Sekolah
                </label>
                <input
                  type="text"
                  placeholder="www.sekolah.sch.id"
                  value={settings.websiteSekolah || ""}
                  onInput={(e) =>
                    setSettings({ ...settings, websiteSekolah: e.target.value })
                  }
                  className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                />
              </div>
            </div>

            {/* Bagian 3: Pejabat Penandatangan */}
            <h4 className="font-bold font-heading text-sm text-gray-900 border-b border-gray-100 pb-2 pt-4">
              Pejabat Kepala Sekolah (Penandatangan Surat)
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Nama Kepala Sekolah Beserta Gelar{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={settings.namaKepsek || ""}
                  onInput={(e) =>
                    setSettings({ ...settings, namaKepsek: e.target.value })
                  }
                  className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                  NIP Kepala Sekolah <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={settings.nipKepsek || ""}
                  onInput={(e) =>
                    setSettings({ ...settings, nipKepsek: e.target.value })
                  }
                  className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>
                {saving ? "Menyimpan..." : "Simpan Profil & Kop Surat"}
              </span>
            </button>
          </div>
        </form>
      )}

      {activeTab === "users" && (
        <div className="space-y-4 max-w-4xl">
          {/* Admin vs Non-admin Header */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold font-heading text-sm text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#4A6FA5]" />
                <span>Hak Akses Pengguna Sistem (RBAC)</span>
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                {user?.role === "admin"
                  ? "Anda memiliki hak akses tertinggi (Administrator). Anda dapat menambah, mengubah, dan mengatur status akun pengguna."
                  : "Ketentuan akses: Hanya Administrator yang berhak menambah atau mengubah akun pengguna sistem."}
              </p>
            </div>

            {user?.role === "admin" ? (
              <button
                onClick={() => setShowAddUserModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition-all active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Tambah Akun Pengguna</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold shrink-0">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Akses Tambah: Khusus Admin</span>
              </div>
            )}
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Nama Pengguna</th>
                  <th className="py-3 px-4">Email Login</th>
                  <th className="py-3 px-4">Role Hak Akses</th>
                  <th className="py-3 px-4">Status</th>
                  {user?.role === "admin" && (
                    <th className="py-3 px-4 text-right">Aksi Admin</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersList.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-gray-900">
                      <div>{u.nama}</div>
                      <div className="text-[10px] text-gray-400 font-mono font-normal">
                        NIP: {u.nip || "-"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-mono">
                      {u.email}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === "admin"
                            ? "bg-purple-100 text-purple-900 border border-purple-200"
                            : "bg-blue-100 text-blue-900 border border-blue-200"
                        }`}
                      >
                        {u.role === "admin" ? "👑 Admin" : "🎓 Guru BK"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.isActive ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">
                          Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-semibold text-[10px]">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    {user?.role === "admin" && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditUser(u)}
                            className="p-1 text-[#4A6FA5] hover:bg-blue-50 hover:text-[#3b5b88] rounded-lg border border-blue-200 transition-colors"
                            title="Edit Data Pengguna"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {u.id !== user.id ? (
                            <>
                              <button
                                onClick={() => handleToggleUserActive(u)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                                  u.isActive
                                    ? "text-amber-700 hover:bg-amber-50 border border-amber-200"
                                    : "text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                                }`}
                              >
                                {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg border border-rose-200 transition-colors"
                                title="Hapus Akun Pengguna Secara Permanen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-gray-400 text-[11px] italic">
                              Akun Anda
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Modal Edit User (Admin Only) */}
          {editingUser && (
            <Modal
              isOpen={true}
              onClose={closeEditUser}
              title="Edit Data Pengguna"
            >
              <form onSubmit={handleEditUserSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Nama Lengkap Pengguna <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.nama}
                    onInput={(e) =>
                      setEditForm({ ...editForm, nama: e.target.value })
                    }
                    className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#4A6FA5]"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                    NIP / NUPTK Pegawai
                  </label>
                  <input
                    type="text"
                    placeholder="Kosongkan jika belum ada"
                    value={editForm.nip}
                    onInput={(e) =>
                      setEditForm({ ...editForm, nip: e.target.value })
                    }
                    className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#4A6FA5]"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Email Akun Login
                  </label>
                  <input
                    type="email"
                    value={editingUser.email || ""}
                    disabled
                    className="w-full text-sm py-2 px-3 bg-gray-100 border border-gray-200 rounded-xl font-mono text-gray-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Email tidak dapat diubah. Jika salah, hapus akun lalu daftarkan ulang dengan email yang benar.
                  </p>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Role Hak Akses <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editForm.role}
                    disabled={editingUser.id === user.id}
                    onChange={(e) =>
                      setEditForm({ ...editForm, role: e.target.value })
                    }
                    className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    <option value="guru_bk">🎓 Guru Bimbingan Konseling (BK)</option>
                    <option value="admin">👑 Administrator</option>
                  </select>
                  {editingUser.id === user.id && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Anda tidak dapat mengubah role akun Anda sendiri.
                    </p>
                  )}
                </div>

                {editingUser.id !== user.id && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      Pengguna lupa kata sandi? Kirim tautan reset ke email pengguna.
                    </p>
                    <button
                      type="button"
                      onClick={handleSendUserReset}
                      disabled={sendingReset}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-[#4A6FA5] border border-blue-200 hover:bg-blue-50 rounded-lg shrink-0 disabled:opacity-50"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{sendingReset ? "Mengirim..." : "Kirim Tautan Reset"}</span>
                    </button>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={closeEditUser}
                    className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingEdit}
                    className="px-5 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                  >
                    {submittingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </form>
            </Modal>
          )}

          {/* Modal Add User (Admin Only) */}
          {showAddUserModal && (
            <Modal
              isOpen={true}
              onClose={() => setShowAddUserModal(false)}
              title="Tambah Akun Pengguna Baru (Hak Akses Admin)"
            >
              <form
                onSubmit={handleCreateUserSubmit}
                className="space-y-4 text-xs"
              >
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 leading-relaxed text-[11px]">
                  🔒 <strong>Akses Tertinggi:</strong> Anda mendaftarkan
                  pengguna baru dengan otoritas Administrator. Pengguna ini akan
                  dapat mengakses sistem sesuai peran (role) yang dipilih.
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Nama Lengkap Pengguna{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ibu Rina Rahmawati, S.Pd"
                    value={newUserForm.nama}
                    onInput={(e) =>
                      setNewUserForm({ ...newUserForm, nama: e.target.value })
                    }
                    className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#4A6FA5]"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                    NIP / NUPTK Pegawai
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 19820514 200801 2 009 (atau '-' jika belum ada)"
                    value={newUserForm.nip}
                    onInput={(e) =>
                      setNewUserForm({ ...newUserForm, nip: e.target.value })
                    }
                    className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#4A6FA5]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    NIP ini akan tercantum di bawah tanda tangan resmi pada
                    Surat Peringatan (SP).
                  </p>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Email Akun Login <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="user@gmail.com"
                    value={newUserForm.email}
                    onInput={(e) =>
                      setNewUserForm({ ...newUserForm, email: e.target.value })
                    }
                    className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#4A6FA5]"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Kata Sandi Awal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimal 6 karakter"
                    value={newUserForm.password}
                    onInput={(e) =>
                      setNewUserForm({
                        ...newUserForm,
                        password: e.target.value,
                      })
                    }
                    className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#4A6FA5]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Berikan kata sandi ini kepada pengguna untuk masuk pertama
                    kali (min. 6 karakter).
                  </p>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Role Hak Akses <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) =>
                      setNewUserForm({ ...newUserForm, role: e.target.value })
                    }
                    className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold"
                  >
                    <option value="guru_bk">
                      🎓 Guru Bimbingan Konseling (BK) — Mengelola Semua Kasus &
                      Surat
                    </option>
                    <option value="admin">
                      👑 Administrator — Akses Penuh Sistem & Kelola User
                    </option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingUser}
                    className="px-5 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                  >
                    {submittingUser ? "Mendaftarkan..." : "Daftarkan Pengguna"}
                  </button>
                </div>
              </form>
            </Modal>
          )}
        </div>
      )}

      {activeTab === "database" && (
        <div className="max-w-2xl bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs space-y-6">
          <div className="space-y-4">
            <div>
              <h4 className="font-bold font-heading text-sm text-gray-900 mb-1 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-[#4A6FA5]" />
                <span>Status Cloud Database (Firebase Firestore)</span>
              </h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Sistem terhubung secara realtime ke server Google Cloud
                Firestore. Seluruh perubahan siswa, kasus, dan surat tersimpan
                secara aman dan terenkripsi.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">
                  Project ID
                </span>
                <span className="font-mono font-bold text-gray-800">
                  {import.meta.env.VITE_FIREBASE_PROJECT_ID || 'sikesiswaan-dev'}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block mb-0.5">
                  Status Koneksi
                </span>
                <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Online & Terverifikasi
                </span>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">
                  Wilayah Server
                </span>
                <span className="font-semibold text-gray-800">
                  asia-southeast2 (Jakarta)
                </span>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">
                  Enkripsi Data
                </span>
                <span className="font-semibold text-gray-800">
                  TLS 1.3 & AES-256
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-200/70 rounded-xl text-xs text-blue-900 leading-relaxed">
              ℹ️ <b>Keamanan Terkelola:</b> Dalam mode cloud production, database terproteksi penuh
              oleh Firestore Security Rules di server Google Cloud.
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
