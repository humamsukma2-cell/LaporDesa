import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { formatDateTime } from '@/lib/laporan-ui';
import { supabase } from '@/lib/supabase';
import {
  formatFileSize,
  formatRupiah,
  openRabPdf,
  RAB_BUCKET,
  type RabWithVersion,
} from '@/lib/rab';

type Props = {
  data: RabWithVersion | null;
  emptyText?: string;
};

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('PDF tidak dapat disiapkan untuk diunduh.'));
    reader.onloadend = () => resolve(String(reader.result ?? '').split(',')[1] ?? '');
    reader.readAsDataURL(blob);
  });
}

export function RabPanel({ data, emptyText = 'RAB belum tersedia untuk laporan ini.' }: Props) {
  const [opening, setOpening] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  if (!data) return <Text style={styles.muted}>{emptyText}</Text>;
  if (!data.version) {
    return <Text style={styles.muted}>RAB sudah terbit, tetapi file PDF belum tersedia. Hubungi admin desa.</Text>;
  }

  const { rab, version } = data;

  async function handleOpen() {
    if (!version) return;
    setOpening(true);
    setError('');
    try {
      await openRabPdf(version.path_pdf);
    } catch (openError) {
      console.error('[RabPanel] Failed to open RAB PDF:', openError);
      setError(openError instanceof Error ? openError.message : 'PDF RAB gagal dibuka. Periksa koneksi lalu coba lagi.');
    } finally {
      setOpening(false);
    }
  }

  async function handleDownload() {
    if (!version) return;
    setDownloading(true);
    setError('');
    try {
      const { data: signed, error: signedError } = await supabase.storage.from(RAB_BUCKET).createSignedUrl(version.path_pdf, 60 * 10);
      if (signedError) throw signedError;
      const response = await fetch(signed.signedUrl);
      if (!response.ok) throw new Error('PDF RAB gagal diunduh.');
      const blob = await response.blob();
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const browserDocument = (globalThis as unknown as { document?: { createElement: (tag: string) => { href: string; download: string; click: () => void } } }).document;
        if (!browserDocument) throw new Error('Unduh PDF tidak didukung di lingkungan ini.');
        const anchor = browserDocument.createElement('a');
        anchor.href = url;
        anchor.download = `${rab.nomor_rab}-v${version.nomor_versi}.pdf`;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const base64 = await blobToBase64(blob);
        const uri = `${FileSystem.cacheDirectory}${rab.nomor_rab}-v${version.nomor_versi}.pdf`;
        await FileSystem.writeAsStringAsync(uri, base64, { encoding: 'base64' });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Unduh atau bagikan RAB' });
        } else {
          throw new Error('Fitur unduh PDF tidak tersedia pada perangkat ini.');
        }
      }
    } catch (downloadError) {
      console.error('[RabPanel] Failed to download RAB PDF:', downloadError);
      setError(downloadError instanceof Error ? downloadError.message : 'PDF RAB gagal diunduh.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>Nomor RAB</Text>
        <Text style={styles.value}>{rab.nomor_rab}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Judul</Text>
        <Text style={styles.value}>{rab.judul}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Total anggaran</Text>
        <Text style={styles.total}>{formatRupiah(rab.total_anggaran)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Sumber dana</Text>
        <Text style={styles.value}>{rab.sumber_dana}</Text>
      </View>
      {!!rab.catatan && (
        <View style={styles.row}>
          <Text style={styles.label}>Catatan</Text>
          <Text style={styles.value}>{rab.catatan}</Text>
        </View>
      )}
      <View style={styles.row}>
        <Text style={styles.label}>Dokumen PDF</Text>
        <Text style={styles.value}>Versi {version.nomor_versi} · {formatFileSize(version.ukuran_file)}</Text>
      </View>
      {!!rab.published_at && (
        <View style={styles.row}>
          <Text style={styles.label}>Diterbitkan</Text>
          <Text style={styles.value}>{formatDateTime(rab.published_at)}</Text>
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, opening && styles.disabled]}
        onPress={() => void handleOpen()}
        disabled={opening}
      >
        {opening ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{error ? 'Coba buka lagi' : 'Buka PDF RAB'}</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={[styles.downloadButton, downloading && styles.disabled]} onPress={() => void handleDownload()} disabled={downloading}>
        {downloading ? <ActivityIndicator color="#1259A7" /> : <Text style={styles.downloadText}>Unduh PDF RAB</Text>}
      </TouchableOpacity>

      <Text style={styles.note}>
        RAB diterbitkan untuk transparansi. Keputusan penggunaan anggaran tetap berada pada pihak berwenang.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
  label: { color: '#64748B', fontSize: 13, flexShrink: 1 },
  value: { color: '#1E293B', fontSize: 13, fontWeight: '600', textAlign: 'right', flexShrink: 1, flex: 1 },
  total: { color: '#1259A7', fontSize: 16, fontWeight: '800', textAlign: 'right' },
  button: { backgroundColor: '#1976D2', borderRadius: 9, padding: 13, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: '700' },
  downloadButton: { borderWidth: 1, borderColor: '#1976D2', borderRadius: 9, padding: 12, alignItems: 'center', marginTop: 8 },
  downloadText: { color: '#1259A7', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  error: { color: '#B91C1C', fontSize: 13, lineHeight: 19, marginTop: 6 },
  note: { color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 10 },
  muted: { color: '#64748B', fontSize: 13, lineHeight: 20, marginTop: 6 },
});
