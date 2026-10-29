import { useState, useEffect } from 'preact/hooks';
import { Link, useLocation } from 'wouter-preact';
import { MoreHorizontal, LogOut } from 'lucide-preact';
import { useAuthStore } from '../../stores/authStore.js';
import { navigation, canAccess, isActivePath } from './navigation.js';
import AboutModal from '../ui/AboutModal.jsx';

/**
 * Navigasi bawah untuk layar kecil (HP). Menampilkan tab utama; menu lainnya,
 * info pengguna, dan tombol Keluar ada di panel "Lainnya".
 */
export default function BottomNav() {
  const [location] = useLocation();
  const { user, logout } = useAuthStore();
  const [showMore, setShowMore] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const allowed = navigation.filter(item => canAccess(item, user));
  const tabs = allowed.filter(item => item.tab);
  const moreItems = allowed.filter(item => !item.tab);
  const moreActive = moreItems.some(item => isActivePath(location, item.href));

  // Tutup panel setiap kali berpindah halaman
  useEffect(() => {
    setShowMore(false);
  }, [location]);

  const handleLogout = async () => {
    setShowMore(false);
    await logout();
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40 px-2 py-1.5 flex justify-around items-center">
        {tabs.map(item => {
          const isActive = isActivePath(location, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive ? 'text-[#4A6FA5] font-semibold' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
              <span className="text-[10px] mt-0.5">{item.shortName || item.name}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setShowMore(true)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            moreActive || showMore ? 'text-[#4A6FA5] font-semibold' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <MoreHorizontal className={`w-5 h-5 ${moreActive || showMore ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] mt-0.5">Lainnya</span>
        </button>
      </nav>

      {showMore && (
        <div className="md:hidden fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMore(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl shadow-2xl px-4 pt-3 pb-6 animate-slide-up">
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />

            {/* Info pengguna */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl mb-3">
              <div className="w-10 h-10 rounded-full bg-[#4A6FA5]/15 text-[#4A6FA5] font-bold flex items-center justify-center text-sm border border-[#4A6FA5]/20">
                {user?.nama ? user.nama.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">{user?.nama || 'Pengguna'}</div>
                <span className="inline-block mt-0.5 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  {user?.role || 'Guest'}
                </span>
              </div>
            </div>

            {/* Menu lainnya */}
            <nav className="space-y-1">
              {moreItems.map(item => {
                const isActive = isActivePath(location, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#4A6FA5] text-white font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 w-full flex items-center gap-2.5 px-3.5 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
              <span>Keluar Akun</span>
            </button>

            {/* Versi & Tentang Sistem */}
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => {
                  setShowMore(false);
                  setShowAbout(true);
                }}
                className="text-[11px] text-gray-400 hover:text-[#4A6FA5] font-medium transition-colors cursor-pointer py-1"
              >
                SIK-Kharisma v1.1.0 • Tentang Sistem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tentang Sistem untuk Mobile */}
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
    </>
  );
}
