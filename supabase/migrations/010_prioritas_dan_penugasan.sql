-- 010_prioritas_dan_penugasan.sql
-- Weighted priority scoring, admin assessment, and single-officer assignment.
-- Weights and thresholds are configuration (not hardcoded in the app).

CREATE TABLE IF NOT EXISTS public.konfigurasi_prioritas (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bobot_bahaya NUMERIC(4,2) NOT NULL DEFAULT 0.40 CHECK (bobot_bahaya BETWEEN 0 AND 1),
  bobot_dampak NUMERIC(4,2) NOT NULL DEFAULT 0.30 CHECK (bobot_dampak BETWEEN 0 AND 1),
  bobot_keparahan NUMERIC(4,2) NOT NULL DEFAULT 0.20 CHECK (bobot_keparahan BETWEEN 0 AND 1),
  bobot_frekuensi NUMERIC(4,2) NOT NULL DEFAULT 0.10 CHECK (bobot_frekuensi BETWEEN 0 AND 1),
  ambang_rendah_max NUMERIC(4,2) NOT NULL DEFAULT 1.80,
  ambang_sedang_max NUMERIC(4,2) NOT NULL DEFAULT 2.60,
  ambang_tinggi_max NUMERIC(4,2) NOT NULL DEFAULT 3.40,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT konfigurasi_bobot_total_check CHECK (
    ROUND(bobot_bahaya + bobot_dampak + bobot_keparahan + bobot_frekuensi, 2) = 1.00
  ),
  CONSTRAINT konfigurasi_ambang_urut_check CHECK (
    ambang_rendah_max < ambang_sedang_max AND ambang_sedang_max < ambang_tinggi_max
  )
);

