import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AdminPageFooter, AdminPageHeader, AdminShell } from '@/components/admin/AdminShell';
import { ADMIN_COLORS as C } from '@/lib/theme';
import { STATUS_META, STATUS_ORDER, describeError } from '@/lib/laporan-ui';
import type { StatusLaporanType, TingkatType } from '@/types';


type Counts = Record<StatusLaporanType, number>;
type Priorities = Record<TingkatType, number>;

const emptyCounts: Counts = {
  pending: 0, needs_information: 0, verified: 0, assigned: 0, in_progress: 0, resolved: 0, rejected: 0,
};
const emptyPriorities: Priorities = { rendah: 0, sedang: 0, tinggi: 0, sangat_tinggi: 0 };
const PRIORITY_LABEL: Record<TingkatType, string> = {
  rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi', sangat_tinggi: 'Sangat tinggi',
};

export default function DashboardAdminScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const [priorities, setPriorities] = useState<Priorities>(emptyPriorities);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  const tablet = width >= 768 && width < 1024;

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setErrorMessage('');
    try {
      const { data: reports, error: reportError } = await supabase
        .from('laporan')
        .select('status');
      if (reportError) throw reportError;

      const nextCounts: Counts = { ...emptyCounts };
      for (const row of (reports ?? []) as { status: StatusLaporanType }[]) {
        if (row.status in nextCounts) nextCounts[row.status] += 1;
      }
      setCounts(nextCounts);
      setTotal((reports ?? []).length);

      const { data: prioritas, error: prioritasError } = await supabase
        .from('penilaian_prioritas')
        .select('prioritas_akhir');
      if (prioritasError) throw prioritasError;
      const nextPriorities: Priorities = { ...emptyPriorities };
      for (const row of (prioritas ?? []) as { prioritas_akhir: TingkatType }[]) {
        if (row.prioritas_akhir in nextPriorities) nextPriorities[row.prioritas_akhir] += 1;
      }
      setPriorities(nextPriorities);
    } catch (error) {
      console.error('[DashboardAdmin] Failed to load dashboard:', error);
      setErrorMessage(describeError(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadDashboard(); }, [loadDashboard]));

  return (
    <AdminShell
      section="dashboard"
      header={(
        <AdminPageHeader
          eyebrow="RINGKASAN PELAYANAN"
          title="Dashboard"
          subtitle={`Selamat datang, ${profile?.nama ?? 'Admin Desa'}.`}
          note="Pantau laporan dan tindak lanjut pelayanan desa."
        />
      )}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadDashboard(true)} tintColor={C.primary} />}
      >

      {!!errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity onPress={() => void loadDashboard()}><Text style={styles.retryText}>Coba lagi</Text></TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color={C.primary} /><Text style={styles.muted}>Memuat ringkasan laporan…</Text></View>
      ) : (
        <>
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <View style={styles.metricTop}><Text style={styles.totalLabel}>Total Laporan Masuk</Text><View style={styles.metricIcon}><Text style={styles.metricIconText}>▤</Text></View></View>
              <Text style={styles.totalValue}>{total}</Text><Text style={styles.metricHint}>Seluruh laporan warga</Text>
            </View>
            <View style={[styles.metricCard, styles.attentionMetric]}>
              <View style={styles.metricTop}><Text style={styles.totalLabel}>Perlu Perhatian</Text><View style={styles.warningIcon}><Text style={styles.warningIconText}>!</Text></View></View>
              <Text style={styles.attentionValue}>{counts.pending + counts.needs_information}</Text><Text style={styles.metricHint}>Menunggu verifikasi atau informasi</Text>
            </View>
            <View style={[styles.metricCard, styles.completedMetric]}>
              <View style={styles.metricTop}><Text style={styles.totalLabel}>Laporan Selesai</Text><View style={styles.successIcon}><Text style={styles.successIconText}>✓</Text></View></View>
              <Text style={styles.totalValue}>{counts.resolved}</Text><Text style={styles.metricHint}>{total ? `${((counts.resolved / total) * 100).toFixed(1).replace('.', ',')}% dari seluruh laporan` : 'Belum ada laporan selesai'}</Text>
            </View>
          </View>

          <View style={styles.panel}>
          <Text style={styles.panelTitle}>Jumlah per Status</Text>
          <Text style={styles.panelHint}>Pantau setiap tahap tindak lanjut laporan warga.</Text>
          <View style={[styles.grid, desktop && styles.gridDesktop, tablet && styles.gridTablet]}>
            {STATUS_ORDER.map((status) => (
              <TouchableOpacity
                key={status}
                accessibilityRole="button"
                accessibilityLabel={`${STATUS_META[status].label}, ${counts[status]} laporan`}
                style={[styles.countCard, styles.countCardNeutral]}
                onPress={() => router.push({ pathname: '/(admin)/daftar-laporan', params: { status } })}
              >
                <View style={styles.statusLabelRow}><View style={[styles.statusDot, { backgroundColor: STATUS_META[status].color }]} /><Text style={[styles.countLabel, { color: '#243B39' }]}>{STATUS_META[status].label}</Text></View>
                <View style={styles.statusCountRow}><Text style={[styles.countValue, { color: '#1B3430' }]}>{counts[status]}</Text><Text style={styles.statusUnit}>laporan</Text></View>
              </TouchableOpacity>
            ))}
          </View>
          </View>

          <View style={styles.panel}>
          <Text style={styles.panelTitle}>Prioritas Laporan</Text>
          <Text style={styles.panelHint}>Distribusi laporan berdasarkan tingkat urgensi.</Text>
          <View style={styles.priorityRow}>
            {(Object.keys(priorities) as TingkatType[]).map((level) => (
              <View key={level} style={styles.priorityCard}>
                <View style={styles.priorityTop}><View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[level] }]} /><Text style={styles.priorityLabel}>{PRIORITY_LABEL[level]}</Text></View>
                <View style={styles.priorityMetric}><Text style={styles.priorityValue}>{priorities[level]}</Text><Text style={styles.priorityUnit}>laporan</Text><Text style={styles.priorityPercent}>{total ? `${((priorities[level] / total) * 100).toFixed(1).replace('.', ',')}%` : '0%'}</Text></View>
                <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${total ? Math.min((priorities[level] / total) * 100, 100) : 0}%`, backgroundColor: PRIORITY_COLORS[level] }]} /></View>
              </View>
            ))}
          </View>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(admin)/daftar-laporan')}>
            <Text style={styles.primaryButtonText}>Lihat semua laporan</Text>
          </TouchableOpacity>
          <AdminPageFooter note="Angka berasal dari data laporan aktual." />
        </>
      )}
      </ScrollView>
    </AdminShell>
  );
}

const PRIORITY_COLORS: Record<TingkatType, string> = {
  rendah: '#75A98F', sedang: '#C6AA65', tinggi: '#CE8D68', sangat_tinggi: '#C47C7D',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { flexGrow: 1, paddingBottom: 8, backgroundColor: C.background },
  loadingBox: { alignItems: 'center', padding: 32 },
  muted: { color: '#64748B', marginTop: 10, textAlign: 'center', fontSize: 12 },
  errorBox: { backgroundColor: C.dangerSoft, marginHorizontal: 20, marginTop: 16, padding: 12, borderRadius: 9, borderWidth: 1, borderColor: C.dangerBorder },
  errorText: { color: C.danger, lineHeight: 20 },
  retryText: { color: C.primary, fontWeight: '700', marginTop: 8 },
  metricGrid: { paddingHorizontal: 20, paddingTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metricCard: { flexGrow: 1, flexBasis: 250, minHeight: 158, backgroundColor: C.surface, padding: 19, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  attentionMetric: { borderColor: '#E9DFCD' }, completedMetric: { borderColor: C.primarySoftBorder },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, totalLabel: { color: C.textSubtle, fontSize: 13, fontWeight: '500' },
  metricIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: C.primarySoft, justifyContent: 'center', alignItems: 'center' }, metricIconText: { color: '#16705D', fontSize: 20 },
  warningIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: C.warningSoft, justifyContent: 'center', alignItems: 'center' }, warningIconText: { color: C.warning, fontWeight: '900', fontSize: 18 },
  successIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: C.successSoft, justifyContent: 'center', alignItems: 'center' }, successIconText: { color: C.success, fontWeight: '900', fontSize: 18 },
  totalValue: { color: '#19342F', fontSize: 36, fontWeight: '800', marginTop: 1 }, attentionValue: { color: '#19342F', fontSize: 36, fontWeight: '800', marginTop: 1 }, metricHint: { color: C.textMuted, fontSize: 11, marginTop: 'auto', paddingTop: 12 },
  panel: { backgroundColor: C.surface, marginHorizontal: 20, marginTop: 18, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  panelTitle: { color: C.text, fontSize: 17, fontWeight: '800' }, panelHint: { color: C.textMuted, fontSize: 12, marginTop: 5, marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, gridDesktop: { gap: 12 }, gridTablet: { gap: 10 },
  countCard: { flexGrow: 1, flexBasis: 180, minHeight: 98, padding: 14, borderRadius: 10 }, countCardNeutral: { backgroundColor: C.surfaceMuted, borderWidth: 1, borderColor: C.borderSoft },
  statusLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, statusDot: { width: 7, height: 7, borderRadius: 4 },
  countValue: { fontSize: 26, fontWeight: '800' }, countLabel: { fontSize: 12, fontWeight: '600' }, statusCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 13 }, statusUnit: { color: '#7A8B86', fontSize: 10 },
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  priorityCard: { flexGrow: 1, flexBasis: 190, backgroundColor: C.surface, paddingVertical: 8, minWidth: 0 }, priorityTop: { flexDirection: 'row', alignItems: 'center', gap: 8 }, priorityDot: { width: 7, height: 7, borderRadius: 4 },
  priorityValue: { color: C.text, fontSize: 26, fontWeight: '800' }, priorityLabel: { color: '#243B39', fontSize: 13, fontWeight: '500' }, priorityMetric: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }, priorityUnit: { color: C.textMuted, fontSize: 10 }, priorityPercent: { color: C.textSubtle, fontSize: 11, marginLeft: 'auto' },
  progressTrack: { height: 6, borderRadius: 4, backgroundColor: '#EDF2EF', marginTop: 10, overflow: 'hidden' }, progressFill: { height: 6, borderRadius: 4, minWidth: 4 },
  primaryButton: { backgroundColor: C.primary, marginHorizontal: 20, marginTop: 18, padding: 15, borderRadius: 10, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  primaryButtonText: { color: C.onPrimary, fontWeight: '700', fontSize: 14 },
});
