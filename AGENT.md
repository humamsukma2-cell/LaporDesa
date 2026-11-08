# AGENT.md - Aplikasi Pemantauan dan Pengelolaan Laporan Kerusakan Infrastruktur Desa

## RINGKASAN PROYEK

Aplikasi mobile React Native untuk satu desa: warga melaporkan kerusakan infrastruktur dengan foto dan GPS, admin memverifikasi dan menilai prioritas, petugas lapangan menangani perbaikan. Transparansi melalui RAB (Rencana Anggaran Biaya) dalam bentuk PDF.

**Kategori Infrastruktur:**
- Jalan lingkungan
- Trotoar/fasilitas pejalan kaki
- Saluran drainase
- Lampu penerangan jalan

**Masalah yang Diselesaikan:**
- Laporan tersebar (WhatsApp, lisan)
- Lokasi tidak jelas
- Warga tidak tahu tindak lanjut
- Prioritas tidak terstruktur
- Rencana biaya tidak transparan

## TECH STACK (FINAL)

- **Frontend:** React Native + Expo + TypeScript (Expo Go only, NO custom native code)
- **Navigasi:** Expo Router
- **Backend:** Supabase (Auth, PostgreSQL, Storage) dengan Row Level Security
- **Lokasi:** expo-location
- **File Picker:** expo-document-picker (untuk PDF RAB)
- **PDF Viewer:** expo-web-browser (signed URL) atau expo-file-system + expo-sharing
- **TIDAK DIPAKAI:** Peta tertanam, tile provider, Google Maps SDK, react-native-pdf, OpenStreetMap
- **PENTING:** Hanya anon key Supabase di aplikasi, service_role key DILARANG

## TIGA PERAN DAN HAK AKSES

### 1. MASYARAKAT (Pelapor)
- Registrasi/login sendiri
- Membuat laporan dengan foto + GPS + patokan teks
- Melihat laporan miliknya sendiri + status + riwayat
- Melengkapi laporan jika admin minta informasi tambahan
- Melihat RAB yang berstatus Published (sesuai aturan akses)

### 2. ADMIN DESA
- Melihat semua laporan
- Memverifikasi: terima / minta info tambahan / tolak (wajib alasan)
- Menilai prioritas (4 kriteria berbobot)
- Menugaskan petugas
- Menyusun, merevisi, dan menerbitkan RAB
- Melihat dashboard ringkasan

### 3. PETUGAS LAPANGAN
- Hanya melihat tugas yang ditugaskan kepadanya
- Memperbarui status pekerjaan
- Mengunggah foto hasil penanganan
- Melihat RAB Published pada laporan yang ditugaskan (asumsi)

**PENTING:** Akun admin dan petugas dibuat oleh admin atau seed, BUKAN registrasi publik. Registrasi publik hanya menghasilkan peran masyarakat.

## ALUR KERJA PER PERAN

### ALUR MASYARAKAT
1. Login/Registrasi
2. Beranda (ringkasan laporan + tombol Buat Laporan)
3. **Buat Laporan:**
   - Pilih kategori infrastruktur
   - Isi deskripsi kerusakan
   - Pilih urgensi menurut pelapor (ini BUKAN prioritas final)
   - Upload foto (kompres, batasi ukuran/format, retry jika gagal)
   - **Ambil GPS di lokasi kerusakan (WAJIB di lokasi):**
     - Tampilkan akurasi GPS
     - Peringatan jika akurasi rendah
     - Izinkan ambil ulang
     - Jika izin lokasi ditolak → laporan tidak bisa dikirim + panduan
   - **Isi patokan lokasi teks (WAJIB):** contoh "depan masjid RT 02"
   - Konfirmasi dan kirim → status awal: Pending
4. Riwayat Laporan
5. Detail Laporan (status, prioritas admin, riwayat status, bagian RAB jika ada)

### ALUR ADMIN
1. Login
2. Dashboard (jumlah laporan per status dan prioritas)
3. Daftar Laporan
4. Detail Laporan (tombol "Buka di Maps" untuk koordinat)
5. **Verifikasi:**
   - Terima → Verified
   - Minta informasi tambahan → Needs Information
   - Tolak → Rejected (wajib alasan)
6. **Penilaian Prioritas** (untuk laporan Verified):
   - Tingkat bahaya: bobot 40%
   - Dampak terhadap masyarakat: 30%
   - Tingkat keparahan: 20%
   - Frekuensi laporan lokasi sama: 10%
   - Sistem berikan rekomendasi kategori
   - Admin tinjau dan tetapkan prioritas akhir (boleh berbeda)
7. **Penugasan Petugas:** Verified → Assigned
8. **Kelola RAB:**
   - Buat RAB (Draft)
   - Upload PDF, isi detail
   - Terbitkan → Published
   - Revisi: upload PDF baru (versi baru)
