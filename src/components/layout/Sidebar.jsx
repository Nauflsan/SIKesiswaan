import { useState } from 'preact/hooks';
import { Link, useLocation } from 'wouter-preact';
import { useAuthStore } from '../../stores/authStore.js';
import { LogOut } from 'lucide-preact';
import { navigation, canAccess, isActivePath } from './navigation.js';
import AboutModal from '../ui/AboutModal.jsx';

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuthStore();
  const [showAbout, setShowAbout] = useState(false);

  const filteredNav = navigation.filter(item => canAccess(item, user));

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-gray-200 z-30">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 h-18 border-b border-gray-100 bg-[#FAFAF8]/50">
        <div className="w-10 h-10 rounded-xl bg-[#4A6FA5]/10 flex items-center justify-center p-1.5 border border-[#4A6FA5]/20 shadow-xs">
          <img
            src="/Logo1-removebg-preview.png"
            alt="Logo SMK Kharisma"
            className="w-7 h-7 object-contain drop-shadow-xs"
          />
        </div>
        <div>
          <span className="font-heading font-extrabold text-lg text-gray-900 tracking-tight block leading-tight">
            SIK-Kharisma
          </span>
          <span className="text-[11px] font-medium text-gray-400 tracking-wider uppercase">
            Kesiswaan Kharisma
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 flex flex-col justify-between overflow-y-auto px-4 py-5">
        <nav className="space-y-1">
          <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
            Menu Utama
          </div>
          {filteredNav.map((item) => {
            const isActive = isActivePath(location, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#4A6FA5] text-white shadow-sm shadow-[#4A6FA5]/25 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="pt-4 border-t border-gray-100 mt-6">
          <div className="p-3 bg-gray-50 rounded-xl mb-2">
            <div className="text-xs font-semibold text-gray-800 truncate">
              {user?.nama || 'Pengguna'}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                {user?.role || 'Guest'}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Akun</span>
          </button>

          {/* Tautan Versi & Tentang Sistem */}
          <div className="text-center pt-3">
            <button
              type="button"
              onClick={() => setShowAbout(true)}
              className="text-[11px] text-gray-400 hover:text-[#4A6FA5] font-medium transition-colors cursor-pointer"
            >
              SIK-Kharisma v1.1.0 • Tentang
            </button>
          </div>
        </div>
      </div>

      {/* Modal Tentang Sistem */}
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
    </aside>
  );
}
