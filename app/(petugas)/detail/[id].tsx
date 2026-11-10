import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { describeError, formatDateTime, priorityMeta, statusMeta } from '@/lib/laporan-ui';
import { fetchPublishedRab, type RabWithVersion } from '@/lib/rab';
import { RabPanel } from '@/components/RabPanel';
import type { StatusLaporanType, TingkatType } from '@/types';

type TaskDetail = {
  id: string;
  kode_laporan: string;
  deskripsi: string;
  urgensi_pelapor: TingkatType;
  patokan_lokasi: string;
  latitude: number | null;
  longitude: number | null;
  akurasi_gps: number | null;
  status: StatusLaporanType;
  created_at: string;
};
type HistoryEntry = { id: string; status_lama: StatusLaporanType | null; status_baru: StatusLaporanType; catatan: string | null; waktu: string };
type PhotoEntry = { id: string; path: string; jenis: string };
type PhotoPreview = PhotoEntry & { url: string };
type PriorityInfo = { skor_rekomendasi: number; prioritas_akhir: TingkatType; created_at: string };
type PickedPhoto = { uri: string };
const BUCKET = 'foto-laporan';
const MAX_RESULT_PHOTOS = 3;
const URGENCY_LABEL: Record<TingkatType, string> = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi', sangat_tinggi: 'Sangat tinggi' };