9. Pemantauan

### ALUR PETUGAS
1. Login
2. Beranda/Daftar Tugas (hanya yang ditugaskan)
3. Detail Tugas:
   - Info kerusakan, foto awal
   - Prioritas
   - Tombol "Buka di Maps"
   - RAB jika sudah terbit
4. **Pembaruan Status:**
   - Assigned → In Progress
   - In Progress → Resolved (wajib upload foto hasil)
5. Upload Foto Hasil Penanganan

## STATUS LAPORAN DAN TRANSISI

**Status:**
- Pending: laporan baru, menunggu admin
- Needs Information: admin minta info tambahan dari pelapor
- Verified: admin nyatakan layak ditindaklanjuti
- Assigned: sudah ditugaskan ke petugas
- In Progress: petugas sedang menangani
- Resolved: penanganan selesai
- Rejected: tidak diteruskan (wajib alasan)

**Transisi yang Diizinkan:**
- Pending → Needs Information / Verified / Rejected (admin)
- Needs Information → Pending (setelah pelapor melengkapi - ASUMSI)
- Verified → Assigned (admin, saat pilih petugas)
- Assigned → In Progress (petugas)
- In Progress → Resolved (petugas, wajib foto hasil)

**PENTING:**
- Setiap transisi dicatat di tabel riwayat_status: status_lama, status_baru, waktu, pelaku, catatan
- Riwayat harus bisa ditelusuri (bukan hanya status terakhir)
- Validasi transisi HARUS di database (fungsi/trigger) agar tidak bisa dilompati dari klien

## PENENTUAN PRIORITAS

### Kriteria dan Bobot (USULAN, bisa diubah):
1. Tingkat bahaya: 40%
2. Dampak terhadap masyarakat: 30%
3. Tingkat keparahan: 20%
4. Frekuensi laporan lokasi sama: 10%

Setiap kriteria dinilai skala 1-5.

### Proses:
1. Admin isi nilai tiap kriteria
2. Sistem hitung skor berbobot
3. Sistem beri rekomendasi kategori: rendah / sedang / tinggi / sangat tinggi
4. Admin tinjau dan tetapkan prioritas akhir (boleh berbeda dari rekomendasi)

### Yang Disimpan:
- Nilai tiap kriteria
- Skor rekomendasi
- Prioritas akhir yang ditetapkan admin
- Admin penilai
- Waktu penilaian

**PENTING:**
- Bobot jadikan KONFIGURASI, jangan hardcode
- Ambang batas skor per kategori BELUM DITETAPKAN → tanya pengguna, jangan ngarang
- Urgensi dari pelapor ≠ prioritas admin (disimpan di kolom terpisah)

## FITUR RAB (Rencana Anggaran Biaya)

**Tujuan:** Transparansi biaya perbaikan bagi warga

### Aturan RAB:
- RAB adalah entitas TERPISAH dari status laporan
- Status RAB sendiri: **Draft** (hanya admin) dan **Published**
- Hanya bisa dibuat untuk laporan Verified atau sesudahnya
- Model: **satu RAB per laporan** (asumsi)

### Konten RAB:
- Nomor/judul RAB
- Total anggaran
- Sumber dana
- Catatan
- File PDF (hanya PDF, batas 5 MB usulan)

### Alur RAB:
1. Admin buat RAB → status Draft (tidak terlihat warga)
2. Admin isi detail + upload PDF
3. Admin klik Terbitkan (konfirmasi) → Published
4. Catat waktu terbit dan admin penerbit

### Revisi RAB:
- Admin upload PDF baru
- Tercatat sebagai versi baru
- Versi lama tetap tersimpan di riwayat
- Hanya versi terbaru yang tampil ke warga

### Akses RAB:
- Draft: hanya admin
- Published: **sesuai aturan akses (ASUMSI belum final):**
  - Semua warga login boleh lihat RAB Published? ATAU
  - Hanya pelapor laporan terkait?
  - Petugas yang ditugaskan boleh lihat?
- Data pribadi pelapor TIDAK ditampilkan

### Tampilan RAB untuk Warga:
- Di Detail Laporan ada bagian "RAB"
- Jika ada RAB Published: ringkasan (nomor, total, sumber dana, tanggal terbit) + tombol "Buka PDF"
- Jika belum ada: "RAB belum tersedia"
- Jika PDF gagal dimuat: pesan jelas + tombol coba lagi
- Label jelas: "Rencana Anggaran Biaya" + catatan bahwa keputusan tetap pada pihak berwenang

