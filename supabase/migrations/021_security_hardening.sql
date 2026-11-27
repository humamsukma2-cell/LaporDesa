-- 021_security_hardening.sql
-- Menutup celah keamanan dan integritas data yang ditemukan pada audit:
--   1. profiles: user tidak boleh menaikkan peran sendiri (privilege escalation).
--   2. riwayat_status: audit trail hanya boleh ditulis oleh trigger/RPC server.
--   3. laporan: status awal wajib pending, update langsung hanya lewat RPC tervalidasi,
--      serta pelapor boleh menghapus laporan pending miliknya (cleanup saat upload gagal).
--   4. foto_laporan + bucket foto-laporan: policy lengkap (baca/unggah/hapus) agar
--      cleanup foto benar-benar bekerja dan foto tidak bisa diakses lintas laporan.
--   5. kategori: RLS diaktifkan.
--   6. informasi_tambahan, penilaian_prioritas, penugasan: mutasi hanya lewat RPC.
--
-- Jalankan setelah 020. Semua pernyataan aman diulang (idempotent).

BEGIN;

-- ============================================================
-- 1. KATEGORI
-- ============================================================
ALTER TABLE public.kategori ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read kategori" ON public.kategori;
CREATE POLICY "Authenticated users can read kategori"
ON public.kategori FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admin can manage kategori" ON public.kategori;
CREATE POLICY "Admin can manage kategori"
ON public.kategori FOR ALL TO authenticated
USING (public.get_user_role() = 'admin'::public.peran_type)
WITH CHECK (public.get_user_role() = 'admin'::public.peran_type);

-- ============================================================
-- 2. PROFILES
-- ============================================================
-- User hanya boleh mengubah nama. Peran dikelola lewat dashboard/service role.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

-- Profile baru dari aplikasi wajib berperan masyarakat.
DROP POLICY IF EXISTS "Users can insert own profile on signup" ON public.profiles;
CREATE POLICY "Users can insert own profile on signup"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (
  id = (SELECT auth.uid())
  AND peran = 'masyarakat'::public.peran_type
);

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (nama) ON public.profiles TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;

-- Lapisan kedua: cegah perubahan peran meskipun ada jalur update lain.
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
     AND NEW.peran IS DISTINCT FROM OLD.peran THEN
    RAISE EXCEPTION 'Peran akun tidak dapat diubah dari aplikasi. Hubungi admin desa.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileges ON public.profiles;
CREATE TRIGGER protect_profile_privileges
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privileges();

-- ============================================================
-- 3. RIWAYAT_STATUS
-- ============================================================
-- Riwayat hanya ditulis oleh trigger dan RPC SECURITY DEFINER.
-- Tidak ada lagi INSERT langsung dari client (cegah pemalsuan audit trail).
DROP POLICY IF EXISTS "System can insert riwayat" ON public.riwayat_status;
REVOKE INSERT, UPDATE, DELETE ON public.riwayat_status FROM authenticated, anon;

-- ============================================================
-- 4. LAPORAN
-- ============================================================
-- Status awal laporan wajib pending; pelapor tidak boleh memalsukan status.
DROP POLICY IF EXISTS "Masyarakat can create laporan" ON public.laporan;
CREATE POLICY "Masyarakat can create laporan"
ON public.laporan FOR INSERT TO authenticated
WITH CHECK (
  public.get_user_role() = 'masyarakat'::public.peran_type
  AND pelapor_id = (SELECT auth.uid())
  AND status = 'pending'::public.status_laporan_type
);

-- Semua perubahan status memakai RPC tervalidasi
-- (verifikasi_laporan, tugaskan_petugas, ubah_status_tugas).
-- Policy update langsung dihapus agar petugas tidak bisa mengubah kolom lain.
DROP POLICY IF EXISTS "Admin can update all laporan" ON public.laporan;
DROP POLICY IF EXISTS "Petugas can update assigned laporan" ON public.laporan;
REVOKE UPDATE ON public.laporan FROM authenticated, anon;

