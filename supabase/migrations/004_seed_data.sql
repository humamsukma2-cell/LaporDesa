-- 004_seed_data.sql
-- Seed data untuk kategori dan akun test

-- ============================================================
-- SEED KATEGORI INFRASTRUKTUR
-- ============================================================

INSERT INTO kategori (nama) VALUES
  ('Jalan Lingkungan'),
  ('Trotoar/Fasilitas Pejalan Kaki'),
  ('Saluran Drainase'),
  ('Lampu Penerangan Jalan');

-- ============================================================
-- SEED AKUN TEST (OPSIONAL)
-- ============================================================

-- CATATAN PENTING:
-- 1. Untuk membuat akun admin dan petugas, Anda HARUS:
--    - Buat user di Supabase Dashboard > Authentication > Users
--    - Atau gunakan Supabase Auth API
--    - Kemudian insert ke tabel profiles dengan peran yang sesuai
--
-- 2. Script di bawah ini hanya TEMPLATE dan TIDAK AKAN BERJALAN
--    karena tidak bisa langsung insert ke auth.users dari migration
--
-- 3. CARA MEMBUAT AKUN ADMIN/PETUGAS:
--    a. Via Supabase Dashboard:
--       - Buka Authentication > Users > Invite User
--       - Atau Add User manually
--       - Copy UUID user yang dibuat
--       - Jalankan query berikut dengan UUID tersebut:
--
--       INSERT INTO profiles (id, nama, peran) VALUES
--         ('uuid-user-dari-dashboard', 'Nama Admin', 'admin');
--
--    b. Via SQL (setelah user dibuat di auth):
--       - Lihat contoh di bawah

-- ============================================================
-- TEMPLATE UNTUK MEMBUAT PROFILE SETELAH USER DIBUAT
-- ============================================================

-- Setelah membuat user di Supabase Dashboard, jalankan:
-- 
-- -- Untuk Admin
-- INSERT INTO profiles (id, nama, peran) VALUES
--   ('GANTI-DENGAN-UUID-USER', 'Admin Desa', 'admin');
--
-- -- Untuk Petugas
-- INSERT INTO profiles (id, nama, peran) VALUES
--   ('GANTI-DENGAN-UUID-USER', 'Petugas Lapangan 1', 'petugas');
--
-- -- Masyarakat akan otomatis dibuat saat registrasi via aplikasi

-- ============================================================
-- CARA ALTERNATIF: BUAT USER VIA SUPABASE AUTH ADMIN API
-- ============================================================

-- Gunakan supabase-js di backend atau script Node.js:
--
-- import { createClient } from '@supabase/supabase-js'
--
-- const supabase = createClient(
--   'YOUR_SUPABASE_URL',
--   'YOUR_SERVICE_ROLE_KEY' // HANYA di backend/script, JANGAN di mobile app!
-- )
--
-- // Buat admin
-- const { data: adminUser, error: adminError } = await supabase.auth.admin.createUser({
--   email: 'admin@desaku.id',
--   password: 'admin123',
--   email_confirm: true
-- })
--
-- // Insert profile admin
-- await supabase.from('profiles').insert({
--   id: adminUser.user.id,
--   nama: 'Admin Desa',
--   peran: 'admin'
-- })
--
-- // Ulangi untuk petugas

-- ============================================================
-- CONTOH DATA TEST (opsional untuk development)
-- ============================================================

-- Uncomment jika Anda sudah punya user ID dan ingin insert profile langsung:

-- INSERT INTO profiles (id, nama, peran) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'Admin Test', 'admin'),
--   ('00000000-0000-0000-0000-000000000002', 'Petugas Test', 'petugas');
