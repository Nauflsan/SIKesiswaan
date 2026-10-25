/**
 * ============================================================================
 * FIREBASE AUTH & USER SERVICE (src/services/firebase/auth.js)
 * ============================================================================
 * Mengelola sesi autentikasi pengguna nyata ke Google Firebase Auth
 * dan sinkronisasi hak akses (RBAC) dengan koleksi Firestore 'users'.
 */

import { auth, db } from '../../lib/firebase.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  deleteUser as deleteAuthUser,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
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
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { firebaseLogService } from './log.js';

const VALID_ROLES = ['admin', 'guru_bk'];
const ROLE_LABELS = { admin: 'Administrator', guru_bk: 'Guru BK' };
const LOGIN_TIMEOUT_MS = 15000;

// Berisi { resolve, reject } selama proses login berjalan; diselesaikan oleh listener sesi.
let pendingLogin = null;

/**
 * Memvalidasi dokumen profil /users/{uid}. Mengembalikan { profile } atau { error }.
 */
function validateProfile(snap) {
  if (!snap.exists()) {
    return { error: 'Akun Anda belum terdaftar di sistem. Hubungi Administrator.' };
  }
  const profile = { id: snap.id, ...snap.data() };
  if (!VALID_ROLES.includes(profile.role)) {
    return { error: 'Role akun tidak valid. Hubungi Administrator.' };
  }
  if (profile.isActive !== true) {
    return { error: 'Akses ditolak: Akun Anda tidak aktif. Hubungi Administrator.' };
  }
  return { profile };
}

/**
 * Mengubah error Firebase Auth menjadi pesan berbahasa Indonesia.
 * Kode yang tidak dikenal memakai pesan cadangan (fallback).
 */
function authErrorMessage(err, fallback) {
  switch (err?.code) {
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return 'Format alamat email tidak valid.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Silakan tunggu beberapa saat lalu coba lagi.';
    case 'auth/network-request-failed':
      return 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'Kata sandi baru terlalu lemah atau belum memenuhi persyaratan. Gunakan minimal 6 karakter.';
    case 'auth/requires-recent-login':
      return 'Sesi perlu diverifikasi ulang. Keluar lalu masuk kembali, kemudian coba lagi.';
    default:
      return fallback;
  }
}

/**
 * Mengirim email reset kata sandi lewat Firebase. Melempar Error berbahasa Indonesia bila gagal.
 * hideUnknownEmail: email yang tidak terdaftar dianggap berhasil (untuk halaman publik).
 */
async function sendResetEmail(email, { hideUnknownEmail = false } = {}) {
  const target = (email || '').trim();
  if (!target) throw new Error('Masukkan alamat email terlebih dahulu.');
  try {
    await sendPasswordResetEmail(auth, target);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      if (hideUnknownEmail) return;
      throw new Error('Email ini belum terdaftar di sistem autentikasi.');
    }
    throw new Error(authErrorMessage(err, 'Gagal mengirim tautan reset kata sandi. Silakan coba lagi.'));
  }
}

