/**
 * =============================================================================
 * KOMPONEN: Surat (Penerbitan Surat Peringatan & Panggilan Resmi)
 * =============================================================================
 * Modul administratif sekolah untuk menerbitkan Surat Peringatan (SP1, SP2, SP3)
 * atau Surat Panggilan Orang Tua sesuai format tata naskah dinas resmi.
 *
 * FITUR UTAMA & LOGIKA BISNIS:
 * 1. Penomoran Surat Atomik Otomatis:
 *    - Menggunakan atomic counter dari konfigurasi sekolah (`nomorSuratCounter`).
 *    - Format baku dinas: [NO_URUT]/BK-DISP/[BULAN_ROMAWI]/[TAHUN]
 *      Contoh: 001/BK-DISP/IX/2026.
 * 2. Kop Surat & Tipografi Formal:
 *    - Wajib menggunakan font serif baku instansi pendidikan: 'Times New Roman'.
 *    - Header memuat identitas dinamis (Pemda, Dinas Pendidikan, Sekolah, Alamat, Telp, Email).
 * 3. Seleksi Riwayat Pelanggaran:
 *    - Pengguna dapat memilih daftar pelanggaran mana saja yang ingin dilampirkan
 *      pada badan surat sebagai rujukan sanksi.
 * 4. Cetak / Simpan PDF:
 *    - Memakai window.print() dengan CSS khusus @media print (A4);
 *      pilih "Save as PDF" pada dialog cetak untuk mengunduh PDF.
 * =============================================================================
 */

import { useState, useEffect } from 'preact/hooks';
import AppLayout from '../components/layout/AppLayout.jsx';
import Modal from '../components/ui/Modal.jsx';
import { suratService, siswaService, kasusService, settingsService } from '../services/index.js';
import { friendlyError } from '../lib/errors.js';
import LoadError from '../components/ui/LoadError.jsx';
import { useAuthStore } from '../stores/authStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { formatTanggal } from '../lib/helpers.js';
import {
  Printer,
  Plus,
  Eye
} from 'lucide-preact';

