/**
 * ============================================================================
 * FIREBASE AUTH & USER SERVICE (src/services/firebase/auth.js)
 * ============================================================================
 * Mengelola sesi autentikasi pengguna nyata ke Google Firebase Auth
 * dan sinkronisasi hak akses (RBAC) dengan koleksi Firestore 'users'.
 */

import { auth, db } from '../../lib/firebase.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  deleteUser as deleteAuthUser,
  getAuth
} from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { firebaseLogService } from './log.js';

const CACHE_USER_KEY = 'sks_firebase_user_cache';
const CACHE_USERS_LIST_KEY = 'sks_firebase_users_list_cache';

// Helper get cached user
function getCachedUser() {
  try {
    const raw = localStorage.getItem(CACHE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Helper set cached user
function setCachedUser(user) {
  try {
    if (user) {
      localStorage.setItem(CACHE_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CACHE_USER_KEY);
    }
  } catch {}
}

// Helper cached users list
function getCachedUsersList() {
  try {
    const raw = localStorage.getItem(CACHE_USERS_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setCachedUsersList(list) {
  try {
    localStorage.setItem(CACHE_USERS_LIST_KEY, JSON.stringify(list || []));
  } catch {}
}

export const firebaseAuthService = {
  /**
   * Mengambil data pengguna yang sedang aktif (dari cache lokal untuk respon instan)
   */
  getCurrentUser: () => {
    return getCachedUser();
  },

  /**
   * Mengambil daftar seluruh pengguna dari Firestore
   */
  getAllUsers: () => {
    return getCachedUsersList();
  },

  /**
   * Refresh daftar pengguna dari Firestore secara asinkron
   */
  fetchUsersList: async () => {
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCachedUsersList(list);
      return list;
    } catch (err) {
      console.warn('Gagal memuat users dari Firestore:', err.message);
      return getCachedUsersList();
    }
  },

  /**
   * Masuk ke sistem menggunakan Firebase Authentication
   */
  login: async (email, password) => {
    // 1. Autentikasi dengan Firebase Auth
    let cred;
    try {
      cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      console.warn('Firebase login error:', err.code, err.message);
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
      ) {
        throw new Error('Email atau kata sandi yang Anda masukkan salah.');
      } else if (err.code === 'auth/invalid-email') {
        throw new Error('Format alamat email tidak valid.');
      } else if (err.code === 'auth/too-many-requests') {
        throw new Error('Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat.');
      } else if (err.code === 'auth/network-request-failed') {
        throw new Error('Gagal terhubung ke server. Periksa koneksi internet Anda.');
      }
      throw new Error(err.message || 'Email atau kata sandi yang Anda masukkan salah.');
    }
    const fbUser = cred.user;

    // 2. Ambil dokumen profil & role dari koleksi 'users' di Firestore.
    //    Tidak ada pembuatan profil otomatis: akun harus didaftarkan Administrator
    //    (admin pertama dibuat manual lewat Firebase Console).
    const userDocRef = doc(db, 'users', fbUser.uid);
    let userDocSnap;
    try {
      userDocSnap = await getDoc(userDocRef);
    } catch (err) {
      await signOut(auth);
      setCachedUser(null);
      throw new Error('Gagal memuat profil akun. Silakan coba lagi.');
    }

    if (!userDocSnap.exists()) {
      await signOut(auth);
      setCachedUser(null);
      throw new Error('Akun Anda belum terdaftar di sistem. Hubungi Administrator.');
    }

    const profile = { id: fbUser.uid, ...userDocSnap.data() };

    if (!['admin', 'guru_bk'].includes(profile.role)) {
      await signOut(auth);
      setCachedUser(null);
      throw new Error('Role akun tidak valid. Hubungi Administrator.');
    }

    // 3. Validasi status aktif akun
    if (profile.isActive === false) {
      await signOut(auth);
      setCachedUser(null);
      throw new Error('Akses ditolak: Akun Anda telah dinonaktifkan oleh Administrator.');
    }

    // 4. Simpan ke cache lokal
    setCachedUser(profile);

    // Refresh daftar user di background
    firebaseAuthService.fetchUsersList().catch(() => {});

    return profile;
  },

  /**
   * Keluar dari sesi aplikasi
   */
  logout: async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Signout error:', err.message);
    } finally {
      setCachedUser(null);
    }
  },

  /**
   * Mendaftarkan pengguna baru (Admin Only)
   * Menggunakan secondary Firebase App agar sesi login Admin saat ini tidak terputus.
   */
  createUser: async (userData, currentUser) => {
    if (currentUser?.role !== 'admin') {
      throw new Error('Hanya Administrator yang memiliki izin mendaftarkan pengguna baru!');
    }

    if (!['admin', 'guru_bk'].includes(userData.role)) {
      throw new Error('Role tidak valid. Pilih Administrator atau Guru BK.');
    }

    const email = userData.email.trim();
    const tempPassword = userData.password || '';
    if (tempPassword.length < 6) {
      throw new Error('Kata sandi awal wajib diisi (minimal 6 karakter).');
    }

    // Inisialisasi app sekunder terisolasi
    const existingApps = getApps();
    const secondaryAppName = 'SecondaryAuthApp';
    let secondaryApp = existingApps.find(a => a.name === secondaryAppName);
    if (!secondaryApp) {
      secondaryApp = initializeApp(
        {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID
        },
        secondaryAppName
      );
    }

    const secondaryAuth = getAuth(secondaryApp);
    const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
    const newUid = userCred.user.uid;

    // Simpan data profil pengguna ke Firestore
    const newUserDoc = {
      id: newUid,
      uid: newUid,
      nama: userData.nama.trim(),
      nip: userData.nip ? userData.nip.trim() : '-',
      email: email,
      role: userData.role,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'users', newUid), newUserDoc);
    } catch (err) {
      // Profil gagal disimpan: hapus akun Auth agar tidak ada akun yatim tanpa profil
      await deleteAuthUser(userCred.user).catch(() => {});
      await signOut(secondaryAuth);
      throw new Error('Gagal menyimpan profil pengguna. Akun tidak dibuat.');
    }

    // Keluar dari secondary app (sesi Admin di app utama tidak terpengaruh)
    await signOut(secondaryAuth);

    // Perbarui cache lokal
    const currentList = getCachedUsersList();
    const updatedList = [newUserDoc, ...currentList.filter(u => u.id !== newUid)];
    setCachedUsersList(updatedList);

    return newUserDoc;
  },

  /**
   * Mengubah status aktif akun pengguna (Admin Only)
   */
  toggleUserActive: async (userId, currentUser) => {
    if (currentUser?.role !== 'admin') {
      throw new Error('Hanya Administrator yang berhak mengubah status akun!');
    }

    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) throw new Error('Pengguna tidak ditemukan di database.');

    const currentStatus = snap.data().isActive !== false;
    const newStatus = !currentStatus;

    await updateDoc(userDocRef, {
      isActive: newStatus,
      updatedAt: serverTimestamp()
    });

    const updated = { id: userId, ...snap.data(), isActive: newStatus };
    const list = getCachedUsersList().map(u => u.id === userId ? updated : u);
    setCachedUsersList(list);

    return updated;
  },

  /**
   * Menghapus akun pengguna dari database (Admin Only)
   */
  deleteUser: async (userId, currentUser) => {
    if (currentUser?.role !== 'admin') {
      throw new Error('Hanya Administrator yang berhak menghapus akun pengguna!');
    }
    if (userId === currentUser?.id || userId === currentUser?.uid) {
      throw new Error('Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif!');
    }

    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    const nama = snap.exists() ? snap.data().nama : userId;

    await deleteDoc(userDocRef);

    // Hapus dari cache lokal
    const list = getCachedUsersList().filter(u => u.id !== userId);
    setCachedUsersList(list);

    // Catat log aktivitas
    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'hapus_user',
      detail: `Menghapus akun pengguna: ${nama}`,
      targetId: userId,
      targetType: 'user'
    });

    return true;
  },

  /**
   * Simulasi ganti role lokal (untuk keperluan demonstrasi sidang)
   */
  setCurrentUser: (user) => {
    setCachedUser(user);
  }
};
