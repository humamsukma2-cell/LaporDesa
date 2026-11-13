import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { STATUS_META, STATUS_ORDER, categoryName, describeError, formatDateTime, statusMeta } from '@/lib/laporan-ui';
import { AdminPageFooter, AdminPageHeader, AdminShell } from '@/components/admin/AdminShell';
import { ADMIN_COLORS as C } from '@/lib/theme';
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
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  const columns = desktop ? 2 : 1;
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
        style={[styles.card, desktop && styles.cardDesktop]}
        accessibilityRole="button"
        accessibilityLabel={`Buka detail laporan ${item.kode_laporan}`}
        onPress={() => router.push({ pathname: '/(admin)/detail/[id]', params: { id: item.id } })}
      >
        <View style={styles.cardTop}>
          <Text style={styles.code}>{item.kode_laporan || 'Laporan'}</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={styles.statusBadgeText}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.category}>{categoryName(item.kategori)}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.deskripsi}</Text>
        <Text style={styles.meta} numberOfLines={1}>Patokan: {item.patokan_lokasi}</Text>
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
    <AdminShell
      section="daftar-laporan"
      header={(
        <AdminPageHeader
          eyebrow="DAFTAR LAPORAN"
          title="Daftar Laporan"
          subtitle="Tinjau laporan warga dan buka detail untuk tindak lanjut."
          note={loading ? 'Memuat data laporan…' : `${visibleReports.length} laporan pada filter ini.`}
        />
      )}
    >
      <View style={styles.page}>
        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: filter === 'all' }}
              style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>Semua ({reports.length})</Text>
            </TouchableOpacity>
            {STATUS_ORDER.map((status) => {
              const amount = reports.filter((report) => report.status === status).length;
              return (
                <TouchableOpacity
                  key={status}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === status }}
                  style={[styles.filterChip, filter === status && styles.filterChipActive]}
                  onPress={() => setFilter(status)}
                >
                  <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>{STATUS_META[status].label} ({amount})</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /><Text style={styles.muted}>Memuat laporan…</Text></View>
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
            key={`laporan-${columns}`}
            style={styles.listContainer}
            data={visibleReports}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? styles.columnRow : undefined}
            contentContainerStyle={[styles.list, desktop && styles.listDesktop]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadReports(true)} tintColor={C.primary} />}
            ListFooterComponent={<AdminPageFooter note="Angka dan status berasal dari data laporan aktual." />}
          />
        )}
      </View>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.background },
  listContainer: { flex: 1 },
  filterBar: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: '#E2E8E4' },
  filterRow: { paddingHorizontal: 20, paddingVertical: 12, gap: 8, alignItems: 'center' },
  filterChip: { borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center', backgroundColor: C.surface },
  filterChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterText: { color: C.textBody, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: C.onPrimary },

  list: { padding: 20, gap: 12 },
  listDesktop: { paddingHorizontal: 28, paddingVertical: 22, gap: 14 },
  columnRow: { gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  muted: { color: C.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  errorTitle: { color: C.textStrong, fontSize: 17, fontWeight: '800', marginBottom: 8 },
  errorText: { color: C.danger, textAlign: 'center', lineHeight: 21 },
  emptyTitle: { color: C.textStrong, fontSize: 18, fontWeight: '800' },
  retryButton: { backgroundColor: C.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 9, marginTop: 16, minHeight: 44, justifyContent: 'center' },
  retryText: { color: C.onPrimary, fontWeight: '700' },

  card: { backgroundColor: C.surface, borderRadius: 12, padding: 17, borderWidth: 1, borderColor: C.border },
  cardDesktop: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  code: { color: C.text, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: C.surfaceMuted, borderWidth: 1, borderColor: C.borderSoft },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { color: C.textBody, fontSize: 11, fontWeight: '600' },
  category: { color: C.primary, fontWeight: '700', fontSize: 12, marginTop: 11, letterSpacing: 0.2 },
  description: { color: C.textBody, fontSize: 14, lineHeight: 21, marginTop: 6 },
  meta: { color: C.textMuted, fontSize: 11.5, marginTop: 7, lineHeight: 17 },
  rabStatus: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 11 },
  rabPublished: { backgroundColor: C.successSoft },
  rabDraft: { backgroundColor: C.warningSoft },
  rabMissing: { backgroundColor: C.surfaceMuted },
  rabStatusText: { fontSize: 11.5, fontWeight: '700' },
  rabPublishedText: { color: '#166534' },
  rabDraftText: { color: C.warningText },
  rabMissingText: { color: '#475569' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EFF4F1', gap: 8 },
  detailLink: { color: C.primary, fontWeight: '700', fontSize: 12.5 },
});