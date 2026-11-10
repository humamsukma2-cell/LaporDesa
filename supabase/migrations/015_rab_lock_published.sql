-- 015_rab_lock_published.sql
-- A published RAB is immutable. Admin edits are only allowed while draft.
-- Revisions after publication are intentionally disabled per product decision.

CREATE OR REPLACE FUNCTION public.cegah_perubahan_rab_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'published'::public.status_rab_type THEN
    RAISE EXCEPTION 'RAB yang sudah diterbitkan tidak dapat diubah.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cegah_perubahan_rab_published ON public.rab;
CREATE TRIGGER cegah_perubahan_rab_published
BEFORE UPDATE ON public.rab
FOR EACH ROW
EXECUTE FUNCTION public.cegah_perubahan_rab_published();

-- Remove old broad policies if migration 014 was previously run with older SQL.
DROP POLICY IF EXISTS "Admin can manage RAB PDF" ON storage.objects;
DROP POLICY IF EXISTS "Admin can insert RAB PDF" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update RAB PDF" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete RAB PDF" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read published RAB PDF" ON storage.objects;

CREATE POLICY "Admin can insert RAB PDF"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'rab-pdf'
  AND public.get_user_role() = 'admin'::public.peran_type
  AND lower(storage.extension(name)) = 'pdf'
);

CREATE POLICY "Admin can delete RAB PDF"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'rab-pdf'
  AND public.get_user_role() = 'admin'::public.peran_type
);

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
