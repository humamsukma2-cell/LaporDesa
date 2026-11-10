-- Create a public profile for every newly registered Auth user.
-- Apply this migration in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  profile_name text;
BEGIN
  profile_name := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'nama'), '');
  IF profile_name IS NULL THEN
    profile_name := COALESCE(NULLIF(SPLIT_PART(NEW.email, '@', 1), ''), 'Pengguna');
  END IF;

  INSERT INTO public.profiles (id, nama, peran)
  VALUES (NEW.id, profile_name, 'masyarakat'::public.peran_type)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user_profile();

-- Backfill profiles for Auth users created before this trigger was installed.
-- Existing profiles (including admin/petugas roles) are left untouched.
INSERT INTO public.profiles (id, nama, peran)
SELECT
  u.id,
  COALESCE(
    NULLIF(BTRIM(u.raw_user_meta_data ->> 'nama'), ''),
    NULLIF(SPLIT_PART(u.email, '@', 1), ''),
    'Pengguna'
  ),
  'masyarakat'::public.peran_type
FROM auth.users AS u
ON CONFLICT (id) DO NOTHING;
