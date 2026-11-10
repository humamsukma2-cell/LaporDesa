-- 014_rab.sql
-- RAB (Rencana Anggaran Biaya) management for a single report.
-- - Private "rab-pdf" storage bucket (PDF only, max 5 MB).
-- - Only admins may upload/manage files.
-- - All authenticated users may read PDFs that belong to a published RAB.
-- - Draft/published rules are enforced server-side, not only in the app.

INSERT INTO storage.buckets (id, name, public)
VALUES ('rab-pdf', 'rab-pdf', false)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf'];

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'rab-pdf';

DROP POLICY IF EXISTS "Admin can manage RAB PDF" ON storage.objects;
DROP POLICY IF EXISTS "Admin can insert RAB PDF" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update RAB PDF" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete RAB PDF" ON storage.objects;
CREATE POLICY "Admin can insert RAB PDF"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'rab-pdf'
  AND public.get_user_role() = 'admin'::public.peran_type
  AND lower(storage.extension(name)) = 'pdf'
  AND (metadata->>'size')::bigint <= 52428800
);

CREATE POLICY "Admin can update RAB PDF"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'rab-pdf'
  AND public.get_user_role() = 'admin'::public.peran_type
)
WITH CHECK (
  bucket_id = 'rab-pdf'
  AND public.get_user_role() = 'admin'::public.peran_type
  AND lower(storage.extension(name)) = 'pdf'
  AND (metadata->>'size')::bigint <= 52428800
);

CREATE POLICY "Admin can delete RAB PDF"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'rab-pdf'
  AND public.get_user_role() = 'admin'::public.peran_type
);

DROP POLICY IF EXISTS "Authenticated can read published RAB PDF" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read published RAB PDF" ON storage.objects;
CREATE POLICY "Authenticated can read published RAB PDF"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'rab-pdf'
  AND EXISTS (
    SELECT 1
    FROM public.rab_versi AS rv
    JOIN public.rab AS r ON r.id = rv.rab_id
    WHERE rv.path_pdf = storage.objects.name
      AND r.status = 'published'::public.status_rab_type
  )
);

-- Create a draft RAB together with its first PDF version.
CREATE OR REPLACE FUNCTION public.simpan_rab(
  p_laporan_id UUID,
  p_nomor_rab TEXT,
  p_judul TEXT,
  p_total_anggaran NUMERIC,
  p_sumber_dana TEXT,
  p_catatan TEXT,
  p_path_pdf TEXT,
  p_ukuran_file INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status public.status_laporan_type;
  v_nomor TEXT := NULLIF(BTRIM(p_nomor_rab), '');
  v_judul TEXT := NULLIF(BTRIM(p_judul), '');
  v_sumber TEXT := NULLIF(BTRIM(p_sumber_dana), '');
  v_catatan TEXT := NULLIF(BTRIM(p_catatan), '');
  v_rab_id UUID;
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'admin'::public.peran_type THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menyusun RAB.' USING ERRCODE = '42501';
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
  IF p_path_pdf NOT LIKE p_laporan_id::TEXT || '/rab/%' THEN
    RAISE EXCEPTION 'Lokasi file PDF tidak valid untuk laporan ini.';
  END IF;
  IF LOWER(RIGHT(p_path_pdf, 4)) <> '.pdf' THEN
    RAISE EXCEPTION 'File RAB harus berformat PDF.';
  END IF;

  SELECT status INTO v_status
  FROM public.laporan
  WHERE id = p_laporan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Laporan tidak ditemukan.';
  END IF;

  IF v_status NOT IN (
    'verified'::public.status_laporan_type,
    'assigned'::public.status_laporan_type,
    'in_progress'::public.status_laporan_type,
    'resolved'::public.status_laporan_type
  ) THEN
    RAISE EXCEPTION 'RAB hanya dapat dibuat setelah laporan diverifikasi.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.rab WHERE laporan_id = p_laporan_id) THEN
    RAISE EXCEPTION 'RAB untuk laporan ini sudah ada. Gunakan revisi untuk mengganti PDF.';
  END IF;

  INSERT INTO public.rab (
    laporan_id, nomor_rab, judul, total_anggaran, sumber_dana, catatan, status, dibuat_oleh
  ) VALUES (
    p_laporan_id, v_nomor, v_judul, p_total_anggaran, v_sumber, v_catatan,
    'draft'::public.status_rab_type, (SELECT auth.uid())
  )
  RETURNING id INTO v_rab_id;

  INSERT INTO public.rab_versi (rab_id, nomor_versi, path_pdf, ukuran_file, diunggah_oleh)
  VALUES (v_rab_id, 1, p_path_pdf, p_ukuran_file, (SELECT auth.uid()));

  RETURN v_rab_id;
END;
$$;

REVOKE ALL ON FUNCTION public.simpan_rab(uuid, text, text, numeric, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.simpan_rab(uuid, text, text, numeric, text, text, text, integer) TO authenticated;

-- Add a new PDF version to an existing RAB (draft or published).
CREATE OR REPLACE FUNCTION public.revisi_rab(
  p_rab_id UUID,
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
  v_next_version INTEGER;
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'admin'::public.peran_type THEN
    RAISE EXCEPTION 'Hanya admin yang dapat merevisi RAB.' USING ERRCODE = '42501';
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

  SELECT laporan_id INTO v_laporan_id
  FROM public.rab
  WHERE id = p_rab_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RAB tidak ditemukan.';
  END IF;

  IF p_path_pdf NOT LIKE v_laporan_id::TEXT || '/rab/%' THEN
    RAISE EXCEPTION 'Lokasi file PDF tidak valid untuk laporan ini.';
  END IF;

  SELECT COALESCE(MAX(nomor_versi), 0) + 1 INTO v_next_version
  FROM public.rab_versi
  WHERE rab_id = p_rab_id;

  INSERT INTO public.rab_versi (rab_id, nomor_versi, path_pdf, ukuran_file, diunggah_oleh)
  VALUES (p_rab_id, v_next_version, p_path_pdf, p_ukuran_file, (SELECT auth.uid()));

  RETURN v_next_version;
END;
$$;

REVOKE ALL ON FUNCTION public.revisi_rab(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revisi_rab(uuid, text, integer) TO authenticated;

-- Publish a draft RAB. A published RAB becomes readable by all logged-in users.
CREATE OR REPLACE FUNCTION public.terbitkan_rab(p_rab_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status public.status_rab_type;
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'admin'::public.peran_type THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menerbitkan RAB.' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status
  FROM public.rab
  WHERE id = p_rab_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RAB tidak ditemukan.';
  END IF;

  IF v_status = 'published'::public.status_rab_type THEN
    RAISE EXCEPTION 'RAB ini sudah diterbitkan.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.rab_versi WHERE rab_id = p_rab_id) THEN
    RAISE EXCEPTION 'Unggah minimal satu file PDF sebelum menerbitkan RAB.';
  END IF;

  UPDATE public.rab
  SET status = 'published'::public.status_rab_type,
      published_at = NOW(),
      published_by = (SELECT auth.uid())
  WHERE id = p_rab_id;
END;
$$;

REVOKE ALL ON FUNCTION public.terbitkan_rab(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.terbitkan_rab(uuid) TO authenticated;
