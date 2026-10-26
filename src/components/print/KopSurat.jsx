/**
 * ============================================================================
 * KOMPONEN CETAK: KOP SURAT RESMI (src/components/print/KopSurat.jsx)
 * ============================================================================
 * Menampilkan kepala surat resmi sekolah dengan logo di sisi kiri
 * dan informasi identitas instansi di bagian tengah.
 */

export default function KopSurat({ settings = {} }) {
  return (
    <div className="kop-surat pb-3 mb-5 border-b-[3px] border-double border-black">
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
  );
}
