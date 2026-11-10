import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { KATEGORI_INFRASTRUKTUR, FOTO_CONFIG } from '@/lib/constants';
import { TingkatType } from '@/types';

const MAX_IMAGE_BYTES = FOTO_CONFIG.MAX_SIZE_TOTAL;
const MAX_IMAGE_COUNT = 3;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
type SelectedPhoto = { uri: string; mimeType: string; size: number };
type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

const urgencies: { value: TingkatType; label: string }[] = [
  { value: 'rendah', label: 'Rendah' },
  { value: 'sedang', label: 'Sedang' },
  { value: 'tinggi', label: 'Tinggi' },
  { value: 'sangat_tinggi', label: 'Sangat tinggi' },
];

export default function BuatLaporanScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<TingkatType | ''>('');
  const [landmark, setLandmark] = useState('');
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationMessage, setLocationMessage] = useState('Lokasi GPS belum diambil (opsional).');
  const [formFeedback, setFormFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const photoBytes = useMemo(() => photos.reduce((sum, photo) => sum + photo.size, 0), [photos]);

  function showError(title: string, message: string) {
    setFormFeedback({ type: 'error', message: `${title}: ${message}` });
    if (Platform.OS !== 'web') Alert.alert(title, message);
  }

  function describeError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object') {
      const value = error as SupabaseLikeError;
      const parts = [value.message, value.code ? `Kode: ${value.code}` : null, value.details, value.hint]
        .filter((part): part is string => Boolean(part));
      if (parts.length) return parts.join(' — ');
    }
    if (typeof error === 'string' && error.trim()) return error;
    return 'Terjadi kesalahan yang tidak diketahui. Silakan coba lagi.';
  }

  async function pickPhotos() {
    if (photos.length >= MAX_IMAGE_COUNT) {
      showError('Batas foto tercapai', 'Maksimal 3 foto untuk satu laporan.');
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showError('Izin diperlukan', 'Izinkan akses galeri untuk memilih foto kerusakan.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGE_COUNT - photos.length,
        quality: 1,
      });
      if (result.canceled) return;

      const added: SelectedPhoto[] = [];
      for (const asset of result.assets) {
        if (photos.length + added.length >= MAX_IMAGE_COUNT) break;
        const mimeType = asset.mimeType ?? (asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
          showError('Format tidak didukung', 'Pilih foto JPG atau PNG saja.');
          continue;
        }

        let uri = asset.uri;
        let size = asset.fileSize ?? 0;
        if (photoBytes + added.reduce((sum, photo) => sum + photo.size, 0) + size > MAX_IMAGE_BYTES || size === 0) {
          const compressed = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1600 } }],
            { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG }
          );
          uri = compressed.uri;
          const response = await fetch(uri);
          size = (await response.blob()).size;
          added.push({ uri, mimeType: 'image/jpeg', size });
        } else {
          added.push({ uri, mimeType, size });
        }
      }

      const total = photoBytes + added.reduce((sum, photo) => sum + photo.size, 0);
      if (total > MAX_IMAGE_BYTES) {
        showError('Ukuran foto terlalu besar', 'Total ukuran foto maksimal 10 MB. Hapus foto atau pilih file yang lebih kecil.');
        return;
      }
      setPhotos((current) => [...current, ...added].slice(0, MAX_IMAGE_COUNT));
    } catch (error) {
      showError('Gagal memilih foto', error instanceof Error ? error.message : 'Silakan coba lagi.');
    }
  }

  function removePhoto(uri: string) {
    setPhotos((current) => current.filter((photo) => photo.uri !== uri));
  }

  async function captureLocation() {
    setLocationMessage('Memeriksa izin lokasi…');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocation(null);
        setLocationMessage('Izin lokasi ditolak. GPS opsional; patokan lokasi tetap wajib diisi. Anda dapat mengaktifkan izin di pengaturan HP lalu mencoba lagi.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(current);
      setLocationMessage(`GPS tersimpan: ${current.coords.latitude.toFixed(6)}, ${current.coords.longitude.toFixed(6)} (akurasi ±${Math.round(current.coords.accuracy ?? 0)} m). GPS hanya informasi tambahan.`);
    } catch (error) {
      setLocation(null);
      setLocationMessage(`Lokasi GPS tidak tersedia: ${error instanceof Error ? error.message : 'Silakan coba lagi.'} GPS opsional; patokan teks wajib.`);
    }
  }

  async function uploadPhotos(reportId: string, uploadedPaths: string[]): Promise<void> {
    const photoRows: { laporan_id: string; path: string; jenis: 'dokumentasi_awal'; uploaded_by: string }[] = [];
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      const extension = photo.mimeType === 'image/png' ? 'png' : 'jpg';
      const path = `${reportId}/awal-${Date.now()}-${index}.${extension}`;
      const response = await fetch(photo.uri);
      if (!response.ok) throw new Error(`Foto ${index + 1} tidak dapat dibaca dari perangkat.`);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from('foto-laporan')
        .upload(path, blob, { contentType: photo.mimeType, upsert: false });
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);
      photoRows.push({
        laporan_id: reportId,
        path,
        jenis: 'dokumentasi_awal',
        uploaded_by: session!.user.id,
      });
    }

    const { error: insertError } = await supabase.from('foto_laporan').insert(photoRows);
    if (insertError) throw insertError;
  }

  async function submitReport() {
    if (!session?.user) {
      showError('Sesi berakhir', 'Silakan login kembali sebelum mengirim laporan.');
      router.replace('/(auth)/login');
      return;
    }
    if (!category || !description.trim() || !urgency || !landmark.trim()) {
      showError('Data belum lengkap', 'Pilih kategori, isi deskripsi, urgensi, dan patokan lokasi.');
      return;
    }
    if (photos.length < 1) {
      showError('Foto wajib', 'Tambahkan minimal 1 foto kerusakan sebelum mengirim laporan.');
      return;
    }
    if (photos.length > MAX_IMAGE_COUNT || photoBytes > MAX_IMAGE_BYTES) {
      showError('Foto tidak valid', 'Maksimal 3 foto JPG/PNG dengan total ukuran maksimal 10 MB.');
      return;
    }

    setBusy(true);
    let reportId: string | null = null;
    let uploadedPaths: string[] = [];
    try {
      let stage = 'mencari kategori';
      const { data: categoryRow, error: categoryError } = await supabase
        .from('kategori')
        .select('id, nama')
        .eq('nama', category.trim())
        .maybeSingle();
      if (categoryError) throw new Error(`${stage}: ${describeError(categoryError)}`);
      if (!categoryRow) throw new Error(`${stage}: kategori "${category}" tidak ditemukan atau tidak dapat dibaca oleh sesi ini.`);

      stage = 'membuat laporan';
      const { data: reportRows, error: reportError } = await supabase
        .from('laporan')
        .insert({
          pelapor_id: session.user.id,
          kategori_id: categoryRow.id,
          deskripsi: description.trim(),
          urgensi_pelapor: urgency,
          latitude: location?.coords.latitude ?? null,
          longitude: location?.coords.longitude ?? null,
          akurasi_gps: location?.coords.accuracy ?? null,
          patokan_lokasi: landmark.trim(),
          status: 'pending',
        })
        .select('id');
      if (reportError) throw new Error(`${stage}: ${describeError(reportError)}`);
      const report = reportRows?.[0];
      if (!report) {
        throw new Error(`${stage}: database menerima permintaan tetapi tidak mengembalikan laporan. Periksa izin SELECT pada tabel laporan.`);
      }
      reportId = report.id;

      stage = 'mengunggah dan menyimpan foto';
      try {
        await uploadPhotos(report.id, uploadedPaths);
      } catch (photoError) {
        throw new Error(`${stage}: ${describeError(photoError)}`);
      }

      setFormFeedback({ type: 'success', message: `Laporan ${report.id} berhasil dikirim dengan status Pending.` });
      router.replace('/(masyarakat)/riwayat');
    } catch (error) {
      // Prevent a report without its mandatory evidence photo if storage/database upload fails.
      if (reportId) {
        const { error: deleteError } = await supabase.from('laporan').delete().eq('id', reportId);
        if (deleteError) console.error('[BuatLaporan] Failed to clean up report:', deleteError);
        if (uploadedPaths.length) {
          const { error: removeError } = await supabase.storage.from('foto-laporan').remove(uploadedPaths);
          if (removeError) console.error('[BuatLaporan] Failed to clean up uploaded photos:', removeError);
        }
      }
      const diagnostic = describeError(error);
      console.error('[BuatLaporan] Submission failed:', error);
      showError('Gagal mengirim laporan', diagnostic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Buat Laporan</Text>
        <Text style={styles.subtitle}>Foto wajib. GPS opsional; patokan lokasi wajib.</Text>
        {!!formFeedback && (
          <View style={[styles.feedbackBox, formFeedback.type === 'success' ? styles.successBox : styles.errorBox]} accessibilityRole="alert">
            <Text style={formFeedback.type === 'success' ? styles.successText : styles.errorText}>{formFeedback.message}</Text>
          </View>
        )}

        <Text style={styles.label}>Kategori *</Text>
        <View style={styles.optionList}>
          {KATEGORI_INFRASTRUKTUR.map((item) => (
            <TouchableOpacity key={item} accessibilityRole="radio" accessibilityState={{ checked: category === item }} style={[styles.option, category === item && styles.optionSelected]} onPress={() => setCategory(item)} disabled={busy}>
              <Text style={[styles.optionText, category === item && styles.optionTextSelected]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Deskripsi kerusakan *</Text>
        <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="Jelaskan kondisi dan bagian yang rusak" multiline maxLength={2000} editable={!busy} />

        <Text style={styles.label}>Urgensi menurut Anda *</Text>
        <View style={styles.chipRow}>
          {urgencies.map((item) => (
            <TouchableOpacity key={item.value} accessibilityRole="radio" accessibilityState={{ checked: urgency === item.value }} style={[styles.chip, urgency === item.value && styles.chipSelected]} onPress={() => setUrgency(item.value)} disabled={busy}>
              <Text style={[styles.chipText, urgency === item.value && styles.chipTextSelected]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>Ini hanya masukan awal. Prioritas akhir ditetapkan admin setelah verifikasi.</Text>

        <Text style={styles.label}>Foto kerusakan * (minimal 1, maksimal 3)</Text>
        <Text style={styles.hint}>JPG/PNG, total maksimal 10 MB. Foto diperlukan sebagai bukti laporan.</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={pickPhotos} disabled={busy || photos.length >= MAX_IMAGE_COUNT}>
          <Text style={styles.secondaryButtonText}>Pilih foto dari galeri ({photos.length}/{MAX_IMAGE_COUNT})</Text>
        </TouchableOpacity>
        <View style={styles.photoList}>
          {photos.map((photo) => (
            <View key={photo.uri} style={styles.photoItem}>
              <Image source={{ uri: photo.uri }} style={styles.photo} />
              <View style={styles.photoInfo}>
                <Text style={styles.hint}>{(photo.size / (1024 * 1024)).toFixed(2)} MB</Text>
                <TouchableOpacity onPress={() => removePhoto(photo.uri)} disabled={busy}>
                  <Text style={styles.removeText}>Hapus</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.hint}>Total: {(photoBytes / (1024 * 1024)).toFixed(2)} / 10 MB</Text>

        <Text style={styles.label}>Lokasi GPS (opsional)</Text>
        <Text style={styles.hint}>GPS hanya informasi tambahan; jika izin ditolak, laporan tetap dapat dikirim memakai patokan lokasi.</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={captureLocation} disabled={busy}>
          <Text style={styles.secondaryButtonText}>{location ? 'Ambil ulang lokasi GPS' : 'Ambil lokasi GPS'}</Text>
        </TouchableOpacity>
        <Text style={styles.locationText}>{locationMessage}</Text>

        <Text style={styles.label}>Patokan lokasi * (wajib)</Text>
        <TextInput style={styles.input} value={landmark} onChangeText={setLandmark} placeholder="Contoh: depan masjid RT 02" maxLength={250} editable={!busy} />

        <TouchableOpacity style={[styles.submitButton, busy && styles.disabledButton]} onPress={submitReport} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Kirim Laporan</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: '#1f2937', marginBottom: 6 },
  subtitle: { color: '#64748b', marginBottom: 20 },
  label: { color: '#1f2937', fontSize: 15, fontWeight: '600', marginTop: 18, marginBottom: 8 },
  hint: { color: '#64748b', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  optionList: { gap: 8 },
  option: { padding: 13, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 9, backgroundColor: '#fff' },
  optionSelected: { borderColor: '#1976d2', backgroundColor: '#eaf3ff' },
  optionText: { color: '#334155' },
  optionTextSelected: { color: '#1259a7', fontWeight: '600' },
  input: { backgroundColor: '#fff', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 9, padding: 12, color: '#1f2937', fontSize: 15 },
  multiline: { minHeight: 105, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff' },
  chipSelected: { borderColor: '#1976d2', backgroundColor: '#eaf3ff' },
  chipText: { color: '#334155' },
  chipTextSelected: { color: '#1259a7', fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderColor: '#1976d2', borderRadius: 9, padding: 13, alignItems: 'center', backgroundColor: '#fff', marginVertical: 4 },
  secondaryButtonText: { color: '#1259a7', fontWeight: '600' },
  photoList: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  photoItem: { width: 100, backgroundColor: '#fff', borderRadius: 8, padding: 5 },
  photo: { width: 90, height: 90, borderRadius: 6 },
  photoInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  removeText: { color: '#c62828', fontSize: 12, fontWeight: '600' },
  locationText: { color: '#334155', fontSize: 13, lineHeight: 19, marginTop: 8 },
  feedbackBox: { borderWidth: 1, borderRadius: 9, padding: 12, marginBottom: 12 },
  errorBox: { backgroundColor: '#FDECEA', borderColor: '#F44336' },
  successBox: { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' },
  errorText: { color: '#B71C1C', fontSize: 14, lineHeight: 20 },
  successText: { color: '#1B5E20', fontSize: 14, lineHeight: 20 },
  submitButton: { backgroundColor: '#1976d2', borderRadius: 10, alignItems: 'center', padding: 16, marginTop: 28 },
  disabledButton: { opacity: 0.65 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
