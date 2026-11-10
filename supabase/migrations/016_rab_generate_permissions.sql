-- 016_rab_generate_permissions.sql
-- Compatibility/security follow-up for app-generated RAB PDFs.
-- Generated PDFs may exceed 5MB; cap at the Storage bucket limit (50MB).
-- Published RAB files remain immutable. Draft RAB can only be updated by admin.

UPDATE storage.buckets
SET file_size_limit = 52428800,
    allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'rab-pdf';

-- Draft updates only. The trigger from 015 prevents a published row changing.
DROP POLICY IF EXISTS "Admin can update draft RAB" ON public.rab;
CREATE POLICY "Admin can update draft RAB"
ON public.rab FOR UPDATE TO authenticated
USING (
  public.get_user_role() = 'admin'::public.peran_type
  AND status = 'draft'::public.status_rab_type
)
WITH CHECK (
  public.get_user_role() = 'admin'::public.peran_type
  AND status = 'draft'::public.status_rab_type
);

-- The earlier broad admin management policy permits direct insert/delete. Remove
-- it so RAB creation and publication can only use their validated RPCs.
DROP POLICY IF EXISTS "Admin can manage RAB" ON public.rab;

-- Admin can read drafts and published rows; other logged-in users only published.
DROP POLICY IF EXISTS "All authenticated users can view published RAB" ON public.rab;
DROP POLICY IF EXISTS "Authenticated users can read published RAB" ON public.rab;
DROP POLICY IF EXISTS "Authenticated can read published RAB" ON public.rab;
CREATE POLICY "Authenticated users can read published RAB"
ON public.rab FOR SELECT TO authenticated
USING (
  status = 'published'::public.status_rab_type
  OR public.get_user_role() = 'admin'::public.peran_type
);

-- Admin needs read access to versions including draft. Published versions can be
-- read by logged-in users. Storage policy separately gates actual object access.
DROP POLICY IF EXISTS "Admin can manage RAB versi" ON public.rab_versi;
DROP POLICY IF EXISTS "Users can view RAB versi based on RAB access" ON public.rab_versi;
DROP POLICY IF EXISTS "Users can read RAB versions when allowed" ON public.rab_versi;
DROP POLICY IF EXISTS "Admin can insert RAB versions" ON public.rab_versi;
CREATE POLICY "Admin can insert RAB versions"
ON public.rab_versi FOR INSERT TO authenticated
WITH CHECK (
  public.get_user_role() = 'admin'::public.peran_type
  AND diunggah_oleh = (SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.rab WHERE id = rab_id AND status = 'draft'::public.status_rab_type)
);
CREATE POLICY "Users can read RAB versions when allowed"
ON public.rab_versi FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'admin'::public.peran_type
  OR EXISTS (
    SELECT 1 FROM public.rab
    WHERE id = rab_id AND status = 'published'::public.status_rab_type
  )
);
