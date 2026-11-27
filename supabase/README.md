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

Jalankan **semua** file di folder `migrations/` secara berurutan (001 sampai 023)
di Supabase Dashboard > **SQL Editor**. Setiap file harus sukses sebelum lanjut
ke file berikutnya.

| Migration | Isi |
| --- | --- |
| `001_initial_schema.sql` | Tabel dan enum dasar |
| `002_rls_policies.sql` | RLS awal |
| `003_functions_triggers.sql` | Trigger kode laporan, status, riwayat |
| `004_seed_data.sql` | Seed kategori |
| `005`–`013` | Perbaikan GPS, RLS recursion, profil, verifikasi, prioritas, penugasan, jawab informasi, status petugas |
| `014`–`020` | Modul RAB: bucket `rab-pdf`, RPC simpan/revisi/terbit, feed RAB publik |
| `021_security_hardening.sql` | **Wajib**: hardening RLS profiles, audit trail, cleanup foto, bucket `foto-laporan` |
| `022_rab_draft_atomic.sql` | **Wajib**: RPC atomik simpan draft RAB + akses PDF draft admin |
| `023_laporan_code_concurrency.sql` | **Wajib**: kode laporan aman untuk insert paralel dan laporan yang dihapus |

> Catatan: `021` sampai `023` bersifat idempotent dan aman dijalankan ulang.
> Semuanya menutup celah keamanan penting, jadi jangan lewati.

## 4. Storage Buckets

Kedua bucket dibuat otomatis oleh migration:

- **`foto-laporan`** (private) — dibuat oleh `021_security_hardening.sql`.
- **`rab-pdf`** (private, PDF saja) — dibuat oleh `014_rab.sql`.

Storage policies juga sudah disertakan di migration, sehingga **tidak perlu**
membuat bucket atau policy secara manual lagi.

Jika bucket sudah pernah dibuat manual dengan nama lama `rab-dokumen`, bucket
tersebut tidak dipakai oleh aplikasi. Aplikasi memakai `rab-pdf`.

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
6. Buka **SQL Editor** dan jalankan (upsert, karena trigger `007` sudah otomatis
   membuat profil `masyarakat` saat user dibuat):
   ```sql
   INSERT INTO public.profiles (id, nama, peran)
   VALUES ('PASTE-UUID-DISINI', 'Admin Desa', 'admin')
   ON CONFLICT (id) DO UPDATE
   SET nama = EXCLUDED.nama, peran = EXCLUDED.peran;
   ```

7. Ulangi untuk petugas:
   - Email: `petugas1@desaku.id`
   - Password: `petugas123`
   - Kemudian jalankan:
   ```sql
   INSERT INTO public.profiles (id, nama, peran)
   VALUES ('PASTE-UUID-PETUGAS-DISINI', 'Petugas Lapangan 1', 'petugas')
   ON CONFLICT (id) DO UPDATE
   SET nama = EXCLUDED.nama, peran = EXCLUDED.peran;
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
AND tablename IN ('profiles', 'laporan', 'kategori', 'foto_laporan', 'riwayat_status', 'rab');
-- Semua harus rowsecurity = true

-- Cek bucket & policy storage
SELECT id, public FROM storage.buckets WHERE id IN ('foto-laporan', 'rab-pdf');
-- Keduanya harus public = false
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
