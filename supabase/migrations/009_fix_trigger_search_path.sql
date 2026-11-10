-- 009_fix_trigger_search_path.sql
-- Trigger functions previously referenced tables without a schema while
-- inheriting the caller's search_path. When called from a SECURITY DEFINER
-- function that sets search_path = '', relations such as riwayat_status could
-- not be resolved (PostgreSQL error 42P01).
--
-- These replacements fully qualify relations and pin search_path so triggers
-- work regardless of who invokes the statement.

CREATE OR REPLACE FUNCTION public.create_riwayat_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.riwayat_status (laporan_id, status_lama, status_baru, pelaku_id)
  VALUES (NEW.id, OLD.status, NEW.status, (SELECT auth.uid()));

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_initial_riwayat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.riwayat_status (laporan_id, status_lama, status_baru, pelaku_id)
  VALUES (NEW.id, NULL, NEW.status, NEW.pelapor_id);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_kode_laporan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  tanggal TEXT;
  urutan TEXT;
  counter INTEGER;
BEGIN
  tanggal := TO_CHAR(NOW(), 'YYYYMMDD');

  SELECT COUNT(*) + 1 INTO counter
  FROM public.laporan
  WHERE kode_laporan LIKE 'LPR-' || tanggal || '-%';

  urutan := LPAD(counter::TEXT, 4, '0');
  NEW.kode_laporan := 'LPR-' || tanggal || '-' || urutan;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status NOT IN ('needs_information', 'verified', 'rejected') THEN
    RAISE EXCEPTION 'Invalid transition from pending to %', NEW.status;
  END IF;

  IF OLD.status = 'needs_information' AND NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'Invalid transition from needs_information to %', NEW.status;
  END IF;

  IF OLD.status = 'verified' AND NEW.status <> 'assigned' THEN
    RAISE EXCEPTION 'Invalid transition from verified to %', NEW.status;
  END IF;

  IF OLD.status = 'assigned' AND NEW.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Invalid transition from assigned to %', NEW.status;
  END IF;

  IF OLD.status = 'in_progress' AND NEW.status <> 'resolved' THEN
    RAISE EXCEPTION 'Invalid transition from in_progress to %', NEW.status;
  END IF;

  IF OLD.status IN ('rejected', 'resolved') THEN
    RAISE EXCEPTION 'Cannot change status from %', OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Re-assert the execution grants for the admin verification workflow so the
-- app role can call it but anonymous users cannot.
REVOKE ALL ON FUNCTION public.verifikasi_laporan(uuid, public.status_laporan_type, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verifikasi_laporan(uuid, public.status_laporan_type, text) TO authenticated;
