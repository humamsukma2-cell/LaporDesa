-- 003_functions_triggers.sql
-- Functions dan Triggers untuk automasi dan validasi

-- ============================================================
-- FUNCTION: Generate kode laporan otomatis
-- ============================================================

CREATE OR REPLACE FUNCTION generate_kode_laporan()
RETURNS TRIGGER AS $$
DECLARE
  tanggal TEXT;
  urutan TEXT;
  counter INTEGER;
BEGIN
  -- Format: LPR-YYYYMMDD-XXXX
  tanggal := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Hitung laporan hari ini
  SELECT COUNT(*) + 1 INTO counter
  FROM laporan
  WHERE kode_laporan LIKE 'LPR-' || tanggal || '-%';
  
  urutan := LPAD(counter::TEXT, 4, '0');
  NEW.kode_laporan := 'LPR-' || tanggal || '-' || urutan;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_kode_laporan
BEFORE INSERT ON laporan
FOR EACH ROW
EXECUTE FUNCTION generate_kode_laporan();

-- ============================================================
-- FUNCTION: Update updated_at otomatis
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_laporan_timestamp
BEFORE UPDATE ON laporan
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCTION: Validasi transisi status
-- ============================================================

CREATE OR REPLACE FUNCTION validate_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Dari pending
  IF OLD.status = 'pending' AND NEW.status NOT IN ('needs_information', 'verified', 'rejected') THEN
    RAISE EXCEPTION 'Invalid transition from pending to %', NEW.status;
  END IF;
  
  -- Dari needs_information
  IF OLD.status = 'needs_information' AND NEW.status != 'pending' THEN
    RAISE EXCEPTION 'Invalid transition from needs_information to %', NEW.status;
  END IF;
  
  -- Dari verified
  IF OLD.status = 'verified' AND NEW.status != 'assigned' THEN
    RAISE EXCEPTION 'Invalid transition from verified to %', NEW.status;
  END IF;
  
  -- Dari assigned
  IF OLD.status = 'assigned' AND NEW.status != 'in_progress' THEN
    RAISE EXCEPTION 'Invalid transition from assigned to %', NEW.status;
  END IF;
  
  -- Dari in_progress
  IF OLD.status = 'in_progress' AND NEW.status != 'resolved' THEN
    RAISE EXCEPTION 'Invalid transition from in_progress to %', NEW.status;
  END IF;
  
  -- Rejected dan resolved adalah terminal states
  IF OLD.status IN ('rejected', 'resolved') THEN
    RAISE EXCEPTION 'Cannot change status from %', OLD.status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_laporan_status
BEFORE UPDATE OF status ON laporan
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION validate_status_transition();

-- ============================================================
-- FUNCTION: Auto-create riwayat saat status berubah
-- ============================================================

CREATE OR REPLACE FUNCTION create_riwayat_status()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO riwayat_status (laporan_id, status_lama, status_baru, pelaku_id)
  VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER track_status_changes
AFTER UPDATE OF status ON laporan
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION create_riwayat_status();

-- ============================================================
-- FUNCTION: Kalkulasi skor prioritas
-- ============================================================

CREATE OR REPLACE FUNCTION hitung_skor_prioritas(
  bahaya INTEGER,
  dampak INTEGER,
  keparahan INTEGER,
  frekuensi INTEGER
)
RETURNS DECIMAL(3,2) AS $$
BEGIN
  RETURN (
    (bahaya * 0.4) +
    (dampak * 0.3) +
    (keparahan * 0.2) +
    (frekuensi * 0.1)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- FUNCTION: Auto-create riwayat awal saat laporan dibuat
-- ============================================================

CREATE OR REPLACE FUNCTION create_initial_riwayat()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO riwayat_status (laporan_id, status_lama, status_baru, pelaku_id)
  VALUES (NEW.id, NULL, NEW.status, NEW.pelapor_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_initial_status_history
AFTER INSERT ON laporan
FOR EACH ROW
EXECUTE FUNCTION create_initial_riwayat();
