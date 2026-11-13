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
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AdminPageHeader, AdminSectionTitle, AdminShell } from '@/components/admin/AdminShell';
import { ADMIN_COLORS as C } from '@/lib/theme';
import {
  DEFAULT_KONFIGURASI_PRIORITAS,
  PRIORITY_META,
  categoryName,
  describeError,
  formatDateTime,
  hitungSkorPrioritas,
  priorityMeta,
  rekomendasiPrioritas,
  statusMeta,
} from '@/lib/laporan-ui';
import type { KonfigurasiPrioritas } from '@/lib/laporan-ui';
import { fetchRabForAdmin, type RabForAdmin } from '@/lib/rab';
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
type Criteria = { bahaya: number; dampak: number; keparahan: number; frekuensi: number };
type PriorityRow = {
  tingkat_bahaya: number;
  dampak_masyarakat: number;
  tingkat_keparahan: number;
  frekuensi_laporan: number;
  skor_rekomendasi: number;
  prioritas_akhir: TingkatType;
  created_at: string;
  catatan_override: string | null;
};
type AssignmentRow = {
  id: string;
  petugas_id: string;
  waktu_penugasan: string;
  petugas: { nama: string } | { nama: string }[] | null;
};
type Officer = { id: string; nama: string };

const URGENCY_LABEL: Record<TingkatType, string> = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi', sangat_tinggi: 'Sangat tinggi' };
const ACTION_LABEL: Record<Action, string> = {
  verified: 'Verifikasi laporan',
  needs_information: 'Minta informasi tambahan',
  rejected: 'Tolak laporan',
};
const CRITERIA: { key: keyof Criteria; label: string; weightKey: keyof KonfigurasiPrioritas }[] = [
  { key: 'bahaya', label: 'Tingkat bahaya', weightKey: 'bobot_bahaya' },
  { key: 'dampak', label: 'Dampak terhadap masyarakat', weightKey: 'bobot_dampak' },
  { key: 'keparahan', label: 'Tingkat keparahan', weightKey: 'bobot_keparahan' },
  { key: 'frekuensi', label: 'Frekuensi laporan lokasi sama', weightKey: 'bobot_frekuensi' },
];

