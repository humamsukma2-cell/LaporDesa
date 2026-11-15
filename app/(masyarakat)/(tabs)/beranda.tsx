import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { StatusLaporanType } from '@/types';
import { formatRupiah } from '@/lib/rab';
import { MasyarakatPageFooter, MasyarakatPageHeader, useMasyarakatShell } from '@/components/MasyarakatShell';
import { CITIZEN_CARD_SHADOW, CITIZEN_COLORS as C, CITIZEN_RADIUS } from '@/lib/masyarakat-theme';

type DashboardReport = {
  id: string;
  kode_laporan: string;
  deskripsi: string;
  status: StatusLaporanType;
  created_at: string;
  kategori: { nama: string } | { nama: string }[] | null;
};
type DashboardRab = { rab_id: string; nomor_rab: string; judul: string; total_anggaran: number | string };

const STATUS_LABEL: Record<StatusLaporanType, string> = {
  pending: 'Menunggu verifikasi',
  needs_information: 'Perlu informasi',
  verified: 'Terverifikasi',
  assigned: 'Ditugaskan',
  in_progress: 'Sedang ditangani',
  resolved: 'Selesai',
  rejected: 'Ditolak',
};

const STATUS_SHORT: Record<StatusLaporanType, string> = {
  pending: 'Menunggu',
  needs_information: 'Perlu info',
  verified: 'Terverifikasi',
  assigned: 'Ditugaskan',
  in_progress: 'Diproses',
  resolved: 'Selesai',
  rejected: 'Ditolak',
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tanggal tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export default function BerandaMasyarakatScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { desktop } = useMasyarakatShell();
  const [reports, setReports] = useState<DashboardReport[]>([]);
  const [rabs, setRabs] = useState<DashboardRab[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [reportResult, rabResult] = await Promise.all([
        supabase
          .from('laporan')
          .select('id, kode_laporan, deskripsi, status, created_at, kategori(nama)')
          .eq('pelapor_id', profile?.id ?? '')
          .order('created_at', { ascending: false }),
        supabase.rpc('daftar_rab_terbit'),
      ]);
      if (reportResult.error) throw reportResult.error;
      if (rabResult.error) throw rabResult.error;
      setReports((reportResult.data ?? []) as unknown as DashboardReport[]);
      setRabs((rabResult.data ?? []) as DashboardRab[]);
    } catch (error) {
      console.error('[BerandaMasyarakat] Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useFocusEffect(useCallback(() => { void loadDashboard(); }, [loadDashboard]));

  const activeCount = reports.filter((report) => !['resolved', 'rejected'].includes(report.status)).length;
  const resolvedCount = reports.filter((report) => report.status === 'resolved').length;
  const pendingCount = reports.filter((report) => report.status === 'pending').length;
  const rejectedCount = reports.filter((report) => report.status === 'rejected').length;
  const latestRab = rabs[0];
  const pad = desktop ? 40 : 16;

  return (
    <View style={styles.page}>
      <MasyarakatPageHeader
        eyebrow="RINGKASAN PELAYANAN WARGA"
        title="Beranda"
        subtitle={`Selamat datang, ${profile?.nama ?? 'Warga Desa'}.`}
        note="Pantau laporan dan tindak lanjut pelayanan desa."
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#1E7BA8" />
            <Text style={styles.muted}>Memuat ringkasan laporan…</Text>
          </View>
        ) : (
          <>
            <View style={[styles.metricGrid, { paddingHorizontal: pad }]}>
              <View style={styles.metricCard}>
                <View style={styles.metricTop}>
                  <Text style={styles.metricLabel}>Total Laporan</Text>
                  <View style={styles.metricIcon}><Text style={styles.metricIconText}>▤</Text></View>
                </View>
                <Text style={styles.metricValue}>{reports.length}</Text>
                <Text style={styles.metricHint}>Seluruh laporan Anda</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={styles.metricTop}>
                  <Text style={styles.metricLabel}>Diproses</Text>
                  <View style={styles.warningIcon}><Text style={styles.warningIconText}>!</Text></View>
                </View>
                <Text style={styles.metricValue}>{activeCount}</Text>
                <Text style={styles.metricHint}>Sedang ditangani petugas</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={styles.metricTop}>
                  <Text style={styles.metricLabel}>Selesai</Text>
                  <View style={styles.successIcon}><Text style={styles.successIconText}>✓</Text></View>
                </View>
                <Text style={styles.metricValue}>{resolvedCount}</Text>
                <Text style={styles.metricHint}>{reports.length ? `${((resolvedCount / reports.length) * 100).toFixed(1).replace('.', ',')}% dari seluruh laporan` : 'Belum ada laporan selesai'}</Text>
              </View>
            </View>

            <View style={[styles.panel, { marginHorizontal: pad, padding: desktop ? 20 : 16 }]}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Laporan Terbaru</Text>
                <TouchableOpacity onPress={() => router.push('/(masyarakat)/(tabs)/riwayat')}>
                  <Text style={styles.panelLink}>Lihat semua →</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.panelHint}>Laporan yang Anda kirim dan status penanganannya.</Text>

              {reports.length === 0 ? (
                <Text style={styles.emptyText}>Belum ada laporan. Mulai dengan membuat laporan pertama Anda.</Text>
              ) : (
                reports.slice(0, 4).map((report, index) => {
                  const category = Array.isArray(report.kategori) ? report.kategori[0]?.nama : report.kategori?.nama;
                  return (
                    <TouchableOpacity
                      key={report.id}
                      accessibilityRole="button"
                      style={[styles.reportRow, index === 0 && styles.reportRowFirst]}
                      onPress={() => router.push({ pathname: '/(masyarakat)/detail/[id]', params: { id: report.id } })}
                    >
                      <View style={styles.reportCopy}>
                        <Text style={styles.reportMeta} numberOfLines={1}>#{report.kode_laporan || 'Laporan'} · {category ?? 'Kategori tidak tersedia'}</Text>
                        <Text style={styles.reportDescription} numberOfLines={2}>{report.deskripsi}</Text>
                        <View style={styles.reportBottomRow}>
                          <Text style={styles.reportDate}>{formatDate(report.created_at)}</Text>
                          <View style={styles.reportTrailing}>
                            <Text
                              numberOfLines={1}
                              style={[styles.statusPill, report.status === 'resolved' ? styles.pillDone : report.status === 'pending' ? styles.pillPending : report.status === 'rejected' ? styles.pillRejected : styles.pillProgress]}
                            >
                              {STATUS_SHORT[report.status] ?? report.status}
                            </Text>
                            <Text style={styles.chevron}>›</Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            <View style={[styles.panel, { marginHorizontal: pad, padding: desktop ? 20 : 16 }]}>
              <Text style={styles.panelTitle}>Status Laporan</Text>
              <Text style={styles.panelHint}>Pantau setiap tahap tindak lanjut laporan Anda.</Text>
              <View style={styles.statusGrid}>
                <StatusCard label="Menunggu verifikasi" value={pendingCount} tone="pending" />
                <StatusCard label="Diproses" value={activeCount} tone="progress" />
                <StatusCard label="Selesai" value={resolvedCount} tone="done" />
                <StatusCard label="Ditolak" value={rejectedCount} tone="rejected" />
              </View>
            </View>

            <View style={[styles.panel, { marginHorizontal: pad, padding: desktop ? 20 : 16 }]}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>RAB Terbaru</Text>
                <TouchableOpacity onPress={() => router.push('/(masyarakat)/(tabs)/rab')}>
                  <Text style={styles.panelLink}>Lihat RAB →</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.panelHint}>Rencana anggaran biaya yang diterbitkan untuk warga.</Text>
              {latestRab ? (
                <View style={styles.rabCard}>
                  <Text style={styles.rabNumber}>#{latestRab.nomor_rab}</Text>
                  <Text style={styles.rabTitle}>{latestRab.judul}</Text>
                  <Text style={styles.rabAmount}>{formatRupiah(latestRab.total_anggaran)}</Text>
                </View>
              ) : (
                <Text style={styles.emptyText}>Belum ada RAB yang diterbitkan.</Text>
              )}
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.primaryButton, { marginHorizontal: pad }]}
              onPress={() => router.push('/(masyarakat)/(tabs)/buat-laporan')}
            >
              <Text style={styles.primaryButtonText}>Buat laporan baru</Text>
            </TouchableOpacity>

            <MasyarakatPageFooter note="Angka berasal dari laporan warga Anda." />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatusCard({ label, value, tone }: { label: string; value: number; tone: 'pending' | 'progress' | 'done' | 'rejected' }) {
  const dot = { pending: '#C6AA65', progress: '#4C8FC0', done: '#75A98F', rejected: '#C47C7D' }[tone];
  return (
    <View style={styles.statusCard}>
      <View style={styles.statusLabelRow}>
        <View style={[styles.statusDot, { backgroundColor: dot }]} />
        <Text style={styles.statusCardLabel}>{label}</Text>
      </View>
      <View style={styles.statusCountRow}>
        <Text style={styles.statusCardValue}>{value}</Text>
        <Text style={styles.statusUnit}>laporan</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: 'transparent' },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { flexGrow: 1, paddingBottom: 24, backgroundColor: 'transparent' },

  loadingBox: { alignItems: 'center', padding: 32 },
  muted: { color: '#64748B', marginTop: 10, textAlign: 'center', fontSize: 12 },

  metricGrid: { paddingTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metricCard: { flexGrow: 1, flexBasis: 150, minHeight: 138, backgroundColor: C.surface, padding: 16, borderRadius: CITIZEN_RADIUS.card, borderWidth: 1, borderColor: C.cardBorder, ...CITIZEN_CARD_SHADOW },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricLabel: { color: '#5C747E', fontSize: 13, fontWeight: '500' },
  metricIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#E4F1F9', justifyContent: 'center', alignItems: 'center' },
  metricIconText: { color: '#1E7BA8', fontSize: 20 },
  warningIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#FBF1DF', justifyContent: 'center', alignItems: 'center' },
  warningIconText: { color: '#A86A13', fontWeight: '900', fontSize: 18 },
  successIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#E8F3ED', justifyContent: 'center', alignItems: 'center' },
  successIconText: { color: '#17805D', fontWeight: '900', fontSize: 18 },
  metricValue: { color: '#1B3430', fontSize: 32, fontWeight: '800', marginTop: 1 },
  metricHint: { color: '#6E828C', fontSize: 11, marginTop: 'auto', paddingTop: 12 },

  panel: { backgroundColor: C.surface, marginTop: 18, padding: 18, borderRadius: CITIZEN_RADIUS.card, borderWidth: 1, borderColor: C.cardBorder, ...CITIZEN_CARD_SHADOW },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  panelTitle: { color: '#1B3430', fontSize: 17, fontWeight: '800' },
  panelLink: { color: '#1E7BA8', fontSize: 12, fontWeight: '700' },
  panelHint: { color: '#6E828C', fontSize: 12, marginTop: 5, marginBottom: 6, lineHeight: 18 },
  emptyText: { color: '#6E828C', fontSize: 13, lineHeight: 20, marginTop: 12 },

  reportRow: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.cardBorderSoft },
  reportRowFirst: { borderTopWidth: 0, marginTop: 6 },
  reportCopy: { minWidth: 0 },
  reportBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  reportMeta: { color: '#5C747E', fontSize: 11, flexShrink: 1 },
  reportDescription: { color: '#1E293B', fontSize: 14, fontWeight: '700', marginTop: 6, lineHeight: 21 },
  reportDate: { color: '#6E828C', fontSize: 11 },
  reportTrailing: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  statusPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, fontSize: 10, fontWeight: '700' },
  pillProgress: { color: '#1E6A96', backgroundColor: '#E1F0FA' },
  pillPending: { color: '#8A6100', backgroundColor: '#FFF2D5' },
  pillDone: { color: '#08745C', backgroundColor: '#DDF5EC' },
  pillRejected: { color: '#A33A3F', backgroundColor: '#FBECEC' },
  chevron: { color: '#5C747E', fontSize: 18 },

  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  statusCard: { flexGrow: 1, flexBasis: 150, minHeight: 100, padding: 15, borderRadius: CITIZEN_RADIUS.inner, backgroundColor: C.surfaceMuted },
  statusLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusCardLabel: { color: '#243B39', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  statusCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 13 },
  statusCardValue: { color: '#1B3430', fontSize: 26, fontWeight: '800' },
  statusUnit: { color: '#7A8B86', fontSize: 10 },

  rabCard: { marginTop: 10, padding: 15, borderRadius: CITIZEN_RADIUS.inner, backgroundColor: C.surfaceMuted },
  rabNumber: { color: '#1E7BA8', fontSize: 11, fontWeight: '700' },
  rabTitle: { color: '#1E293B', fontSize: 15, fontWeight: '700', marginTop: 6, lineHeight: 21 },
  rabAmount: { color: '#1B3430', fontSize: 20, fontWeight: '800', marginTop: 8 },

  primaryButton: { backgroundColor: '#0B0F14', marginTop: 18, padding: 15, borderRadius: CITIZEN_RADIUS.field, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
