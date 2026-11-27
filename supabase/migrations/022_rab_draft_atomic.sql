-- 022_rab_draft_atomic.sql
-- Menyempurnakan alur RAB:
--   1. Draft hanya bisa diubah lewat satu RPC atomik (metadata + versi PDF),
--      sehingga update tabel tidak bisa berhasil sebagian.
--   2. Admin boleh membaca PDF RAB draft (sebelumnya hanya published),
--      agar tombol unduh pada mode draft berfungsi.
--   3. Update tabel rab secara langsung ditutup; semua perubahan lewat RPC.
--
-- Jalankan setelah 021.

BEGIN;

-- ============================================================
-- 1. PDF RAB DRAFT BISA DIBACA ADMIN
-- ============================================================
DROP POLICY IF EXISTS "Admin can read RAB PDF" ON storage.objects;
CREATE POLICY "Admin can read RAB PDF"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'rab-pdf'
  AND public.get_user_role() = 'admin'::public.peran_type
);

-- ============================================================
-- 2. SIMPAN PERUBAHAN DRAFT SECARA ATOMIK
-- ============================================================
CREATE OR REPLACE FUNCTION public.perbarui_rab_draft(
  p_rab_id UUID,
  p_nomor_rab TEXT,
  p_judul TEXT,
  p_total_anggaran NUMERIC,
  p_sumber_dana TEXT,
  p_catatan TEXT,
  p_path_pdf TEXT,
  p_ukuran_file INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_laporan_id UUID;
  v_status public.status_rab_type;
  v_nomor TEXT := NULLIF(BTRIM(p_nomor_rab), '');
  v_judul TEXT := NULLIF(BTRIM(p_judul), '');
  v_sumber TEXT := NULLIF(BTRIM(p_sumber_dana), '');
  v_catatan TEXT := NULLIF(BTRIM(p_catatan), '');
  v_next_version INTEGER;
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'admin'::public.peran_type THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengubah RAB.' USING ERRCODE = '42501';
  END IF;

  IF v_nomor IS NULL THEN
    RAISE EXCEPTION 'Nomor RAB wajib diisi.';
  END IF;
  IF v_judul IS NULL THEN
    RAISE EXCEPTION 'Judul RAB wajib diisi.';
  END IF;
  IF v_sumber IS NULL THEN
    RAISE EXCEPTION 'Sumber dana wajib diisi.';
  END IF;
  IF p_total_anggaran IS NULL OR p_total_anggaran <= 0 THEN
    RAISE EXCEPTION 'Total anggaran harus lebih besar dari nol.';
  END IF;
  IF p_ukuran_file IS NULL OR p_ukuran_file <= 0 THEN
    RAISE EXCEPTION 'Ukuran PDF harus lebih besar dari nol.';
  END IF;
  IF p_path_pdf IS NULL OR BTRIM(p_path_pdf) = '' THEN
    RAISE EXCEPTION 'File PDF RAB wajib dibuat dan diunggah aplikasi.';
  END IF;
  IF LOWER(RIGHT(p_path_pdf, 4)) <> '.pdf' THEN
    RAISE EXCEPTION 'File RAB harus berformat PDF.';
  END IF;

  SELECT laporan_id, status INTO v_laporan_id, v_status
  FROM public.rab
  WHERE id = p_rab_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RAB tidak ditemukan.';
  END IF;
  IF v_status <> 'draft'::public.status_rab_type THEN
    RAISE EXCEPTION 'RAB yang sudah diterbitkan tidak dapat diubah.';
  END IF;
  IF p_path_pdf NOT LIKE v_laporan_id::TEXT || '/rab/%' THEN
    RAISE EXCEPTION 'Lokasi file PDF tidak valid untuk laporan ini.';
  END IF;

  UPDATE public.rab
  SET nomor_rab = v_nomor,
      judul = v_judul,
      total_anggaran = p_total_anggaran,
      sumber_dana = v_sumber,
      catatan = v_catatan
  WHERE id = p_rab_id;

  SELECT COALESCE(MAX(nomor_versi), 0) + 1 INTO v_next_version
  FROM public.rab_versi
  WHERE rab_id = p_rab_id;

  INSERT INTO public.rab_versi (
    rab_id, nomor_versi, path_pdf, ukuran_file, diunggah_oleh
  ) VALUES (
    p_rab_id, v_next_version, p_path_pdf, p_ukuran_file, (SELECT auth.uid())
  );

  RETURN v_next_version;
END;
$$;

REVOKE ALL ON FUNCTION public.perbarui_rab_draft(uuid, text, text, numeric, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.perbarui_rab_draft(uuid, text, text, numeric, text, text, text, integer) TO authenticated;

-- ============================================================
-- 3. TUTUP MUTASI LANGSUNG PADA RAB / RAB_VERSI
-- ============================================================
-- simpan_rab(), perbarui_rab_draft(), revisi_rab(), dan terbitkan_rab()
-- adalah SECURITY DEFINER sehingga tetap berjalan tanpa policy ini.
DROP POLICY IF EXISTS "Admin can update draft RAB" ON public.rab;
DROP POLICY IF EXISTS "Admin can insert RAB versions" ON public.rab_versi;
REVOKE INSERT, UPDATE, DELETE ON public.rab FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.rab_versi FROM authenticated, anon;

COMMIT;