export default function DetailLaporanAdminScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;

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

  const [config, setConfig] = useState<KonfigurasiPrioritas>(DEFAULT_KONFIGURASI_PRIORITAS);
  const [priority, setPriority] = useState<PriorityRow | null>(null);
  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);
  const [rab, setRab] = useState<RabForAdmin | null>(null);
  const [priorityFormOpen, setPriorityFormOpen] = useState(false);
  const [criteria, setCriteria] = useState<Criteria>({ bahaya: 3, dampak: 3, keparahan: 3, frekuensi: 3 });
  const [finalPriority, setFinalPriority] = useState<TingkatType>('sedang');
  const [priorityOverridden, setPriorityOverridden] = useState(false);
  const [savingPriority, setSavingPriority] = useState(false);
  const [priorityError, setPriorityError] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loadingOfficers, setLoadingOfficers] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');

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

      const [historyResult, photoResult, infoResult, priorityResult, assignmentResult, configResult, rabResult] = await Promise.all([
        supabase.from('riwayat_status').select('id, status_lama, status_baru, catatan, waktu').eq('laporan_id', id).order('waktu', { ascending: true }),
        supabase.from('foto_laporan').select('id, path, jenis').eq('laporan_id', id).order('uploaded_at', { ascending: true }),
        supabase.from('informasi_tambahan').select('id, permintaan, jawaban, created_at, dijawab_pada').eq('laporan_id', id).order('created_at', { ascending: true }),
        supabase.from('penilaian_prioritas').select('tingkat_bahaya, dampak_masyarakat, tingkat_keparahan, frekuensi_laporan, skor_rekomendasi, prioritas_akhir, created_at, catatan_override').eq('laporan_id', id).maybeSingle(),
        supabase.from('penugasan').select('id, petugas_id, waktu_penugasan, petugas:profiles!penugasan_petugas_id_fkey(nama)').eq('laporan_id', id).maybeSingle(),
        supabase.from('konfigurasi_prioritas').select('bobot_bahaya, bobot_dampak, bobot_keparahan, bobot_frekuensi, ambang_rendah_max, ambang_sedang_max, ambang_tinggi_max').eq('id', 1).maybeSingle(),
        fetchRabForAdmin(id),
      ]);
      if (historyResult.error) throw historyResult.error;
      if (photoResult.error) throw photoResult.error;
      if (infoResult.error) throw infoResult.error;
      if (priorityResult.error) throw priorityResult.error;
      if (assignmentResult.error) throw assignmentResult.error;
      if (configResult.error) {
        console.warn('[DetailAdmin] Priority configuration unavailable, using defaults:', configResult.error.message);
      }

      if (configResult.data) {
        const raw = configResult.data as unknown as KonfigurasiPrioritas;
        setConfig({
          bobot_bahaya: Number(raw.bobot_bahaya),
          bobot_dampak: Number(raw.bobot_dampak),
          bobot_keparahan: Number(raw.bobot_keparahan),
          bobot_frekuensi: Number(raw.bobot_frekuensi),
          ambang_rendah_max: Number(raw.ambang_rendah_max),
          ambang_sedang_max: Number(raw.ambang_sedang_max),
          ambang_tinggi_max: Number(raw.ambang_tinggi_max),
        });
      }

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
      setPriority((priorityResult.data as unknown as PriorityRow) ?? null);
      setAssignment((assignmentResult.data as unknown as AssignmentRow) ?? null);
      setRab(rabResult);
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

  function openPriorityForm() {
    const initial: Criteria = { bahaya: 3, dampak: 3, keparahan: 3, frekuensi: 3 };
    setCriteria(initial);
    setFinalPriority(rekomendasiPrioritas(hitungSkorPrioritas(initial, config), config));
    setPriorityOverridden(false);
    setOverrideReason('');
    setPriorityError('');
    setSuccessMessage('');
    setPriorityFormOpen(true);
  }

  function updateCriterion(key: keyof Criteria, value: number) {
    const next = { ...criteria, [key]: value };
    setCriteria(next);
    if (!priorityOverridden) {
      setFinalPriority(rekomendasiPrioritas(hitungSkorPrioritas(next, config), config));
    }
  }

  function chooseFinalPriority(level: TingkatType, recommendation: TingkatType) {
    setFinalPriority(level);
    setPriorityOverridden(level !== recommendation);
    if (level === recommendation) setOverrideReason('');
  }

  async function submitPriority() {
    if (!id) return;
    if (priorityOverridden && !overrideReason.trim()) {
      setPriorityError('Alasan perbedaan prioritas wajib diisi.');
      return;
    }
    setSavingPriority(true);
    setPriorityError('');
    setSuccessMessage('');
    try {
      const { error } = await supabase.rpc('simpan_penilaian_prioritas', {
        p_laporan_id: id,
        p_bahaya: criteria.bahaya,
        p_dampak: criteria.dampak,
        p_keparahan: criteria.keparahan,
        p_frekuensi: criteria.frekuensi,
        p_prioritas_akhir: finalPriority,
        p_catatan_override: priorityOverridden ? overrideReason.trim() : null,
      });
      if (error) throw error;
      setPriorityFormOpen(false);
      setOverrideReason('');
      setSuccessMessage('Penilaian prioritas berhasil disimpan.');
      await loadDetail();
    } catch (error) {
      console.error('[DetailAdmin] Priority assessment failed:', error);
      setPriorityError(describeError(error));
    } finally {
      setSavingPriority(false);
    }
  }

  async function openAssignmentForm() {
    setAssignmentOpen(true);
    setAssignmentError('');
    setSuccessMessage('');
    if (officers.length > 0) return;
    setLoadingOfficers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nama')
        .eq('peran', 'petugas')
        .order('nama', { ascending: true });
      if (error) throw error;
      setOfficers((data ?? []) as Officer[]);
    } catch (error) {
      console.error('[DetailAdmin] Failed to load officers:', error);
      setAssignmentError(describeError(error));
    } finally {
      setLoadingOfficers(false);
    }
  }

  async function submitAssignment() {
    if (!id || !selectedOfficer) {
      setAssignmentError('Pilih petugas terlebih dahulu.');
      return;
    }
    setSavingAssignment(true);
    setAssignmentError('');
    setSuccessMessage('');
    try {
      const { error } = await supabase.rpc('tugaskan_petugas', {
        p_laporan_id: id,
        p_petugas_id: selectedOfficer,
      });
      if (error) throw error;
      setAssignmentOpen(false);
      setSelectedOfficer('');
      setSuccessMessage('Laporan berhasil ditugaskan ke petugas.');
      await loadDetail();
    } catch (error) {
      console.error('[DetailAdmin] Assignment failed:', error);
      setAssignmentError(describeError(error));
    } finally {
      setSavingAssignment(false);
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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /><Text style={styles.muted}>Memuat detail laporan…</Text></View>;
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
  const previewScore = hitungSkorPrioritas(criteria, config);
  const previewRecommendation = rekomendasiPrioritas(previewScore, config);
  const canAssess = report.status === 'verified' && !priority;
  const canAssign = report.status === 'verified' && !!priority && !assignment;
  const assignedOfficerName = assignment
    ? (Array.isArray(assignment.petugas) ? assignment.petugas[0]?.nama : assignment.petugas?.nama) ?? 'Petugas'
    : null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AdminShell
        section="daftar-laporan"
        label="Detail Laporan"
        header={(
          <AdminPageHeader
            eyebrow="TINDAK LANJUT LAPORAN"
            title={report.kode_laporan}
            subtitle={categoryName(report.kategori)}
            note="Periksa rincian laporan, tentukan tindak lanjut, lalu kelola RAB bila diperlukan."
            accessory={(
              <TouchableOpacity style={styles.backChip} accessibilityRole="button" accessibilityLabel="Kembali ke daftar laporan" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/daftar-laporan'))}>
                <Text style={styles.backChipText}>‹ Kembali</Text>
              </TouchableOpacity>
            )}
          />
        )}
      >
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]} keyboardShouldPersistTaps="handled">
        {!!errorMessage && <View style={styles.inlineError}><Text style={styles.errorText}>{errorMessage}</Text></View>}
        {!!successMessage && <View style={styles.successBox}><Text style={styles.successText}>{successMessage}</Text></View>}

        <View style={[styles.columns, desktop && styles.columnsDesktop]}>
          <View style={[styles.columnMain, desktop && styles.columnMainDesktop]}>
        <View style={[styles.statusBox, { backgroundColor: status.background }]}>
          <Text style={styles.statusLabel}>Status saat ini</Text>
          <Text style={[styles.statusValue, { color: status.color }]}>{status.label}</Text>
        </View>

        <AdminSectionTitle>Informasi laporan</AdminSectionTitle>
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

        <AdminSectionTitle>Foto laporan</AdminSectionTitle>
        {photos.length === 0 ? <Text style={styles.muted}>Tidak ada foto yang tercatat.</Text> : (
          <View style={styles.photoGrid}>{photos.map((photo) => (
            <View key={photo.id} style={styles.photoCard}>
              {photo.url ? <Image source={{ uri: photo.url }} style={styles.photo} resizeMode="cover" /> : <View style={[styles.photo, styles.photoUnavailable]}><Text style={styles.muted}>Foto tidak dapat dimuat</Text></View>}
              <Text style={styles.photoCaption}>{photo.jenis === 'hasil_penanganan' ? 'Foto hasil penanganan' : 'Foto dokumentasi awal'}</Text>
            </View>
          ))}</View>
        )}
          </View>

          <View style={[styles.columnSide, desktop && styles.columnSideDesktop]}>
        <AdminSectionTitle>Verifikasi laporan</AdminSectionTitle>
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
                    {submitting ? <ActivityIndicator color={C.onPrimary} /> : <Text style={styles.confirmText}>Kirim</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.muted}>Hanya laporan berstatus Pending yang dapat diverifikasi.</Text>
        )}

        <AdminSectionTitle>Penilaian prioritas</AdminSectionTitle>
        {priority ? (
          <View style={styles.card}>
            {CRITERIA.map((criterion) => (
              <View key={criterion.key} style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>{criterion.label}</Text>
                <Text style={styles.scoreValue}>{priority[criterion.key === 'bahaya' ? 'tingkat_bahaya' : criterion.key === 'dampak' ? 'dampak_masyarakat' : criterion.key === 'keparahan' ? 'tingkat_keparahan' : 'frekuensi_laporan']} / 5</Text>
              </View>
            ))}
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Skor rekomendasi</Text>
              <Text style={styles.scoreValue}>{Number(priority.skor_rekomendasi).toFixed(2)}</Text>
            </View>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Rekomendasi sistem</Text>
              <Text style={[styles.scoreValue, { color: priorityMeta(rekomendasiPrioritas(Number(priority.skor_rekomendasi), config)).color }]}>
                {priorityMeta(rekomendasiPrioritas(Number(priority.skor_rekomendasi), config)).label}
              </Text>
            </View>
            <View style={[styles.finalPriority, { backgroundColor: priorityMeta(priority.prioritas_akhir).background }]}>
              <Text style={styles.finalPriorityLabel}>Prioritas akhir admin</Text>
              <Text style={[styles.finalPriorityValue, { color: priorityMeta(priority.prioritas_akhir).color }]}>{priorityMeta(priority.prioritas_akhir).label}</Text>
              {priority.prioritas_akhir !== rekomendasiPrioritas(Number(priority.skor_rekomendasi), config) && (
                <Text style={styles.overrideNote}>
                  Berbeda dari rekomendasi sistem ({priorityMeta(rekomendasiPrioritas(Number(priority.skor_rekomendasi), config)).label}), sesuai keputusan admin.
                </Text>
              )}
              {!!priority.catatan_override && (
                <Text style={styles.overrideNote}>Alasan admin: {priority.catatan_override}</Text>
              )}
            </View>
            <Text style={styles.muted}>Dinilai {formatDateTime(priority.created_at)}. Prioritas yang sudah ditetapkan tidak dapat diubah.</Text>
          </View>
        ) : canAssess ? (
          <View style={styles.actionBox}>
            {!priorityFormOpen ? (
              <>
                <Text style={styles.hint}>Nilai empat kriteria (skala 1–5). Bobot: bahaya 40%, dampak 30%, keparahan 20%, frekuensi 10%. Sistem memberi rekomendasi; prioritas akhir tetap ditetapkan admin.</Text>
                <TouchableOpacity style={[styles.actionButton, styles.confirmButton]} onPress={openPriorityForm}>
                  <Text style={styles.confirmText}>Nilai prioritas</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View>
                <Text style={styles.actionTitle}>Form penilaian prioritas</Text>
                {CRITERIA.map((criterion) => (
                  <View key={criterion.key} style={styles.criteriaBlock}>
                    <Text style={styles.criteriaLabel}>{criterion.label} ({Math.round(config[criterion.weightKey] * 100)}%)</Text>
                    <View style={styles.criteriaOptions}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <TouchableOpacity
                          key={value}
                          accessibilityRole="button"
                          accessibilityState={{ selected: criteria[criterion.key] === value }}
                          style={[styles.criteriaChip, criteria[criterion.key] === value && styles.criteriaChipActive]}
                          onPress={() => updateCriterion(criterion.key, value)}
                          disabled={savingPriority}
                        >
                          <Text style={[styles.criteriaChipText, criteria[criterion.key] === value && styles.criteriaChipTextActive]}>{value}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}

                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>Skor berbobot</Text>
                  <Text style={styles.previewValue}>{previewScore.toFixed(2)}</Text>
                  <Text style={styles.previewLabel}>Rekomendasi sistem: <Text style={{ color: priorityMeta(previewRecommendation).color, fontWeight: '800' }}>{priorityMeta(previewRecommendation).label}</Text></Text>
                  {finalPriority !== previewRecommendation && (
                    <Text style={styles.overrideWarning}>
                      Prioritas akhir berbeda dari rekomendasi sistem. Pilihan ini akan tercatat sebagai keputusan admin.
                    </Text>
                  )}
                </View>

                <Text style={styles.criteriaLabel}>Prioritas akhir (dapat berbeda dari rekomendasi)</Text>
                <View style={styles.priorityChoices}>
                  {(Object.keys(PRIORITY_META) as TingkatType[]).map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.priorityChip, finalPriority === level && { backgroundColor: PRIORITY_META[level].background, borderColor: PRIORITY_META[level].color }]}
                      onPress={() => chooseFinalPriority(level, previewRecommendation)}
                      disabled={savingPriority}
                    >
                      <Text style={[styles.priorityChipText, finalPriority === level && { color: PRIORITY_META[level].color, fontWeight: '800' }]}>{PRIORITY_META[level].label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {priorityOverridden && (
                  <View style={styles.overrideInputBox}>
                    <Text style={styles.criteriaLabel}>Alasan perbedaan prioritas (wajib)</Text>
                    <TextInput
                      style={styles.overrideInput}
                      value={overrideReason}
                      onChangeText={setOverrideReason}
                      placeholder="Jelaskan alasan admin menetapkan prioritas berbeda dari rekomendasi sistem"
                      multiline
                      maxLength={500}
                      editable={!savingPriority}
                    />
                    <Text style={styles.overrideHint}>Alasan ini akan tercatat dan terlihat oleh pelapor.</Text>
                  </View>
                )}

                {!!priorityError && <Text style={styles.actionError}>{priorityError}</Text>}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => setPriorityFormOpen(false)} disabled={savingPriority}>
                    <Text style={styles.cancelText}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.confirmButton, savingPriority && styles.disabled]} onPress={() => void submitPriority()} disabled={savingPriority}>
                    {savingPriority ? <ActivityIndicator color={C.onPrimary} /> : <Text style={styles.confirmText}>Simpan penilaian</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.muted}>
            {report.status === 'pending' ? 'Verifikasi laporan terlebih dahulu sebelum menilai prioritas.' : 'Penilaian prioritas belum tersedia pada status ini.'}
          </Text>
        )}

        <AdminSectionTitle>Penugasan petugas</AdminSectionTitle>
        {assignment ? (
          <View style={styles.card}>
            <View style={styles.scoreRow}><Text style={styles.scoreLabel}>Petugas</Text><Text style={styles.scoreValue}>{assignedOfficerName}</Text></View>
            <View style={styles.scoreRow}><Text style={styles.scoreLabel}>Ditugaskan</Text><Text style={styles.scoreValue}>{formatDateTime(assignment.waktu_penugasan)}</Text></View>
            <Text style={styles.muted}>Satu laporan hanya ditangani oleh satu petugas.</Text>
          </View>
        ) : canAssign ? (
          <View style={styles.actionBox}>
            {!assignmentOpen ? (
              <>
                <Text style={styles.hint}>Pilih satu petugas lapangan untuk menangani laporan ini. Status akan berubah menjadi Ditugaskan.</Text>
                <TouchableOpacity style={[styles.actionButton, styles.confirmButton]} onPress={() => void openAssignmentForm()}>
                  <Text style={styles.confirmText}>Tugaskan petugas</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View>
                <Text style={styles.actionTitle}>Pilih petugas</Text>
                {loadingOfficers ? <ActivityIndicator color={C.primary} /> : officers.length === 0 ? (
                  <Text style={styles.muted}>Belum ada akun petugas. Minta admin membuat akun petugas terlebih dahulu.</Text>
                ) : (
                  <View style={styles.officerList}>
                    {officers.map((officer) => (
                      <TouchableOpacity
                        key={officer.id}
                        style={[styles.officerChip, selectedOfficer === officer.id && styles.officerChipActive]}
                        onPress={() => setSelectedOfficer(officer.id)}
                        disabled={savingAssignment}
                      >
                        <Text style={[styles.officerText, selectedOfficer === officer.id && styles.officerTextActive]}>{officer.nama}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {!!assignmentError && <Text style={styles.actionError}>{assignmentError}</Text>}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => setAssignmentOpen(false)} disabled={savingAssignment}>
                    <Text style={styles.cancelText}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.confirmButton, (savingAssignment || officers.length === 0) && styles.disabled]}
                    onPress={() => void submitAssignment()}
                    disabled={savingAssignment || officers.length === 0}
                  >
                    {savingAssignment ? <ActivityIndicator color={C.onPrimary} /> : <Text style={styles.confirmText}>Tugaskan</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.muted}>
            {report.status === 'pending'
              ? 'Verifikasi laporan dan tetapkan prioritas sebelum menugaskan petugas.'
              : report.status === 'verified'
                ? 'Tetapkan prioritas terlebih dahulu sebelum menugaskan petugas.'
                : assignment ? '' : 'Penugasan tidak dapat dilakukan pada status ini.'}
          </Text>
        )}

        {infoRequests.length > 0 && (
          <>
            <AdminSectionTitle>Permintaan informasi tambahan</AdminSectionTitle>
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

        <AdminSectionTitle>RAB (Rencana Anggaran Biaya)</AdminSectionTitle>
        {rab ? (
          <View style={styles.card}>
            <Text style={styles.body}>Nomor: {rab.rab.nomor_rab} · {rab.rab.status === 'published' ? 'Published' : 'Draft'}</Text>
            <Text style={styles.body}>Judul: {rab.rab.judul}</Text>
            <TouchableOpacity style={[styles.actionButton, styles.confirmButton]} onPress={() => router.push({ pathname: '/(admin)/kelola-rab/[id]', params: { id: report.id } })}>
              <Text style={styles.confirmText}>{rab.rab.status === 'published' ? 'Kelola / revisi RAB' : 'Lanjutkan RAB'}</Text>
            </TouchableOpacity>
          </View>
        ) : report.status === 'verified' || report.status === 'assigned' || report.status === 'in_progress' || report.status === 'resolved' ? (
          <View style={styles.actionBox}>
            <Text style={styles.hint}>Belum ada RAB untuk laporan ini.</Text>
            <TouchableOpacity style={[styles.actionButton, styles.confirmButton]} onPress={() => router.push({ pathname: '/(admin)/kelola-rab/[id]', params: { id: report.id } })}>
              <Text style={styles.confirmText}>Buat RAB</Text>
            </TouchableOpacity>
          </View>
        ) : <Text style={styles.muted}>RAB dapat dibuat setelah laporan diverifikasi.</Text>}

        </View>
        </View>

        <AdminSectionTitle>Riwayat status</AdminSectionTitle>
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
      </AdminShell>
    </KeyboardAvoidingView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.card}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.body}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.background },
  container: { flex: 1, backgroundColor: C.background },
  content: { padding: 20, paddingBottom: 40, backgroundColor: C.background },
  contentDesktop: { paddingHorizontal: 28, paddingTop: 24 },
  columns: { gap: 0 },
  columnsDesktop: { flexDirection: 'row', alignItems: 'flex-start', gap: 22 },
  columnMain: { minWidth: 0 },
  columnMainDesktop: { flex: 1.15 },
  columnSide: { minWidth: 0 },
  columnSideDesktop: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, backgroundColor: C.background },
  code: { color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 14 },
  statusBox: { padding: 16, borderRadius: 12, marginTop: 22 },
  statusLabel: { color: '#475569', fontSize: 12, letterSpacing: 0.2 },
  statusValue: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  sectionTitle: { color: C.text, fontWeight: '800', fontSize: 17, marginTop: 24, marginBottom: 10 },
  card: { backgroundColor: C.surface, padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  infoLabel: { color: C.textSubtle, fontSize: 11.5, marginBottom: 5, marginTop: 4, letterSpacing: 0.2 },
  body: { color: C.textBody, fontSize: 14, lineHeight: 21 },
  link: { color: C.primary, fontWeight: '700', marginTop: 9 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: { width: '48%', backgroundColor: C.surface, padding: 7, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 8 },
  photoUnavailable: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  photoCaption: { color: C.textSubtle, fontSize: 12, margin: 6, lineHeight: 17 },
  actionBox: { backgroundColor: C.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionButton: { flexGrow: 1, minWidth: 92, minHeight: 44, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  verifyButton: { backgroundColor: C.primary },
  verifyText: { color: C.onPrimary, fontWeight: '700' },
  infoButton: { backgroundColor: C.warningSoft, borderWidth: 1, borderColor: '#EBDDBF' },
  infoText: { color: C.warningText, fontWeight: '700' },
  rejectButton: { backgroundColor: C.dangerSoft, borderWidth: 1, borderColor: C.dangerBorder },
  rejectText: { color: C.dangerText, fontWeight: '700' },
  actionTitle: { color: C.text, fontSize: 15, fontWeight: '800', marginBottom: 6 },
  hint: { color: C.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  input: { backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.borderInput, borderRadius: 9, padding: 12, minHeight: 95, textAlignVertical: 'top', color: C.text },
  actionError: { color: C.danger, marginTop: 9, lineHeight: 19 },
  cancelButton: { backgroundColor: C.surfaceMuted, borderWidth: 1, borderColor: C.border },
  cancelText: { color: C.textBody, fontWeight: '700' },
  confirmButton: { backgroundColor: C.primary },
  confirmText: { color: C.onPrimary, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  successBox: { backgroundColor: C.successSoft, padding: 12, borderRadius: 9, marginTop: 16, borderWidth: 1, borderColor: C.primarySoftBorder },
  successText: { color: C.successText, lineHeight: 20 },
  inlineError: { backgroundColor: C.dangerSoft, padding: 12, borderRadius: 9, marginTop: 16, borderWidth: 1, borderColor: C.dangerBorder },
  errorTitle: { color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  errorText: { color: C.danger, lineHeight: 21 },
  muted: { color: C.textMuted, fontSize: 13, lineHeight: 20, marginTop: 6 },
  timelineItem: { flexDirection: 'row', marginBottom: 16 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary, marginTop: 6, marginRight: 11 },
  timelineContent: { flex: 1, backgroundColor: C.surface, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  historyStatus: { color: C.text, fontWeight: '700', marginBottom: 5 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
  scoreLabel: { color: C.textSubtle, fontSize: 13, flexShrink: 1 },
  scoreValue: { color: C.text, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  finalPriority: { marginTop: 10, padding: 12, borderRadius: 9 },
  finalPriorityLabel: { color: '#475569', fontSize: 12 },
  finalPriorityValue: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  criteriaBlock: { marginTop: 12 },
  criteriaLabel: { color: C.textBody, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  criteriaOptions: { flexDirection: 'row', gap: 7 },
  criteriaChip: { flex: 1, borderWidth: 1, borderColor: C.borderInput, borderRadius: 8, paddingVertical: 10, minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface },
  criteriaChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  criteriaChipText: { color: C.textBody, fontWeight: '700' },
  criteriaChipTextActive: { color: C.onPrimary },
  previewBox: { backgroundColor: C.primarySoft, borderRadius: 9, padding: 13, marginTop: 14, borderWidth: 1, borderColor: C.primarySoftBorder },
  previewLabel: { color: C.textSubtle, fontSize: 13, lineHeight: 20 },
  previewValue: { color: C.primaryDark, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  overrideWarning: { color: '#9C4221', fontSize: 12, lineHeight: 18, marginTop: 8, fontWeight: '600' },
  overrideNote: { color: '#9C4221', fontSize: 12, lineHeight: 18, marginTop: 6 },
  priorityChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  priorityChip: { borderWidth: 1, borderColor: C.borderInput, borderRadius: 999, paddingHorizontal: 13, minHeight: 40, justifyContent: 'center', backgroundColor: C.surface },
  priorityChipText: { color: C.textBody, fontSize: 12, fontWeight: '600' },
  overrideInputBox: { marginTop: 14 },
  overrideInput: { backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.borderInput, borderRadius: 9, padding: 12, minHeight: 80, textAlignVertical: 'top', color: C.text },
  overrideHint: { color: C.textMuted, fontSize: 12, marginTop: 6, lineHeight: 18 },
  officerList: { gap: 8, marginVertical: 6 },
  officerChip: { borderWidth: 1, borderColor: C.borderInput, borderRadius: 9, padding: 12, minHeight: 44, justifyContent: 'center', backgroundColor: C.surface },
  officerChipActive: { borderColor: C.primary, backgroundColor: C.primarySoft },
  officerText: { color: C.textBody },
  officerTextActive: { color: C.primary, fontWeight: '700' },
  button: { backgroundColor: C.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 9, marginTop: 16 },
  buttonText: { color: C.onPrimary, fontWeight: '700' },
  backLink: { color: C.primary, fontWeight: '700', marginTop: 16 },
  backChip: { borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 16, minHeight: 40, justifyContent: 'center', marginTop: 16 },
  backChipText: { color: C.textBody, fontWeight: '700', fontSize: 12 },
});
