import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { STATUS_META, STATUS_ORDER, categoryName, describeError, formatDateTime, statusMeta } from '@/lib/laporan-ui';
import type { StatusLaporanType } from '@/types';

type ReportItem = {
  id: string;
  kode_laporan: string;
  deskripsi: string;
  status: StatusLaporanType;
  created_at: string;
  patokan_lokasi: string;
  kategori: { nama: string } | { nama: string }[] | null;
  rab?: { id: string; status: 'draft' | 'published'; nomor_rab: string; judul: string } | { id: string; status: 'draft' | 'published'; nomor_rab: string; judul: string }[] | null;
};

type Filter = 'all' | StatusLaporanType;

export default function DaftarLaporanAdminScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const initialFilter = useMemo<Filter>(() => {
    const value = Array.isArray(params.status) ? params.status[0] : params.status;
    return value && (STATUS_ORDER as string[]).includes(value) ? (value as StatusLaporanType) : 'all';
  }, [params.status]);

  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadReports = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase
        .from('laporan')
        .select('id, kode_laporan, deskripsi, status, created_at, patokan_lokasi, kategori(nama), rab(id, status, nomor_rab, judul)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReports((data ?? []) as unknown as ReportItem[]);
    } catch (error) {
      console.error('[DaftarLaporanAdmin] Failed to load reports:', error);
      setErrorMessage(describeError(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadReports(); }, [loadReports]));

  const visibleReports = useMemo(
    () => (filter === 'all' ? reports : reports.filter((report) => report.status === filter)),
    [filter, reports],
  );

  const renderItem = ({ item }: { item: ReportItem }) => {
    const status = statusMeta(item.status);
    const rabRecord = Array.isArray(item.rab) ? item.rab[0] : item.rab;
    return (
      <TouchableOpacity
        style={styles.card}
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/(admin)/detail/[id]', params: { id: item.id } })}
      >
        <View style={styles.cardTop}>
          <Text style={styles.code}>{item.kode_laporan || 'Laporan'}</Text>
          <Text style={[styles.statusBadge, { color: status.color, backgroundColor: status.background }]}>{status.label}</Text>
        </View>
        <Text style={styles.category}>{categoryName(item.kategori)}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.deskripsi}</Text>
        <Text style={styles.meta}>Patokan: {item.patokan_lokasi}</Text>
        {item.status === 'resolved' && (
          <View style={[styles.rabStatus, rabRecord?.status === 'published' ? styles.rabPublished : rabRecord ? styles.rabDraft : styles.rabMissing]}>
            <Text style={[styles.rabStatusText, rabRecord?.status === 'published' ? styles.rabPublishedText : rabRecord ? styles.rabDraftText : styles.rabMissingText]}>
              {rabRecord?.status === 'published'
                ? `RAB sudah diterbitkan · ${rabRecord.nomor_rab}`
                : rabRecord
                  ? 'RAB masih draft · belum terlihat oleh warga'
                  : 'RAB belum dibuat'}
            </Text>
          </View>
        )}
        <View style={styles.cardBottom}>
          <Text style={styles.meta}>{formatDateTime(item.created_at)}</Text>
          <Text style={styles.detailLink}>Lihat detail ›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <TouchableOpacity style={[styles.filterChip, filter === 'all' && styles.filterChipActive]} onPress={() => setFilter('all')}>
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>Semua ({reports.length})</Text>
        </TouchableOpacity>
        {STATUS_ORDER.map((status) => {
          const amount = reports.filter((report) => report.status === status).length;
          return (
            <TouchableOpacity key={status} style={[styles.filterChip, filter === status && styles.filterChipActive]} onPress={() => setFilter(status)}>
              <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>{STATUS_META[status].label} ({amount})</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1976D2" /><Text style={styles.muted}>Memuat laporan…</Text></View>
      ) : errorMessage ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Laporan belum dapat dimuat</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadReports()}><Text style={styles.retryText}>Coba lagi</Text></TouchableOpacity>
        </View>
      ) : visibleReports.length === 0 ? (
        <View style={styles.center}><Text style={styles.emptyTitle}>Tidak ada laporan</Text><Text style={styles.muted}>Belum ada laporan pada filter ini.</Text></View>
      ) : (
        <FlatList
          data={visibleReports}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadReports(true)} tintColor="#1976D2" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  filterRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: 'center' },
  filterChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: '#1976D2', borderColor: '#1976D2' },
  filterText: { color: '#334155', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  list: { padding: 14, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  muted: { color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  errorTitle: { color: '#1E293B', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorText: { color: '#B91C1C', textAlign: 'center', lineHeight: 21 },
  emptyTitle: { color: '#1E293B', fontSize: 19, fontWeight: '700' },
  retryButton: { backgroundColor: '#1976D2', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 9, marginTop: 16 },
  retryText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  code: { color: '#1E293B', fontSize: 14, fontWeight: '800', flex: 1 },
  statusBadge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },
  category: { color: '#1976D2', fontWeight: '700', marginTop: 10 },
  description: { color: '#334155', fontSize: 14, lineHeight: 20, marginTop: 6 },
  meta: { color: '#64748B', fontSize: 12, marginTop: 7 },
  rabStatus: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 10 },
  rabPublished: { backgroundColor: '#DCFCE7' },
  rabDraft: { backgroundColor: '#FEF3C7' },
  rabMissing: { backgroundColor: '#F1F5F9' },
  rabStatusText: { fontSize: 12, fontWeight: '700' },
  rabPublishedText: { color: '#166534' },
  rabDraftText: { color: '#92400E' },
  rabMissingText: { color: '#475569' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8 },
  detailLink: { color: '#1259A7', fontWeight: '700', fontSize: 13 },
});
