/**
 * ============================================================================
 * STATE MANAGEMENT: OTENTIKASI & PENGGUNA (src/stores/authStore.js)
 * ============================================================================
 * Menggunakan Zustand untuk mengelola sesi login dan hak akses (RBAC).
 * Sumber kebenaran sesi adalah Firebase Auth + dokumen profil /users/{uid},
 * bukan cache di browser. Panggil init() sekali saat aplikasi dibuka.
 */

import { create } from 'zustand';
import { authService } from '../services/index.js';

// Fungsi untuk berhenti memantau sesi (diisi oleh init)
let stopSession = null;

export const useAuthStore = create((set, get) => ({
  // Pengguna yang sedang login (null jika belum/tidak login)
  user: null,

  // false selama sesi Firebase belum selesai diperiksa (layar tunggu)
  ready: false,

  // Pesan bila sesi gagal dimuat karena jaringan (layar "Coba lagi")
  sessionError: null,

  // Alasan sesi berakhir (mis. akun dinonaktifkan), ditampilkan di halaman login
  sessionMessage: null,

  // Flag transisi animasi logo keluar saat berhasil login
  isLoginTransition: false,
  setLoginTransition: (val) => set({ isLoginTransition: val }),

  /**
   * Mulai memantau sesi. Aman dipanggil ulang (dipakai tombol "Coba lagi").
   */
  init: () => {
    if (stopSession) stopSession();
    set({ ready: false, sessionError: null });

    stopSession = authService.onSessionChange(({ user, message, retryable }) => {
      set((state) => ({
        user,
        ready: true,
        sessionError: retryable ? message : null,
        sessionMessage: user
          ? null
          : retryable
            ? state.sessionMessage
            : (message ?? state.sessionMessage)
      }));
    });
  },

  /**
   * Masuk ke sistem dengan email & password. State user diisi oleh pemantau sesi.
   */
  login: async (email, password) => {
    set({ sessionMessage: null });
    try {
      return await authService.login(email, password);
    } catch (err) {
      set({ sessionMessage: null });
      throw err;
    }
  },

  /**
   * Keluar dari sesi aplikasi.
   */
  logout: async () => {
    await authService.logout();
    set({ user: null, sessionMessage: null, isLoginTransition: false });
  },

  /**
   * LOGIKA ADMIN: Mendaftarkan akun pengguna baru ke sistem.
   * Hanya berhasil jika pengguna yang sedang login memiliki role 'admin'.
   */
  createUser: async (userData) => {
    return authService.createUser(userData, get().user);
  },

  /**
   * LOGIKA ADMIN: Menonaktifkan atau mengaktifkan akun pengguna.
   */
  toggleUserActive: async (userId) => {
    return authService.toggleUserActive(userId, get().user);
  },

  /**
   * LOGIKA ADMIN: Menghapus akun pengguna dari database.
   */
  deleteUser: async (userId) => {
    return authService.deleteUser(userId, get().user);
  },

  /**
   * LOGIKA ADMIN: Mengubah nama, NIP, dan role pengguna.
   */
  updateUser: async (userId, data) => {
    return authService.updateUser(userId, data, get().user);
  },

  /**
   * LOGIKA ADMIN: Mengirim tautan reset kata sandi ke email pengguna lain.
   */
  sendUserPasswordReset: async (userId) => {
    return authService.sendUserPasswordReset(userId, get().user);
  },

  /**
   * Lupa kata sandi: kirim tautan reset ke email (bisa dipakai tanpa login).
   */
  sendPasswordReset: async (email) => {
    return authService.sendPasswordReset(email);
  },

  /**
   * Ganti kata sandi akun yang sedang login (wajib kata sandi saat ini).
   */
  changePassword: async (currentPassword, newPassword) => {
    return authService.changePassword(currentPassword, newPassword, get().user);
  }
}));
