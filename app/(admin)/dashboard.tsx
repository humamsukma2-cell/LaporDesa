import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
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
  const { profile, signOut } = useAuth();
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const [priorities, setPriorities] = useState<Priorities>(emptyPriorities);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

  async function handleSignOut() {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadDashboard(true)} tintColor="#1976D2" />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Dashboard Admin</Text>
        <Text style={styles.name}>{profile?.nama ?? 'Admin Desa'}</Text>
        <Text style={styles.headerHint}>Pantau laporan warga dan tindak lanjutnya.</Text>
      </View>

      {!!errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity onPress={() => void loadDashboard()}><Text style={styles.retryText}>Coba lagi</Text></TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color="#1976D2" /><Text style={styles.muted}>Memuat ringkasan laporan…</Text></View>
      ) : (
        <>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total laporan masuk</Text>
            <Text style={styles.totalValue}>{total}</Text>
          </View>

          <Text style={styles.sectionTitle}>Jumlah per status</Text>
          <View style={styles.grid}>
            {STATUS_ORDER.map((status) => (
              <TouchableOpacity
                key={status}
                style={[styles.countCard, { backgroundColor: STATUS_META[status].background }]}
                onPress={() => router.push({ pathname: '/(admin)/daftar-laporan', params: { status } })}
              >
                <Text style={[styles.countValue, { color: STATUS_META[status].color }]}>{counts[status]}</Text>
                <Text style={[styles.countLabel, { color: STATUS_META[status].color }]}>{STATUS_META[status].label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Prioritas yang sudah dinilai</Text>
          <View style={styles.priorityRow}>
            {(Object.keys(priorities) as TingkatType[]).map((level) => (
              <View key={level} style={styles.priorityCard}>
                <Text style={styles.priorityValue}>{priorities[level]}</Text>
                <Text style={styles.priorityLabel}>{PRIORITY_LABEL[level]}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(admin)/daftar-laporan')}>
            <Text style={styles.primaryButtonText}>Lihat semua laporan</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={() => void handleSignOut()}>
        <Text style={styles.logoutButtonText}>Keluar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { paddingBottom: 36 },
  header: { backgroundColor: '#1259A7', padding: 22, paddingTop: 30 },
  greeting: { color: '#DBEAFE', fontSize: 15 },
  name: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 },
  headerHint: { color: '#BFDBFE', fontSize: 13, marginTop: 8 },
  loadingBox: { alignItems: 'center', padding: 32 },
  muted: { color: '#64748B', marginTop: 10, textAlign: 'center' },
  errorBox: { backgroundColor: '#FEE2E2', margin: 16, padding: 12, borderRadius: 9 },
  errorText: { color: '#B91C1C', lineHeight: 20 },
  retryText: { color: '#1259A7', fontWeight: '700', marginTop: 8 },
  totalCard: { backgroundColor: '#fff', margin: 16, marginBottom: 0, padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  totalLabel: { color: '#64748B', fontSize: 14 },
  totalValue: { color: '#1E293B', fontSize: 34, fontWeight: '800', marginTop: 4 },
  sectionTitle: { color: '#1E293B', fontSize: 16, fontWeight: '800', marginHorizontal: 16, marginTop: 24, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  countCard: { width: '47.5%', padding: 14, borderRadius: 11 },
  countValue: { fontSize: 25, fontWeight: '800' },
  countLabel: { fontSize: 12, fontWeight: '700', marginTop: 4, lineHeight: 17 },
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  priorityCard: { flexGrow: 1, minWidth: '22%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, alignItems: 'center' },
  priorityValue: { color: '#1E293B', fontSize: 20, fontWeight: '800' },
  priorityLabel: { color: '#64748B', fontSize: 11, marginTop: 4, textAlign: 'center' },
  primaryButton: { backgroundColor: '#1976D2', margin: 16, marginTop: 24, padding: 16, borderRadius: 10, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  logoutButton: { marginHorizontal: 16, marginTop: 8, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#F44336', alignItems: 'center', backgroundColor: '#fff' },
  logoutButtonText: { color: '#C62828', fontWeight: '700' },
});
