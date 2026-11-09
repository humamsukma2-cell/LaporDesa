-- 002_rls_policies.sql
-- Row Level Security policies untuk semua tabel

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE laporan ENABLE ROW LEVEL SECURITY;
ALTER TABLE foto_laporan ENABLE ROW LEVEL SECURITY;
ALTER TABLE riwayat_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE informasi_tambahan ENABLE ROW LEVEL SECURITY;
ALTER TABLE penilaian_prioritas ENABLE ROW LEVEL SECURITY;
ALTER TABLE penugasan ENABLE ROW LEVEL SECURITY;
ALTER TABLE rab ENABLE ROW LEVEL SECURITY;
ALTER TABLE rab_versi ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS peran_type AS $$
  SELECT peran FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================

CREATE POLICY "Public profiles viewable by authenticated users"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can insert own profile on signup"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ============================================================
-- LAPORAN POLICIES
-- ============================================================

-- SELECT: Masyarakat lihat miliknya, admin lihat semua, petugas lihat yang ditugaskan
CREATE POLICY "Users can view laporan based on role"
ON laporan FOR SELECT
TO authenticated
USING (
  CASE get_user_role()
    WHEN 'masyarakat' THEN pelapor_id = auth.uid()
    WHEN 'admin' THEN true
    WHEN 'petugas' THEN id IN (
      SELECT laporan_id FROM penugasan WHERE petugas_id = auth.uid()
    )
    ELSE false
  END
);

-- INSERT: Hanya masyarakat yang bisa buat laporan
CREATE POLICY "Masyarakat can create laporan"
ON laporan FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role() = 'masyarakat' AND pelapor_id = auth.uid()
);

-- UPDATE: Admin bisa update semua, petugas bisa update yang ditugaskan (hanya status)
CREATE POLICY "Admin can update all laporan"
ON laporan FOR UPDATE
TO authenticated
USING (get_user_role() = 'admin');

CREATE POLICY "Petugas can update assigned laporan"
ON laporan FOR UPDATE
TO authenticated
USING (
  get_user_role() = 'petugas' AND
  id IN (SELECT laporan_id FROM penugasan WHERE petugas_id = auth.uid())
);

-- ============================================================
-- FOTO_LAPORAN POLICIES
-- ============================================================

CREATE POLICY "Users can view foto based on laporan access"
ON foto_laporan FOR SELECT
TO authenticated
USING (
  laporan_id IN (SELECT id FROM laporan)
);

CREATE POLICY "Users can upload foto to accessible laporan"
ON foto_laporan FOR INSERT
TO authenticated
WITH CHECK (
  laporan_id IN (SELECT id FROM laporan) AND uploaded_by = auth.uid()
);

-- ============================================================
-- RIWAYAT_STATUS POLICIES
-- ============================================================

CREATE POLICY "Users can view riwayat based on laporan access"
ON riwayat_status FOR SELECT
TO authenticated
USING (
  laporan_id IN (SELECT id FROM laporan)
);

CREATE POLICY "System can insert riwayat"
ON riwayat_status FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================================
-- INFORMASI_TAMBAHAN POLICIES
-- ============================================================

CREATE POLICY "Users can view info tambahan based on laporan access"
ON informasi_tambahan FOR SELECT
TO authenticated
USING (
  laporan_id IN (SELECT id FROM laporan)
);

CREATE POLICY "Admin can request info tambahan"
ON informasi_tambahan FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role() = 'admin' AND diminta_oleh = auth.uid()
);

CREATE POLICY "Masyarakat can answer info tambahan for own laporan"
ON informasi_tambahan FOR UPDATE
TO authenticated
USING (
  get_user_role() = 'masyarakat' AND
  laporan_id IN (SELECT id FROM laporan WHERE pelapor_id = auth.uid())
);

-- ============================================================
-- PENILAIAN_PRIORITAS POLICIES
-- ============================================================

CREATE POLICY "Admin can manage prioritas"
ON penilaian_prioritas FOR ALL
TO authenticated
USING (get_user_role() = 'admin')
WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Non-admin can view prioritas of accessible laporan"
ON penilaian_prioritas FOR SELECT
TO authenticated
USING (
  laporan_id IN (SELECT id FROM laporan)
);

-- ============================================================
-- PENUGASAN POLICIES
-- ============================================================

CREATE POLICY "Admin can create penugasan"
ON penugasan FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role() = 'admin' AND admin_pemberi_tugas_id = auth.uid()
);

CREATE POLICY "Users can view penugasan based on laporan access"
ON penugasan FOR SELECT
TO authenticated
USING (
  laporan_id IN (SELECT id FROM laporan)
);

-- ============================================================
-- RAB POLICIES
-- ============================================================

CREATE POLICY "Admin can manage RAB"
ON rab FOR ALL
TO authenticated
USING (get_user_role() = 'admin')
WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "All authenticated users can view published RAB"
ON rab FOR SELECT
TO authenticated
USING (
  status = 'published' OR get_user_role() = 'admin'
);

-- ============================================================
-- RAB_VERSI POLICIES
-- ============================================================

CREATE POLICY "Admin can manage RAB versi"
ON rab_versi FOR ALL
TO authenticated
USING (
  get_user_role() = 'admin'
)
WITH CHECK (
  get_user_role() = 'admin' AND diunggah_oleh = auth.uid()
);

CREATE POLICY "Users can view RAB versi based on RAB access"
ON rab_versi FOR SELECT
TO authenticated
USING (
  rab_id IN (SELECT id FROM rab)
);
