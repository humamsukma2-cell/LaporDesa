-- Allow assigned officers to add completion photos to their active tasks.
-- The app supplies uploaded_by = auth.uid(); authorization is checked against
-- the task assignment and active report state on the server.

DROP POLICY IF EXISTS "Users can upload foto to accessible laporan" ON public.foto_laporan;
DROP POLICY IF EXISTS "Petugas can upload hasil foto for assigned active laporan" ON public.foto_laporan;
DROP POLICY IF EXISTS "Reporters can upload photos to own reports" ON public.foto_laporan;

CREATE POLICY "Reporters can upload photos to own reports"
ON public.foto_laporan FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = (SELECT auth.uid())
  AND jenis = 'dokumentasi_awal'::public.jenis_foto_type
  AND public.get_user_role() = 'masyarakat'::public.peran_type
  AND public.can_access_laporan(laporan_id)
);

CREATE POLICY "Petugas can upload hasil foto for assigned active laporan"
ON public.foto_laporan FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = (SELECT auth.uid())
  AND jenis = 'hasil_penanganan'::public.jenis_foto_type
  AND public.get_user_role() = 'petugas'::public.peran_type
  AND EXISTS (
    SELECT 1
    FROM public.penugasan AS p
    JOIN public.laporan AS l ON l.id = p.laporan_id
    WHERE p.laporan_id = foto_laporan.laporan_id
      AND p.petugas_id = (SELECT auth.uid())
      AND l.status IN (
        'assigned'::public.status_laporan_type,
        'in_progress'::public.status_laporan_type
      )
  )
);
