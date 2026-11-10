import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Print from 'expo-print';
import { jsPDF } from 'jspdf';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { describeError, formatDateTime } from '@/lib/laporan-ui';
import { fetchRabForAdmin, formatRupiah, RAB_BUCKET, type RabForAdmin } from '@/lib/rab';

export default function KelolaRabAdminScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const laporanId = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const [data, setData] = useState<RabForAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [nomor, setNomor] = useState('');
  const [judul, setJudul] = useState('');
  const [anggaran, setAnggaran] = useState('');
  const [sumber, setSumber] = useState('');
  const [catatan, setCatatan] = useState('');

  const load = useCallback(async () => {
    if (!laporanId) {
      setError('ID laporan tidak tersedia.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await fetchRabForAdmin(laporanId);
      setData(result);
      if (result) {
        setNomor(result.rab.nomor_rab);
        setJudul(result.rab.judul);
        setAnggaran(String(result.rab.total_anggaran));
        setSumber(result.rab.sumber_dana);
        setCatatan(result.rab.catatan ?? '');
      }
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [laporanId]);

  useEffect(() => { void load(); }, [load]);

  function makeHtml() {
    const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
    const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date());
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: A4; margin: 22mm 20mm; } body { font-family: Arial, sans-serif; color: #172033; font-size: 12pt; }
      h1 { text-align: center; font-size: 17pt; margin: 0 0 6px; } .sub { text-align:center; color:#475569; margin-bottom:26px; }
      table { width:100%; border-collapse:collapse; margin:20px 0; } td { border:1px solid #94a3b8; padding:10px; }
      td:first-child { width:35%; font-weight:bold; background:#f1f5f9; } .amount { font-size:16pt; font-weight:bold; }
      .note { margin-top:24px; white-space:pre-wrap; } .footer { margin-top:52px; text-align:right; }
    </style></head><body>
      <h1>RENCANA ANGGARAN BIAYA</h1><div class="sub">DOKUMEN RAB LAPORAN INFRASTRUKTUR DESA</div>
      <table><tr><td>Nomor RAB</td><td>${escape(nomor.trim())}</td></tr>
      <tr><td>Judul perbaikan</td><td>${escape(judul.trim())}</td></tr>
      <tr><td>Anggaran perbaikan</td><td class="amount">${escape(formatRupiah(anggaran))}</td></tr>
      <tr><td>Sumber dana</td><td>${escape(sumber.trim())}</td></tr>
      <tr><td>Tanggal dokumen</td><td>${escape(date)}</td></tr></table>
      ${catatan.trim() ? `<div class="note"><b>Catatan:</b><br>${escape(catatan.trim())}</div>` : ''}
      <p>Dokumen ini merupakan ringkasan RAB yang diterbitkan melalui aplikasi LaporDesa.</p>
      <div class="footer">Pemerintah Desa<br><br><br>________________________</div>
    </body></html>`;
  }

  async function generatePdfBlob(): Promise<Blob> {
    if (Platform.OS === 'web') {
      const pdf = new jsPDF({ format: 'a4', unit: 'mm' });
      const margin = 20;
      let y = 25;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text('RENCANA ANGGARAN BIAYA', 105, y, { align: 'center' });
      y += 8;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text('DOKUMEN RAB LAPORAN INFRASTRUKTUR DESA', 105, y, { align: 'center' });
      y += 18;
      const rows: [string, string][] = [
        ['Nomor RAB', nomor.trim()],
        ['Judul perbaikan', judul.trim()],
        ['Anggaran perbaikan', formatRupiah(anggaran)],
        ['Sumber dana', sumber.trim()],
        ['Tanggal dokumen', new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date())],
      ];
      for (const [label, value] of rows) {
        const lines = pdf.splitTextToSize(value, 95) as string[];
        const rowHeight = Math.max(12, lines.length * 5 + 6);
        if (y + rowHeight > 260) { pdf.addPage(); y = 22; }
        pdf.setFillColor(241, 245, 249);
        pdf.rect(margin, y, 55, rowHeight, 'F');
        pdf.setDrawColor(148, 163, 184);
        pdf.rect(margin, y, 55, rowHeight);
        pdf.rect(margin + 55, y, 110, rowHeight);
        pdf.setFont('helvetica', 'bold');
        pdf.text(label, margin + 3, y + 7);
        pdf.setFont('helvetica', 'normal');
        pdf.text(lines, margin + 58, y + 7);
        y += rowHeight;
      }
      if (catatan.trim()) {
        y += 12;
        pdf.setFont('helvetica', 'bold');
        pdf.text('Catatan:', margin, y);
        y += 6;
        pdf.setFont('helvetica', 'normal');
        pdf.text(pdf.splitTextToSize(catatan.trim(), 165), margin, y);
        y += 14;
      }
      y += 8;
      pdf.setFontSize(9);
      pdf.text('Dokumen ini merupakan ringkasan RAB yang diterbitkan melalui aplikasi LaporDesa.', margin, y);
      y += 25;
      pdf.text('Pemerintah Desa', 165, y, { align: 'center' });
      y += 22;
      pdf.text('________________________', 165, y, { align: 'center' });
      const output = pdf.output('blob');
      if (!output.size) throw new Error('PDF yang dihasilkan kosong.');
      return output;
    }

    const generated = await Print.printToFileAsync({ html: makeHtml() });
    if (!generated || typeof generated.uri !== 'string' || !generated.uri.trim()) {
      throw new Error('PDF gagal dibuat oleh perangkat. Pastikan aplikasi sudah dibangun ulang setelah pemasangan expo-print.');
    }
    const response = await fetch(generated.uri);
    if (!response.ok) throw new Error('PDF hasil generate tidak dapat dibaca.');
    const blob = await response.blob();
    if (!blob.size) throw new Error('PDF yang dihasilkan kosong.');
    return blob;
  }

  async function uploadGeneratedPdf(path: string, blob: Blob) {
    const { error: uploadError } = await supabase.storage.from(RAB_BUCKET).upload(path, blob, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (uploadError) throw uploadError;
    return blob.size;
  }

  async function saveDraft() {
    if (!laporanId) return;
    const amount = Number(anggaran.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
    if (!nomor.trim() || !judul.trim() || !sumber.trim()) {
      setError('Nomor RAB, judul perbaikan, dan sumber dana wajib diisi.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Masukkan anggaran yang valid dan lebih besar dari nol.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    let uploadedPath = '';
    try {
      const pdfBlob = await generatePdfBlob();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error('Sesi login tidak tersedia.');
      uploadedPath = `${laporanId}/rab/${userId}/${Date.now()}-rab.pdf`;
      const fileSize = await uploadGeneratedPdf(uploadedPath, pdfBlob);
      if (!data) {
        const { error: rpcError } = await supabase.rpc('simpan_rab', {
          p_laporan_id: laporanId,
          p_nomor_rab: nomor.trim(),
          p_judul: judul.trim(),
          p_total_anggaran: amount,
          p_sumber_dana: sumber.trim(),
          p_catatan: catatan.trim() || null,
          p_path_pdf: uploadedPath,
          p_ukuran_file: fileSize,
        });
        if (rpcError) throw rpcError;
      } else {
        const { data: updatedRows, error: updateError } = await supabase.from('rab').update({
          nomor_rab: nomor.trim(), judul: judul.trim(), total_anggaran: amount,
          sumber_dana: sumber.trim(), catatan: catatan.trim() || null,
        }).eq('id', data.rab.id).eq('status', 'draft').select('id');
        if (updateError) throw updateError;
        if (!updatedRows?.length) throw new Error('RAB sudah diterbitkan atau tidak dapat diedit.');
        const { error: versionError } = await supabase.rpc('revisi_rab', {
          p_rab_id: data.rab.id, p_path_pdf: uploadedPath, p_ukuran_file: fileSize,
        });
        if (versionError) throw versionError;
      }
      setNotice(data ? 'Perubahan draft dan PDF berhasil disimpan.' : 'Draft RAB dan PDF berhasil dibuat.');
      await load();
    } catch (e) {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from(RAB_BUCKET).remove([uploadedPath]);
        if (cleanupError) console.warn('[KelolaRAB] File cleanup failed:', cleanupError.message);
      }
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!data) return;
    const confirmPublish = async () => {
      setPublishing(true);
      setError('');
      try {
        const { error: rpcError } = await supabase.rpc('terbitkan_rab', { p_rab_id: data.rab.id });
        if (rpcError) throw rpcError;
        setNotice('RAB berhasil diterbitkan dan dapat dilihat semua warga yang login.');
        await load();
      } catch (e) {
        setError(describeError(e));
      } finally {
        setPublishing(false);
      }
    };
    if (Platform.OS === 'web') {
      await confirmPublish();
    } else {
      Alert.alert('Terbitkan RAB?', 'Setelah diterbitkan, data RAB tidak dapat diedit.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Terbitkan', onPress: () => void confirmPublish() },
      ]);
    }
  }

  async function downloadPdf(path: string, fileName: string) {
    setDownloadingPath(path);
    setError('');
    try {
      const { data: signed, error: signedError } = await supabase.storage.from(RAB_BUCKET).createSignedUrl(path, 60 * 10);
      if (signedError) throw signedError;
      const result = await fetch(signed.signedUrl);
      if (!result.ok) throw new Error('PDF gagal diunduh.');
      const blob = await result.blob();
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const browserDocument = (globalThis as unknown as { document?: { createElement: (tag: string) => { href: string; download: string; click: () => void } } }).document;
        if (!browserDocument) throw new Error('Unduh PDF tidak didukung di lingkungan ini.');
        const anchor = browserDocument.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
      } else if (await Sharing.isAvailableAsync()) {
        const base64 = await blobToBase64(blob);
        const uri = `${(await import('expo-file-system/legacy')).cacheDirectory}${fileName}`;
        await (await import('expo-file-system/legacy')).writeAsStringAsync(uri, base64, { encoding: 'base64' });
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Simpan atau bagikan PDF RAB' });
      } else {
        throw new Error('Fitur unduh/bagikan file tidak tersedia pada perangkat ini.');
      }
    } catch (e) {
      setError(describeError(e));
    } finally {
      setDownloadingPath('');
    }
  }

  async function previewPdf() {
    setError('');
    try {
      await Print.printAsync({ html: makeHtml() });
    } catch (e) {
      setError(describeError(e));
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1976D2" /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{data ? 'Kelola RAB' : 'Buat RAB'}</Text>
        <Text style={styles.subtitle}>Isi ringkasan RAB. Aplikasi akan membuat PDF resmi secara otomatis.</Text>
        {!!error && <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View>}
        {!!notice && <View style={styles.successBox}><Text style={styles.success}>{notice}</Text></View>}

        {!data || data.rab.status === 'draft' ? (
          <View style={styles.card}>
            <Field label="Nomor RAB" value={nomor} onChangeText={setNomor} placeholder="Contoh: RAB/2026/001" />
            <Field label="Judul perbaikan" value={judul} onChangeText={setJudul} placeholder="Contoh: Perbaikan jalan RT 02" />
            <Field label="Anggaran perbaikan (Rp)" value={anggaran} onChangeText={setAnggaran} placeholder="Contoh: 25000000" keyboardType="decimal-pad" />
            <Field label="Sumber dana" value={sumber} onChangeText={setSumber} placeholder="Contoh: APBDes" />
            <Field label="Catatan (opsional)" value={catatan} onChangeText={setCatatan} placeholder="Catatan tambahan" multiline />
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void previewPdf()} disabled={saving}>
              <Text style={styles.secondaryText}>Pratinjau / cetak PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, saving && styles.disabled]} onPress={() => void saveDraft()} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{data ? 'Simpan perubahan draft' : 'Buat draft dan PDF'}</Text>}
            </TouchableOpacity>
            {data?.rab.status === 'draft' && (
              <TouchableOpacity style={[styles.publishButton, publishing && styles.disabled]} onPress={() => void publish()} disabled={publishing || saving}>
                {publishing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Terbitkan RAB</Text>}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.publishedBadge}>PUBLISHED · TIDAK DAPAT DIEDIT</Text>
            <Text style={styles.fieldLabel}>{data.rab.nomor_rab} · {data.rab.judul}</Text>
            <Text style={styles.summary}>{formatRupiah(data.rab.total_anggaran)} · {data.rab.sumber_dana}</Text>
            <Text style={styles.muted}>Diterbitkan {formatDateTime(data.rab.published_at)}</Text>
          </View>
        )}

        {data && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>PDF RAB</Text>
            {data.versions.map((version, index) => (
              <View key={version.id} style={styles.versionRow}>
                <View style={styles.versionText}>
                  <Text style={styles.fieldLabel}>Versi {version.nomor_versi}{index === 0 ? ' · terbaru' : ''}</Text>
                  <Text style={styles.muted}>{formatDateTime(version.waktu_unggah)}</Text>
                </View>
                <TouchableOpacity style={styles.openButton} onPress={() => void downloadPdf(version.path_pdf, `${data.rab.nomor_rab}-v${version.nomor_versi}.pdf`)} disabled={downloadingPath === version.path_pdf}>
                  {downloadingPath === version.path_pdf ? <ActivityIndicator color="#1976D2" /> : <Text style={styles.openText}>Unduh PDF</Text>}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>Kembali ke detail laporan</Text></TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onerror = () => reject(new Error('PDF tidak dapat disiapkan untuk diunduh.'));
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      resolve(result.split(',')[1] ?? '');
    };
    reader.readAsDataURL(blob);
  });
}

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={[styles.input, multiline && styles.multiline]} value={value} onChangeText={onChangeText} placeholder={placeholder} multiline={multiline} keyboardType={keyboardType ?? 'default'} maxLength={multiline ? 1000 : 120} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' }, content: { padding: 18, paddingBottom: 40 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#1E293B', fontSize: 23, fontWeight: '800' }, subtitle: { color: '#64748B', fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 14 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 15, marginBottom: 14 }, field: { marginBottom: 13 },
  fieldLabel: { color: '#334155', fontWeight: '700', fontSize: 13, marginBottom: 6 }, input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, color: '#1E293B', backgroundColor: '#F8FAFC' }, multiline: { minHeight: 76, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: '#1976D2', borderRadius: 9, padding: 14, alignItems: 'center', marginTop: 11 }, publishButton: { backgroundColor: '#2F855A', borderRadius: 9, padding: 14, alignItems: 'center', marginTop: 10 }, primaryText: { color: '#fff', fontWeight: '800' }, disabled: { opacity: 0.6 },
  secondaryButton: { borderWidth: 1, borderColor: '#1976D2', borderRadius: 9, padding: 13, alignItems: 'center' }, secondaryText: { color: '#1259A7', fontWeight: '700' },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 9, padding: 11, marginBottom: 12 }, error: { color: '#B91C1C', lineHeight: 20 }, successBox: { backgroundColor: '#C6F6D5', borderRadius: 9, padding: 11, marginBottom: 12 }, success: { color: '#22543D', lineHeight: 20 },
  sectionTitle: { color: '#1E293B', fontSize: 17, fontWeight: '800', marginBottom: 10 }, versionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingVertical: 12, gap: 8 }, versionText: { flex: 1 },
  openButton: { paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#1976D2', borderRadius: 8 }, openText: { color: '#1259A7', fontWeight: '700' }, publishedBadge: { color: '#2F855A', fontWeight: '900', marginBottom: 10 }, summary: { color: '#1259A7', fontWeight: '800', fontSize: 16, marginTop: 8 }, muted: { color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 5 },
  backButton: { padding: 13, alignItems: 'center' }, backText: { color: '#1976D2', fontWeight: '700' },
});
