import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { formatDateTime } from '@/lib/laporan-ui';
import { formatRupiah, openRabPdf } from '@/lib/rab';
import { supabase } from '@/lib/supabase';

type PublicRab = {
  rab_id: string;
  nomor_rab: string;
  judul: string;
  total_anggaran: number | string;
  sumber_dana: string;
  catatan: string | null;
  published_at: string | null;
  path_pdf: string | null;
  nomor_versi: number | null;
  ukuran_file: number | null;
};

export default function RabWargaScreen() {
  const [items, setItems] = useState<PublicRab[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingId, setOpeningId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('daftar_rab_terbit');
      if (rpcError) throw rpcError;
      setItems((data ?? []) as PublicRab[]);
    } catch (e) {
      console.error('[RabWarga] Failed to load published RAB:', e);
      setError(e instanceof Error ? e.message : 'Daftar RAB tidak dapat dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function handleOpen(item: PublicRab) {
    if (!item.path_pdf) {
      setError('Dokumen PDF RAB belum tersedia.');
      return;
    }
    setOpeningId(item.rab_id);
    setError('');
    try {
      await openRabPdf(item.path_pdf);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF gagal dibuka.');
    } finally {
      setOpeningId('');
    }
  }

  if (loading && !refreshing) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1976D2" /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transparansi RAB</Text>
      <Text style={styles.subtitle}>RAB yang diterbitkan dapat dilihat oleh semua warga yang login. Informasi laporan pelapor tidak ditampilkan di sini.</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={items}
        keyExtractor={(item) => item.rab_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
        contentContainerStyle={items.length ? styles.list : styles.emptyList}
        ListEmptyComponent={<Text style={styles.empty}>Belum ada RAB yang diterbitkan.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.number}>{item.nomor_rab}</Text>
            <Text style={styles.heading}>{item.judul}</Text>
            <View style={styles.row}><Text style={styles.label}>Anggaran</Text><Text style={styles.amount}>{formatRupiah(item.total_anggaran)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Sumber dana</Text><Text style={styles.value}>{item.sumber_dana}</Text></View>
            {!!item.catatan && <View style={styles.noteBox}><Text style={styles.label}>Catatan</Text><Text style={styles.value}>{item.catatan}</Text></View>}
            {!!item.published_at && <Text style={styles.date}>Diterbitkan {formatDateTime(item.published_at)}</Text>}
            <TouchableOpacity style={styles.button} onPress={() => void handleOpen(item)} disabled={openingId === item.rab_id || !item.path_pdf}>
              {openingId === item.rab_id ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Buka PDF RAB</Text>}
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB', paddingHorizontal: 16, paddingTop: 18 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  title: { color: '#1E293B', fontSize: 23, fontWeight: '800' },
  subtitle: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 12 },
  list: { paddingBottom: 28 }, emptyList: { flexGrow: 1, justifyContent: 'center', paddingBottom: 32 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 15, marginBottom: 12 },
  number: { color: '#1976D2', fontWeight: '800', fontSize: 12 }, heading: { color: '#1E293B', fontSize: 17, fontWeight: '800', marginTop: 5, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 }, label: { color: '#64748B', fontSize: 13 }, value: { color: '#1E293B', fontWeight: '600', textAlign: 'right', flex: 1 },
  amount: { color: '#1259A7', fontWeight: '800', textAlign: 'right', flex: 1 }, noteBox: { borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 8, paddingTop: 9, gap: 4 }, date: { color: '#64748B', fontSize: 12, marginTop: 8 },
  button: { backgroundColor: '#1976D2', borderRadius: 9, padding: 12, alignItems: 'center', marginTop: 12 }, buttonText: { color: '#fff', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#64748B', lineHeight: 20 }, error: { color: '#B91C1C', backgroundColor: '#FEE2E2', borderRadius: 8, padding: 10, marginBottom: 8 },
});
