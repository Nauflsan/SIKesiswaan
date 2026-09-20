/**
 * ============================================================================
 * STATE MANAGEMENT: ANTARMUKA PENGGUNA & TOAST NOTIFIKASI (src/stores/uiStore.js)
 * ============================================================================
 * Mengelola pop-up notifikasi melayang (Toast) di pojok kanan atas layar
 * untuk memberi feedback visual kepada pengguna setelah aksi simpan/edit/hapus.
 */

import { create } from 'zustand';

export const useUIStore = create((set) => ({
  // State: data pesan notifikasi saat ini ({ message, type }) atau null
  toast: null,

  /**
   * Menampilkan pesan notifikasi toast dengan auto-dismiss.
   * @param {string} message - Teks pesan notifikasi
   * @param {'success' | 'error' | 'info'} type - Tipe warna notifikasi (default: 'success')
   * @param {number} duration - Durasi tayang dalam milidetik (default: 3500ms)
   */
  showToast: (message, type = 'success', duration = 3500) => {
    set({ toast: { message, type } });

    // Hapus otomatis setelah durasi habis
    setTimeout(() => {
      set((state) => {
        if (state.toast && state.toast.message === message) {
          return { toast: null };
        }
        return state;
      });
    }, duration);
  },

  /**
   * Menutup notifikasi toast secara manual.
   */
  hideToast: () => set({ toast: null })
}));
