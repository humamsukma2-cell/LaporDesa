import type { StatusLaporanType } from '@/types';

export const STATUS_META: Record<StatusLaporanType, { label: string; color: string; background: string }> = {
  pending: { label: 'Menunggu verifikasi', color: '#B7791F', background: '#FEFCBF' },
  needs_information: { label: 'Perlu informasi', color: '#6B46C1', background: '#E9D8FD' },
  verified: { label: 'Terverifikasi', color: '#2B6CB0', background: '#DBEAFE' },
  assigned: { label: 'Ditugaskan', color: '#2C5282', background: '#E0E7FF' },
  in_progress: { label: 'Sedang ditangani', color: '#C05621', background: '#FEEBC8' },
  resolved: { label: 'Selesai', color: '#2F855A', background: '#C6F6D5' },
  rejected: { label: 'Ditolak', color: '#C53030', background: '#FED7D7' },
};

export const STATUS_ORDER: StatusLaporanType[] = [
  'pending',
  'needs_information',
  'verified',
  'assigned',
  'in_progress',
  'resolved',
  'rejected',
];

export function statusMeta(status: StatusLaporanType | string) {
  return STATUS_META[status as StatusLaporanType]
    ?? { label: status, color: '#475569', background: '#E2E8F0' };
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Tidak tersedia';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function categoryName(value: { nama: string } | { nama: string }[] | null | undefined) {
  if (!value) return 'Kategori tidak tersedia';
  const row = Array.isArray(value) ? value[0] : value;
  return row?.nama ?? 'Kategori tidak tersedia';
}

export function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const value = error as { message?: string; code?: string; details?: string; hint?: string };
    const parts = [value.message, value.details, value.hint].filter((part): part is string => Boolean(part));
    if (parts.length) return parts.join(' — ');
  }
  if (typeof error === 'string' && error.trim()) return error;
  return 'Terjadi kesalahan yang tidak diketahui. Silakan coba lagi.';
}
