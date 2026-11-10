-- Make published RAB summaries discoverable to all authenticated citizens,
-- without granting those citizens access to the associated report.
-- RAB list API exposes only RAB metadata and PDF path/version data.

DROP POLICY IF EXISTS "Authenticated users can read published RAB" ON public.rab;
DROP POLICY IF EXISTS "All authenticated users can view published RAB" ON public.rab;
DROP POLICY IF EXISTS "Authenticated can read published RAB" ON public.rab;
CREATE POLICY "Authenticated users can read published RAB"
ON public.rab FOR SELECT TO authenticated
USING (
  status = 'published'::public.status_rab_type
  OR public.get_user_role() = 'admin'::public.peran_type
);

DROP POLICY IF EXISTS "Users can read RAB versions when allowed" ON public.rab_versi;
DROP POLICY IF EXISTS "Users can view RAB versi based on RAB access" ON public.rab_versi;
CREATE POLICY "Users can read RAB versions when allowed"
ON public.rab_versi FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'admin'::public.peran_type
  OR EXISTS (
    SELECT 1 FROM public.rab AS r
    WHERE r.id = rab_id
      AND r.status = 'published'::public.status_rab_type
  )
);

-- List only safe, published RAB fields. Do not return laporan_id or any report
-- details, so clients can render a public transparency list without reading reports.
CREATE OR REPLACE FUNCTION public.daftar_rab_terbit()
RETURNS TABLE (
  rab_id UUID,
  nomor_rab TEXT,
  judul TEXT,
  total_anggaran NUMERIC,
  sumber_dana TEXT,
  catatan TEXT,
  published_at TIMESTAMPTZ,
  path_pdf TEXT,
  nomor_versi INTEGER,
  ukuran_file INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.id,
         r.nomor_rab,
         r.judul,
         r.total_anggaran,
         r.sumber_dana,
         r.catatan,
         r.published_at,
         v.path_pdf,
         v.nomor_versi,
         v.ukuran_file
  FROM public.rab AS r
  LEFT JOIN LATERAL (
    SELECT rv.path_pdf, rv.nomor_versi, rv.ukuran_file
    FROM public.rab_versi AS rv
    WHERE rv.rab_id = r.id
    ORDER BY rv.nomor_versi DESC
    LIMIT 1
  ) AS v ON TRUE
  WHERE r.status = 'published'::public.status_rab_type
  ORDER BY r.published_at DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.daftar_rab_terbit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.daftar_rab_terbit() TO authenticated;
