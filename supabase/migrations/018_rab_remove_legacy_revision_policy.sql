-- 018_rab_remove_legacy_revision_policy.sql
-- Remove the permissive legacy ALL policy that would allow admins to insert
-- RAB version rows directly, bypassing the draft-only revisi_rab RPC.
DROP POLICY IF EXISTS "Admin can manage RAB versi" ON public.rab_versi;

DROP POLICY IF EXISTS "Admin can insert RAB versions" ON public.rab_versi;
CREATE POLICY "Admin can insert RAB versions"
ON public.rab_versi FOR INSERT TO authenticated
WITH CHECK (
  public.get_user_role() = 'admin'::public.peran_type
  AND diunggah_oleh = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.rab
    WHERE id = rab_id AND status = 'draft'::public.status_rab_type
  )
);