export default function Surat() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  // State arsip surat, siswa, dan profil sekolah
  const [suratList, setSuratList] = useState([]);
  const [siswaList, setSiswaList] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // State Modal Penerbitan Surat Baru
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSiswaId, setSelectedSiswaId] = useState('');
  const [jenisSurat, setJenisSurat] = useState('sp1');
  const [keteranganTambahan, setKeteranganTambahan] = useState('');
  const [studentKasus, setStudentKasus] = useState([]);
  const [selectedKasusIds, setSelectedKasusIds] = useState([]);
  const [generating, setGenerating] = useState(false);

  // State Pratinjau Lembar Surat Resmi untuk Cetak
  const [previewSurat, setPreviewSurat] = useState(null);
  const [previewKasusList, setPreviewKasusList] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  /**
   * Mengambil data arsip surat, data siswa, dan setting kop surat sekolah
   */
  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const [suratData, siswaData, settingsData] = await Promise.all([
        suratService.getAll(),
        siswaService.getAll(),
        settingsService.get()
      ]);
      setSuratList(suratData);
      setSiswaList(siswaData);
      setSettings(settingsData);

      // Cek apakah ada query param ?siswaId=... atau ?id=... dari halaman lain
      const params = new URLSearchParams(window.location.search);
      const sId = params.get('siswaId');
      const suratId = params.get('id');
      if (suratId) {
        const found = suratData.find(s => s.id === suratId);
        if (found) {
          setPreviewSurat(found);
        }
      } else if (sId) {
        setSelectedSiswaId(sId);
        setShowCreateModal(true);
      }
    } catch (err) {
      const msg = friendlyError(err, 'Gagal memuat arsip surat');
      setLoadError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Mengambil riwayat kasus siswa yang dipilih agar dapat dicantumkan pada surat
   */
  useEffect(() => {
    if (!selectedSiswaId) {
      setStudentKasus([]);
      setSelectedKasusIds([]);
      return;
    }
    kasusService.getBySiswaId(selectedSiswaId).then(data => {
      setStudentKasus(data);
      setSelectedKasusIds(data.map(k => k.id)); // Secara default pilih semua kasus aktif
    });
  }, [selectedSiswaId]);

  /**
   * Mengambil rincian kasus untuk ditampilkan pada pratinjau lembar surat
   */
  useEffect(() => {
    if (!previewSurat?.siswaId) {
      setPreviewKasusList([]);
      return;
    }
    const ids = Array.isArray(previewSurat.kasusIds) ? previewSurat.kasusIds : [];
    if (ids.length === 0) {
      setPreviewKasusList([]);
      return;
    }
    kasusService.getBySiswaId(previewSurat.siswaId, { includeDeleted: true }).then((data) => {
      setPreviewKasusList(data.filter(k => ids.includes(k.id)));
    }).catch(() => {
      setPreviewKasusList([]);
    });
  }, [previewSurat]);

  /**
   * Handler penerbitan surat:
   * Menyimpan arsip surat ke database dan menaikkan nomor surat atomik.
   */
  const handleCreateSurat = async (e) => {
    e.preventDefault();
    if (!selectedSiswaId) {
      showToast('Silakan pilih siswa terlebih dahulu', 'error');
      return;
    }

    setGenerating(true);
    try {
      const created = await suratService.create({
        siswaId: selectedSiswaId,
        jenis: jenisSurat,
        kasusIds: selectedKasusIds,
        keteranganTambahan,
        status: 'draft'
      }, user);

      showToast(`Surat ${created.nomorSurat} berhasil dibuat!`, 'success');
      setShowCreateModal(false);
      loadData();
      setPreviewSurat(created); // Langsung buka pratinjau surat
    } catch (err) {
      showToast(err.message || 'Gagal menerbitkan surat', 'error');
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Membuka dialog print browser untuk cetak langsung atau "Save as PDF"
   */
  const handlePrint = () => {
    window.print();
  };

  return (
    <AppLayout
      title="Surat Peringatan & Panggilan Resmi"
      subtitle="Penerbitan surat resmi kedisiplinan sekolah berstandar administratif"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-semibold text-gray-500">
            Total {suratList.length} surat telah diterbitkan
          </span>
        </div>
        <button
          onClick={() => {
            setSelectedSiswaId('');
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Surat SP Baru</span>
        </button>
      </div>

      {/* Letters List */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4">Nomor Surat</th>
                <th className="py-3 px-4">Jenis Surat</th>
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Tanggal Diterbitkan</th>
                <th className="py-3 px-4">Akumulasi Poin</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {suratList.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-gray-400">
                    {loadError ? (
                      <LoadError message={loadError} onRetry={loadData} />
                    ) : loading ? (
                      'Memuat data surat...'
                    ) : (
                      'Belum ada surat peringatan yang dibuat. Klik tombol di atas untuk menerbitkan surat.'
                    )}
                  </td>
                </tr>
              ) : (
                suratList.map((surat) => (
                  <tr key={surat.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                      {surat.nomorSurat}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900">
                        {surat.jenis}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-900">
                      {surat.siswaNama}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {surat.siswaKelas}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {formatTanggal(surat.tanggalSurat)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-red-600">
                      {surat.totalPoin} pt
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 capitalize">
                        {surat.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setPreviewSurat(surat)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Pratinjau</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Generate Surat */}
      {showCreateModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowCreateModal(false)}
          title="Penerbitan Surat Peringatan / Panggilan"
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleCreateSurat} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                Pilih Siswa Penerima Surat <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSiswaId}
                onChange={(e) => setSelectedSiswaId(e.target.value)}
                required
                className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl"
              >
                <option value="">-- Pilih Siswa --</option>
                {siswaList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nama} ({s.kelas} • {s.totalPoin} Poin • {s.statusSP.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Jenis Surat <span className="text-red-500">*</span>
                </label>
                <select
                  value={jenisSurat}
                  onChange={(e) => setJenisSurat(e.target.value)}
                  className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold"
                >
                  <option value="sp1">Surat Peringatan I (SP 1)</option>
                  <option value="sp2">Surat Peringatan II (SP 2)</option>
                  <option value="sp3">Surat Peringatan III (SP 3 / Terakhir)</option>
                  <option value="panggilan_orang_tua">Surat Panggilan Orang Tua</option>
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Nomor Surat Berikutnya
                </label>
                <input
                  type="text"
                  disabled
                  value={`Nomor Urut #${(settings.nomorSuratCounter || 0) + 1} (Auto-increment)`}
                  className="w-full text-sm py-2 px-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 font-mono"
                />
              </div>
            </div>

            {/* Select violations to include in letter */}
            {studentKasus.length > 0 && (
              <div>
                <label className="block font-bold uppercase tracking-wider text-gray-600 mb-2">
                  Daftar Pelanggaran yang Dicantumkan di Surat ({selectedKasusIds.length} terpilih)
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  {studentKasus.map(k => (
                    <label key={k.id} className="flex items-center gap-2 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={selectedKasusIds.includes(k.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedKasusIds([...selectedKasusIds, k.id]);
                          } else {
                            setSelectedKasusIds(selectedKasusIds.filter(id => id !== k.id));
                          }
                        }}
                        className="rounded text-[#4A6FA5] focus:ring-[#4A6FA5]"
                      />
                      <span className="font-medium text-gray-800">{formatTanggal(k.tanggal)}</span>
                      <span className="text-gray-500">— {k.kategoriNama}</span>
                      <span className="font-bold text-rose-600 ml-auto">+{k.poin} pt</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-600 mb-1">
                Instruksi Khusus / Jadwal Menghadap (Opsional)
              </label>
              <textarea
                rows="2"
                placeholder="Contoh: Orang tua / wali siswa diminta hadir ke ruang BK pada hari Senin, 21 September 2026 pukul 09.00 WIB."
                value={keteranganTambahan}
                onInput={(e) => setKeteranganTambahan(e.target.value)}
                className="w-full text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={generating}
                className="px-5 py-2 bg-[#4A6FA5] hover:bg-[#3b5b88] text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
              >
                {generating ? 'Membuat...' : 'Terbitkan Surat Resmi'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Preview & Print Modal */}
      {previewSurat && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewSurat(null)}
          title={`Pratinjau Resmi: ${previewSurat.nomorSurat}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            {/* Top action buttons */}
            <div className="flex items-center justify-between no-print bg-gray-50 p-3 rounded-xl border border-gray-200">
              <span className="text-xs text-gray-500 font-medium">
                Kop resmi sekolah & tanda tangan kepala sekolah otomatis terpasang
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-semibold"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Langsung</span>
                </button>
              </div>
            </div>

            {/* Official Letterhead Paper View */}
            <div
              id="printable-surat-content"
              className="surat-resmi bg-white p-8 sm:p-12 border border-gray-300 rounded-lg shadow-sm text-black leading-relaxed"
              style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
            >
              {/* Kop Surat Resmi */}
              <div className="pb-3 mb-5 border-b-[3px] border-double border-black">
                <div className="flex items-center gap-4">
                  {/* Logo Sekolah di Kiri */}
                  <div className="w-20 shrink-0 flex items-center justify-center">
                    <img
                      src="/Logo1-removebg-preview.png"
                      alt="Logo SMKS Kharisma Panongan"
                      className="w-18 h-18 object-contain"
                    />
                  </div>

                  {/* Identitas Sekolah di Tengah */}
                  <div className="flex-1 text-center pr-4 sm:pr-0">
                    {settings.pemerintahDaerah && (
                      <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider leading-tight text-black">
                        {settings.pemerintahDaerah}
                      </h3>
                    )}
                    {settings.dinasPendidikan && (
                      <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider leading-tight text-black">
                        {settings.dinasPendidikan}
                      </h4>
                    )}
                    <h1 className="text-lg sm:text-2xl font-black uppercase text-black tracking-wide my-0.5">
                      {settings.namaSekolah || 'SMKS KHARISMA PANONGAN'}
                    </h1>
                    <p className="text-[11px] text-black leading-tight">
                      {settings.alamatSekolah || 'Jl. Raya Panongan No. 1, Kab. Tangerang, Banten'}
                      {settings.teleponSekolah ? ` • Telp: ${settings.teleponSekolah}` : ''}
                    </p>
                    {(settings.websiteSekolah || settings.emailSekolah) && (
                      <p className="text-[10px] text-black leading-tight italic mt-0.5">
                        {settings.websiteSekolah ? `Laman: ${settings.websiteSekolah}` : ''}
                        {settings.websiteSekolah && settings.emailSekolah ? ' • ' : ''}
                        {settings.emailSekolah ? `Pos-el: ${settings.emailSekolah}` : ''}
                      </p>
                    )}
                  </div>
                  {/* Spacer penyeimbang di sisi kanan untuk tampilan desktop */}
                  <div className="w-20 shrink-0 hidden sm:block" />
                </div>
              </div>

              {/* Header Surat: Nomor, Lampiran, Hal */}
              <div className="flex justify-between items-start text-xs mb-6 gap-4">
                <table className="text-xs shrink-0" style={{ width: 'auto' }}>
                  <tbody>
                    <tr><td className="w-20 py-0.5">Nomor</td><td>: {previewSurat.nomorSurat}</td></tr>
                    <tr><td className="py-0.5">Lampiran</td><td>: -</td></tr>
                    <tr><td className="py-0.5 align-top">Perihal</td><td className="align-top">: <strong>
                      {previewSurat.jenis === 'sp1'
                        ? 'Surat Peringatan Pertama (SP 1)'
                        : previewSurat.jenis === 'sp2'
                        ? 'Surat Peringatan Kedua (SP 2)'
                        : previewSurat.jenis === 'sp3'
                        ? 'Surat Peringatan Ketiga / Terakhir (SP 3)'
                        : 'Panggilan Orang Tua / Wali Siswa'}
                    </strong></td></tr>
                  </tbody>
                </table>
                <div className="text-right text-xs shrink-0 whitespace-nowrap pt-0.5">
                  <p>{settings.kotaSekolah || 'Tangerang'}, {formatTanggal(previewSurat.tanggalSurat)}</p>
                </div>
              </div>

              {/* Penerima Surat */}
              <div className="text-xs mb-5">
                <p>Kepada Yth.</p>
                <p className="font-bold">Bapak / Ibu Orang Tua / Wali dari Siswa:</p>
                <table className="my-2 ml-4 text-xs">
                  <tbody>
                    <tr><td className="w-28 py-0.5 font-medium">Nama Siswa</td><td>: <strong>{previewSurat.siswaNama}</strong></td></tr>
                    <tr><td className="py-0.5 font-medium">NISN</td><td>: {previewSurat.siswaNisn}</td></tr>
                    <tr><td className="py-0.5 font-medium">Kelas</td><td>: {previewSurat.siswaKelas}</td></tr>
                  </tbody>
                </table>
                <p>Di Tempat</p>
              </div>

              {/* Isi Surat Baku */}
              <div className="text-xs space-y-3 leading-relaxed text-justify">
                <p>
                  Dengan hormat,
                </p>
                <p>
                  Berdasarkan hasil pemantauan ketertiban dan kedisiplinan siswa di lingkungan sekolah, bersama surat ini pihak sekolah menyampaikan pemberitahuan resmi bahwa putra/putri Bapak/Ibu tercatat telah melakukan pelanggaran tata tertib sekolah dengan akumulasi mencapai <strong>{previewSurat.totalPoin} Poin Pelanggaran</strong>.
                </p>

                {previewKasusList.length > 0 && (
                  <div className="my-3">
                    <p className="font-semibold mb-1">Rincian pelanggaran yang tercatat:</p>
                    <table className="w-full border-collapse border border-black text-[11px]">
                      <thead>
                        <tr className="bg-gray-100 text-left">
                          <th className="border border-black px-2 py-1.5 w-8 text-center">No</th>
                          <th className="border border-black px-2 py-1.5 w-24">Tanggal</th>
                          <th className="border border-black px-2 py-1.5">Bentuk Pelanggaran</th>
                          <th className="border border-black px-2 py-1.5 w-16 text-center">Poin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewKasusList.map((k, idx) => (
                          <tr key={k.id || idx}>
                            <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                            <td className="border border-black px-2 py-1 whitespace-nowrap">{formatTanggal(k.tanggal)}</td>
                            <td className="border border-black px-2 py-1">{k.kategoriNama}{k.deskripsi ? ` (${k.deskripsi})` : ''}</td>
                            <td className="border border-black px-2 py-1 text-center font-bold">+{k.poin}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {previewSurat.keteranganTambahan ? (
                  <div className="p-3 border border-black/80 my-2 bg-gray-50/40 text-xs">
                    <p className="font-bold mb-1">Pemberitahuan Khusus / Jadwal Menghadap:</p>
                    <p className="italic">{previewSurat.keteranganTambahan}</p>
                  </div>
                ) : (
                  <p>
                    Sehubungan dengan hal tersebut, kami mengharapkan kerja sama Bapak/Ibu untuk memberikan bimbingan dan pengawasan yang lebih intensif di lingkungan keluarga agar yang bersangkutan tidak mengulangi tindakan pelanggaran di kemudian hari.
                  </p>
                )}

                <p>
                  Demikian surat pemberitahuan peringatan ini kami sampaikan dengan sebenar-benarnya untuk menjadi perhatian bersama demi kelancaran proses pembinaan karakter dan masa depan putra/putri Bapak/Ibu di sekolah kami. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.
                </p>
              </div>

              {/* Tanda Tangan Resmi */}
              <div className="flex justify-between items-start pt-8 mt-6 text-xs text-black">
                <div className="w-56 text-left">
                  <p>Mengetahui,</p>
                  <p className="font-bold">Guru Bimbingan Konseling (BK)</p>
                  <div className="h-20"></div>
                  <p className="font-bold underline uppercase">{previewSurat.createdByNama || user?.nama || 'Guru Bimbingan Konseling'}</p>
                  <p className="text-[11px]">NIP. {previewSurat.createdByNip || user?.nip || '-'}</p>
                </div>

                <div className="w-56 text-right">
                  <p className="invisible">Mengetahui,</p>
                  <p className="font-bold">Kepala Sekolah,</p>
                  <div className="h-20"></div>
                  <p className="font-bold underline uppercase">{settings.namaKepsek || '(Nama Kepala Sekolah belum diisi)'}</p>
                  <p className="text-[11px]">NIP. {settings.nipKepsek || '-'}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 no-print">
              <button
                onClick={() => setPreviewSurat(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
