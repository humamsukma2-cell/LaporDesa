import { TingkatType } from '@/types';

// Konfigurasi prioritas
export const PRIORITAS_CONFIG = {
  BOBOT: {
    tingkat_bahaya: 0.4,
    dampak_masyarakat: 0.3,
    tingkat_keparahan: 0.2,
    frekuensi_laporan: 0.1,
  },
  AMBANG_BATAS: {
    rendah: { min: 1.0, max: 2.0 },
    sedang: { min: 2.01, max: 3.0 },
    tinggi: { min: 3.01, max: 4.0 },
    sangat_tinggi: { min: 4.01, max: 5.0 },
  },
} as const;

// Konfigurasi foto
export const FOTO_CONFIG = {
  MAX_SIZE_TOTAL: 10 * 1024 * 1024, // 10 MB
  MAX_COUNT: 3,
  ALLOWED_TYPES: ['image/jpeg', 'image/png'],
  COMPRESSION_QUALITY: 0.8,
} as const;

// Konfigurasi PDF
export const PDF_CONFIG = {
  MAX_SIZE: 5 * 1024 * 1024, // 5 MB
  ALLOWED_TYPE: 'application/pdf',
} as const;

// Label status laporan
export const STATUS_LABELS: Record<string, string> = {
  pending: 'Menunggu Verifikasi',
  needs_information: 'Butuh Info Tambahan',
  verified: 'Terverifikasi',
  assigned: 'Ditugaskan',
  in_progress: 'Sedang Dikerjakan',
  resolved: 'Selesai',
  rejected: 'Ditolak',
};

// Label tingkat/prioritas
export const TINGKAT_LABELS: Record<TingkatType, string> = {
  rendah: 'Rendah',
  sedang: 'Sedang',
  tinggi: 'Tinggi',
  sangat_tinggi: 'Sangat Tinggi',
};

// Warna status
export const STATUS_COLORS: Record<string, string> = {
  pending: '#FFA500',
  needs_information: '#2196F3',
  verified: '#4CAF50',
  assigned: '#9C27B0',
  in_progress: '#FF9800',
  resolved: '#4CAF50',
  rejected: '#F44336',
};

// Warna prioritas
export const PRIORITAS_COLORS: Record<TingkatType, string> = {
  rendah: '#4CAF50',
  sedang: '#FFA500',
  tinggi: '#FF5722',
  sangat_tinggi: '#F44336',
};

// Kategori infrastruktur
export const KATEGORI_INFRASTRUKTUR = [
  'Jalan Lingkungan',
  'Trotoar/Fasilitas Pejalan Kaki',
  'Saluran Drainase',
  'Lampu Penerangan Jalan',
] as const;
