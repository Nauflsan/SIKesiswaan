/**
 * Daftar menu navigasi bersama (dipakai Sidebar di desktop dan BottomNav di HP).
 * - roles : role yang boleh melihat menu (kosong = semua pengguna yang sudah login)
 * - tab   : true = tampil sebagai tab utama di BottomNav; sisanya masuk panel "Lainnya"
 * - shortName : label pendek untuk tab di BottomNav
 */
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  Tag,
  FileSpreadsheet,
  FileText,
  History,
  Settings,
  UserCog,
  BarChart3
} from 'lucide-preact';

export const navigation = [
  { name: 'Dashboard', shortName: 'Beranda', href: '/', icon: LayoutDashboard, tab: true },
  { name: 'Data Kasus', shortName: 'Kasus', href: '/kasus', icon: AlertTriangle, tab: true },
  { name: 'Daftar Siswa', shortName: 'Siswa', href: '/siswa', icon: Users, tab: true },
  { name: 'Kategori Pelanggaran', href: '/kategori', icon: Tag, roles: ['admin', 'guru_bk'] },
  { name: 'Rekapitulasi & Laporan', shortName: 'Rekap', href: '/rekap', icon: BarChart3, roles: ['admin', 'guru_bk'] },
  { name: 'Import Data Excel', href: '/import', icon: FileSpreadsheet, roles: ['admin', 'guru_bk'] },
  { name: 'Surat Peringatan (SP)', shortName: 'Surat', href: '/surat', icon: FileText, roles: ['admin', 'guru_bk'], tab: true },
  { name: 'Log Aktivitas', href: '/log', icon: History, roles: ['admin', 'guru_bk'] },
  { name: 'Pengaturan Sistem', href: '/settings', icon: Settings, roles: ['admin'] },
  { name: 'Akun Saya', href: '/akun', icon: UserCog }
];

/** Apakah pengguna boleh melihat menu ini? */
export function canAccess(item, user) {
  if (!item.roles) return true;
  return Boolean(user) && item.roles.includes(user.role);
}

/** Apakah menu ini sedang aktif untuk alamat halaman saat ini? */
export function isActivePath(location, href) {
  return location === href || (href !== '/' && location.startsWith(href));
}
