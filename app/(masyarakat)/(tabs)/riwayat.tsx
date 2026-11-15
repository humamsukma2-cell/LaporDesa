import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { CITIZEN_CARD_SHADOW, CITIZEN_COLORS as C, CITIZEN_RADIUS } from '@/lib/masyarakat-theme';
import type { StatusLaporanType } from '@/types';
import { useMasyarakatShell, MasyarakatPageHeader } from '@/components/MasyarakatShell';

type ReportItem = {
  id: string;
  kode_laporan: string;
  deskripsi: string;
  status: StatusLaporanType;
  created_at: string;
  kategori: { nama: string } | { nama: string }[] | null;
};

const STATUS: Record<StatusLaporanType, { label: string; color: string }> = {
  pending: { label: 'Menunggu verifikasi', color: '#B7791F' },
  needs_information: { label: 'Perlu informasi', color: '#805AD5' },
  verified: { label: 'Terverifikasi', color: '#2B6CB0' },
  assigned: { label: 'Ditugaskan', color: '#2C5282' },
  in_progress: { label: 'Sedang ditangani', color: '#C05621' },
  resolved: { label: 'Selesai', color: '#2F855A' },
  rejected: { label: 'Ditolak', color: '#C53030' },
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tanggal tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function RiwayatScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { desktop } = useMasyarakatShell();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [rabByReport, setRabByReport] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StatusLaporanType>('all');

  const loadReports = useCallback(async (isRefresh = false) => {
    if (!session?.user.id) {
      setReports([]);
      setRabByReport({});
      setErrorMessage('Sesi login tidak tersedia. Silakan login kembali.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase
        .from('laporan')
        .select('id, kode_laporan, deskripsi, status, created_at, kategori(nama)')
        .eq('pelapor_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as ReportItem[];
      setReports(rows);

      // Tandai laporan yang sudah memiliki RAB terbit agar warga tahu
      // dokumen anggarannya sudah tersedia.
      const ids = rows.map((row) => row.id);
      if (ids.length) {
        try {
          const { data: rabRows, error: rabError } = await supabase
            .from('rab')
            .select('laporan_id, nomor_rab')
            .eq('status', 'published')
            .in('laporan_id', ids);
          if (rabError) throw rabError;
          const next: Record<string, string> = {};
          for (const row of (rabRows ?? []) as { laporan_id: string; nomor_rab: string }[]) {
            next[row.laporan_id] = row.nomor_rab;
          }
          setRabByReport(next);
        } catch (rabError) {
          console.warn('[Riwayat] Informasi RAB tidak tersedia:', rabError);
          setRabByReport({});
        }
      } else {
        setRabByReport({});
      }
    } catch (error) {
      console.error('[Riwayat] Failed to load reports:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Gagal memuat riwayat. Periksa koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user.id]);

  useFocusEffect(useCallback(() => {
    void loadReports();
  }, [loadReports]));

  const filteredReports = statusFilter === 'all' ? reports : reports.filter((report) => report.status === statusFilter);
  const pad = desktop ? 40 : 16;
  const filters: { key: 'all' | StatusLaporanType; label: string }[] = [
    { key: 'all', label: `Semua ${reports.length}` },
    { key: 'pending', label: `Menunggu ${reports.filter((item) => item.status === 'pending').length}` },
    { key: 'in_progress', label: `Diproses ${reports.filter((item) => item.status === 'in_progress').length}` },
    { key: 'resolved', label: `Selesai ${reports.filter((item) => item.status === 'resolved').length}` },
    { key: 'rejected', label: `Ditolak ${reports.filter((item) => item.status === 'rejected').length}` },
  ];

  const renderItem = ({ item }: { item: ReportItem }) => {
    const status = STATUS[item.status] ?? { label: item.status, color: '#64748B' };
    const rabNumber = rabByReport[item.id];
    return (
      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.card, { padding: desktop ? 20 : 16 }, desktop && styles.cardDesktop]}
        onPress={() => router.push({ pathname: '/(masyarakat)/detail/[id]', params: { id: item.id } })}
      >
        <View style={styles.cardTop}>
          <Text style={styles.code}>{item.kode_laporan || 'Laporan'}</Text>
          <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
        </View>
        <Text style={styles.category}>{(Array.isArray(item.kategori) ? item.kategori[0]?.nama : item.kategori?.nama) ?? 'Kategori tidak tersedia'}</Text>
        <Text style={styles.description} numberOfLines={3}>{item.deskripsi}</Text>
        <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        {!!rabNumber && (
          <View style={styles.rabAlert}>
            <View style={styles.rabAlertDot} />
            <Text style={styles.rabAlertText}>RAB sudah diterbitkan · {rabNumber}</Text>
          </View>
        )}
        <Text style={styles.detailLink}>Lihat detail ›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <MasyarakatPageHeader
        eyebrow="RIWAYAT LAPORAN"
        title="Riwayat"
        subtitle="Semua laporan yang pernah Anda kirim."
        note="Pilih laporan untuk melihat detail penanganannya."
      />
      <View style={[styles.filters, { paddingHorizontal: pad }]}>
        {filters.map((filter) => <TouchableOpacity key={filter.key} style={[styles.filter, statusFilter === filter.key && styles.filterActive]} onPress={() => setStatusFilter(filter.key)}><Text style={[styles.filterText, statusFilter === filter.key && styles.filterTextActive]}>{filter.label}</Text></TouchableOpacity>)}
      </View>
      <View style={[styles.resultHeading, { paddingHorizontal: pad }]}><Text style={styles.resultCount}>{filteredReports.length} laporan Anda</Text><Text style={styles.sortLabel}>Terbaru dahulu ↓</Text></View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={C.primaryStrong} /><Text style={styles.muted}>Memuat riwayat laporan…</Text></View>
      ) : errorMessage ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Riwayat belum dapat dimuat</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadReports()}><Text style={styles.retryText}>Coba lagi</Text></TouchableOpacity>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Belum ada laporan</Text>
          <Text style={styles.muted}>Laporan yang Anda kirim akan muncul di sini.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.push('/(masyarakat)/(tabs)/buat-laporan')}><Text style={styles.retryText}>Buat laporan</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingHorizontal: pad }]}
          numColumns={desktop ? 2 : 1}
          columnWrapperStyle={desktop ? styles.columnWrapper : undefined}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadReports(true)} tintColor={C.primaryStrong} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 16, paddingBottom: 2 },
  filter: { height: 36, alignSelf: 'center', paddingHorizontal: 14, borderRadius: CITIZEN_RADIUS.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.cardBorder, justifyContent: 'center' },
  filterActive: { backgroundColor: C.primarySoft, borderColor: '#B9DDF8' },
  filterText: { color: '#49647C', fontSize: 11 },
  filterTextActive: { color: C.text, fontWeight: '700' },
  resultHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 14, marginBottom: 14, flexWrap: 'wrap' },
  resultCount: { color: C.text, fontSize: 13, fontWeight: '700' },
  sortLabel: { color: C.muted, fontSize: 10 },
  list: { paddingTop: 3, paddingBottom: 24, gap: 16, width: '100%' },
  columnWrapper: { gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  muted: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  errorTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  errorText: { color: C.danger, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: '800' },
  retryButton: { backgroundColor: C.black, minHeight: 46, justifyContent: 'center', paddingHorizontal: 21, borderRadius: 999, marginTop: 18 },
  retryText: { color: C.white, fontWeight: '700' },
  card: { alignSelf: 'stretch', backgroundColor: C.surface, padding: 20, borderRadius: CITIZEN_RADIUS.card, borderWidth: 1, borderColor: C.cardBorder, ...CITIZEN_CARD_SHADOW },
  cardDesktop: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', columnGap: 10, rowGap: 6 },
  code: { color: C.text, fontSize: 14, fontWeight: '800', flexShrink: 1, minWidth: 0 },
  status: { fontSize: 11, fontWeight: '700', textAlign: 'right', flexShrink: 1, marginLeft: 'auto', backgroundColor: C.primarySoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' },
  category: { color: C.primaryStrong, fontWeight: '700', marginTop: 11, fontSize: 12 },
  description: { color: C.textBody, fontSize: 14, lineHeight: 21, marginTop: 6 },
  date: { color: C.muted, fontSize: 12, marginTop: 10 },
  rabAlert: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 9, paddingHorizontal: 11, borderRadius: CITIZEN_RADIUS.inner, backgroundColor: '#DDF0FF', borderWidth: 1, borderColor: '#BEE0FA' },
  rabAlertDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.primaryStrong },
  rabAlertText: { color: C.primaryStrong, fontSize: 11.5, fontWeight: '700', flexShrink: 1, lineHeight: 16 },
  detailLink: { color: C.text, fontWeight: '700', marginTop: 14, textAlign: 'right', fontSize: 12 },
});