-- Pelapor boleh menghapus laporan miliknya yang masih pending.
-- Dipakai untuk cleanup ketika upload foto gagal di tengah proses.
DROP POLICY IF EXISTS "Reporters can delete own pending laporan" ON public.laporan;
CREATE POLICY "Reporters can delete own pending laporan"
ON public.laporan FOR DELETE TO authenticated
USING (
  pelapor_id = (SELECT auth.uid())
  AND status = 'pending'::public.status_laporan_type
);

-- ============================================================
-- 5. FOTO_LAPORAN (tabel + storage)
-- ============================================================
DROP POLICY IF EXISTS "Uploaders can delete own foto" ON public.foto_laporan;
CREATE POLICY "Uploaders can delete own foto"
ON public.foto_laporan FOR DELETE TO authenticated
USING (
  uploaded_by = (SELECT auth.uid())
  AND public.can_access_laporan(laporan_id)
);

-- Bucket privat untuk foto laporan (dibuat otomatis, tidak perlu manual).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'foto-laporan',
  'foto-laporan',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png'];

-- Hapus policy lama dari panduan setup manual (jika pernah dibuat) agar tidak
-- memperlonggar policy baru di bawah.
DROP POLICY IF EXISTS "Authenticated users can upload foto" ON storage.objects;
DROP POLICY IF EXISTS "Users can view foto" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload RAB" ON storage.objects;
DROP POLICY IF EXISTS "Admin can manage RAB files" ON storage.objects;

DROP POLICY IF EXISTS "Users can read foto laporan files" ON storage.objects;
CREATE POLICY "Users can read foto laporan files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'foto-laporan'
  AND EXISTS (
    SELECT 1
    FROM public.laporan AS l
    WHERE l.id::text = split_part(storage.objects.name, '/', 1)
      AND public.can_access_laporan(l.id)
  )
);

DROP POLICY IF EXISTS "Users can upload foto laporan files" ON storage.objects;
CREATE POLICY "Users can upload foto laporan files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'foto-laporan'
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png')
  AND EXISTS (
    SELECT 1
    FROM public.laporan AS l
    WHERE l.id::text = split_part(storage.objects.name, '/', 1)
      AND public.can_access_laporan(l.id)
  )
);

-- Uploader boleh menghapus file miliknya sendiri (cleanup); admin boleh menghapus.
-- Tidak bergantung pada baris laporan agar cleanup tetap bekerja setelah laporan dihapus.
DROP POLICY IF EXISTS "Users can delete own foto laporan files" ON storage.objects;
CREATE POLICY "Users can delete own foto laporan files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'foto-laporan'
  AND (
    owner_id::text = (SELECT auth.uid())::text
    OR public.get_user_role() = 'admin'::public.peran_type
  )
);

-- ============================================================
-- 6. INFORMASI TAMBAHAN
-- ============================================================
-- Permintaan dibuat oleh verifikasi_laporan(); jawaban oleh
-- jawab_informasi_tambahan(). Tidak ada mutasi langsung dari client.
DROP POLICY IF EXISTS "Admin can request info tambahan" ON public.informasi_tambahan;
DROP POLICY IF EXISTS "Masyarakat can answer info tambahan for own laporan" ON public.informasi_tambahan;
REVOKE INSERT, UPDATE, DELETE ON public.informasi_tambahan FROM authenticated, anon;

-- ============================================================
-- 7. PENILAIAN PRIORITAS & PENUGASAN
-- ============================================================
-- Ditulis hanya oleh simpan_penilaian_prioritas() dan tugaskan_petugas().
DROP POLICY IF EXISTS "Admin can manage prioritas" ON public.penilaian_prioritas;
REVOKE INSERT, UPDATE, DELETE ON public.penilaian_prioritas FROM authenticated, anon;

DROP POLICY IF EXISTS "Admin can create penugasan" ON public.penugasan;
REVOKE INSERT, UPDATE, DELETE ON public.penugasan FROM authenticated, anon;

COMMIT;
