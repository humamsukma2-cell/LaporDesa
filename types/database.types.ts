// Database types - akan di-generate dari Supabase
// Untuk sementara kita define manual

export type PeranType = 'masyarakat' | 'admin' | 'petugas';

export type StatusLaporanType =
  | 'pending'
  | 'needs_information'
  | 'verified'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'rejected';

export type TingkatType = 'rendah' | 'sedang' | 'tinggi' | 'sangat_tinggi';

export type JenisFotoType = 'dokumentasi_awal' | 'hasil_penanganan';

export type StatusRabType = 'draft' | 'published';

export interface Profile {
  id: string;
  nama: string;
  peran: PeranType;
  created_at: string;
}

export interface Kategori {
  id: number;
  nama: string;
  created_at: string;
}

export interface Laporan {
  id: string;
  kode_laporan: string;
  pelapor_id: string;
  kategori_id: number;
  deskripsi: string;
  urgensi_pelapor: TingkatType;
  latitude: number;
  longitude: number;
  akurasi_gps?: number;
  patokan_lokasi: string;
  status: StatusLaporanType;
  created_at: string;
  updated_at: string;
  // Relations
  pelapor?: Profile;
  kategori?: Kategori;
}

export interface FotoLaporan {
  id: string;
  laporan_id: string;
  path: string;
  jenis: JenisFotoType;
  uploaded_by: string;
  uploaded_at: string;
}

export interface RiwayatStatus {
  id: string;
  laporan_id: string;
  status_lama: StatusLaporanType | null;
  status_baru: StatusLaporanType;
  pelaku_id: string;
  catatan?: string;
  waktu: string;
  // Relations
  pelaku?: Profile;
}

export interface InformasiTambahan {
  id: string;
  laporan_id: string;
  permintaan: string;
  jawaban?: string;
  diminta_oleh: string;
  dijawab_pada?: string;
  created_at: string;
}

export interface PenilaianPrioritas {
  id: string;
  laporan_id: string;
  tingkat_bahaya: number;
  dampak_masyarakat: number;
  tingkat_keparahan: number;
  frekuensi_laporan: number;
  skor_rekomendasi: number;
  prioritas_akhir: TingkatType;
  admin_penilai_id: string;
  created_at: string;
}

export interface Penugasan {
  id: string;
  laporan_id: string;
  petugas_id: string;
  admin_pemberi_tugas_id: string;
  waktu_penugasan: string;
  // Relations
  petugas?: Profile;
}

export interface Rab {
  id: string;
  laporan_id: string;
  nomor_rab: string;
  judul: string;
  total_anggaran: number;
  sumber_dana: string;
  catatan?: string;
  status: StatusRabType;
  dibuat_oleh: string;
  created_at: string;
  published_at?: string;
  published_by?: string;
}

export interface RabVersi {
  id: string;
  rab_id: string;
  nomor_versi: number;
  path_pdf: string;
  ukuran_file: number;
  diunggah_oleh: string;
  waktu_unggah: string;
}
