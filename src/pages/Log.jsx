import { useState, useEffect } from 'preact/hooks';
import AppLayout from '../components/layout/AppLayout.jsx';
import { logService } from '../services/index.js';
import { formatWaktu } from '../lib/helpers.js';
import { friendlyError } from '../lib/errors.js';
import LoadError from '../components/ui/LoadError.jsx';

export default function Log() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await logService.getAll();
      setLogs(data);
    } catch (err) {
      setLoadError(friendlyError(err, 'Gagal memuat log aktivitas'));
    } finally {
      setLoading(false);
    }
  }

  const getActionBadge = (aksi) => {
    switch (aksi) {
      case 'tambah_kasus':
      case 'tambah_siswa':
      case 'tambah_kategori':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Tambah</span>;
      case 'edit_kasus':
      case 'edit_siswa':
      case 'edit_kategori':
      case 'ubah_settings':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Edit / Update</span>;
      case 'hapus_kasus':
      case 'hapus_siswa':
      case 'hapus_kategori':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Hapus (Soft)</span>;
      case 'hapus_permanen_siswa':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Hapus Permanen</span>;
      case 'buat_surat':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Surat SP</span>;
      case 'edit_user':
      case 'ganti_sandi':
      case 'reset_sandi':
      case 'hapus_user':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">Akun Pengguna</span>;
      case 'sinkron_status_siswa':
      case 'bangun_daftar_kelas':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">Pemeliharaan Data</span>;
      case 'import_siswa':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">Import Excel</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">{aksi}</span>;
    }
  };

  return (
    <AppLayout
      title="Log Aktivitas & Audit Trail"
      subtitle="Rekam jejak setiap tindakan pencatatan, perubahan status, dan penerbitan dokumen"
    >
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-4">Jenis Aksi</th>
                <th className="py-3 px-4">Rincian Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-gray-400">
                    {loadError ? (
                      <LoadError message={loadError} onRetry={loadLogs} />
                    ) : loading ? (
                      'Memuat log aktivitas...'
                    ) : (
                      'Belum ada log aktivitas tercatat.'
                    )}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                      {formatWaktu(log.createdAt)}
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900 whitespace-nowrap">
                      {log.userNama}
                    </td>
                    <td className="py-3 px-4">
                      {getActionBadge(log.aksi)}
                    </td>
                    <td className="py-3 px-4 text-gray-700 leading-relaxed font-medium">
                      {log.detail}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
