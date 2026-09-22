/**
 * =============================================================================
 * KOMPONEN UI: Badge (Label Status SP, Status Kasus, & Poin)
 * =============================================================================
 * Komponen penanda visual serbaguna dengan warna representatif sesuai status.
 */

import { formatBadgeStatusSP, formatBadgeKasus, formatBadgeStatusSiswa } from '../../lib/helpers.js';

/**
 * Badge penanda status Surat Peringatan (Normal, SP1, SP2, SP3)
 */
export function SPBadge({ status }) {
  const badge = formatBadgeStatusSP(status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.color}`}>
      {badge.label}
    </span>
  );
}

/**
 * Badge penanda status keaktifan siswa (Aktif, Lulus, Pindah, Keluar)
 */
export function StatusSiswaBadge({ status }) {
  const badge = formatBadgeStatusSiswa(status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.color}`}>
      {badge.label}
    </span>
  );
}

/**
 * Badge penanda status penanganan kasus (Baru, Ditangani, Selesai)
 */
export function KasusStatusBadge({ status }) {
  const badge = formatBadgeKasus(status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.color}`}>
      {badge.label}
    </span>
  );
}

/**
 * Badge bobot poin pelanggaran bernuansa merah/rose
 */
export function PoinBadge({ poin, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 ${className}`}>
      +{poin} Poin
    </span>
  );
}

