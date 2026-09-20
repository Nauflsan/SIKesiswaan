import { useAuthStore } from '../../stores/authStore.js';
import { Cloud } from 'lucide-preact';

export default function Topbar({ title, subtitle }) {
  const { user } = useAuthStore();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-2xs">
      <div>
        <h1 className="text-xl font-bold font-heading text-gray-900 leading-tight">
          {title || 'SIK-Kharisma'}
        </h1>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Right Controls: Cloud Status & User info */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 bg-blue-50/80 border border-blue-200/70 px-2.5 py-1 rounded-xl text-[#4A6FA5] text-[11px] font-semibold">
          <Cloud className="w-3.5 h-3.5 text-[#4A6FA5]" />
          <span>Firebase Online</span>
        </div>

        {/* User Pill */}
        <div className="flex items-center gap-2.5 pl-2">
          <div className="w-8 h-8 rounded-full bg-[#4A6FA5]/15 text-[#4A6FA5] font-bold flex items-center justify-center text-xs border border-[#4A6FA5]/20">
            {user?.nama ? user.nama.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-semibold text-gray-800 leading-none">
              {user?.nama}
            </div>
            <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">
              {user?.role}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
