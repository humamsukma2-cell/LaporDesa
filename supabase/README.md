# Setup Database Supabase

Ikuti langkah-langkah ini untuk setup database Supabase untuk aplikasi LaporDesa.

## 1. Buat Projekt Supabase

1. Buka [supabase.com](https://supabase.com)
2. Login atau daftar akun
3. Klik "New Project"
4. Isi:
   - Name: `LaporDesa`
   - Database Password: (simpan password ini)
   - Region: Pilih yang terdekat dengan Indonesia
5. Tunggu project selesai dibuat (~2 menit)

## 2. Setup Environment Variables

1. Di dashboard Supabase, buka **Settings** > **API**
2. Copy **Project URL** dan **anon public key**
3. Buka file `.env` di root project
4. Isi dengan:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

**PENTING:** JANGAN pernah commit file `.env` ke Git!

## 3. Jalankan Migrations

Jalankan SQL migrations di Supabase Dashboard > **SQL Editor**:

### a. Migration 001: Initial Schema
1. Buka file `migrations/001_initial_schema.sql`
2. Copy semua isinya
3. Paste di SQL Editor
4. Klik **Run**
5. Pastikan tidak ada error

### b. Migration 002: RLS Policies
1. Buka file `migrations/002_rls_policies.sql`
2. Copy semua isinya
3. Paste di SQL Editor
4. Klik **Run**

### c. Migration 003: Functions & Triggers
1. Buka file `migrations/003_functions_triggers.sql`
2. Copy semua isinya
3. Paste di SQL Editor
4. Klik **Run**

### d. Migration 004: Seed Data
1. Buka file `migrations/004_seed_data.sql`
2. Copy bagian seed kategori
3. Paste di SQL Editor
4. Klik **Run**

## 4. Setup Storage Buckets

### Bucket untuk Foto Laporan
1. Buka **Storage** di dashboard
2. Klik **New Bucket**
3. Name: `foto-laporan`
4. Public: **OFF** (private)
5. Klik **Create Bucket**

### Bucket untuk RAB PDF
1. Klik **New Bucket** lagi
2. Name: `rab-dokumen`
3. Public: **OFF** (private)
4. Klik **Create Bucket**

### Storage Policies
Jalankan SQL ini di SQL Editor:

```sql
-- Policy untuk foto-laporan bucket
CREATE POLICY "Authenticated users can upload foto"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'foto-laporan' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can view foto"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'foto-laporan');

-- Policy untuk rab-dokumen bucket
CREATE POLICY "Admin can upload RAB"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rab-dokumen' AND
  (SELECT peran FROM profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Admin can manage RAB files"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'rab-dokumen' AND
  (SELECT peran FROM profiles WHERE id = auth.uid()) = 'admin'
);
```

## 5. Buat Akun Admin & Petugas

### Via Dashboard (Cara Termudah):

1. Buka **Authentication** > **Users**
2. Klik **Add User**
3. Isi:
   - Email: `admin@desaku.id`
   - Password: `admin123` (atau password pilihan Anda)
   - Auto Confirm User: **ON**
4. Klik **Create User**
5. **Copy UUID user** yang baru dibuat
6. Buka **SQL Editor** dan jalankan:
   ```sql
   INSERT INTO profiles (id, nama, peran) VALUES
     ('PASTE-UUID-DISINI', 'Admin Desa', 'admin');
   ```

7. Ulangi untuk petugas:
   - Email: `petugas1@desaku.id`
   - Password: `petugas123`
   - Kemudian insert profile:
   ```sql
   INSERT INTO profiles (id, nama, peran) VALUES
     ('PASTE-UUID-PETUGAS-DISINI', 'Petugas Lapangan 1', 'petugas');
   ```

## 6. Verifikasi Setup

Jalankan query ini untuk memastikan semuanya setup dengan benar:

```sql
-- Cek kategori
SELECT * FROM kategori;
-- Harus ada 4 kategori

-- Cek profiles
SELECT * FROM profiles;
-- Harus ada admin dan petugas

-- Cek RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'laporan', 'rab');
-- Semua harus rowsecurity = true
```

## 7. Test Koneksi dari Aplikasi

1. Pastikan `.env` sudah diisi dengan benar
2. Jalankan aplikasi: `npx expo start`
3. Scan QR code dengan Expo Go
4. Coba login dengan akun admin yang dibuat
5. Jika berhasil, setup selesai! ✅

## Troubleshooting

### Error: "relation does not exist"
- Pastikan semua migration sudah dijalankan
- Check di **Database** > **Tables** apakah tabel sudah ada

### Error: "new row violates row-level security policy"
- Pastikan RLS policies sudah dijalankan (migration 002)
- Check policy dengan: `SELECT * FROM pg_policies WHERE tablename = 'nama_tabel';`

### Error: "Failed to fetch"
- Periksa EXPO_PUBLIC_SUPABASE_URL dan KEY di .env
- Pastikan tidak ada spasi atau quote di value

### Tidak bisa upload foto
- Pastikan storage buckets sudah dibuat
- Pastikan storage policies sudah dijalankan

## Keamanan

✅ **AMAN:**
- Anon key di aplikasi mobile
- RLS enabled di semua tabel
- Storage buckets private

❌ **BAHAYA (JANGAN LAKUKAN):**
- Taruh service_role key di aplikasi mobile
- Disable RLS
- Buat storage bucket public untuk data sensitif

---

**Setelah setup selesai, Anda siap untuk development!** 🚀
