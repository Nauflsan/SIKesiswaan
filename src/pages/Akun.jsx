/**
 * =============================================================================
 * KOMPONEN: Akun (Akun Saya)
 * =============================================================================
 * Halaman untuk semua pengguna yang sudah login (admin dan guru BK):
 * - Melihat informasi akun sendiri (hanya baca).
 * - Mengganti kata sandi. Wajib memasukkan kata sandi saat ini (verifikasi ulang).
 *
 * Nama, NIP, dan role hanya bisa diubah Administrator lewat Pengaturan > Pengguna.
 * =============================================================================
 */

import { useState } from 'preact/hooks';
import AppLayout from '../components/layout/AppLayout.jsx';
import { useAuthStore } from '../stores/authStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { friendlyError } from '../lib/errors.js';
import { KeyRound, AlertCircle } from 'lucide-preact';

const ROLE_LABELS = { admin: 'Administrator', guru_bk: 'Guru BK' };

export default function Akun() {
  const { user, changePassword } = useAuthStore();
  const { showToast } = useUIStore();

  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.next.length < 6) {
      setError('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (form.next !== form.confirm) {
      setError('Konfirmasi kata sandi baru tidak sama.');
      return;
    }
    if (form.next === form.current) {
      setError('Kata sandi baru harus berbeda dari kata sandi saat ini.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      showToast('Kata sandi berhasil diganti.', 'success');
    } catch (err) {
      setError(friendlyError(err, 'Gagal mengganti kata sandi.'));
    } finally {
      setSaving(false);
    }
  };

  const inputType = showPassword ? 'text' : 'password';
  const inputClass =
    'w-full text-sm py-2.5 px-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4A6FA5]/20 focus:border-[#4A6FA5]';
  const labelClass = 'block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5';

  return (
    <AppLayout
      title="Akun Saya"
      subtitle="Informasi akun dan pengaturan kata sandi"
    >
      <div className="space-y-6 max-w-xl">
        {/* Informasi akun (hanya baca) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
          <h4 className="font-bold font-heading text-sm text-gray-900 border-b border-gray-100 pb-2 mb-4">
            Informasi Akun
          </h4>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <dt className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Nama</dt>
              <dd className="font-semibold text-gray-900">{user?.nama}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Role</dt>
              <dd className="font-semibold text-gray-900">{ROLE_LABELS[user?.role] || user?.role}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Email Login</dt>
              <dd className="font-mono text-gray-700 break-all">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">NIP / NUPTK</dt>
              <dd className="font-mono text-gray-700">{user?.nip || '-'}</dd>
            </div>
          </dl>
          <p className="text-[11px] text-gray-400 mt-4">
            Untuk mengubah nama, NIP, atau role, hubungi Administrator.
          </p>
        </div>

        {/* Ganti kata sandi */}
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs space-y-4"
        >
          <h4 className="font-bold font-heading text-sm text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#4A6FA5]" />
            <span>Ganti Kata Sandi</span>
          </h4>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200/90 rounded-xl text-xs text-red-700 font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className={labelClass}>Kata Sandi Saat Ini</label>
            <input
              type={inputType}
              required
              autocomplete="current-password"
              value={form.current}
              onInput={setField('current')}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Kata Sandi Baru</label>
            <input
              type={inputType}
              required
              minLength={6}
              autocomplete="new-password"
              placeholder="Minimal 6 karakter"
              value={form.next}
              onInput={setField('next')}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Ulangi Kata Sandi Baru</label>
            <input
              type={inputType}
              required
              autocomplete="new-password"
              value={form.confirm}
              onInput={setField('confirm')}
              className={inputClass}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Tampilkan kata sandi</span>
          </label>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}</span>
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
