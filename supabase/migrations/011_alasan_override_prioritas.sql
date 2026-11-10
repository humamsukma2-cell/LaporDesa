-- 011_alasan_override_prioritas.sql
-- Admin may set a final priority different from the system recommendation, but
-- the reason becomes mandatory and is stored for auditability.

ALTER TABLE public.penilaian_prioritas
  ADD COLUMN IF NOT EXISTS catatan_override TEXT;

-- Replace the previous signature so the unvalidated version cannot be called.
DROP FUNCTION IF EXISTS public.simpan_penilaian_prioritas(
  UUID, INTEGER, INTEGER, INTEGER, INTEGER, public.tingkat_type
);

CREATE OR REPLACE FUNCTION public.simpan_penilaian_prioritas(
  p_laporan_id UUID,
  p_bahaya INTEGER,
  p_dampak INTEGER,
  p_keparahan INTEGER,
  p_frekuensi INTEGER,
  p_prioritas_akhir public.tingkat_type,
  p_catatan_override TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status public.status_laporan_type;
  v_skor NUMERIC;
  v_rekomendasi public.tingkat_type;
  v_catatan TEXT;
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'admin'::public.peran_type THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menilai prioritas.' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status
  FROM public.laporan
  WHERE id = p_laporan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Laporan tidak ditemukan.';
  END IF;
  IF v_status <> 'verified'::public.status_laporan_type THEN
    RAISE EXCEPTION 'Penilaian prioritas hanya untuk laporan berstatus Terverifikasi. Status saat ini: %.', v_status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.penilaian_prioritas WHERE laporan_id = p_laporan_id) THEN
    RAISE EXCEPTION 'Prioritas laporan ini sudah ditetapkan dan tidak dapat diubah.';
  END IF;

  v_skor := public.hitung_skor_prioritas_config(p_bahaya, p_dampak, p_keparahan, p_frekuensi);
  v_rekomendasi := public.hitung_rekomendasi_prioritas(p_bahaya, p_dampak, p_keparahan, p_frekuensi);
  v_catatan := NULLIF(BTRIM(p_catatan_override), '');

  IF p_prioritas_akhir <> v_rekomendasi AND v_catatan IS NULL THEN
    RAISE EXCEPTION 'Alasan wajib diisi ketika prioritas akhir berbeda dari rekomendasi sistem.';
  END IF;

  IF p_prioritas_akhir = v_rekomendasi THEN
    v_catatan := NULL;
  END IF;

  INSERT INTO public.penilaian_prioritas (
    laporan_id, tingkat_bahaya, dampak_masyarakat, tingkat_keparahan, frekuensi_laporan,
    skor_rekomendasi, prioritas_akhir, admin_penilai_id, catatan_override
  ) VALUES (
    p_laporan_id, p_bahaya, p_dampak, p_keparahan, p_frekuensi,
    v_skor, p_prioritas_akhir, (SELECT auth.uid()), v_catatan
  );

  RETURN v_skor;
END;
$$;

REVOKE ALL ON FUNCTION public.simpan_penilaian_prioritas(uuid, integer, integer, integer, integer, public.tingkat_type, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.simpan_penilaian_prioritas(uuid, integer, integer, integer, integer, public.tingkat_type, text) TO authenticated;
