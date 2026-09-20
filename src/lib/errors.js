/**
 * Mengubah error Firebase menjadi pesan yang mudah dipahami pengguna.
 * Kode error tidak dikenal memakai pesan cadangan (fallback).
 */
export function friendlyError(err, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  const code = String(err?.code || '');

  if (code.includes('permission-denied')) {
    return 'Akses ditolak. Akun Anda tidak berhak melakukan tindakan ini.';
  }
  if (code.includes('unauthenticated')) {
    return 'Sesi berakhir. Silakan masuk kembali.';
  }
  if (code.includes('unavailable') || code.includes('network') || code.includes('deadline-exceeded')) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
  }
  // Error buatan aplikasi (tanpa kode Firebase) sudah berbahasa Indonesia
  if (!code && err?.message) return err.message;
  return fallback;
}
