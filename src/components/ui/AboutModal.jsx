import Modal from './Modal.jsx';
import { ShieldCheck, School, Code, Info } from 'lucide-preact';

/**
 * =============================================================================
 * KOMPONEN: AboutModal (Informasi Sistem & Hak Cipta)
 * =============================================================================
 * Modal resmi informasi rilis, profil pengembang, program PKM, dan
 * pernyataan Hak Cipta (HKI) UU No. 28 Tahun 2014.
 */
export default function AboutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tentang Sistem & Informasi Lisensi"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-xs text-gray-600">
        {/* Header Identitas Sistem */}
        <div className="flex items-center gap-3.5 p-3.5 bg-gray-50 border border-gray-100 rounded-2xl">
          <div className="w-12 h-12 rounded-xl bg-white p-2 border border-gray-200/80 shadow-xs flex items-center justify-center shrink-0">
            <img
              src="/Logo1-removebg-preview.png"
              alt="Logo SMK Kharisma"
              className="w-8 h-8 object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="font-heading font-extrabold text-base text-gray-900 leading-tight">
              SIK-Kharisma
            </div>
            <div className="text-[11px] text-gray-500 font-medium">
              Sistem Informasi Kesiswaan & Kedisiplinan
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-md bg-blue-100/80 text-[#4A6FA5] font-bold text-[10px]">
                Versi 1.0.0
              </span>
              <span className="text-[10px] text-gray-400 font-medium">
                Rilis 2026
              </span>
            </div>
          </div>
        </div>

        {/* Deskripsi Singkat */}
        <p className="text-gray-600 leading-relaxed text-[11px]">
          Platform tata kelola kesiswaan terpadu untuk pencatatan rekam jejak kedisiplinan, sistem poin kumulatif pelanggaran berjenjang, dan penerbitan surat peringatan (SP) dinas resmi.
        </p>

        {/* Detail Pengembang & Mitra */}
        <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <School className="w-4 h-4 text-[#4A6FA5] shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Mitra Instansi
              </div>
              <div className="font-semibold text-gray-800">
                SMK Kharisma Nusantara
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-2 border-t border-gray-100">
            <Code className="w-4 h-4 text-[#4A6FA5] shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Program & Pengembang
              </div>
              <div className="font-semibold text-gray-800">
                Program Kreativitas Mahasiswa (PKM)
              </div>
              <div className="text-[11px] text-gray-500">
                Dikembangkan oleh Tim PKM Universitas Pamulang
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-2 border-t border-gray-100">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Status Hak Cipta (HKI)
              </div>
              <div className="font-semibold text-gray-800">
                Hak Cipta © 2026
              </div>
              <div className="text-[10px] text-gray-500 leading-snug">
                Dilindungi Undang-Undang Republik Indonesia No. 28 Tahun 2014 tentang Hak Cipta.
              </div>
            </div>
          </div>
        </div>

        {/* Footer Tombol Tutup */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}
