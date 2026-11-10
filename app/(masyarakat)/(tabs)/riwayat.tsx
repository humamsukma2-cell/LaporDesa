import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { StatusLaporanType } from '@/types';

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
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadReports = useCallback(async (isRefresh = false) => {
    if (!session?.user.id) {
      setReports([]);
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
      setReports((data ?? []) as unknown as ReportItem[]);
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

  const renderItem = ({ item }: { item: ReportItem }) => {
    const status = STATUS[item.status] ?? { label: item.status, color: '#64748B' };
    return (
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.card}
        onPress={() => router.push({ pathname: '/(masyarakat)/detail/[id]', params: { id: item.id } })}
      >
        <View style={styles.cardTop}>
          <Text style={styles.code}>{item.kode_laporan || 'Laporan'}</Text>
          <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
        </View>
        <Text style={styles.category}>{(Array.isArray(item.kategori) ? item.kategori[0]?.nama : item.kategori?.nama) ?? 'Kategori tidak tersedia'}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.deskripsi}</Text>
        <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        <Text style={styles.detailLink}>Lihat detail ›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1976D2" /><Text style={styles.muted}>Memuat riwayat laporan…</Text></View>
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
          data={reports}
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
  list: { padding: 16, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  muted: { color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  errorTitle: { color: '#1E293B', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  errorText: { color: '#B91C1C', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  emptyTitle: { color: '#1E293B', fontSize: 20, fontWeight: '700' },
  retryButton: { backgroundColor: '#1976D2', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 9, marginTop: 18 },
  retryText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  code: { color: '#1E293B', fontSize: 14, fontWeight: '700', flex: 1 },
  status: { fontSize: 12, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  category: { color: '#1976D2', fontWeight: '600', marginTop: 10 },
  description: { color: '#334155', fontSize: 14, lineHeight: 20, marginTop: 6 },
  date: { color: '#64748B', fontSize: 12, marginTop: 10 },
  detailLink: { color: '#1976D2', fontWeight: '700', marginTop: 12, textAlign: 'right' },
});