export const firebaseAuthService = {
  /**
   * Memantau sesi login. Sumber kebenaran: sesi Firebase Auth + dokumen profil /users/{uid}
   * (dipantau realtime, sehingga akun yang dinonaktifkan atau dihapus otomatis keluar).
   * callback({ user, message, retryable }) dipanggil setiap status sesi berubah.
   * Mengembalikan fungsi untuk berhenti memantau.
   */
  onSessionChange: (callback) => {
    let unsubProfile = null;
    let waitTimer = null;
    const stopProfile = () => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (waitTimer) {
        clearTimeout(waitTimer);
        waitTimer = null;
      }
    };

    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      stopProfile();

      if (!fbUser) {
        callback({ user: null, message: null, retryable: false });
        return;
      }

      // Bila profil tak kunjung terbaca (mis. offline), jangan biarkan layar menunggu selamanya
      waitTimer = setTimeout(() => {
        waitTimer = null;
        if (!pendingLogin) {
          callback({
            user: null,
            message: 'Gagal memuat profil akun. Periksa koneksi internet lalu coba lagi.',
            retryable: true
          });
        }
      }, LOGIN_TIMEOUT_MS);

      unsubProfile = onSnapshot(
        doc(db, 'users', fbUser.uid),
        (snap) => {
          // Saat offline, dokumen yang belum ada di cache dilaporkan "tidak ada": tunggu data server
          if (!snap.exists() && snap.metadata.fromCache) return;

          if (waitTimer) {
            clearTimeout(waitTimer);
            waitTimer = null;
          }

          const result = validateProfile(snap);
          const pending = pendingLogin;
          pendingLogin = null;

          if (result.error) {
            stopProfile();
            signOut(auth).catch(() => {});
            if (pending) pending.reject(new Error(result.error));
            callback({ user: null, message: result.error, retryable: false });
            return;
          }

          if (pending) pending.resolve(result.profile);
          callback({ user: result.profile, message: null, retryable: false });
        },
        () => {
          // Gagal membaca profil (umumnya jaringan). Saat login: batalkan sesi.
          // Saat membuka ulang aplikasi: sesi dipertahankan dan pengguna diminta mencoba lagi.
          const message = 'Gagal memuat profil akun. Periksa koneksi internet lalu coba lagi.';
          const pending = pendingLogin;
          pendingLogin = null;
          if (pending) {
            signOut(auth).catch(() => {});
            pending.reject(new Error(message));
          }
          callback({ user: null, message, retryable: !pending });
        }
      );
    });

    return () => {
      stopProfile();
      unsubAuth();
    };
  },

  /**
   * Mengambil daftar seluruh pengguna dari Firestore
   */
  fetchUsersList: async () => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /**
   * Masuk ke sistem menggunakan Firebase Authentication.
   * Profil pengguna diselesaikan oleh onSessionChange; fungsi ini menunggu hasilnya.
   */
  login: async (email, password) => {
    if (pendingLogin) {
      throw new Error('Proses masuk sedang berjalan. Mohon tunggu.');
    }

    const profilePromise = new Promise((resolve, reject) => {
      pendingLogin = { resolve, reject };
    });
    profilePromise.catch(() => {}); // penolakan ditangani oleh pemanggil login()

    const timer = setTimeout(() => {
      if (pendingLogin) {
        const pending = pendingLogin;
        pendingLogin = null;
        signOut(auth).catch(() => {});
        pending.reject(new Error('Waktu memuat profil habis. Periksa koneksi internet lalu coba lagi.'));
      }
    }, LOGIN_TIMEOUT_MS);
    profilePromise.then(() => clearTimeout(timer), () => clearTimeout(timer));

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      pendingLogin = null;
      clearTimeout(timer);
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
      throw new Error('Email atau kata sandi yang Anda masukkan salah.');
    }

    return profilePromise;
  },

  /**
   * Keluar dari sesi aplikasi
   */
  logout: async () => {
    await signOut(auth);
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
    let userCred;
    try {
      userCred = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        throw new Error(
          'Email ini sudah terdaftar di Firebase Auth. Jika akunnya pernah dihapus dari daftar pengguna, ' +
          'hapus juga di Firebase Console (Authentication → Users), atau gunakan email lain.'
        );
      }
      throw new Error(authErrorMessage(err, 'Gagal membuat akun pengguna. Silakan coba lagi.'));
    }
    const newUid = userCred.user.uid;

    // Simpan data profil pengguna ke Firestore
    const newUserDoc = {
      id: newUid,
      uid: newUid,
      nama: userData.nama.trim(),
      nip: userData.nip ? userData.nip.trim() : '-',
      jabatan: userData.jabatan ? userData.jabatan.trim() : '',
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

    return newUserDoc;
  },

  /**
   * Lupa kata sandi (halaman Login, tanpa sesi): kirim tautan reset ke email.
   * Email yang tidak terdaftar dianggap berhasil agar daftar akun tidak bisa ditebak dari luar.
   */
  sendPasswordReset: async (email) => {
    await sendResetEmail(email, { hideUnknownEmail: true });
    return true;
  },

  /**
   * Admin mengirim tautan reset kata sandi ke email pengguna lain.
   * (Client SDK tidak bisa mengatur sandi orang lain secara langsung.)
   */
  sendUserPasswordReset: async (userId, currentUser) => {
    if (currentUser?.role !== 'admin') {
      throw new Error('Hanya Administrator yang berhak mengirim reset kata sandi!');
    }

    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) throw new Error('Pengguna tidak ditemukan di database.');
    const { nama, email } = snap.data();

    await sendResetEmail(email);

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'reset_sandi',
      detail: `Mengirim tautan reset kata sandi ke ${nama} (${email})`,
      targetId: userId,
      targetType: 'user'
    });

    return { nama, email };
  },

  /**
   * Ganti kata sandi akun sendiri. Wajib memasukkan kata sandi saat ini (verifikasi ulang).
   */
  changePassword: async (currentPassword, newPassword, currentUser) => {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.email) {
      throw new Error('Sesi berakhir. Silakan masuk kembali.');
    }
    if (!currentPassword) throw new Error('Kata sandi saat ini wajib diisi.');
    if ((newPassword || '').length < 6) {
      throw new Error('Kata sandi baru minimal 6 karakter.');
    }
    if (newPassword === currentPassword) {
      throw new Error('Kata sandi baru harus berbeda dari kata sandi saat ini.');
    }

    try {
      const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
      await reauthenticateWithCredential(fbUser, credential);
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        throw new Error('Kata sandi saat ini salah.');
      }
      throw new Error(authErrorMessage(err, 'Gagal memverifikasi kata sandi saat ini. Silakan coba lagi.'));
    }

    try {
      await updatePassword(fbUser, newPassword);
    } catch (err) {
      throw new Error(authErrorMessage(err, 'Gagal mengganti kata sandi. Silakan coba lagi.'));
    }

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'ganti_sandi',
      detail: 'Mengganti kata sandi akun sendiri',
      targetId: fbUser.uid,
      targetType: 'user'
    });

    return true;
  },

  /**
   * Mengubah data profil pengguna: nama, NIP, jabatan, dan role (Admin Only).
   * Email tidak bisa diubah dari sini. Admin tidak boleh mengubah role akunnya sendiri.
   */
  updateUser: async (userId, data, currentUser) => {
    if (currentUser?.role !== 'admin') {
      throw new Error('Hanya Administrator yang berhak mengubah data pengguna!');
    }

    const nama = (data?.nama || '').trim();
    if (!nama) throw new Error('Nama pengguna wajib diisi.');
    if (!VALID_ROLES.includes(data?.role)) {
      throw new Error('Role tidak valid. Pilih Administrator atau Guru BK.');
    }
    const nip = (data.nip || '').trim() || '-';
    const jabatan = (data.jabatan || '').trim();

    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) throw new Error('Pengguna tidak ditemukan di database.');
    const before = snap.data();

    const isSelf = userId === currentUser.id || userId === currentUser.uid;
    if (isSelf && data.role !== before.role) {
      throw new Error('Anda tidak dapat mengubah role akun Anda sendiri.');
    }

    // Bandingkan dengan data lama; jika tidak ada yang berubah, tidak perlu menulis
    const prev = { nama: before.nama, nip: before.nip ?? '-', jabatan: before.jabatan ?? '', role: before.role };
    const next = { nama, nip, jabatan, role: data.role };
    const changes = [];
    if (prev.nama !== next.nama) changes.push(`nama "${prev.nama}" → "${next.nama}"`);
    if (prev.nip !== next.nip) changes.push(`NIP ${prev.nip} → ${next.nip}`);
    if (prev.jabatan !== next.jabatan) changes.push(`jabatan "${prev.jabatan || '-'}" → "${next.jabatan || '-'}"`);
    if (prev.role !== next.role) {
      changes.push(`role ${ROLE_LABELS[prev.role] || prev.role} → ${ROLE_LABELS[next.role]}`);
    }
    if (changes.length === 0) return { id: userId, ...before };

    await updateDoc(userDocRef, { ...next, updatedAt: serverTimestamp() });

    await firebaseLogService.create({
      userId: currentUser?.id,
      userNama: currentUser?.nama,
      aksi: 'edit_user',
      detail: `Mengubah data pengguna ${prev.nama}: ${changes.join(', ')}`,
      targetId: userId,
      targetType: 'user'
    });

    return { id: userId, ...before, ...next };
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

    return { id: userId, ...snap.data(), isActive: newStatus };
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
  }
};
