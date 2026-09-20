import { AlertCircle, RefreshCw } from 'lucide-preact';

/**
 * Pesan gagal memuat data beserta tombol "Coba lagi".
 */
export default function LoadError({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4">
      <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
      <p className="text-sm font-semibold text-red-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-[#4A6FA5] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Coba lagi
      </button>
    </div>
  );
}
