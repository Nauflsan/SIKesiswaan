/**
 * ============================================================================
 * KOMPONEN CETAK: LAPORAN KEDISIPLINAN SISWA (src/components/print/LaporanSiswa.jsx)
 * ============================================================================
 * Dokumen cetak A4 resmi laporan kedisiplinan seorang siswa:
 * - Kop surat resmi instansi
 * - Biodata dan ringkasan akumulasi vs poin periode
 * - Ringkasan pelanggaran per kategori (bila ada)
 * - Kronologi insiden pelanggaran
 * - Riwayat surat peringatan yang pernah diterbitkan
 * - Blok tanda tangan pejabat sekolah (Guru BK / Kesiswaan & Kepala Sekolah)
 */

import KopSurat from './KopSurat.jsx';
import { formatTanggal, formatBadgeStatusSiswa, formatBadgeStatusSP } from '../../lib/helpers.js';
import { ringkasKategori, hitungPoinPeriode, labelStatusKasus, labelJenisSurat } from '../../lib/laporan.js';

export default function LaporanSiswa({
  siswa = {},
  kasus = [],
  suratList = [],
  settings = {},
  user = {},
  periodeLabel = 'Seluruh Riwayat'
}) {
  const kategoriSummary = ringkasKategori(kasus);
  const poinPeriode = hitungPoinPeriode(kasus);
  const tanggalCetak = formatTanggal(new Date().toISOString().slice(0, 10));

  const statusSiswaLabel = formatBadgeStatusSiswa(siswa?.statusSiswa).label;
  const statusSPLabel = formatBadgeStatusSP(siswa?.statusSP).label;

  return (
    <div
      className="laporan-siswa-dokumen"
      style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
    >
      {/* 1. Kop Surat Resmi */}
      <KopSurat settings={settings} />

      {/* 2. Judul Dokumen */}
      <div className="text-center mb-5">
        <h2 className="text-base sm:text-lg font-bold uppercase underline tracking-wide text-black">
          LAPORAN KEDISIPLINAN SISWA
        </h2>
        <p className="text-xs mt-1 text-black">Periode: {periodeLabel}</p>
      </div>

      {/* 3. Tabel Identitas Siswa */}
      <table className="w-full text-xs mb-5 tabel-utuh">
        <tbody>
          <tr>
            <td className="w-48 py-0.5 font-medium text-black">Nama Siswa</td>
            <td className="py-0.5 text-black">: <strong>{siswa?.nama || '-'}</strong></td>
          </tr>
          <tr>
            <td className="py-0.5 font-medium text-black">NISN</td>
            <td className="py-0.5 text-black">: {siswa?.nisn || '-'}</td>
          </tr>
          <tr>
            <td className="py-0.5 font-medium text-black">Kelas</td>
            <td className="py-0.5 text-black">: {siswa?.kelas || '-'}</td>
          </tr>
          <tr>
            <td className="py-0.5 font-medium text-black">Kompetensi Keahlian / Jurusan</td>
            <td className="py-0.5 text-black">: {siswa?.jurusan || 'Umum'}</td>
          </tr>
          <tr>
            <td className="py-0.5 font-medium text-black">Angkatan</td>
            <td className="py-0.5 text-black">: {siswa?.angkatan || '-'}</td>
          </tr>
          <tr>
            <td className="py-0.5 font-medium text-black">Status Siswa</td>
            <td className="py-0.5 text-black">: {statusSiswaLabel}</td>
          </tr>
          <tr>
            <td className="py-0.5 font-medium text-black">Status SP Terkini</td>
            <td className="py-0.5 text-black">: {statusSPLabel}</td>
          </tr>
          <tr>
            <td className="py-0.5 font-medium text-black">Akumulasi Poin Seluruh Waktu</td>
            <td className="py-0.5 text-black">: <strong>{Number(siswa?.totalPoin || 0)} Poin</strong></td>
          </tr>
          <tr>
            <td className="py-0.5 font-medium text-black">Poin pada Periode Ini</td>
            <td className="py-0.5 text-black">: <strong>{poinPeriode} Poin</strong></td>
          </tr>
        </tbody>
      </table>

      {/* 4. Ringkasan per Kategori (sembunyikan bila tidak ada) */}
      {kategoriSummary.length > 0 && (
        <div className="mb-5">
          <p className="font-bold text-[11px] mb-1.5 text-black">Ringkasan Pelanggaran per Kategori:</p>
          <table className="w-full border-collapse border border-black text-[11px] tabel-utuh">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="border border-black px-2 py-1 w-8 text-center text-black">No</th>
                <th className="border border-black px-2 py-1 text-black">Kategori Pelanggaran</th>
                <th className="border border-black px-2 py-1 w-28 text-center text-black">Jumlah Kejadian</th>
                <th className="border border-black px-2 py-1 w-24 text-center text-black">Total Poin</th>
              </tr>
            </thead>
            <tbody>
              {kategoriSummary.map((kat, idx) => (
                <tr key={idx}>
                  <td className="border border-black px-2 py-1 text-center text-black">{idx + 1}</td>
                  <td className="border border-black px-2 py-1 text-black">{kat.nama}</td>
                  <td className="border border-black px-2 py-1 text-center text-black">{kat.jumlah} kali</td>
                  <td className="border border-black px-2 py-1 text-center font-bold text-black">+{kat.poin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Kronologi Pelanggaran */}
      <div className="mb-5">
        <p className="font-bold text-[11px] mb-1.5 text-black">Kronologi Catatan Pelanggaran:</p>
        {kasus.length === 0 ? (
          <p className="text-center italic text-gray-700 my-4 py-2 border border-dashed border-gray-400">
            Tidak ada catatan pelanggaran pada periode ini.
          </p>
        ) : (
          <table className="w-full border-collapse border border-black text-[11px]">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="border border-black px-2 py-1 w-8 text-center text-black">No</th>
                <th className="border border-black px-2 py-1 w-20 text-black">Tanggal</th>
                <th className="border border-black px-2 py-1 text-black">Bentuk Pelanggaran</th>
                <th className="border border-black px-2 py-1 w-12 text-center text-black">Poin</th>
                <th className="border border-black px-2 py-1 w-28 text-black">Status Penanganan</th>
                <th className="border border-black px-2 py-1 w-24 text-black">Petugas</th>
              </tr>
            </thead>
            <tbody>
              {kasus.map((k, idx) => (
                <tr key={k.id || idx}>
                  <td className="border border-black px-2 py-1 text-center text-black">{idx + 1}</td>
                  <td className="border border-black px-2 py-1 whitespace-nowrap text-black">{formatTanggal(k.tanggal)}</td>
                  <td className="border border-black px-2 py-1 text-black">
                    <div className="font-medium text-black break-words">{k.kategoriNama}</div>
                    {k.deskripsi && (
                      <div className="text-[10px] text-gray-700 mt-0.5 italic break-words">
                        {k.deskripsi}
                      </div>
                    )}
                  </td>
                  <td className="border border-black px-2 py-1 text-center font-bold text-black">+{k.poin}</td>
                  <td className="border border-black px-2 py-1 text-black">{labelStatusKasus(k.status)}</td>
                  <td className="border border-black px-2 py-1 text-black">{k.createdByNama || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 6. Riwayat Surat Peringatan */}
      <div className="mb-4">
        <p className="font-bold text-[11px] mb-1.5 text-black">Riwayat Penerbitan Surat Peringatan:</p>
        {!suratList || suratList.length === 0 ? (
          <p className="text-center italic text-gray-700 my-2 py-1">
            Belum pernah diterbitkan surat peringatan.
          </p>
        ) : (
          <table className="w-full border-collapse border border-black text-[11px] tabel-utuh">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="border border-black px-2 py-1 w-8 text-center text-black">No</th>
                <th className="border border-black px-2 py-1 text-black">Nomor Surat</th>
                <th className="border border-black px-2 py-1 text-black">Jenis Surat</th>
                <th className="border border-black px-2 py-1 w-28 text-black">Tanggal Surat</th>
              </tr>
            </thead>
            <tbody>
              {suratList.map((s, idx) => (
                <tr key={s.id || idx}>
                  <td className="border border-black px-2 py-1 text-center text-black">{idx + 1}</td>
                  <td className="border border-black px-2 py-1 font-mono font-medium text-black">{s.nomorSurat || '-'}</td>
                  <td className="border border-black px-2 py-1 text-black">{labelJenisSurat(s.jenis)}</td>
                  <td className="border border-black px-2 py-1 whitespace-nowrap text-black">
                    {formatTanggal(s.tanggalSurat || (s.createdAt ? s.createdAt.slice(0, 10) : ''))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 7. Keterangan Akumulasi Poin */}
      <p className="text-[10px] italic text-gray-700 mt-2 mb-4">
        * Poin bersifat akumulatif dan tidak direset saat naik kelas.
      </p>

      {/* 8. Lembar Tanda Tangan Kedinasan */}
      <div className="tanda-tangan grid grid-cols-2 gap-8 pt-6 mt-6 text-xs text-black">
        <div>
          <p>Mengetahui,</p>
          <p className="font-bold">
            {user?.jabatan || (user?.role === 'guru_bk' ? 'Guru Bimbingan Konseling (BK)' : 'Kesiswaan')}
          </p>
          <div className="h-20"></div>
          <p className="font-bold underline uppercase">{user?.nama || 'Guru Bimbingan Konseling'}</p>
          <p className="text-[11px]">NIP. {user?.nip || '-'}</p>
        </div>

        <div className="text-right">
          <p>{settings?.kotaSekolah || 'Tangerang'}, {tanggalCetak}</p>
          <p className="font-bold">Kepala Sekolah,</p>
          <div className="h-20"></div>
          <p className="font-bold underline uppercase">{settings?.namaKepsek || '(Nama Kepala Sekolah)'}</p>
          <p className="text-[11px]">NIP. {settings?.nipKepsek || '-'}</p>
        </div>
      </div>
    </div>
  );
}
