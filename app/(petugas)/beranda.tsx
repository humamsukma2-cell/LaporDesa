import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { categoryName, describeError, formatDateTime, statusMeta } from '@/lib/laporan-ui';
import type { StatusLaporanType } from '@/types';

type TaskItem = {
  id: string;
  kode_laporan: string;
  deskripsi: string;
  status: StatusLaporanType;
  created_at: string;
  patokan_lokasi: string;
  kategori: { nama: string } | { nama: string }[] | null;
};

const ACTIVE: StatusLaporanType[] = ['assigned', 'in_progress'];

export default function BerandaPetugasScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadTasks = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase
        .from('laporan')
        .select('id, kode_laporan, deskripsi, status, created_at, patokan_lokasi, kategori(nama)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTasks((data ?? []) as unknown as TaskItem[]);
    } catch (error) {
      console.error('[PetugasBeranda] Failed to load tasks:', error);
      setErrorMessage(describeError(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadTasks(); }, [loadTasks]));

  const activeTasks = useMemo(() => tasks.filter((task) => ACTIVE.includes(task.status)), [tasks]);
  const finishedTasks = useMemo(() => tasks.filter((task) => task.status === 'resolved'), [tasks]);

  async function handleSignOut() {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  const renderTask = ({ item }: { item: TaskItem }) => {
    const status = statusMeta(item.status);
    return (
      <TouchableOpacity
        style={styles.card}
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/(petugas)/detail/[id]', params: { id: item.id } })}
      >
        <View style={styles.cardTop}>
          <Text style={styles.code}>{item.kode_laporan || 'Tugas'}</Text>
          <Text style={[styles.statusBadge, { color: status.color, backgroundColor: status.background }]}>{status.label}</Text>
        </View>
        <Text style={styles.category}>{categoryName(item.kategori)}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.deskripsi}</Text>
        <Text style={styles.meta}>Patokan: {item.patokan_lokasi}</Text>
        <View style={styles.cardBottom}>
          <Text style={styles.meta}>{formatDateTime(item.created_at)}</Text>
          <Text style={styles.detailLink}>Buka tugas ›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const data = useMemo(() => [
    ...activeTasks.map((task) => ({ ...task, __section: 'active' as const })),
    ...finishedTasks.map((task) => ({ ...task, __section: 'finished' as const })),
  ], [activeTasks, finishedTasks]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Petugas Lapangan</Text>
        <Text style={styles.name}>{profile?.nama ?? 'Petugas'}</Text>
        <Text style={styles.headerHint}>{activeTasks.length} tugas aktif · {finishedTasks.length} selesai</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1976D2" /><Text style={styles.muted}>Memuat tugas…</Text></View>
      ) : errorMessage ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Tugas belum dapat dimuat</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadTasks()}><Text style={styles.retryText}>Coba lagi</Text></TouchableOpacity>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}><Text style={styles.emptyTitle}>Belum ada tugas</Text><Text style={styles.muted}>Tugas yang diberikan admin akan muncul di sini.</Text></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View>
              {item.__section === 'active' && activeTasks[0]?.id === item.id && <Text style={styles.sectionTitle}>Tugas aktif</Text>}
              {item.__section === 'finished' && finishedTasks[0]?.id === item.id && <Text style={styles.sectionTitle}>Selesai</Text>}
              {renderTask({ item })}
            </View>
          )}
          style={styles.listContainer}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadTasks(true)} tintColor="#1976D2" />}
        />
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={() => void handleSignOut()}>
        <Text style={styles.logoutButtonText}>Keluar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  header: { backgroundColor: '#1259A7', padding: 22, paddingTop: 28 },
  greeting: { color: '#DBEAFE', fontSize: 14 },
  name: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 },
  headerHint: { color: '#BFDBFE', fontSize: 13, marginTop: 8 },
  list: { padding: 14, gap: 12, paddingBottom: 24 },
  listContainer: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  muted: { color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  errorTitle: { color: '#1E293B', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorText: { color: '#B91C1C', textAlign: 'center', lineHeight: 21 },
  emptyTitle: { color: '#1E293B', fontSize: 19, fontWeight: '700' },
  retryButton: { backgroundColor: '#1976D2', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 9, marginTop: 16 },
  retryText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { color: '#1E293B', fontSize: 15, fontWeight: '800', marginBottom: 8, marginTop: 6 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  code: { color: '#1E293B', fontSize: 14, fontWeight: '800', flex: 1 },
  statusBadge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },
  category: { color: '#1976D2', fontWeight: '700', marginTop: 10 },
  description: { color: '#334155', fontSize: 14, lineHeight: 20, marginTop: 6 },
  meta: { color: '#64748B', fontSize: 12, marginTop: 7 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8 },
  detailLink: { color: '#1259A7', fontWeight: '700', fontSize: 13 },
  logoutButton: { margin: 14, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#F44336', alignItems: 'center', backgroundColor: '#fff' },
  logoutButtonText: { color: '#C62828', fontWeight: '700' },
});