### Penyimpanan RAB:
- Bucket Supabase Storage PRIVAT terpisah dari foto
- Database hanya simpan path
- Warga akses lewat **signed URL berumur pendek**
- Signed URL dibuat setelah pemeriksaan hak akses
- RAB Draft tidak bisa diakses lewat tautan langsung

### Membuka PDF (Expo Go):
- Opsi 1: expo-web-browser dengan signed URL
- Opsi 2: download dengan expo-file-system, buka dengan expo-sharing
- Pendekatan final ditentukan lewat uji di perangkat
- JANGAN pakai react-native-pdf (tidak jalan di Expo Go)

## ATURAN LOKASI DAN PETA

### TIDAK ADA di Aplikasi:
- Peta tertanam
- Tile provider
- Google Maps SDK
- OpenStreetMap component
- Halaman "Pilih Lokasi" dengan peta
- Halaman "Peta Laporan"

### YANG ADA:
- **expo-location** untuk ambil koordinat GPS
- **Pelapor HARUS di lokasi kerusakan** saat ambil GPS
- Koordinat (latitude, longitude, akurasi) disimpan di database
- **Patokan lokasi teks WAJIB diisi** (contoh: "depan masjid RT 02")
- Koordinat dan patokan sama-sama wajib
- Tampilkan akurasi GPS ke pelapor
- Peringatan jika akurasi rendah
- Tombol ambil ulang GPS
- Jika izin lokasi ditolak: laporan tidak bisa dikirim + panduan cara aktifkan izin

### Membuka Koordinat:
- Tombol **"Buka di Maps"** di Detail Laporan (admin) dan Detail Tugas (petugas)
- Menggunakan **Linking** ke URL koordinat
- Membuka aplikasi Maps bawaan HP
- Jika aplikasi Maps tidak tersedia: pesan jelas

## MODEL DATA (Tabel Utama)

### profiles / pengguna
- id (link ke auth.users)
- nama
- peran: masyarakat | admin | petugas
- created_at

### kategori
- id
- nama (jalan lingkungan, trotoar, drainase, lampu penerangan)

### laporan
- id
- kode_laporan (unique, auto-generated)
- pelapor_id (FK ke profiles)
- kategori_id (FK ke kategori)
- deskripsi
- urgensi_pelapor (rendah, sedang, tinggi, sangat_tinggi)
- latitude (WAJIB)
- longitude (WAJIB)
- akurasi_gps (meter)
- patokan_lokasi (text, WAJIB)
- status (enum)
- created_at
- updated_at

### foto_laporan
- id
- laporan_id (FK)
- path (storage path)
- jenis: dokumentasi_awal | hasil_penanganan
- uploaded_by (FK ke profiles)
- uploaded_at

### riwayat_status
- id
- laporan_id (FK)
- status_lama
- status_baru
- pelaku_id (FK ke profiles)
- waktu
- catatan (untuk alasan penolakan / permintaan info tambahan)

### penilaian_prioritas
- id
- laporan_id (FK, unique)
- tingkat_bahaya (1-5)
- dampak_masyarakat (1-5)
- tingkat_keparahan (1-5)
- frekuensi_laporan (1-5)
- skor_rekomendasi (calculated)
- prioritas_akhir (rendah, sedang, tinggi, sangat_tinggi)
- admin_penilai_id (FK ke profiles)
- created_at

### penugasan
- id
- laporan_id (FK, unique)
- petugas_id (FK ke profiles)
- admin_pemberi_tugas_id (FK ke profiles)
- waktu_penugasan

### rab
- id
- laporan_id (FK, unique)
- nomor_rab
- judul
- total_anggaran (decimal)
- sumber_dana
- catatan
- status: draft | published
- dibuat_oleh (FK ke profiles)
- created_at
- published_at
- published_by (FK ke profiles)

### rab_versi
- id
- rab_id (FK)
- nomor_versi (1, 2, 3, ...)
- path_pdf (storage path)
- ukuran_file (bytes)
- diunggah_oleh (FK ke profiles)
- waktu_unggah

## KEAMANAN (Row Level Security)

### WAJIB RLS di Semua Tabel:
- **Masyarakat:** hanya baca/tulis laporan miliknya sendiri
- **Admin:** baca semua, ubah sesuai wewenang
- **Petugas:** hanya baca/ubah laporan yang ditugaskan kepadanya
- **RAB Draft:** hanya admin
- **RAB Published:** sesuai aturan akses (asumsi belum final)

### Storage Bucket:
- Bucket foto: akses sesuai peran
- Bucket RAB: PRIVAT, akses via signed URL setelah cek hak akses

### Keamanan Tambahan:
- Data pribadi pelapor tidak tampil ke pengguna tidak berwenang
- Service_role key DILARANG di aplikasi mobile
- Hanya anon key yang dipakai
- Semua pemeriksaan akses harus bisa diuji per peran

