import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { formatDateTime } from '@/lib/laporan-ui';
import { formatRupiah, openRabPdf } from '@/lib/rab';
import { supabase } from '@/lib/supabase';
import { CITIZEN_CARD_SHADOW, CITIZEN_COLORS as C, CITIZEN_RADIUS } from '@/lib/masyarakat-theme';
import { useMasyarakatShell, MasyarakatPageHeader } from '@/components/MasyarakatShell';

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
  const { desktop } = useMasyarakatShell();
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
    return <View style={styles.center}><ActivityIndicator size="large" color={C.primaryStrong} /></View>;
  }

  const pad = desktop ? 40 : 16;

  return (
    <View style={styles.container}>
      <MasyarakatPageHeader
        eyebrow="TRANSPARANSI ANGGARAN"
        title="RAB"
        subtitle="Rencana anggaran biaya yang sudah diterbitkan."
        note="Buka dokumen PDF untuk melihat rincian biaya."
      />
      {!!error && <Text style={[styles.error, { marginHorizontal: pad }]}>{error}</Text>}
      {items.length > 0 && (
        <View style={[styles.rabHero, !desktop && styles.rabHeroMobile, { marginHorizontal: pad }]}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Anggaran terbuka, desa terpercaya.</Text>
            <Text style={styles.heroSubtitle}>Pantau rencana biaya dan dokumen penanganan laporan Anda.</Text>
          </View>
          <View style={[styles.heroAmountWrap, !desktop && styles.heroAmountWrapMobile]}>
            <Text style={[styles.heroAmount, !desktop && styles.heroAmountMobile]}>{formatRupiah(items.reduce((sum, item) => sum + Number(item.total_anggaran || 0), 0))}</Text>
            <Text style={styles.heroSubtitle}>{items.length} dokumen RAB tersedia</Text>
          </View>
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(item) => item.rab_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.primaryStrong} />}
        contentContainerStyle={[items.length ? styles.list : styles.emptyList, { paddingHorizontal: pad }]}
        numColumns={desktop ? 2 : 1}
        columnWrapperStyle={desktop && items.length > 1 ? styles.rabColumns : undefined}
        ListEmptyComponent={<Text style={styles.empty}>Belum ada RAB yang diterbitkan.</Text>}
        renderItem={({ item, index }) => (
          <View style={[styles.card, { padding: desktop ? 20 : 16 }, desktop && styles.cardDesktop]}>
            <Text style={styles.number}>{index === 0 ? 'DOKUMEN TERBARU' : 'PDF'} · #{item.nomor_rab}</Text>
            <View style={[styles.rabCardHeader, !desktop && styles.rabCardHeaderMobile]}>
              <View style={[styles.rabCardCopy, desktop && styles.rabCardCopyDesktop]}><Text style={[styles.heading, !desktop && styles.headingMobile]}>{item.judul}</Text><Text style={styles.date}>Diterbitkan {formatDateTime(item.published_at ?? '')}</Text></View>
              <TouchableOpacity style={[styles.button, !desktop && styles.buttonMobile]} onPress={() => void handleOpen(item)} disabled={openingId === item.rab_id || !item.path_pdf}>
                {openingId === item.rab_id ? <ActivityIndicator color={C.white} /> : <Text style={styles.buttonText}>Unduh PDF</Text>}
              </TouchableOpacity>
            </View>
            <View style={styles.breakdownHead}><Text style={styles.number}>RINCIAN ANGGARAN</Text><Text style={styles.number}>JUMLAH</Text></View>
            <View style={styles.row}><Text style={styles.label}>Sumber dana</Text><Text style={styles.value}>{item.sumber_dana}</Text></View>
            {!!item.catatan && <View style={styles.row}><Text style={styles.label}>Catatan</Text><Text style={styles.value}>{item.catatan}</Text></View>}
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Total anggaran</Text><Text style={styles.amount}>{formatRupiah(item.total_anggaran)}</Text></View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  rabHero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 18, borderRadius: CITIZEN_RADIUS.card, padding: 24, marginTop: 18, marginBottom: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.cardBorder, ...CITIZEN_CARD_SHADOW },
  rabHeroMobile: { flexDirection: 'column', alignItems: 'flex-start', gap: 16, padding: 16 },
  heroCopy: { flexShrink: 1 },
  heroTitle: { color: C.text, fontSize: 22, fontWeight: '800', lineHeight: 29 },
  heroSubtitle: { color: C.muted, fontSize: 11, marginTop: 5, lineHeight: 17 },
  heroAmountWrap: { alignItems: 'flex-end', flexShrink: 0 },
  heroAmountWrapMobile: { alignItems: 'flex-start' },
  heroAmount: { color: C.text, fontSize: 25, fontWeight: '800' },
  heroAmountMobile: { fontSize: 22, lineHeight: 28 },
  list: { paddingBottom: 24, width: '100%' }, emptyList: { flexGrow: 1, justifyContent: 'center', paddingBottom: 32 },
  rabColumns: { gap: 18 },
  card: { alignSelf: 'stretch', minWidth: 0, backgroundColor: C.surface, borderWidth: 1, borderColor: C.cardBorder, borderRadius: CITIZEN_RADIUS.card, padding: 20, marginBottom: 14, ...CITIZEN_CARD_SHADOW },
  cardDesktop: { flex: 1 },
  number: { color: '#49647C', fontWeight: '800', fontSize: 9, letterSpacing: 0.4 },
  rabCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 8 },
  rabCardHeaderMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 14 },
  rabCardCopy: { minWidth: 0 },
  rabCardCopyDesktop: { flex: 1 },
  heading: { color: C.text, fontSize: 20, fontWeight: '800', lineHeight: 27 },
  headingMobile: { fontSize: 18, lineHeight: 24 },
  breakdownHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 25, paddingBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  label: { color: C.textBody, fontSize: 13, flexShrink: 1 }, value: { color: C.text, fontWeight: '600', textAlign: 'right', flex: 1, lineHeight: 19 },
  amount: { color: C.text, fontWeight: '800', textAlign: 'right', fontSize: 19, flexShrink: 1 },
  totalRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: C.cardBorderSoft, marginTop: 13, paddingTop: 15 },
  totalLabel: { color: C.text, fontSize: 13, fontWeight: '700' },
  date: { color: C.muted, fontSize: 10, marginTop: 7 },
  button: { backgroundColor: C.black, borderRadius: CITIZEN_RADIUS.pill, minHeight: 44, minWidth: 140, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' }, buttonMobile: { minWidth: 0, width: '100%' }, buttonText: { color: C.white, fontWeight: '700', fontSize: 12 },
  empty: { textAlign: 'center', color: C.muted, lineHeight: 20 }, error: { color: C.danger, backgroundColor: C.dangerSoft, borderRadius: 12, padding: 12, marginBottom: 8 },
});
