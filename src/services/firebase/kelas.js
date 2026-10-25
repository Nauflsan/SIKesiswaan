/**
 * ============================================================================
 * FIREBASE KELAS SERVICE (src/services/firebase/kelas.js)
 * ============================================================================
 * Mengelola master daftar kelas sekolah yang disimpan pada dokumen meta/kelas.
 * Mencegah full-scan koleksi siswa hanya untuk mendapatkan daftar kelas.
 */

import { db } from '../../lib/firebase.js';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { DEFAULT_KELAS } from '../../lib/helpers.js';
import { firebaseLogService } from './log.js';
import { firebaseSiswaService } from './siswa.js';

const META_KELAS_REF = doc(db, 'meta', 'kelas');

const normalizeKelas = (str) => String(str ?? '').trim().replace(/\s+/g, ' ');

let cachedKelas = null;

export const firebaseKelasService = {
  /**
   * Mengambil daftar master kelas terurut.
   * Menggunakan in-memory module cache kecuali { force: true }.
   */
  get: async ({ force = false } = {}) => {
    if (!force && cachedKelas !== null) {
      return cachedKelas.slice();
    }

    const snap = await getDoc(META_KELAS_REF);
    if (!snap.exists()) {
      const defaultList = [...DEFAULT_KELAS].sort();
      cachedKelas = defaultList;
      return defaultList.slice();
    }

    const data = snap.data();
    const list = (Array.isArray(data?.list) ? data.list : [])
      .map(normalizeKelas)
      .filter(Boolean)
      .sort();

    cachedKelas = list;
    return list.slice();
  },

  /**
   * Menambah daftar beberapa kelas baru ke dokumen meta/kelas.
   */
  addMany: async (daftarNama) => {
    if (!Array.isArray(daftarNama) || daftarNama.length === 0) {
      return firebaseKelasService.get();
    }

    const snap = await getDoc(META_KELAS_REF);
    const exists = snap.exists();
    const currentList = exists
      ? (Array.isArray(snap.data()?.list) ? snap.data().list : [])
      : [...DEFAULT_KELAS];

    const existingLowerSet = new Set(
      currentList.map(k => normalizeKelas(k).toLowerCase()).filter(Boolean)
    );

    const baru = [];
    for (const raw of daftarNama) {
      const normalized = normalizeKelas(raw);
      if (normalized && !existingLowerSet.has(normalized.toLowerCase())) {
        existingLowerSet.add(normalized.toLowerCase());
        baru.push(normalized);
      }
    }

    if (baru.length === 0) {
      const sorted = currentList.map(normalizeKelas).filter(Boolean).sort();
      cachedKelas = sorted;
      return sorted.slice();
    }

    const nowIso = new Date().toISOString();
    if (exists) {
      await updateDoc(META_KELAS_REF, {
        list: arrayUnion(...baru),
        updatedAt: nowIso
      });
    } else {
      await setDoc(META_KELAS_REF, {
        list: [...DEFAULT_KELAS, ...baru],
        updatedAt: nowIso
      });
    }

    const updatedList = [...currentList, ...baru]
      .map(normalizeKelas)
      .filter(Boolean)
      .sort();
    cachedKelas = updatedList;
    return updatedList.slice();
  },

  /**
   * Menambah satu nama kelas baru ke dokumen meta/kelas.
   */
  add: async (nama) => {
    return firebaseKelasService.addMany([nama]);
  },

  /**
   * Membangun ulang seluruh daftar kelas dari data siswa aktif + DEFAULT_KELAS (Khusus Admin).
   */
  rebuildFromSiswa: async (currentUser) => {
    const siswaAktif = await firebaseSiswaService.getAktif({ force: true });
    const kelasMap = new Map();

    // 1. Masukkan DEFAULT_KELAS
    DEFAULT_KELAS.forEach(k => {
      const norm = normalizeKelas(k);
      if (norm) kelasMap.set(norm.toLowerCase(), norm);
    });

    // 2. Masukkan kelas unik dari siswa aktif
    siswaAktif.forEach(s => {
      const norm = normalizeKelas(s.kelas);
      if (norm && !kelasMap.has(norm.toLowerCase())) {
        kelasMap.set(norm.toLowerCase(), norm);
      }
    });

    const mergedList = Array.from(kelasMap.values()).sort();
    const nowIso = new Date().toISOString();

    await setDoc(META_KELAS_REF, {
      list: mergedList,
      updatedAt: nowIso
    });

    cachedKelas = mergedList;

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'bangun_daftar_kelas',
      detail: `Membangun ulang daftar kelas (${mergedList.length} kelas)`,
      targetId: 'kelas',
      targetType: 'meta'
    });

    return mergedList.slice();
  }
};
