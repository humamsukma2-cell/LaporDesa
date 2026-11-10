-- 013_petugas_status.sql
-- Field officer status updates with server-side validation.
-- Rules enforced here (not only in the app):
--   assigned -> in_progress
--   in_progress -> resolved, only after at least one completion photo exists

CREATE OR REPLACE FUNCTION public.ubah_status_tugas(
  p_laporan_id UUID,
  p_status public.status_laporan_type
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status public.status_laporan_type;
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'petugas'::public.peran_type THEN
    RAISE EXCEPTION 'Hanya petugas yang dapat memperbarui status tugas.' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('in_progress'::public.status_laporan_type, 'resolved'::public.status_laporan_type) THEN
    RAISE EXCEPTION 'Status tujuan tidak valid untuk petugas: %', p_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.penugasan
    WHERE laporan_id = p_laporan_id AND petugas_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Anda tidak ditugaskan pada laporan ini.' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status
  FROM public.laporan
  WHERE id = p_laporan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Laporan tidak ditemukan.';
  END IF;

  IF p_status = 'in_progress'::public.status_laporan_type AND v_status <> 'assigned'::public.status_laporan_type THEN
    RAISE EXCEPTION 'Pekerjaan hanya dapat dimulai dari status Ditugaskan. Status saat ini: %.', v_status;
  END IF;

  IF p_status = 'resolved'::public.status_laporan_type THEN
    IF v_status <> 'in_progress'::public.status_laporan_type THEN
      RAISE EXCEPTION 'Pekerjaan hanya dapat diselesaikan dari status Sedang ditangani. Status saat ini: %.', v_status;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.foto_laporan
      WHERE laporan_id = p_laporan_id AND jenis = 'hasil_penanganan'::public.jenis_foto_type
    ) THEN
      RAISE EXCEPTION 'Unggah minimal satu foto hasil penanganan sebelum menandai selesai.';
    END IF;
  END IF;

  UPDATE public.laporan SET status = p_status WHERE id = p_laporan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ubah_status_tugas(uuid, public.status_laporan_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ubah_status_tugas(uuid, public.status_laporan_type) TO authenticated;
