/**
 * ============================================================================
 * STATE MANAGEMENT: OTENTIKASI & PENGGUNA (src/stores/authStore.js)
 * ============================================================================
 * Menggunakan Zustand untuk mengelola state global sesi login, hak akses (RBAC),
 * dan daftar pengguna di seluruh halaman aplikasi.
 */

import { create } from 'zustand';
import { authService } from '../services/index.js';

export const useAuthStore = create((set, get) => ({
  // State: data pengguna yang sedang aktif login
  user: authService.getCurrentUser(),

  // State: daftar seluruh pengguna terdaftar
  usersList: authService.getAllUsers(),

  // Status loading dan error penanganan login
  loading: false,
  error: null,

  /**
   * Masuk ke sistem dengan email & password.
   */
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const user = await authService.login(email, password);
      const list = await authService.fetchUsersList();
      set({ user, usersList: list, loading: false });
      return user;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  /**
   * Keluar dari sesi aplikasi.
   */
  logout: async () => {
    await authService.logout();
    set({ user: null });
  },

  /**
   * LOGIKA ADMIN: Mendaftarkan akun pengguna baru ke sistem.
   * Hanya berhasil jika pengguna yang sedang login memiliki role 'admin'.
   */
  createUser: async (userData) => {
    const currentUser = get().user;
    const newUser = await authService.createUser(userData, currentUser);
    const list = await authService.fetchUsersList();
    set({ usersList: list });
    return newUser;
  },

  /**
   * LOGIKA ADMIN: Menonaktifkan atau mengaktifkan akun pengguna.
   */
  toggleUserActive: async (userId) => {
    const currentUser = get().user;
    const updated = await authService.toggleUserActive(userId, currentUser);
    const list = await authService.fetchUsersList();
    set({ usersList: list });
    return updated;
  },

  /**
   * LOGIKA ADMIN: Menghapus akun pengguna dari database.
   */
  deleteUser: async (userId) => {
    const currentUser = get().user;
    await authService.deleteUser(userId, currentUser);
    const list = await authService.fetchUsersList();
    set({ usersList: list });
    return true;
  }
}));
