-- GPS is supporting information, not a requirement for submitting a report.
-- Keep latitude/longitude paired and within valid coordinate ranges when provided.

ALTER TABLE public.laporan
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL;

ALTER TABLE public.laporan
  ADD CONSTRAINT laporan_coordinates_pair_and_range_check
  CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (
      latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND latitude BETWEEN -90 AND 90
      AND longitude BETWEEN -180 AND 180
    )
  );
