/**
 * ============================================================================
 * SERVICE LAYER (src/services/index.js)
 * ============================================================================
 * Pola Arsitektur: Service Layer / Facade Pattern
 * 
 * TUJUAN:
 * Memisahkan antarmuka pengguna (UI Components) dari implementasi SDK Firebase.
 * Semua modul aplikasi (Dashboard, Kasus, Siswa, dll.) berinteraksi dengan layanan cloud
 * secara terpusat melalui gerbang file ini.
 */

import { firebaseAuthService } from './firebase/auth.js';
import { firebaseSiswaService } from './firebase/siswa.js';
import { firebaseKasusService } from './firebase/kasus.js';
import { firebaseKategoriService } from './firebase/kategori.js';
import { firebaseSuratService } from './firebase/surat.js';
import { firebaseSettingsService } from './firebase/settings.js';
import { firebaseLogService } from './firebase/log.js';

export const authService = firebaseAuthService;
export const siswaService = firebaseSiswaService;
export const kasusService = firebaseKasusService;
export const kategoriService = firebaseKategoriService;
export const suratService = firebaseSuratService;
export const settingsService = firebaseSettingsService;
export const logService = firebaseLogService;

// Mode Cloud Firebase Aktif
export const isMockMode = false;