export default function DetailTugasPetugasScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [priority, setPriority] = useState<PriorityInfo | null>(null);
  const [rab, setRab] = useState<RabWithVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [pickedPhotos, setPickedPhotos] = useState<PickedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) {
      setErrorMessage('ID tugas tidak tersedia.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const { data: taskData, error: taskError } = await supabase
        .from('laporan')
        .select('id, kode_laporan, deskripsi, urgensi_pelapor, latitude, longitude, akurasi_gps, patokan_lokasi, status, created_at')
        .eq('id', id)
        .maybeSingle();
      if (taskError) throw taskError;
      if (!taskData) {
        setErrorMessage('Tugas tidak ditemukan atau bukan penugasan Anda.');
        setLoading(false);
        return;
      }

      const [historyResult, photoResult, priorityResult, rabResult] = await Promise.all([
        supabase.from('riwayat_status').select('id, status_lama, status_baru, catatan, waktu').eq('laporan_id', id).order('waktu', { ascending: true }),
        supabase.from('foto_laporan').select('id, path, jenis').eq('laporan_id', id).order('uploaded_at', { ascending: true }),
        supabase.from('penilaian_prioritas').select('skor_rekomendasi, prioritas_akhir, created_at').eq('laporan_id', id).maybeSingle(),
        fetchPublishedRab(id),
      ]);
      if (historyResult.error) throw historyResult.error;
      if (photoResult.error) throw photoResult.error;
      if (priorityResult.error) throw priorityResult.error;

      const photoRows = (photoResult.data ?? []) as PhotoEntry[];
      const previews = await Promise.all(photoRows.map(async (photo) => {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(photo.path, 60 * 30);
        if (error) {
          console.warn('[DetailTugas] Could not create photo URL:', error.message);
          return { ...photo, url: '' };
        }
        return { ...photo, url: data.signedUrl };
      }));

      setTask(taskData as unknown as TaskDetail);
      setHistory((historyResult.data ?? []) as HistoryEntry[]);
      setPhotos(previews);
      setPriority((priorityResult.data as unknown as PriorityInfo) ?? null);
      setRab(rabResult ?? null);
    } catch (error) {
      console.error('[DetailTugas] Failed to load task detail:', error);
      setErrorMessage(describeError(error));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  const initialPhotos = useMemo(() => photos.filter((photo) => photo.jenis === 'dokumentasi_awal'), [photos]);
  const resultPhotos = useMemo(() => photos.filter((photo) => photo.jenis === 'hasil_penanganan'), [photos]);
  const remainingResultSlots = Math.max(0, MAX_RESULT_PHOTOS - resultPhotos.length - pickedPhotos.length);

  function showFeedback(message: string) {
    setActionError('');
    setSuccessMessage(message);
    if (Platform.OS !== 'web') Alert.alert('Berhasil', message);
  }

  function showFailure(message: string) {
    setSuccessMessage('');
    setActionError(message);
    if (Platform.OS !== 'web') Alert.alert('Gagal', message);
  }

  async function startWork() {
    if (!id) return;
    setUpdating(true);
    setActionError('');
    setSuccessMessage('');
    try {
      const { error } = await supabase.rpc('ubah_status_tugas', { p_laporan_id: id, p_status: 'in_progress' });
      if (error) throw error;
      showFeedback('Pekerjaan dimulai.');
      await loadDetail();
    } catch (error) {
      console.error('[DetailTugas] Failed to start work:', error);
      showFailure(describeError(error));
    } finally {
      setUpdating(false);
    }
  }

  async function resolveWork() {
    if (!id) return;
    setUpdating(true);
    setActionError('');
    setSuccessMessage('');
    try {
      const { error } = await supabase.rpc('ubah_status_tugas', { p_laporan_id: id, p_status: 'resolved' });
      if (error) throw error;
      showFeedback('Pekerjaan ditandai selesai.');
      await loadDetail();
    } catch (error) {
      console.error('[DetailTugas] Failed to resolve work:', error);
      showFailure(describeError(error));
    } finally {
      setUpdating(false);
    }
  }

  async function pickResultPhotos() {
    if (remainingResultSlots <= 0) {
      showFailure(`Maksimal ${MAX_RESULT_PHOTOS} foto hasil.`);
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showFailure('Izinkan akses galeri.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remainingResultSlots,
        quality: 1,
      });
      if (result.canceled) return;
      setPickedPhotos((current) => [...current, ...result.assets.map((asset) => ({ uri: asset.uri }))].slice(0, MAX_RESULT_PHOTOS - resultPhotos.length));
      setActionError('');
    } catch (error) {
      console.error('[DetailTugas] Failed to pick photos:', error);
      showFailure(describeError(error));
    }
  }

  async function uploadResultPhotos() {
    if (!id) return;
    if (resultPhotos.length + pickedPhotos.length === 0) {
      showFailure('Pilih minimal satu foto hasil.');
      return;
    }
    if (!task || !['assigned', 'in_progress'].includes(task.status)) {
      showFailure('Foto hasil hanya saat tugas aktif.');
      return;
    }
    setUploading(true);
    setActionError('');
    setSuccessMessage('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const uploaderId = authData.user?.id;
      if (!uploaderId) throw new Error('Sesi login petugas tidak tersedia.');
      const rows: { laporan_id: string; path: string; jenis: 'hasil_penanganan'; uploaded_by: string }[] = [];
      for (let index = 0; index < pickedPhotos.length; index += 1) {
        const compressed = await ImageManipulator.manipulateAsync(
          pickedPhotos[index].uri,
          [{ resize: { width: 1600 } }],
          { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG }
        );
        const response = await fetch(compressed.uri);
        if (!response.ok) throw new Error('Foto tidak dapat dibaca.');
        const blob = await response.blob();
        if (blob.size > 5 * 1024 * 1024) throw new Error('Satu foto > 5 MB.');
        const path = `${id}/hasil-${Date.now()}-${index}.jpg`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;
        rows.push({ laporan_id: id, path, jenis: 'hasil_penanganan', uploaded_by: uploaderId });
      }
      const { error: insertError } = await supabase.from('foto_laporan').insert(rows);
      if (insertError) throw insertError;
      setPickedPhotos([]);
      showFeedback('Foto hasil berhasil diunggah.');
      await loadDetail();
    } catch (error) {
      console.error('[DetailTugas] Failed to upload:', error);
      showFailure(describeError(error));
    } finally {
      setUploading(false);
    }
  }

  async function openCoordinates() {
    if (!task?.latitude || !task?.longitude) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${task.latitude},${task.longitude}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else showFailure('Peta tidak tersedia.');
    } catch {
      showFailure('Gagal membuka peta.');
    }
  }

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#1976D2" /><Text style={styles.muted}>Memuat…</Text></View>
  );
  if (!task) return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>Tugas tidak ditemukan</Text>
      <Text style={styles.errorText}>{errorMessage}</Text>
      <TouchableOpacity style={styles.button} onPress={() => void loadDetail()}><Text style={styles.buttonText}>Coba lagi</Text></TouchableOpacity>
    </View>
  );

  const status = statusMeta(task.status);
  const isActive = task.status === 'assigned' || task.status === 'in_progress';
  const canResolve = task.status === 'in_progress' && resultPhotos.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!!errorMessage && <View style={styles.inlineError}><Text style={styles.errorText}>{errorMessage}</Text></View>}
      {!!successMessage && <View style={styles.successBox}><Text style={styles.successText}>{successMessage}</Text></View>}

      <Text style={styles.code}>{task.kode_laporan}</Text>
      <View style={[styles.statusBox, { backgroundColor: status.background }]}><Text style={styles.statusLabel}>Status tugas</Text><Text style={[styles.statusValue, { color: status.color }]}>{status.label}</Text></View>

      <Text style={styles.sectionTitle}>Informasi kerusakan</Text>
      <Info label="Deskripsi" value={task.deskripsi} />
      <Info label="Urgensi" value={URGENCY_LABEL[task.urgensi_pelapor] ?? task.urgensi_pelapor} />
      <Info label="Patokan" value={task.patokan_lokasi} />
      {task.latitude != null && task.longitude != null && (
        <View style={styles.card}><Text style={styles.infoLabel}>Koordinat</Text><Text style={styles.body}>{task.latitude.toFixed(6)}, {task.longitude.toFixed(6)}</Text><Text style={styles.muted}>Akurasi ±{Math.round(task.akurasi_gps ?? 0)} m</Text><TouchableOpacity onPress={() => void openCoordinates()}><Text style={styles.link}>Buka di Maps</Text></TouchableOpacity></View>
      )}

      <Text style={styles.sectionTitle}>Prioritas penanganan</Text>
      {priority ? (
        <View style={styles.card}><Text style={[styles.priorityValue, { color: priorityMeta(priority.prioritas_akhir).color }]}>{priorityMeta(priority.prioritas_akhir).label}</Text><Text style={styles.body}>Skor: {Number(priority.skor_rekomendasi).toFixed(2)} dari 5,00</Text></View>
      ) : <Text style={styles.muted}>Prioritas belum ditetapkan.</Text>}

      <Text style={styles.sectionTitle}>Foto dokumentasi awal</Text>
      {initialPhotos.length === 0 ? <Text style={styles.muted}>Tidak ada foto awal.</Text> : (
        <View style={styles.photoGrid}>{initialPhotos.map((photo) => (
          <View key={photo.id} style={styles.photoCard}><Image source={{ uri: photo.url ?? '' }} style={styles.photo} resizeMode="cover" /><Text style={styles.photoCaption}>{photo.jenis === 'dokumentasi_awal' ? 'Awal' : ''}</Text></View>
        ))}</View>
      )}

      <Text style={styles.sectionTitle}>Foto hasil penanganan</Text>
      {resultPhotos.length === 0 ? <Text style={styles.muted}>Belum ada foto hasil.</Text> : (
        <View style={styles.photoGrid}>{resultPhotos.map((photo) => (
          <View key={photo.id} style={styles.photoCard}><Image source={{ uri: photo.url ?? '' }} style={styles.photo} resizeMode="cover" /><Text style={styles.photoCaption}>{photo.jenis === 'hasil_penanganan' ? 'Hasil' : ''}</Text></View>
        ))}</View>
      )}

      {isActive && (
        <>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void pickResultPhotos()} disabled={uploading || remainingResultSlots === 0}>
            <Text style={styles.secondaryButtonText}>
              {remainingResultSlots === 0 ? 'Batas 3 foto hasil' : `Pilih foto hasil (${pickedPhotos.length} dipilih)`}
            </Text>
          </TouchableOpacity>
          {pickedPhotos.length > 0 && (
            <View style={styles.pickedRow}>
              {pickedPhotos.map((photo) => <Image key={photo.uri} source={{ uri: photo.uri }} style={styles.pickedPhoto} />)}
            </View>
          )}
          {pickedPhotos.length > 0 && (
            <TouchableOpacity style={[styles.primaryButton, uploading && styles.disabled]} onPress={() => void uploadResultPhotos()} disabled={uploading}>
              {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Unggah foto hasil</Text>}
            </TouchableOpacity>
          )}
        </>
      )}

      <Text style={styles.sectionTitle}>Tindakan</Text>
      {!!actionError && <Text style={styles.actionError}>{actionError}</Text>}
      {task.status === 'assigned' ? (
        <TouchableOpacity style={[styles.primaryButton, updating && styles.disabled]} onPress={() => void startWork()} disabled={updating}>
          {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Mulai pekerjaan</Text>}
        </TouchableOpacity>
      ) : task.status === 'in_progress' ? (
        <>
          <TouchableOpacity style={[styles.primaryButton, (!canResolve || updating) && styles.disabled]} onPress={() => void resolveWork()} disabled={!canResolve || updating}>
            {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Tandai selesai</Text>}
          </TouchableOpacity>
          {!canResolve && <Text style={styles.hint}>Unggah foto hasil terlebih dahulu.</Text>}
        </>
      ) : task.status === 'resolved' ? (
        <Text style={styles.muted}>Tugas ini sudah selesai.</Text>
      ) : (
        <Text style={styles.muted}>Tidak ada tindakan.</Text>
      )}

      <Text style={styles.sectionTitle}>Riwayat status</Text>
      {history.length === 0 ? (
        <Text style={styles.muted}>Belum ada riwayat.</Text>
      ) : (
        history.map((entry) => (
          <View key={entry.id} style={styles.timelineItem}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineContent}>
              <Text style={styles.historyStatus}>
                {entry.status_lama ? `${statusMeta(entry.status_lama).label} → ` : ''}
                {statusMeta(entry.status_baru).label}
              </Text>
              <Text style={styles.muted}>{formatDateTime(entry.waktu)}</Text>
              {entry.catatan ? <Text style={styles.body}>{entry.catatan}</Text> : null}
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>RAB</Text>
      <RabPanel data={rab} />
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.card}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.body}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, backgroundColor: '#F4F7FB' },
  code: { color: '#1E293B', fontSize: 20, fontWeight: '800', marginBottom: 14 },
  statusBox: { padding: 15, borderRadius: 12 },
  statusLabel: { color: '#475569', fontSize: 13 },
  statusValue: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  sectionTitle: { color: '#1E293B', fontWeight: '800', fontSize: 17, marginTop: 24, marginBottom: 10 },
  card: { backgroundColor: '#fff', padding: 13, borderRadius: 9, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  infoLabel: { color: '#64748B', fontSize: 12, marginBottom: 5, marginTop: 6 },
  body: { color: '#334155', fontSize: 14, lineHeight: 21 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: { width: '48%', backgroundColor: '#fff', padding: 6, borderRadius: 9 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 6 },
  photoUnavailable: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  photoCaption: { color: '#475569', fontSize: 12, margin: 6 },
  pickedRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pickedPhoto: { width: 64, height: 64, borderRadius: 6 },
  secondaryButton: { borderWidth: 1, borderColor: '#1976D2', borderRadius: 9, padding: 13, alignItems: 'center', backgroundColor: '#fff', marginTop: 10 },
  secondaryButtonText: { color: '#1259A7', fontWeight: '700' },
  primaryButton: { backgroundColor: '#1976D2', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.6 },
  hint: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 8 },
  actionError: { color: '#B91C1C', marginBottom: 8, lineHeight: 19 },
  successBox: { backgroundColor: '#C6F6D5', padding: 11, borderRadius: 8, marginBottom: 12 },
  successText: { color: '#22543D', lineHeight: 20 },
  inlineError: { backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8, marginBottom: 12 },
  errorTitle: { color: '#1E293B', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  errorText: { color: '#B91C1C', textAlign: 'center', lineHeight: 21 },
  muted: { color: '#64748B', fontSize: 13, lineHeight: 20, marginTop: 6 },
  timelineItem: { flexDirection: 'row', marginBottom: 16 },
  timelineDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#1976D2', marginTop: 4, marginRight: 11 },
  link: { color: '#1976D2', fontWeight: '700', marginTop: 8 },
  priorityValue: { fontSize: 19, fontWeight: '800', marginBottom: 5 },
  timelineContent: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 9, borderWidth: 1, borderColor: '#E2E8F0' },
  historyStatus: { color: '#1E293B', fontWeight: '700', marginBottom: 5 },
  button: { backgroundColor: '#1976D2', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 9, marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '700' },
});