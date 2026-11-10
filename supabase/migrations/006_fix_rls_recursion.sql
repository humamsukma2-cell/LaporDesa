-- Fix RLS recursion between laporan and related policies.
-- Run this migration in Supabase SQL Editor.
-- Role lookup uses a SECURITY DEFINER function with a fixed search_path so
-- reading profiles does not recursively apply policies as the caller.

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.peran_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.peran
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- The previous policies query laporan from within policies on laporan or its
-- related tables. Use one definer helper for access checks to avoid recursive
-- policy evaluation and keep the role boundaries intact.
CREATE OR REPLACE FUNCTION public.can_access_laporan(target_laporan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.laporan AS l
    WHERE l.id = target_laporan_id
      AND (
        (public.get_user_role() = 'masyarakat'::public.peran_type AND l.pelapor_id = (SELECT auth.uid()))
        OR public.get_user_role() = 'admin'::public.peran_type
        OR (
          public.get_user_role() = 'petugas'::public.peran_type
          AND EXISTS (
            SELECT 1
            FROM public.penugasan AS p
            WHERE p.laporan_id = l.id
              AND p.petugas_id = (SELECT auth.uid())
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_laporan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_laporan(uuid) TO authenticated;

-- Replace recursive laporan policies with direct role/ownership checks.
DROP POLICY IF EXISTS "Users can view laporan based on role" ON public.laporan;
CREATE POLICY "Users can view laporan based on role"
ON public.laporan FOR SELECT
TO authenticated
USING (
  (public.get_user_role() = 'masyarakat'::public.peran_type AND pelapor_id = (SELECT auth.uid()))
  OR public.get_user_role() = 'admin'::public.peran_type
  OR (
    public.get_user_role() = 'petugas'::public.peran_type
    AND EXISTS (
      SELECT 1 FROM public.penugasan p
      WHERE p.laporan_id = laporan.id AND p.petugas_id = (SELECT auth.uid())
    )
  )
);

-- Related-table policies must not use SELECT ... FROM laporan under caller RLS.
DROP POLICY IF EXISTS "Users can view foto based on laporan access" ON public.foto_laporan;
CREATE POLICY "Users can view foto based on laporan access"
ON public.foto_laporan FOR SELECT TO authenticated
USING (public.can_access_laporan(laporan_id));

DROP POLICY IF EXISTS "Users can upload foto to accessible laporan" ON public.foto_laporan;
CREATE POLICY "Users can upload foto to accessible laporan"
ON public.foto_laporan FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = (SELECT auth.uid())
  AND public.can_access_laporan(laporan_id)
);

DROP POLICY IF EXISTS "Users can view riwayat based on laporan access" ON public.riwayat_status;
CREATE POLICY "Users can view riwayat based on laporan access"
ON public.riwayat_status FOR SELECT TO authenticated
USING (public.can_access_laporan(laporan_id));

DROP POLICY IF EXISTS "Users can view info tambahan based on laporan access" ON public.informasi_tambahan;
CREATE POLICY "Users can view info tambahan based on laporan access"
ON public.informasi_tambahan FOR SELECT TO authenticated
USING (public.can_access_laporan(laporan_id));

DROP POLICY IF EXISTS "Masyarakat can answer info tambahan for own laporan" ON public.informasi_tambahan;
CREATE POLICY "Masyarakat can answer info tambahan for own laporan"
ON public.informasi_tambahan FOR UPDATE TO authenticated
USING (
  public.get_user_role() = 'masyarakat'::public.peran_type
  AND public.can_access_laporan(laporan_id)
);

DROP POLICY IF EXISTS "Non-admin can view prioritas of accessible laporan" ON public.penilaian_prioritas;
CREATE POLICY "Non-admin can view prioritas of accessible laporan"
ON public.penilaian_prioritas FOR SELECT TO authenticated
USING (public.can_access_laporan(laporan_id));

DROP POLICY IF EXISTS "Users can view penugasan based on laporan access" ON public.penugasan;
CREATE POLICY "Users can view penugasan based on laporan access"
ON public.penugasan FOR SELECT TO authenticated
USING (public.can_access_laporan(laporan_id));

DROP POLICY IF EXISTS "Users can view RAB versi based on RAB access" ON public.rab_versi;
CREATE POLICY "Users can view RAB versi based on RAB access"
ON public.rab_versi FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rab r
    WHERE r.id = rab_versi.rab_id
      AND (r.status = 'published'::public.status_rab_type
        OR public.get_user_role() = 'admin'::public.peran_type)
  )
);
