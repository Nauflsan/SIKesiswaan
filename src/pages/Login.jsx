import { useState } from 'preact/hooks';
import { useLocation } from 'wouter-preact';
import { useAuthStore } from '../stores/authStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { ShieldAlert, LogIn, Cloud, AlertCircle } from 'lucide-preact';

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuthStore();
  const { showToast } = useUIStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);
    try {
      await login(email, password);
      showToast('Berhasil masuk ke SIK-Kharisma', 'success');
      setLocation('/');
    } catch (err) {
      const msg = err.message || 'Email atau kata sandi yang Anda masukkan salah.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#4A6FA5] flex items-center justify-center text-white shadow-md shadow-[#4A6FA5]/25 mx-auto mb-3">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold font-heading text-gray-900 tracking-tight">
            SIK-Kharisma
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Sistem Informasi Ketertiban & Kedisiplinan Siswa
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-sm mb-6">
          {/* Alert Peringatan Gagal Login */}
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200/90 rounded-2xl text-xs text-red-700 font-medium flex items-start gap-2.5 mb-5 shadow-xs transition-all">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block text-red-800 mb-0.5">Gagal Masuk</span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                Email Akun
              </label>
              <input
                type="email"
                required
                value={email}
                onInput={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="user@gmail.com"
                className="w-full text-sm py-2.5 px-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4A6FA5]/20 focus:border-[#4A6FA5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                Kata Sandi
              </label>
              <input
                type="password"
                required
                value={password}
                onInput={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="••••••••"
                className="w-full text-sm py-2.5 px-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4A6FA5]/20 focus:border-[#4A6FA5]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Masuk...' : 'Masuk ke Aplikasi'}</span>
            </button>
          </form>
        </div>

        {/* Mode Indicator */}
        <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 text-xs">
          <div className="flex items-center gap-2 text-blue-900 font-bold mb-1">
            <Cloud className="w-4 h-4 text-[#4A6FA5]" />
            <span>Mode Cloud Firebase Aktif</span>
          </div>
          <p className="text-[11px] text-blue-800/80 leading-relaxed">
            Terhubung ke project <b>sikesiswaan-dev</b>. Masuk menggunakan email dan kata sandi akun Firebase yang telah terdaftar.
          </p>
        </div>
      </div>
    </div>
  );
}
