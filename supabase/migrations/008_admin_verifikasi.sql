-- Admin verification of citizen reports.
-- Centralises the status transition, history note, and information request in
-- one transaction so invalid transitions cannot be skipped from the client.

CREATE OR REPLACE FUNCTION public.verifikasi_laporan(
  p_laporan_id uuid,
  p_status public.status_laporan_type,
  p_catatan text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status public.status_laporan_type;
  v_history_id uuid;
  v_catatan text;
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'admin'::public.peran_type THEN
    RAISE EXCEPTION 'Hanya admin yang dapat memverifikasi laporan.' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('verified'::public.status_laporan_type, 'needs_information'::public.status_laporan_type, 'rejected'::public.status_laporan_type) THEN
    RAISE EXCEPTION 'Status verifikasi tidak valid: %', p_status;
  END IF;

  v_catatan := NULLIF(BTRIM(p_catatan), '');
  IF p_status IN ('rejected'::public.status_laporan_type, 'needs_information'::public.status_laporan_type)
     AND v_catatan IS NULL THEN
    RAISE EXCEPTION 'Alasan atau permintaan informasi wajib diisi.';
  END IF;

  SELECT status INTO v_status
  FROM public.laporan
  WHERE id = p_laporan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Laporan tidak ditemukan.';
  END IF;
  IF v_status <> 'pending'::public.status_laporan_type THEN
    RAISE EXCEPTION 'Hanya laporan berstatus Pending yang dapat diverifikasi. Status saat ini: %.', v_status;
  END IF;

  UPDATE public.laporan SET status = p_status WHERE id = p_laporan_id;

  SELECT id INTO v_history_id
  FROM public.riwayat_status
  WHERE laporan_id = p_laporan_id
    AND status_lama = v_status
    AND status_baru = p_status
  ORDER BY waktu DESC
  LIMIT 1;

  IF v_history_id IS NOT NULL AND v_catatan IS NOT NULL THEN
    UPDATE public.riwayat_status SET catatan = v_catatan WHERE id = v_history_id;
  END IF;

  IF p_status = 'needs_information'::public.status_laporan_type THEN
    INSERT INTO public.informasi_tambahan (laporan_id, permintaan, diminta_oleh)
    VALUES (p_laporan_id, v_catatan, (SELECT auth.uid()));
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.verifikasi_laporan(uuid, public.status_laporan_type, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verifikasi_laporan(uuid, public.status_laporan_type, text) TO authenticated;
