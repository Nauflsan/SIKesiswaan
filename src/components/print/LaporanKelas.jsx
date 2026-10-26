/**
 * ============================================================================
 * KOMPONEN CETAK: LAPORAN KEDISIPLINAN SATU KELAS (src/components/print/LaporanKelas.jsx)
 * ============================================================================
 * Merender lembar LaporanSiswa untuk seluruh siswa dalam satu kelas.
 * Setiap siswa dibungkus pembungkus kelas .laporan-halaman agar terjadi page break
 * secara otomatis pada mode cetak A4.
 */

import LaporanSiswa from './LaporanSiswa.jsx';

export default function LaporanKelas({
  daftar = [],
  settings = {},
  user = {},
  periodeLabel = 'Seluruh Riwayat'
}) {
  return (
    <div className="laporan-kelas-koleksi">
      {daftar.map((item, index) => (
        <div key={item.siswa?.id || index} className="laporan-halaman">
          <LaporanSiswa
            siswa={item.siswa}
            kasus={item.kasus}
            suratList={item.suratList}
            settings={settings}
            user={user}
            periodeLabel={periodeLabel}
          />
        </div>
      ))}
    </div>
  );
}
