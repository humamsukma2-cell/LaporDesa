export * from './database.types';

// Auth types
export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSession {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  profile: import('./database.types').Profile | null;
  session: AuthSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nama: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// Form types
export interface BuatLaporanForm {
  kategori_id: number;
  deskripsi: string;
  urgensi_pelapor: import('./database.types').TingkatType;
  latitude: number;
  longitude: number;
  akurasi_gps?: number;
  patokan_lokasi: string;
  fotos: string[]; // Array of local URIs
}

export interface PenilaianPrioritasForm {
  tingkat_bahaya: number;
  dampak_masyarakat: number;
  tingkat_keparahan: number;
  frekuensi_laporan: number;
  prioritas_akhir: import('./database.types').TingkatType;
}

export interface RabForm {
  nomor_rab: string;
  judul: string;
  total_anggaran: number;
  sumber_dana: string;
  catatan?: string;
  pdf_uri: string;
}
