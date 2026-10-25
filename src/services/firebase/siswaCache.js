/**
 * ============================================================================
 * SISWA IN-MEMORY CACHE (src/services/firebase/siswaCache.js)
 * ============================================================================
 * Cache data siswa aktif di tingkat memori modul JavaScript (bukan storage browser).
 * Terisolasi per sesi pengguna (berdasarkan Firebase Auth UID) dengan TTL 30 menit.
 */

import { auth } from '../../lib/firebase.js';

const TTL_MS = 30 * 60 * 1000; // 30 menit
let state = { uid: null, list: null, ts: 0 };

const uidSekarang = () => auth.currentUser?.uid ?? null;
const valid = () =>
  state.list !== null && state.uid === uidSekarang() && Date.now() - state.ts < TTL_MS;

export const siswaCache = {
  /** Salinan daftar siswa aktif, atau null bila kosong/kedaluwarsa/beda pengguna */
  get() { return valid() ? state.list.slice() : null; },
  set(list) { state = { uid: uidSekarang(), list: list.slice(), ts: Date.now() }; },
  /** Ganti atau tambah satu siswa (hanya bila cache valid) */
  upsert(item) {
    if (!valid()) return;
    const i = state.list.findIndex(s => s.id === item.id);
    state.list = i >= 0
      ? state.list.map(s => (s.id === item.id ? { ...s, ...item } : s))
      : [...state.list, item];
  },
  /** Ubah sebagian field satu siswa (misal totalPoin dan statusSP) */
  patch(id, fields) {
    if (!valid()) return;
    state.list = state.list.map(s => (s.id === id ? { ...s, ...fields } : s));
  },
  remove(id) {
    if (!valid()) return;
    state.list = state.list.filter(s => s.id !== id);
  },
  clear() { state = { uid: null, list: null, ts: 0 }; }
};