## HALAMAN (Expo Router)

Pisahkan route group per peran, lakukan guard berdasarkan peran setelah login.

### Masyarakat:
- Login/Registrasi
- Beranda
- Buat Laporan (termasuk GPS dan patokan lokasi)
- Riwayat Laporan
- Detail Laporan (+ bagian RAB)
- Penampil RAB (PDF)

### Admin:
- Dashboard (jumlah laporan per status dan prioritas)
- Daftar Laporan
- Detail Laporan (tombol Buka di Maps)
- Verifikasi dan Penilaian Prioritas
- Penugasan Petugas
- Kelola RAB:
  - Form RAB
  - Upload PDF
  - Daftar versi
  - Tombol Terbitkan

### Petugas:
- Beranda
- Daftar Tugas
- Detail Tugas (tombol Buka di Maps, + RAB bila terbit)
- Pembaruan Pekerjaan (ubah status + upload foto hasil)

## TIDAK ADA DI MVP (JANGAN DIKERJAKAN)

- Klasifikasi kerusakan dengan AI
- Notifikasi push
- Deteksi duplikat otomatis (admin periksa manual)
- Heatmap/analisis spasial
- Multi-desa/integrasi instansi
- Pelacakan petugas real-time
- Pencatatan realisasi biaya vs RAB
- Tanda tangan digital RAB
- Persetujuan RAB berjenjang
- Peta tertanam

## PENANGANAN KEGAGALAN

Tampilkan pesan yang jelas dan tombol "Coba Lagi" untuk:
- Jaringan/layanan bermasalah
- Foto/PDF gagal upload
- Izin lokasi ditolak (+ panduan cara aktifkan)
- Aplikasi Maps tidak tersedia
- PDF gagal dimuat

## PRINSIP PENTING

1. **Urgensi pelapor ≠ Prioritas admin**
   - Disimpan di kolom terpisah
   - Prioritas akhir SELALU ditetapkan admin setelah verifikasi

2. **Aplikasi hanya membantu pelaporan dan pemantauan**
   - Tidak menentukan besaran anggaran
   - Tidak menggantikan dokumen resmi anggaran desa

3. **Lokasi WAJIB**
   - Pelapor harus di lokasi saat ambil GPS
   - Koordinat + patokan teks keduanya wajib

4. **RAB untuk Transparansi**
   - Draft tidak terlihat warga
   - Published terlihat sesuai aturan akses
   - Label jelas bahwa keputusan tetap pada pihak berwenang

## TAHAPAN KERJA

### TAHAP 1 - PAHAMI ✅
Tulis ringkasan pemahaman: tujuan, peran, alur, transisi status, aturan RAB, aturan lokasi, batasan Expo Go.

### TAHAP 2 - TANYA
Daftarkan semua asumsi/celah yang ambigu (max 10 pertanyaan, urut dari yang paling berdampak). Tunggu jawaban.

### TAHAP 3 - RENCANA
Usulkan:
- Struktur folder Expo Router
- Skema SQL Supabase (tabel, enum, trigger transisi status, RLS, bucket storage)
- Urutan pengerjaan per tahap kecil yang bisa diuji di Expo Go

Tunggu persetujuan.

### TAHAP 4 - IMPLEMENTASI BERTAHAP
Kerjakan satu tahap per giliran:
- Jelaskan perubahan
- Sebutkan cara mengujinya
- Jangan tambah fitur di luar MVP
- Jika library tidak kompatibel Expo Go: hentikan dan beri tahu
- Jika ada instruksi bertentangan: tanyakan dulu, jangan menebak

## ASUMSI YANG PERLU DIKONFIRMASI

1. Transisi Needs Information → Pending setelah pelapor melengkapi (belum eksplisit di PRD)
2. Ambang batas skor prioritas per kategori belum ditetapkan
3. Siapa boleh lihat RAB Published (semua warga login? hanya pelapor terkait?)
4. Cara pembuatan akun admin/petugas (seed? admin bikin?)
5. Resolved mensyaratkan foto hasil penanganan
6. Petugas boleh lihat RAB Published pada laporan yang ditugaskan
7. Bagaimana jika warga tidak di lokasi saat melapor (ditolak? beri panduan?)
8. Apakah admin bisa mengubah prioritas setelah ditetapkan?
9. Apakah pelapor bisa membatalkan laporan?
10. Batas ukuran foto untuk dokumentasi

---

**Dibuat:** 2026-11-08
**Proyek:** Aplikasi Pemantauan dan Pengelolaan Laporan Kerusakan Infrastruktur Desa
**Mata Kuliah:** Pemrograman Berbasis Platform, Informatika
