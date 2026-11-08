# LaporDesa - Aplikasi Pemantauan dan Pengelolaan Laporan Kerusakan Infrastruktur Desa

Aplikasi mobile untuk memfasilitasi pelaporan, verifikasi, dan penanganan kerusakan infrastruktur lingkungan desa dengan transparansi melalui Rencana Anggaran Biaya (RAB).

## 📱 Tentang Aplikasi

Aplikasi ini menghubungkan tiga pihak:
- **Masyarakat**: Melaporkan kerusakan infrastruktur dengan foto dan GPS
- **Admin Desa**: Memverifikasi laporan, menilai prioritas, menugaskan petugas, dan menerbitkan RAB
- **Petugas Lapangan**: Menangani perbaikan dan memperbarui status pekerjaan

### Kategori Infrastruktur
- Jalan Lingkungan
- Trotoar/Fasilitas Pejalan Kaki
- Saluran Drainase
- Lampu Penerangan Jalan

## 🛠️ Tech Stack

- **Frontend**: React Native + Expo + TypeScript (Expo Go)
- **Backend**: Supabase (Auth, PostgreSQL, Storage)
- **Navigasi**: Expo Router
- **Lokasi**: expo-location
- **File**: expo-document-picker, expo-file-system, expo-sharing, expo-web-browser

## 🚀 Setup Development

### Prerequisites
- Node.js (v18+)
- npm atau yarn
- Expo CLI
- Expo Go app di HP (untuk testing)
- Akun Supabase

### Instalasi

1. Clone repository
```bash
git clone https://github.com/USERNAME/LaporDesa.git
cd LaporDesa
```

2. Install dependencies
```bash
npm install
```

3. Setup environment variables
```bash
cp .env.example .env
```

Edit `.env` dan isi dengan kredensial Supabase Anda:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Setup database Supabase
- Jalankan migrations di `supabase/migrations/` via Supabase Dashboard > SQL Editor
- Jalankan seed data untuk kategori dan akun admin/petugas

5. Run development server
```bash
npx expo start
```

6. Scan QR code dengan Expo Go app di HP Anda

## 📁 Struktur Proyek

```
LaporDesa/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Login, Register
│   ├── (masyarakat)/      # UI Pelapor
│   ├── (admin)/           # UI Admin
│   └── (petugas)/         # UI Petugas
├── components/            # Reusable components
├── lib/                   # Utilities & services
├── types/                 # TypeScript types
├── hooks/                 # Custom React hooks
├── supabase/              # Database migrations & seeds
└── AGENT.md              # Dokumentasi lengkap proyek
```

## 📋 Fitur Utama

### Masyarakat (Pelapor)
- ✅ Registrasi dan login
- ✅ Buat laporan dengan foto dan GPS (wajib di lokasi)
- ✅ Isi patokan lokasi teks
- ✅ Pantau status laporan
- ✅ Lengkapi informasi tambahan jika diminta admin
- ✅ Lihat RAB yang diterbitkan

### Admin Desa
- ✅ Dashboard ringkasan laporan
- ✅ Verifikasi laporan (terima/tolak/minta info)
- ✅ Penilaian prioritas (4 kriteria berbobot)
- ✅ Penugasan petugas
- ✅ Kelola RAB (draft, upload PDF, terbitkan, revisi)

### Petugas Lapangan
- ✅ Lihat daftar tugas yang ditugaskan
- ✅ Update status pekerjaan
- ✅ Upload foto hasil penanganan
- ✅ Lihat RAB pada tugas

## 🔐 Keamanan

- Row Level Security (RLS) aktif di semua tabel
- Storage bucket privat dengan signed URL
- Hanya anon key di aplikasi (service_role key TIDAK BOLEH ada)
- Validasi transisi status di database (trigger)

## 📊 Status Laporan

- **Pending**: Menunggu verifikasi admin
- **Needs Information**: Admin meminta info tambahan
- **Verified**: Disetujui untuk ditindaklanjuti
- **Assigned**: Sudah ditugaskan ke petugas
- **In Progress**: Sedang dikerjakan
- **Resolved**: Penanganan selesai
- **Rejected**: Tidak diteruskan (dengan alasan)

## 🎯 Penilaian Prioritas

Admin menilai laporan berdasarkan 4 kriteria:
1. Tingkat bahaya (40%)
2. Dampak terhadap masyarakat (30%)
3. Tingkat keparahan (20%)
4. Frekuensi laporan lokasi sama (10%)

Sistem memberikan rekomendasi, admin menetapkan prioritas akhir.

## 📄 RAB (Rencana Anggaran Biaya)

- Status: Draft (admin only) atau Published (transparansi publik)
- Hanya untuk laporan Verified ke atas
- Format PDF, maksimal 5 MB
- Mendukung revisi (versioning)
- Akses via signed URL

## 🧪 Testing

Untuk menguji aplikasi, gunakan akun seed:
- **Admin**: `admin@desaku.id` / `admin123`
- **Petugas**: `petugas1@desaku.id` / `petugas123`
- **Masyarakat**: Registrasi sendiri via aplikasi

## 📝 Batasan & Aturan

### Foto
- Format: JPG, PNG
- Total per laporan: 10 MB
- Maksimal: 3 foto per laporan/hasil

### GPS
- Pelapor harus di lokasi kerusakan
- Tampilkan akurasi GPS
- Patokan lokasi teks wajib diisi
- Koordinat dibuka via aplikasi Maps bawaan (Linking)

### PDF RAB
- Maksimal: 5 MB
- Format: PDF only
- Dibuka via expo-web-browser atau download + sharing

### Tidak Ada di MVP
- ❌ Peta tertanam
- ❌ Notifikasi push
- ❌ Deteksi duplikat otomatis
- ❌ Multi-desa
- ❌ Klasifikasi AI

## 🤝 Kontribusi

Proyek ini adalah tugas akhir mata kuliah Pemrograman Berbasis Platform, Informatika.

## 📄 Lisensi

Proyek ini dibuat untuk keperluan edukasi.

---

**Dibuat dengan**: React Native + Expo + Supabase
**Tahun**: 2026
**Mata Kuliah**: Pemrograman Berbasis Platform

Untuk dokumentasi lengkap, lihat [AGENT.md](./AGENT.md)
