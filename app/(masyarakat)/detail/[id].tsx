import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { priorityMeta, describeError } from '@/lib/laporan-ui';
import { fetchPublishedRab, type RabWithVersion } from '@/lib/rab';
import { RabPanel } from '@/components/RabPanel';
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
};
type HistoryEntry = { id: string; status_lama: StatusLaporanType | null; status_baru: StatusLaporanType; catatan: string | null; waktu: string };
type PhotoEntry = { id: string; path: string; jenis: string };
type PhotoPreview = PhotoEntry & { url: string };
type PriorityPreview = { skor_rekomendasi: number; prioritas_akhir: TingkatType; created_at: string; catatan_override: string | null };
type InfoRequest = { id: string; permintaan: string; jawaban: string | null; created_at: string; dijawab_pada: string | null };

const STATUS: Record<StatusLaporanType, string> = {
  pending: 'Menunggu verifikasi', needs_information: 'Perlu informasi', verified: 'Terverifikasi',
  assigned: 'Ditugaskan', in_progress: 'Sedang ditangani', resolved: 'Selesai', rejected: 'Ditolak',
};
const URGENCY: Record<TingkatType, string> = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi', sangat_tinggi: 'Sangat tinggi' };
const BUCKET = 'foto-laporan';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Tanggal tidak tersedia' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function DetailLaporanScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { session } = useAuth();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [priority, setPriority] = useState<PriorityPreview | null>(null);
  const [rab, setRab] = useState<RabWithVersion | null>(null);
  const [infoRequests, setInfoRequests] = useState<InfoRequest[]>([]);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [submittingAnswerId, setSubmittingAnswerId] = useState('');
  const [infoError, setInfoError] = useState('');
  const [infoSuccess, setInfoSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadDetail = useCallback(async () => {
    if (!id || !session?.user.id) {
      setErrorMessage('Laporan atau sesi pengguna tidak tersedia.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const { data: reportData, error: reportError } = await supabase
        .from('laporan')
        .select('id, kode_laporan, pelapor_id, deskripsi, urgensi_pelapor, latitude, longitude, akurasi_gps, patokan_lokasi, status, created_at, kategori(nama)')
        .eq('id', id)
        .eq('pelapor_id', session.user.id)
        .maybeSingle();
      if (reportError) throw reportError;
      if (!reportData) {
        setErrorMessage('Laporan tidak ditemukan atau Anda tidak memiliki akses ke laporan ini.');
        setLoading(false);
        return;
      }
      const { data: historyData, error: historyError } = await supabase
        .from('riwayat_status')
        .select('id, status_lama, status_baru, catatan, waktu')
        .eq('laporan_id', id)
        .order('waktu', { ascending: true });
      if (historyError) throw historyError;

      const { data: photoData, error: photoError } = await supabase
        .from('foto_laporan')
        .select('id, path, jenis')
        .eq('laporan_id', id)
        .order('uploaded_at', { ascending: true });
      if (photoError) throw photoError;

      const { data: priorityData, error: priorityError } = await supabase
        .from('penilaian_prioritas')
        .select('skor_rekomendasi, prioritas_akhir, created_at, catatan_override')
        .eq('laporan_id', id)
        .maybeSingle();
      if (priorityError) throw priorityError;

      const { data: infoData, error: infoErrorResult } = await supabase
        .from('informasi_tambahan')
        .select('id, permintaan, jawaban, created_at, dijawab_pada')
        .eq('laporan_id', id)
        .order('created_at', { ascending: true });
      if (infoErrorResult) throw infoErrorResult;

      let rabData: RabWithVersion | null = null;
      try {
        rabData = await fetchPublishedRab(id);
      } catch (rabError) {
        console.warn('[DetailLaporan] RAB unavailable:', rabError);
      }

      const photoRows = (photoData ?? []) as PhotoEntry[];
      const previews = await Promise.all(photoRows.map(async (photo) => {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(photo.path, 60 * 30);
        if (error) {
          console.warn('[DetailLaporan] Could not create photo URL:', error.message);
          return { ...photo, url: '' };
        }
        return { ...photo, url: data.signedUrl };
      }));

      setReport(reportData as unknown as ReportDetail);
      setHistory((historyData ?? []) as HistoryEntry[]);
      setPhotos(previews);
      setPriority((priorityData as unknown as PriorityPreview) ?? null);
      setRab(rabData);
      setInfoRequests((infoData ?? []) as InfoRequest[]);
    } catch (error) {
      console.error('[DetailLaporan] Failed to load report detail:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Gagal memuat detail laporan.');
    } finally {
      setLoading(false);
    }
  }, [id, session?.user.id]);

  React.useEffect(() => { void loadDetail(); }, [loadDetail]);

  async function submitAnswer(requestId: string) {
    const draft = (answerDrafts[requestId] ?? '').trim();
    if (!draft) {
      setInfoError('Jawaban wajib diisi sebelum dikirim.');
      return;
    }
    setSubmittingAnswerId(requestId);
    setInfoError('');
    setInfoSuccess('');
    try {
      const { error } = await supabase.rpc('jawab_informasi_tambahan', {
        p_permintaan_id: requestId,
        p_jawaban: draft,
      });
      if (error) throw error;
      setAnswerDrafts((current) => {
        const next = { ...current };
        delete next[requestId];
        return next;
      });
      setInfoSuccess('Jawaban berhasil dikirim. Laporan kembali menunggu verifikasi admin.');
      await loadDetail();
    } catch (error) {
      console.error('[DetailLaporan] Failed to answer information request:', error);
      setInfoError(describeError(error));
    } finally {
      setSubmittingAnswerId('');
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
      setErrorMessage('Gagal membuka tautan peta. Coba lagi dari perangkat.');
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1976D2" /><Text style={styles.muted}>Memuat detail laporan…</Text></View>;
  if (errorMessage && !report) return <View style={styles.center}><Text style={styles.errorTitle}>Detail belum dapat ditampilkan</Text><Text style={styles.errorText}>{errorMessage}</Text><TouchableOpacity style={styles.button} onPress={() => void loadDetail()}><Text style={styles.buttonText}>Coba lagi</Text></TouchableOpacity><TouchableOpacity onPress={() => router.back()}><Text style={styles.backLink}>Kembali</Text></TouchableOpacity></View>;
  if (!report) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!!errorMessage && <View style={styles.inlineError}><Text style={styles.errorText}>{errorMessage}</Text></View>}
      <Text style={styles.code}>{report.kode_laporan}</Text>
      <View style={styles.statusBox}><Text style={styles.statusLabel}>Status saat ini</Text><Text style={styles.statusValue}>{STATUS[report.status] ?? report.status}</Text></View>
      {report.status === 'needs_information' && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>Admin meminta informasi tambahan. Lengkapi jawaban pada bagian “Permintaan informasi dari admin” di bawah.</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Informasi laporan</Text>
      <Info label="Kategori" value={(Array.isArray(report.kategori) ? report.kategori[0]?.nama : report.kategori?.nama) ?? 'Tidak tersedia'} />
      <Info label="Tanggal dikirim" value={formatDate(report.created_at)} />
      <Info label="Urgensi pelapor" value={URGENCY[report.urgensi_pelapor] ?? report.urgensi_pelapor} />
      <Info label="Deskripsi" value={report.deskripsi} />
      <Info label="Patokan lokasi" value={report.patokan_lokasi} />
      {report.latitude != null && report.longitude != null ? (
        <View style={styles.locationBox}>
          <Text style={styles.body}>Koordinat: {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}</Text>
          {report.akurasi_gps != null && <Text style={styles.muted}>Akurasi ±{Math.round(report.akurasi_gps)} m</Text>}
          <TouchableOpacity onPress={() => void openCoordinates()}><Text style={styles.link}>Buka lokasi di peta</Text></TouchableOpacity>
        </View>
      ) : <Info label="Lokasi GPS" value="Tidak disertakan" />}

      <Text style={styles.sectionTitle}>Foto laporan</Text>
      {photos.length === 0 ? <Text style={styles.muted}>Belum ada foto yang tercatat.</Text> : (
        <View style={styles.photoGrid}>{photos.map((photo) => (
          <View key={photo.id} style={styles.photoCard}>
            {photo.url ? <Image source={{ uri: photo.url }} style={styles.photo} resizeMode="cover" /> : <View style={[styles.photo, styles.photoUnavailable]}><Text style={styles.muted}>Foto tidak dapat dimuat</Text></View>}
            <Text style={styles.photoCaption}>{photo.jenis === 'hasil_penanganan' ? 'Foto hasil' : 'Foto awal'}</Text>
          </View>
        ))}</View>
      )}

      <Text style={styles.sectionTitle}>Prioritas penanganan</Text>
      {priority ? (
        <View style={styles.locationBox}>
          <Text style={styles.statusLabel}>Prioritas yang ditetapkan admin</Text>
          <Text style={[styles.priorityValue, { color: priorityMeta(priority.prioritas_akhir).color }]}>
            {priorityMeta(priority.prioritas_akhir).label}
          </Text>
          <Text style={styles.body}>Skor penilaian: {Number(priority.skor_rekomendasi).toFixed(2)} dari 5,00</Text>
          {!!priority.catatan_override && (
            <Text style={styles.body}>Alasan penetapan admin: {priority.catatan_override}</Text>
          )}
          <Text style={styles.muted}>Dinilai {formatDate(priority.created_at)}. Keputusan akhir tetap pada pihak berwenang.</Text>
        </View>
      ) : (
        <Text style={styles.muted}>Prioritas belum ditetapkan. Admin akan menilai setelah laporan diverifikasi.</Text>
      )}

      <Text style={styles.sectionTitle}>Rencana Anggaran Biaya (RAB)</Text>
      <RabPanel data={rab} />

      {infoRequests.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Permintaan informasi dari admin</Text>
          {!!infoError && <View style={styles.inlineError}><Text style={styles.errorText}>{infoError}</Text></View>}
          {!!infoSuccess && <View style={styles.successBox}><Text style={styles.successText}>{infoSuccess}</Text></View>}
          {infoRequests.map((request) => (
            <View key={request.id} style={styles.requestBox}>
              <Text style={styles.requestMeta}>Diminta {formatDate(request.created_at)}</Text>
              <Text style={styles.body}>{request.permintaan}</Text>
              {request.jawaban ? (
                <View style={styles.answerBox}>
                  <Text style={styles.infoLabel}>Jawaban Anda</Text>
                  <Text style={styles.body}>{request.jawaban}</Text>
                  {!!request.dijawab_pada && <Text style={styles.muted}>Dikirim {formatDate(request.dijawab_pada)}</Text>}
                </View>
              ) : report.status === 'needs_information' ? (
                <View>
                  <Text style={styles.infoLabel}>Jawaban Anda (wajib)</Text>
                  <TextInput
                    style={styles.answerInput}
                    value={answerDrafts[request.id] ?? ''}
                    onChangeText={(text) => setAnswerDrafts((current) => ({ ...current, [request.id]: text }))}
                    placeholder="Tuliskan informasi yang diminta admin"
                    multiline
                    maxLength={1500}
                    editable={submittingAnswerId !== request.id}
                  />
                  <TouchableOpacity
                    style={[styles.answerButton, submittingAnswerId === request.id && styles.answerButtonDisabled]}
                    onPress={() => void submitAnswer(request.id)}
                    disabled={submittingAnswerId === request.id}
                  >
                    {submittingAnswerId === request.id
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.answerButtonText}>Kirim jawaban</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.muted}>Belum dijawab. Permintaan hanya dapat dijawab saat status laporan “Perlu informasi”.</Text>
              )}
            </View>
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>Riwayat status</Text>
      {history.length === 0 ? <Text style={styles.muted}>Riwayat status belum tersedia.</Text> : history.map((entry) => (
        <View key={entry.id} style={styles.timelineItem}>
          <View style={styles.timelineDot} />
          <View style={styles.timelineContent}>
            <Text style={styles.historyStatus}>{entry.status_lama ? `${STATUS[entry.status_lama]} → ` : ''}{STATUS[entry.status_baru] ?? entry.status_baru}</Text>
            <Text style={styles.muted}>{formatDate(entry.waktu)}</Text>
            {!!entry.catatan && <Text style={styles.body}>{entry.catatan}</Text>}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.body}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 36 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, backgroundColor: '#F4F7FB' },
  code: { color: '#1E293B', fontSize: 20, fontWeight: '800', marginBottom: 14 },
  statusBox: { backgroundColor: '#EAF3FF', padding: 15, borderRadius: 12, borderColor: '#BFDBFE', borderWidth: 1 },
  statusLabel: { color: '#475569', fontSize: 13 },
  statusValue: { color: '#1259A7', fontWeight: '800', fontSize: 17, marginTop: 4 },
  sectionTitle: { color: '#1E293B', fontWeight: '800', fontSize: 17, marginTop: 24, marginBottom: 10 },
  info: { backgroundColor: '#fff', padding: 13, borderRadius: 9, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  infoLabel: { color: '#64748B', fontSize: 12, marginBottom: 5 },
  body: { color: '#334155', fontSize: 14, lineHeight: 21 },
  locationBox: { backgroundColor: '#fff', padding: 13, borderRadius: 9, marginTop: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  link: { color: '#1976D2', fontWeight: '700', marginTop: 9 },
  priorityValue: { fontSize: 19, fontWeight: '800', marginVertical: 6 },
  warningBox: { backgroundColor: '#FEFCBF', borderWidth: 1, borderColor: '#D69E2E', borderRadius: 10, padding: 12, marginTop: 12 },
  warningText: { color: '#7B341E', fontSize: 13, lineHeight: 20 },
  requestBox: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 13, marginBottom: 10 },
  requestMeta: { color: '#64748B', fontSize: 12, marginBottom: 6 },
  answerBox: { backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10, marginTop: 10 },
  answerInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 9, padding: 11, minHeight: 85, textAlignVertical: 'top', color: '#1E293B', marginTop: 4 },
  answerButton: { backgroundColor: '#1976D2', borderRadius: 9, padding: 13, alignItems: 'center', marginTop: 10 },
  answerButtonDisabled: { opacity: 0.6 },
  answerButtonText: { color: '#fff', fontWeight: '700' },
  successBox: { backgroundColor: '#C6F6D5', padding: 11, borderRadius: 8, marginBottom: 10 },
  successText: { color: '#22543D', lineHeight: 20 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: { width: '48%', backgroundColor: '#fff', padding: 6, borderRadius: 9 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 6 },
  photoUnavailable: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  photoCaption: { color: '#475569', fontSize: 12, margin: 6 },
  timelineItem: { flexDirection: 'row', marginBottom: 16 },
  timelineDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#1976D2', marginTop: 4, marginRight: 11 },
  timelineContent: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 9, borderWidth: 1, borderColor: '#E2E8F0' },
  historyStatus: { color: '#1E293B', fontWeight: '700', marginBottom: 5 },
  muted: { color: '#64748B', fontSize: 13, lineHeight: 20, marginTop: 6 },
  errorTitle: { color: '#1E293B', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  errorText: { color: '#B91C1C', textAlign: 'center', lineHeight: 21 },
  button: { backgroundColor: '#1976D2', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 9, marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '700' },
  backLink: { color: '#1976D2', fontWeight: '700', marginTop: 16 },
  inlineError: { backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8, marginBottom: 12 },
});
