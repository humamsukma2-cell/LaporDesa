-- 001_initial_schema.sql
-- Initial database schema untuk LaporDesa

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

-- Peran pengguna
CREATE TYPE peran_type AS ENUM ('masyarakat', 'admin', 'petugas');

-- Status laporan
CREATE TYPE status_laporan_type AS ENUM (
  'pending',
  'needs_information',
  'verified',
  'assigned',
  'in_progress',
  'resolved',
  'rejected'
);

-- Tingkat urgensi/prioritas
CREATE TYPE tingkat_type AS ENUM ('rendah', 'sedang', 'tinggi', 'sangat_tinggi');

-- Jenis foto
CREATE TYPE jenis_foto_type AS ENUM ('dokumentasi_awal', 'hasil_penanganan');

-- Status RAB
CREATE TYPE status_rab_type AS ENUM ('draft', 'published');

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles (extend auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  peran peran_type NOT NULL DEFAULT 'masyarakat',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kategori infrastruktur
CREATE TABLE kategori (
  id SERIAL PRIMARY KEY,
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Laporan kerusakan
CREATE TABLE laporan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_laporan TEXT NOT NULL UNIQUE,
  pelapor_id UUID NOT NULL REFERENCES profiles(id),
  kategori_id INTEGER NOT NULL REFERENCES kategori(id),
  deskripsi TEXT NOT NULL,
  urgensi_pelapor tingkat_type NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  akurasi_gps DOUBLE PRECISION,
  patokan_lokasi TEXT NOT NULL,
  status status_laporan_type NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foto laporan
CREATE TABLE foto_laporan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laporan_id UUID NOT NULL REFERENCES laporan(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  jenis jenis_foto_type NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Riwayat status laporan
CREATE TABLE riwayat_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laporan_id UUID NOT NULL REFERENCES laporan(id) ON DELETE CASCADE,
  status_lama status_laporan_type,
  status_baru status_laporan_type NOT NULL,
  pelaku_id UUID NOT NULL REFERENCES profiles(id),
  catatan TEXT,
  waktu TIMESTAMPTZ DEFAULT NOW()
);

-- Informasi tambahan (Needs Information flow)
CREATE TABLE informasi_tambahan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laporan_id UUID NOT NULL REFERENCES laporan(id) ON DELETE CASCADE,
  permintaan TEXT NOT NULL,
  jawaban TEXT,
  diminta_oleh UUID NOT NULL REFERENCES profiles(id),
  dijawab_pada TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Penilaian prioritas
CREATE TABLE penilaian_prioritas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laporan_id UUID NOT NULL UNIQUE REFERENCES laporan(id) ON DELETE CASCADE,
  tingkat_bahaya INTEGER NOT NULL CHECK (tingkat_bahaya BETWEEN 1 AND 5),
  dampak_masyarakat INTEGER NOT NULL CHECK (dampak_masyarakat BETWEEN 1 AND 5),
  tingkat_keparahan INTEGER NOT NULL CHECK (tingkat_keparahan BETWEEN 1 AND 5),
  frekuensi_laporan INTEGER NOT NULL CHECK (frekuensi_laporan BETWEEN 1 AND 5),
  skor_rekomendasi DECIMAL(3,2) NOT NULL,
  prioritas_akhir tingkat_type NOT NULL,
  admin_penilai_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Penugasan petugas
CREATE TABLE penugasan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laporan_id UUID NOT NULL UNIQUE REFERENCES laporan(id) ON DELETE CASCADE,
  petugas_id UUID NOT NULL REFERENCES profiles(id),
  admin_pemberi_tugas_id UUID NOT NULL REFERENCES profiles(id),
  waktu_penugasan TIMESTAMPTZ DEFAULT NOW()
);

-- RAB (Rencana Anggaran Biaya)
CREATE TABLE rab (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laporan_id UUID NOT NULL UNIQUE REFERENCES laporan(id) ON DELETE CASCADE,
  nomor_rab TEXT NOT NULL,
  judul TEXT NOT NULL,
  total_anggaran DECIMAL(15,2) NOT NULL,
  sumber_dana TEXT NOT NULL,
  catatan TEXT,
  status status_rab_type NOT NULL DEFAULT 'draft',
  dibuat_oleh UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES profiles(id)
);

-- Versi RAB (untuk revisi)
CREATE TABLE rab_versi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rab_id UUID NOT NULL REFERENCES rab(id) ON DELETE CASCADE,
  nomor_versi INTEGER NOT NULL,
  path_pdf TEXT NOT NULL,
  ukuran_file INTEGER NOT NULL,
  diunggah_oleh UUID NOT NULL REFERENCES profiles(id),
  waktu_unggah TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rab_id, nomor_versi)
);

-- ============================================================
-- INDEXES untuk performa
-- ============================================================

CREATE INDEX idx_laporan_pelapor ON laporan(pelapor_id);
CREATE INDEX idx_laporan_status ON laporan(status);
CREATE INDEX idx_laporan_created ON laporan(created_at DESC);
CREATE INDEX idx_foto_laporan ON foto_laporan(laporan_id);
CREATE INDEX idx_riwayat_laporan ON riwayat_status(laporan_id);
CREATE INDEX idx_penugasan_petugas ON penugasan(petugas_id);
CREATE INDEX idx_rab_laporan ON rab(laporan_id);