INSERT INTO public.konfigurasi_prioritas (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.konfigurasi_prioritas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read konfigurasi prioritas" ON public.konfigurasi_prioritas;
CREATE POLICY "Authenticated users can read konfigurasi prioritas"
ON public.konfigurasi_prioritas FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admin can manage konfigurasi prioritas" ON public.konfigurasi_prioritas;
CREATE POLICY "Admin can manage konfigurasi prioritas"
ON public.konfigurasi_prioritas FOR ALL TO authenticated
USING (public.get_user_role() = 'admin'::public.peran_type)
WITH CHECK (public.get_user_role() = 'admin'::public.peran_type);

-- Hitung skor berbobot berdasarkan konfigurasi.
CREATE OR REPLACE FUNCTION public.hitung_skor_prioritas_config(
  p_bahaya INTEGER,
  p_dampak INTEGER,
  p_keparahan INTEGER,
  p_frekuensi INTEGER
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c public.konfigurasi_prioritas;
BEGIN
  IF p_bahaya NOT BETWEEN 1 AND 5
     OR p_dampak NOT BETWEEN 1 AND 5
     OR p_keparahan NOT BETWEEN 1 AND 5
     OR p_frekuensi NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Setiap kriteria harus bernilai antara 1 dan 5.';
  END IF;

  SELECT * INTO c FROM public.konfigurasi_prioritas WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Konfigurasi prioritas belum tersedia.';
  END IF;

  RETURN ROUND(
    p_bahaya * c.bobot_bahaya
    + p_dampak * c.bobot_dampak
    + p_keparahan * c.bobot_keparahan
    + p_frekuensi * c.bobot_frekuensi,
    2
  );
END;
$$;

-- Rekomendasi kategori berdasarkan ambang yang dikonfigurasi.
CREATE OR REPLACE FUNCTION public.hitung_rekomendasi_prioritas(
  p_bahaya INTEGER,
  p_dampak INTEGER,
  p_keparahan INTEGER,
  p_frekuensi INTEGER
)
RETURNS public.tingkat_type
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c public.konfigurasi_prioritas;
  v_skor NUMERIC;
BEGIN
  v_skor := public.hitung_skor_prioritas_config(p_bahaya, p_dampak, p_keparahan, p_frekuensi);
  SELECT * INTO c FROM public.konfigurasi_prioritas WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Konfigurasi prioritas belum tersedia.';
  END IF;

  IF v_skor < c.ambang_rendah_max THEN
    RETURN 'rendah'::public.tingkat_type;
  ELSIF v_skor < c.ambang_sedang_max THEN
    RETURN 'sedang'::public.tingkat_type;
  ELSIF v_skor < c.ambang_tinggi_max THEN
    RETURN 'tinggi'::public.tingkat_type;
  ELSE
    RETURN 'sangat_tinggi'::public.tingkat_type;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.hitung_skor_prioritas_config(integer, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hitung_rekomendasi_prioritas(integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hitung_skor_prioritas_config(integer, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hitung_rekomendasi_prioritas(integer, integer, integer, integer) TO authenticated;

-- Simpan penilaian admin. Prioritas akhir sekali ditetapkan tidak dapat diubah.
CREATE OR REPLACE FUNCTION public.simpan_penilaian_prioritas(
  p_laporan_id UUID,
  p_bahaya INTEGER,
  p_dampak INTEGER,
  p_keparahan INTEGER,
  p_frekuensi INTEGER,
  p_prioritas_akhir public.tingkat_type
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status public.status_laporan_type;
  v_skor NUMERIC;
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

  INSERT INTO public.penilaian_prioritas (
    laporan_id, tingkat_bahaya, dampak_masyarakat, tingkat_keparahan, frekuensi_laporan,
    skor_rekomendasi, prioritas_akhir, admin_penilai_id
  ) VALUES (
    p_laporan_id, p_bahaya, p_dampak, p_keparahan, p_frekuensi,
    v_skor, p_prioritas_akhir, (SELECT auth.uid())
  );

  RETURN v_skor;
END;
$$;

REVOKE ALL ON FUNCTION public.simpan_penilaian_prioritas(uuid, integer, integer, integer, integer, public.tingkat_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.simpan_penilaian_prioritas(uuid, integer, integer, integer, integer, public.tingkat_type) TO authenticated;

-- Tugaskan tepat satu petugas, hanya setelah laporan diverifikasi dan dinilai.
CREATE OR REPLACE FUNCTION public.tugaskan_petugas(
  p_laporan_id UUID,
  p_petugas_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status public.status_laporan_type;
  v_peran public.peran_type;
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'admin'::public.peran_type THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menugaskan petugas.' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status
  FROM public.laporan
  WHERE id = p_laporan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Laporan tidak ditemukan.';
  END IF;
  IF v_status <> 'verified'::public.status_laporan_type THEN
    RAISE EXCEPTION 'Penugasan hanya untuk laporan berstatus Terverifikasi. Status saat ini: %.', v_status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.penilaian_prioritas WHERE laporan_id = p_laporan_id) THEN
    RAISE EXCEPTION 'Nilai prioritas laporan terlebih dahulu sebelum menugaskan petugas.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.penugasan WHERE laporan_id = p_laporan_id) THEN
    RAISE EXCEPTION 'Laporan ini sudah memiliki penugasan.';
  END IF;

  SELECT peran INTO v_peran FROM public.profiles WHERE id = p_petugas_id;
  IF NOT FOUND OR v_peran <> 'petugas'::public.peran_type THEN
    RAISE EXCEPTION 'Akun yang dipilih bukan petugas lapangan yang valid.';
  END IF;

  INSERT INTO public.penugasan (laporan_id, petugas_id, admin_pemberi_tugas_id)
  VALUES (p_laporan_id, p_petugas_id, (SELECT auth.uid()));

  UPDATE public.laporan SET status = 'assigned'::public.status_laporan_type WHERE id = p_laporan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tugaskan_petugas(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tugaskan_petugas(uuid, uuid) TO authenticated;

-- Admin can see the whole officer list (profiles is already readable by
-- authenticated users); this index keeps assignment selection fast.
CREATE INDEX IF NOT EXISTS idx_profiles_peran ON public.profiles(peran);
