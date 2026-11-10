-- 012_jawab_informasi_tambahan.sql
-- Citizens answer an admin information request and the report moves back to
-- Pending once no unanswered requests remain.

CREATE OR REPLACE FUNCTION public.jawab_informasi_tambahan(
  p_permintaan_id UUID,
  p_jawaban TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_laporan_id UUID;
  v_pelapor_id UUID;
  v_status public.status_laporan_type;
  v_jawaban TEXT;
  v_unanswered INTEGER;
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'masyarakat'::public.peran_type THEN
    RAISE EXCEPTION 'Hanya pelapor yang dapat menjawab permintaan informasi.' USING ERRCODE = '42501';
  END IF;

  v_jawaban := NULLIF(BTRIM(p_jawaban), '');
  IF v_jawaban IS NULL THEN
    RAISE EXCEPTION 'Jawaban wajib diisi.';
  END IF;

  SELECT it.laporan_id, l.pelapor_id, l.status
  INTO v_laporan_id, v_pelapor_id, v_status
  FROM public.informasi_tambahan AS it
  JOIN public.laporan AS l ON l.id = it.laporan_id
  WHERE it.id = p_permintaan_id
  FOR UPDATE OF l, it;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permintaan informasi tidak ditemukan.';
  END IF;
  IF v_pelapor_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Anda tidak berhak menjawab permintaan informasi laporan ini.' USING ERRCODE = '42501';
  END IF;
  IF v_status <> 'needs_information'::public.status_laporan_type THEN
    RAISE EXCEPTION 'Laporan tidak sedang menunggu informasi tambahan.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.informasi_tambahan
    WHERE id = p_permintaan_id AND jawaban IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Permintaan informasi ini sudah dijawab.';
  END IF;

  UPDATE public.informasi_tambahan
  SET jawaban = v_jawaban,
      dijawab_pada = NOW()
  WHERE id = p_permintaan_id;

  SELECT COUNT(*) INTO v_unanswered
  FROM public.informasi_tambahan
  WHERE laporan_id = v_laporan_id
    AND jawaban IS NULL;

  IF v_unanswered = 0 THEN
    UPDATE public.laporan
    SET status = 'pending'::public.status_laporan_type
    WHERE id = v_laporan_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.jawab_informasi_tambahan(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jawab_informasi_tambahan(uuid, text) TO authenticated;
