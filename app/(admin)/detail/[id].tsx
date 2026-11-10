import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { categoryName, describeError, formatDateTime, statusMeta } from '@/lib/laporan-ui';
import type { StatusLaporanType, TingkatType } from '@/types';

type ReportDetail = {
  id: string;
  kode_laporan: string;
  pelapor_id: string;
  deskripsi: string;
  urgensi_pelapor: TingkatType;
  latitude: number | null;
  longitude: number | null;
  akurasi_gps: number | null;
  patokan_lokasi: string;
  status: StatusLaporanType;
  created_at: string;
  kategori: { nama: string } | { nama: string }[] | null;
  pelapor: { nama: string } | { nama: string }[] | null;
};
type HistoryEntry = { id: string; status_lama: StatusLaporanType | null; status_baru: StatusLaporanType; catatan: string | null; waktu: string };
type PhotoEntry = { id: string; path: string; jenis: string };
type PhotoPreview = PhotoEntry & { url: string };
type InfoRequest = { id: string; permintaan: string; jawaban: string | null; created_at: string; dijawab_pada: string | null };
type Action = 'verified' | 'needs_information' | 'rejected';

const URGENCY_LABEL: Record<TingkatType, string> = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi', sangat_tinggi: 'Sangat tinggi' };
const ACTION_LABEL: Record<Action, string> = {
  verified: 'Verifikasi laporan',
  needs_information: 'Minta informasi tambahan',
  rejected: 'Tolak laporan',
};

