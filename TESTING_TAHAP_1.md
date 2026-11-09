# Testing Guide - TAHAP 1: Setup Project & Authentication

## ✅ Yang Sudah Dikerjakan

### Setup Project
- [x] Inisialisasi Expo project dengan TypeScript
- [x] Setup Expo Router
- [x] Konfigurasi Babel dan TypeScript
- [x] Install dependencies

### Database
- [x] Buat skema database lengkap
- [x] Setup RLS policies
- [x] Functions & triggers untuk automasi
- [x] Seed data kategori

### Authentication
- [x] Setup Supabase client
- [x] Auth helper functions (signIn, signUp, signOut)
- [x] Auth Context untuk state management
- [x] Route guards per peran

### UI
- [x] Halaman Login
- [x] Halaman Registrasi
- [x] Beranda Masyarakat
- [x] Beranda Admin (placeholder)
- [x] Beranda Petugas (placeholder)
- [x] Auto-redirect berdasarkan peran

## 🧪 Cara Testing

### Prasyarat
1. Setup Supabase (ikuti `supabase/README.md`)
2. Isi file `.env` dengan kredensial Supabase
3. Buat akun admin dan petugas di Supabase Dashboard

### 1. Install Dependencies
```bash
npm install
```

### 2. Jalankan Development Server
```bash
npx expo start
```

### 3. Buka di Expo Go
- Scan QR code dengan Expo Go app di HP Android/iOS
- Tunggu aplikasi load

### 4. Test Registrasi (Masyarakat)
1. Aplikasi akan membuka halaman Login
2. Tap "Daftar di sini"
3. Isi form registrasi:
   - Nama: "Test User"
   - Email: "test@example.com"
   - Password: "password123"
   - Konfirmasi Password: "password123"
4. Tap "Daftar"
5. **Expected:** Alert "Registrasi Berhasil", redirect ke Login
6. **Verify di Supabase:**
   - Buka Authentication > Users: ada user baru
   - Buka SQL Editor, jalankan:
     ```sql
     SELECT * FROM profiles WHERE peran = 'masyarakat';
     ```
   - Harus ada profile dengan nama "Test User"

### 5. Test Login (Masyarakat)
1. Di halaman Login, masukkan:
   - Email: "test@example.com"
   - Password: "password123"
2. Tap "Masuk"
3. **Expected:** 
   - Redirect ke Beranda Masyarakat
   - Tampil greeting dengan nama user
   - Ada tombol "Buat Laporan Baru"
4. Tap tab "Riwayat"
5. **Expected:** Tampil halaman placeholder Riwayat

### 6. Test Logout (Masyarakat)
1. Di Beranda Masyarakat, scroll ke bawah
2. Tap tombol "Keluar"
3. **Expected:** Redirect ke halaman Login

### 7. Test Login (Admin)
1. Di halaman Login, masukkan kredensial admin:
   - Email: `admin@desaku.id`
   - Password: `admin123` (atau password yang Anda set)
2. Tap "Masuk"
3. **Expected:**
   - Redirect ke Dashboard Admin
   - Tampil greeting "Dashboard Admin" dengan nama admin
4. **Verify:** Tab bar tidak muncul (karena Stack navigation)

### 8. Test Logout (Admin)
1. Scroll ke bawah
2. Tap tombol "Keluar"
3. **Expected:** Redirect ke halaman Login

### 9. Test Login (Petugas)
1. Di halaman Login, masukkan kredensial petugas:
   - Email: `petugas1@desaku.id`
   - Password: `petugas123`
2. Tap "Masuk"
3. **Expected:**
   - Redirect ke Beranda Petugas
   - Tampil greeting "Daftar Tugas" dengan nama petugas

### 10. Test Route Guards
1. Login sebagai Masyarakat
2. **Coba akses:** 
   - URL admin tidak bisa diakses (auto-redirect)
   - URL petugas tidak bisa diakses (auto-redirect)
3. Logout, login sebagai Admin
4. **Verify:** Tidak bisa akses route masyarakat/petugas

### 11. Test Error Handling
1. Di halaman Login, masukkan email/password salah
2. Tap "Masuk"
3. **Expected:** Alert error dengan pesan jelas
4. Di halaman Registrasi:
   - Coba password < 6 karakter
   - Coba password tidak match
   - Coba field kosong
5. **Expected:** Alert validasi sesuai error

### 12. Test Auth Persistence
1. Login sebagai Masyarakat
2. Force close aplikasi Expo Go
3. Buka aplikasi lagi
4. **Expected:** Tetap login, langsung ke Beranda Masyarakat

## ✅ Checklist Testing

- [ ] Dependencies terinstall tanpa error
- [ ] Aplikasi bisa dijalankan dengan `npx expo start`
- [ ] Aplikasi bisa dibuka di Expo Go
- [ ] Registrasi masyarakat berhasil
- [ ] Profile otomatis dibuat dengan peran 'masyarakat'
- [ ] Login masyarakat berhasil, redirect ke beranda masyarakat
- [ ] Login admin berhasil, redirect ke dashboard admin
- [ ] Login petugas berhasil, redirect ke beranda petugas
- [ ] Route guard bekerja (tidak bisa akses route peran lain)
- [ ] Logout berhasil, redirect ke login
- [ ] Error handling validasi form bekerja
- [ ] Auth persistence bekerja (tetap login setelah restart)
- [ ] Tab navigation masyarakat bekerja (Beranda, Riwayat)

## 🐛 Known Issues / Limitations

- Halaman Buat Laporan, Riwayat, Detail masih placeholder (akan di TAHAP 3-4)
- Dashboard admin belum ada data (akan di TAHAP 5)
- Belum ada validasi email format di client-side
- Belum ada loading state saat auth persistence check

## 📝 Database Verification

Jalankan query ini di Supabase SQL Editor untuk verify:

```sql
-- Cek semua profiles
SELECT id, nama, peran, created_at FROM profiles;

-- Cek RLS policies
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- Cek triggers
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- Cek functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION';
```

## 🎯 Success Criteria

TAHAP 1 dianggap berhasil jika:
1. ✅ Aplikasi bisa dijalankan di Expo Go tanpa error
2. ✅ Registrasi dan login untuk semua peran berfungsi
3. ✅ Route guard dan auto-redirect berdasarkan peran bekerja
4. ✅ Auth persistence bekerja
5. ✅ Database schema, RLS, triggers sudah setup
6. ✅ Storage buckets sudah dibuat

---

**Jika semua test berhasil, siap lanjut ke TAHAP 2!** 🚀
