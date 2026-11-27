-- 023_laporan_code_concurrency.sql
-- Perbaikan pembuatan kode laporan:
-- Generasi lama memakai COUNT(*) + 1. Setelah fitur cleanup (DELETE laporan
-- pending) aktif, pola itu bisa menghasilkan kode duplikat ketika ada nomor
-- yang bolong, dan dua permintaan bersamaan bisa mendapat nomor yang sama.
--
-- Versi ini mengunci per-tanggal (advisory lock transaksi) lalu memakai nomor
-- urut terbesar + 1, sehingga aman untuk laporan bersamaan maupun yang dihapus.

CREATE OR REPLACE FUNCTION public.generate_kode_laporan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  tanggal TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  urutan TEXT;
  counter INTEGER;
BEGIN
  -- Satu lock per tanggal: insert paralel akan mengantre sebentar,
  -- bukan saling menimpa kode.
  PERFORM pg_advisory_xact_lock(hashtext('laporan-kode-' || tanggal));

  SELECT COALESCE(MAX(SUBSTRING(kode_laporan FROM '([0-9]+)$')::INTEGER), 0) + 1
  INTO counter
  FROM public.laporan
  WHERE kode_laporan LIKE 'LPR-' || tanggal || '-%'
    AND kode_laporan ~ ('^LPR-' || tanggal || '-[0-9]+$');

  urutan := LPAD(counter::TEXT, 4, '0');
  NEW.kode_laporan := 'LPR-' || tanggal || '-' || urutan;

  RETURN NEW;
END;
$$;