export default function DetailLaporanAdminScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [infoRequests, setInfoRequests] = useState<InfoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadDetail = useCallback(async () => {
    if (!id) {
      setErrorMessage('ID laporan tidak tersedia.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const { data: reportData, error: reportError } = await supabase
        .from('laporan')
        .select('id, kode_laporan, pelapor_id, deskripsi, urgensi_pelapor, latitude, longitude, akurasi_gps, patokan_lokasi, status, created_at, kategori(nama), pelapor:profiles(nama)')
        .eq('id', id)
        .maybeSingle();
      if (reportError) throw reportError;
      if (!reportData) {
        setErrorMessage('Laporan tidak ditemukan atau tidak dapat diakses.');
        setLoading(false);
        return;
      }

      const [historyResult, photoResult, infoResult] = await Promise.all([
        supabase.from('riwayat_status').select('id, status_lama, status_baru, catatan, waktu').eq('laporan_id', id).order('waktu', { ascending: true }),
        supabase.from('foto_laporan').select('id, path, jenis').eq('laporan_id', id).order('uploaded_at', { ascending: true }),
        supabase.from('informasi_tambahan').select('id, permintaan, jawaban, created_at, dijawab_pada').eq('laporan_id', id).order('created_at', { ascending: true }),
      ]);
      if (historyResult.error) throw historyResult.error;
      if (photoResult.error) throw photoResult.error;
      if (infoResult.error) throw infoResult.error;

      const photoRows = (photoResult.data ?? []) as PhotoEntry[];
      const previews = await Promise.all(photoRows.map(async (photo) => {
        const { data, error } = await supabase.storage.from('foto-laporan').createSignedUrl(photo.path, 60 * 30);
        if (error) {
          console.warn('[DetailAdmin] Could not create photo URL:', error.message);
          return { ...photo, url: '' };
        }
        return { ...photo, url: data.signedUrl };
      }));

      setReport(reportData as unknown as ReportDetail);
      setHistory((historyResult.data ?? []) as HistoryEntry[]);
      setPhotos(previews);
      setInfoRequests((infoResult.data ?? []) as InfoRequest[]);
    } catch (error) {
      console.error('[DetailAdmin] Failed to load report detail:', error);
      setErrorMessage(describeError(error));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  function startAction(next: Action) {
    setAction(next);
    setNote('');
    setActionError('');
    setSuccessMessage('');
  }

  async function submitAction() {
    if (!action || !id) return;
    const trimmed = note.trim();
    if ((action === 'rejected' || action === 'needs_information') && !trimmed) {
      setActionError(action === 'rejected' ? 'Alasan penolakan wajib diisi.' : 'Permintaan informasi wajib diisi.');
      return;
    }
    setSubmitting(true);
    setActionError('');
    setSuccessMessage('');
    try {
      const { error } = await supabase.rpc('verifikasi_laporan', {
        p_laporan_id: id,
        p_status: action,
        p_catatan: trimmed || null,
      });
      if (error) throw error;
      setSuccessMessage(
        action === 'verified' ? 'Laporan berhasil diverifikasi.'
          : action === 'rejected' ? 'Laporan berhasil ditolak dengan alasan tercatat.'
            : 'Permintaan informasi tambahan berhasil dikirim.'
      );
      setAction(null);
      setNote('');
      await loadDetail();
    } catch (error) {
      console.error('[DetailAdmin] Verification failed:', error);
      setActionError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function openCoordinates() {
    if (report?.latitude == null || report.longitude == null) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${report.latitude},${report.longitude}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else setErrorMessage('Aplikasi untuk membuka tautan peta tidak tersedia pada perangkat ini.');
    } catch {
      setErrorMessage('Gagal membuka tautan peta. Coba lagi.');
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1976D2" /><Text style={styles.muted}>Memuat detail laporan…</Text></View>;
  if (!report) return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>Detail belum dapat ditampilkan</Text>
      <Text style={styles.errorText}>{errorMessage || 'Laporan tidak ditemukan.'}</Text>
      <TouchableOpacity style={styles.button} onPress={() => void loadDetail()}><Text style={styles.buttonText}>Coba lagi</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => router.back()}><Text style={styles.backLink}>Kembali</Text></TouchableOpacity>
    </View>
  );

  const status = statusMeta(report.status);
  const canVerify = report.status === 'pending';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!!errorMessage && <View style={styles.inlineError}><Text style={styles.errorText}>{errorMessage}</Text></View>}
        {!!successMessage && <View style={styles.successBox}><Text style={styles.successText}>{successMessage}</Text></View>}

        <Text style={styles.code}>{report.kode_laporan}</Text>
        <View style={[styles.statusBox, { backgroundColor: status.background }]}>
          <Text style={styles.statusLabel}>Status saat ini</Text>
          <Text style={[styles.statusValue, { color: status.color }]}>{status.label}</Text>
        </View>

        <Text style={styles.sectionTitle}>Informasi laporan</Text>
        <Info label="Kategori" value={categoryName(report.kategori)} />
        <Info label="Pelapor" value={(Array.isArray(report.pelapor) ? report.pelapor[0]?.nama : report.pelapor?.nama) ?? 'Tidak tersedia'} />
        <Info label="Tanggal dikirim" value={formatDateTime(report.created_at)} />
        <Info label="Urgensi menurut pelapor" value={URGENCY_LABEL[report.urgensi_pelapor] ?? report.urgensi_pelapor} />
        <Info label="Deskripsi" value={report.deskripsi} />
        <Info label="Patokan lokasi" value={report.patokan_lokasi} />
        {report.latitude != null && report.longitude != null ? (
          <View style={styles.card}>
            <Text style={styles.infoLabel}>Koordinat GPS</Text>
            <Text style={styles.body}>{report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}</Text>
            {report.akurasi_gps != null && <Text style={styles.muted}>Akurasi ±{Math.round(report.akurasi_gps)} m</Text>}
            <TouchableOpacity onPress={() => void openCoordinates()}><Text style={styles.link}>Buka di Maps</Text></TouchableOpacity>
          </View>
        ) : <Info label="Lokasi GPS" value="Tidak disertakan oleh pelapor" />}

        <Text style={styles.sectionTitle}>Foto laporan</Text>
        {photos.length === 0 ? <Text style={styles.muted}>Tidak ada foto yang tercatat.</Text> : (
          <View style={styles.photoGrid}>{photos.map((photo) => (
            <View key={photo.id} style={styles.photoCard}>
              {photo.url ? <Image source={{ uri: photo.url }} style={styles.photo} resizeMode="cover" /> : <View style={[styles.photo, styles.photoUnavailable]}><Text style={styles.muted}>Foto tidak dapat dimuat</Text></View>}
              <Text style={styles.photoCaption}>{photo.jenis === 'hasil_penanganan' ? 'Foto hasil penanganan' : 'Foto dokumentasi awal'}</Text>
            </View>
          ))}</View>
        )}

        <Text style={styles.sectionTitle}>Verifikasi laporan</Text>
        {canVerify ? (
          <View style={styles.actionBox}>
            {!action ? (
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionButton, styles.verifyButton]} onPress={() => startAction('verified')}>
                  <Text style={styles.verifyText}>Verifikasi</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.infoButton]} onPress={() => startAction('needs_information')}>
                  <Text style={styles.infoText}>Minta informasi</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => startAction('rejected')}>
                  <Text style={styles.rejectText}>Tolak</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={styles.actionTitle}>{ACTION_LABEL[action]}</Text>
                <Text style={styles.hint}>
                  {action === 'verified' ? 'Laporan akan diteruskan ke tahap penilaian prioritas. Catatan bersifat opsional.'
                    : action === 'needs_information' ? 'Tuliskan informasi yang masih dibutuhkan dari pelapor.'
                      : 'Tuliskan alasan penolakan. Alasan ini wajib dan akan tercatat pada riwayat laporan.'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={note}
                  onChangeText={setNote}
                  placeholder={action === 'rejected' ? 'Alasan penolakan (wajib)' : action === 'needs_information' ? 'Informasi yang dibutuhkan (wajib)' : 'Catatan verifikasi (opsional)'}
                  multiline
                  maxLength={1000}
                  editable={!submitting}
                />
                {!!actionError && <Text style={styles.actionError}>{actionError}</Text>}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => setAction(null)} disabled={submitting}>
                    <Text style={styles.cancelText}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.confirmButton, submitting && styles.disabled]} onPress={() => void submitAction()} disabled={submitting}>
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Kirim</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.muted}>Hanya laporan berstatus Pending yang dapat diverifikasi.</Text>
        )}

        {infoRequests.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Permintaan informasi tambahan</Text>
            {infoRequests.map((request) => (
              <View key={request.id} style={styles.card}>
                <Text style={styles.infoLabel}>Diminta {formatDateTime(request.created_at)}</Text>
                <Text style={styles.body}>{request.permintaan}</Text>
                <Text style={styles.infoLabel}>Jawaban pelapor</Text>
                <Text style={styles.body}>{request.jawaban ?? 'Belum dijawab.'}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Riwayat status</Text>
        {history.length === 0 ? <Text style={styles.muted}>Belum ada riwayat status.</Text> : history.map((entry) => (
          <View key={entry.id} style={styles.timelineItem}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineContent}>
              <Text style={styles.historyStatus}>
                {entry.status_lama ? `${statusMeta(entry.status_lama).label} → ` : ''}{statusMeta(entry.status_baru).label}
              </Text>
              <Text style={styles.muted}>{formatDateTime(entry.waktu)}</Text>
              {!!entry.catatan && <Text style={styles.body}>{entry.catatan}</Text>}
            </View>
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.card}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.body}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  link: { color: '#1976D2', fontWeight: '700', marginTop: 9 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: { width: '48%', backgroundColor: '#fff', padding: 6, borderRadius: 9 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 6 },
  photoUnavailable: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  photoCaption: { color: '#475569', fontSize: 12, margin: 6 },
  actionBox: { backgroundColor: '#fff', padding: 14, borderRadius: 11, borderWidth: 1, borderColor: '#E2E8F0' },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionButton: { flexGrow: 1, minWidth: 92, padding: 12, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  verifyButton: { backgroundColor: '#2F855A' },
  verifyText: { color: '#fff', fontWeight: '700' },
  infoButton: { backgroundColor: '#E9D8FD' },
  infoText: { color: '#553C9A', fontWeight: '700' },
  rejectButton: { backgroundColor: '#FED7D7' },
  rejectText: { color: '#9B2C2C', fontWeight: '700' },
  actionTitle: { color: '#1E293B', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  hint: { color: '#64748B', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 9, padding: 12, minHeight: 95, textAlignVertical: 'top', color: '#1E293B' },
  actionError: { color: '#B91C1C', marginTop: 9, lineHeight: 19 },
  cancelButton: { backgroundColor: '#E2E8F0' },
  cancelText: { color: '#334155', fontWeight: '700' },
  confirmButton: { backgroundColor: '#1976D2' },
  confirmText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  successBox: { backgroundColor: '#C6F6D5', padding: 12, borderRadius: 9, marginBottom: 12 },
  successText: { color: '#22543D', lineHeight: 20 },
  inlineError: { backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8, marginBottom: 12 },
  errorTitle: { color: '#1E293B', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  errorText: { color: '#B91C1C', textAlign: 'center', lineHeight: 21 },
  muted: { color: '#64748B', fontSize: 13, lineHeight: 20, marginTop: 6 },
  timelineItem: { flexDirection: 'row', marginBottom: 16 },
  timelineDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#1976D2', marginTop: 4, marginRight: 11 },
  timelineContent: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 9, borderWidth: 1, borderColor: '#E2E8F0' },
  historyStatus: { color: '#1E293B', fontWeight: '700', marginBottom: 5 },
  button: { backgroundColor: '#1976D2', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 9, marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '700' },
  backLink: { color: '#1976D2', fontWeight: '700', marginTop: 16 },
});
