import { Link, useLocation } from 'wouter-preact';
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  FileSpreadsheet,
  FileText
} from 'lucide-preact';

export default function BottomNav() {
  const [location] = useLocation();

  const items = [
    { name: 'Beranda', href: '/', icon: LayoutDashboard },
    { name: 'Kasus', href: '/kasus', icon: AlertTriangle },
    { name: 'Siswa', href: '/siswa', icon: Users },
    { name: 'Surat', href: '/surat', icon: FileText },
    { name: 'Import', href: '/import', icon: FileSpreadsheet }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40 px-2 py-1.5 flex justify-around items-center">
      {items.map(item => {
        const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              isActive ? 'text-[#4A6FA5] font-semibold' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
            <span className="text-[10px] mt-0.5">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
