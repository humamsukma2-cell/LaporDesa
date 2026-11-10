-- 017_rab_disable_published_revisions.sql
-- Enforce the agreed rule even when callers invoke the RPC directly:
-- PDF version additions are allowed only while the parent RAB is a draft.

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
  v_status public.status_rab_type;
  v_next_version INTEGER;
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'admin'::public.peran_type THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menyimpan versi PDF RAB.' USING ERRCODE = '42501';
  END IF;

  SELECT laporan_id, status INTO v_laporan_id, v_status
  FROM public.rab
  WHERE id = p_rab_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RAB tidak ditemukan.';
  END IF;
  IF v_status <> 'draft'::public.status_rab_type THEN
    RAISE EXCEPTION 'RAB yang sudah diterbitkan tidak dapat diedit atau direvisi.';
  END IF;
  IF p_ukuran_file IS NULL OR p_ukuran_file <= 0 THEN
    RAISE EXCEPTION 'Ukuran PDF harus lebih besar dari nol.';
  END IF;
  IF p_path_pdf IS NULL OR BTRIM(p_path_pdf) = ''
     OR LOWER(RIGHT(p_path_pdf, 4)) <> '.pdf' THEN
    RAISE EXCEPTION 'Lokasi PDF RAB tidak valid.';
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
