import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import * as Print from 'expo-print';
import { jsPDF } from 'jspdf';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AdminPageFooter, AdminPageHeader, AdminSectionTitle, AdminShell } from '@/components/admin/AdminShell';
import { ADMIN_COLORS as C } from '@/lib/theme';
import { describeError, formatDateTime } from '@/lib/laporan-ui';
import { fetchRabForAdmin, formatRupiah, RAB_BUCKET, type RabForAdmin } from '@/lib/rab';

export default function KelolaRabAdminScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const laporanId = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
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

  function parseAnggaran(value: string): number {
    const normalized = value.trim().replace(/\s/g, '');
    if (!normalized) return 0;
    // Indonesian format (25.000.000 or 25.000.000,50) and plain digits
    // use dot as thousands separator; a single comma may represent decimals.
    const canonical = normalized.includes(',')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/\./g, '');
    const parsed = Number(canonical);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatAnggaranInput(value: string): string {
    const digits = value.replace(/\D/g, '');
    return digits ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(digits)) : '';
  }

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
        setAnggaran(formatAnggaranInput(String(Math.round(Number(result.rab.total_anggaran)))));
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
    const escape = (value: string, multiline = false) => {
      const safe = value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
      return multiline ? safe.replace(/\r?\n/g, '<br>') : safe;
    };
    const amountText = formatRupiah(parseAnggaran(anggaran));
    const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date());
    const published = data?.rab.status === 'published';
    const documentStatus = published ? 'Dokumen terbit' : 'Draft';
    return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>RAB ${escape(nomor.trim())}</title>
<style>
  @page { size: A4; margin: 17mm 18mm 18mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body {
    font-family: "Segoe UI", Arial, Helvetica, sans-serif;
    color: #1B3430; font-size: 10.5pt; line-height: 1.55;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .sheet { width: 100%; max-width: 174mm; margin: 0 auto; }
  .topbar { height: 6px; border-radius: 999px; margin-bottom: 20px;
    background: linear-gradient(90deg, #07564B 0%, #166B57 58%, #C28A4A 100%); }
  .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px;
    padding-bottom: 16px; border-bottom: 1.5px solid #DCE7E2; }
  .brand { color: #166B57; font-size: 8pt; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
  h1 { margin: 7px 0 4px; font-size: 20pt; line-height: 1.15; color: #07564B; letter-spacing: -.01em; }
  .subtitle { margin: 0; color: #758681; font-size: 9.5pt; }
  .badge { flex: none; margin-top: 3px; padding: 6px 12px; border-radius: 999px; font-size: 8pt;
    font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .badge.draft { color: #A86A13; background: #FBF1DF; border: 1px solid #EED9B5; }
  .badge.published { color: #17805D; background: #E8F3ED; border: 1px solid #CBE7DA; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0 0; }
  .meta-card { background: #F4F8F6; border: 1px solid #DCE7E2; border-radius: 10px; padding: 11px 14px; }
  .meta-card.wide { grid-column: 1 / -1; }
  .label { display: block; color: #758681; font-size: 7.5pt; font-weight: 800;
    letter-spacing: .14em; text-transform: uppercase; margin-bottom: 4px; }
  .value { display: block; color: #1B3430; font-size: 10.5pt; font-weight: 700; }
  .amount-card { display: flex; align-items: center; justify-content: space-between; gap: 20px;
    margin: 18px 0; padding: 20px 24px; border-radius: 14px; color: #ffffff;
    background: linear-gradient(135deg, #07564B 0%, #166B57 100%); }
  .amount-label { display: block; color: #CFE8E0; font-size: 8pt; font-weight: 800;
    letter-spacing: .14em; text-transform: uppercase; }
  .amount { display: block; margin-top: 4px; font-size: 23pt; line-height: 1.1;
    font-weight: 800; letter-spacing: -.02em; }
  .amount-mark { flex: none; width: 58px; height: 58px; border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,.42); display: flex; align-items: center;
    justify-content: center; font-size: 9pt; font-weight: 800; letter-spacing: .08em; }
  .note { margin-top: 18px; padding: 13px 16px; border-radius: 0 10px 10px 0;
    border-left: 4px solid #C28A4A; background: #FBF6EC; }
  .note-title { color: #8A5A1F; font-size: 8pt; font-weight: 800;
    letter-spacing: .12em; text-transform: uppercase; margin-bottom: 4px; }
  .note p { margin: 0; color: #4A3A25; }
  .closing { margin-top: 20px; color: #60756F; font-size: 9.5pt; }
  .signature { margin-top: 34px; display: flex; justify-content: flex-end; }
  .signature-box { width: 62mm; text-align: center; }
  .signature-date { color: #60756F; font-size: 9pt; }
  .signature-title { margin-top: 4px; color: #1B3430; font-weight: 700; font-size: 10pt; }
  .signature-space { height: 24mm; }
  .signature-line { border-top: 1px solid #334155; padding-top: 5px; font-weight: 700; font-size: 10pt; }
  .signature-name { margin-top: 2px; color: #758681; font-size: 8.5pt; }
  .footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #E4ECE8;
    display: flex; justify-content: space-between; gap: 12px;
    color: #8AA09A; font-size: 7.5pt; letter-spacing: .04em; }
</style></head>
<body><div class="sheet">
  <div class="topbar"></div>
  <header class="header">
    <div>
      <div class="brand">LaporDesa &middot; Pemerintah Desa</div>
      <h1>Rencana Anggaran Biaya</h1>
      <p class="subtitle">Dokumen perencanaan biaya perbaikan infrastruktur desa</p>
    </div>
    <span class="badge ${published ? 'published' : 'draft'}">${documentStatus}</span>
  </header>

  <div class="meta">
    <div class="meta-card wide"><span class="label">Nomor RAB</span><span class="value">${escape(nomor.trim())}</span></div>
    <div class="meta-card wide"><span class="label">Judul perbaikan</span><span class="value">${escape(judul.trim())}</span></div>
    <div class="meta-card"><span class="label">Sumber dana</span><span class="value">${escape(sumber.trim())}</span></div>
    <div class="meta-card"><span class="label">Tanggal dokumen</span><span class="value">${escape(date)}</span></div>
  </div>

  <div class="amount-card">
    <div>
      <span class="amount-label">Total anggaran perbaikan</span>
      <span class="amount">${escape(amountText)}</span>
    </div>
    <span class="amount-mark">RAB</span>
  </div>

  ${catatan.trim() ? `<section class="note"><div class="note-title">Catatan</div><p>${escape(catatan.trim(), true)}</p></section>` : ''}

  <section class="closing">
    <p>Dokumen ini merupakan ringkasan Rencana Anggaran Biaya yang dibuat melalui aplikasi
    LaporDesa dan menjadi bagian dari transparansi pengelolaan infrastruktur desa.</p>
  </section>

  <div class="signature">
    <div class="signature-box">
      <div class="signature-date">${escape(date)}</div>
      <div class="signature-title">Pemerintah Desa</div>
      <div class="signature-space"></div>
      <div class="signature-line">Kepala Desa</div>
      <div class="signature-name">( .................................. )</div>
    </div>
  </div>

  <div class="footer">
    <span>Dibuat otomatis oleh LaporDesa</span>
    <span>${escape(nomor.trim())}</span>
  </div>
</div></body></html>`;
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
        ['Anggaran perbaikan', formatRupiah(parseAnggaran(anggaran))],
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
    const amount = parseAnggaran(anggaran);
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
        // Satu RPC = satu transaksi: metadata draft dan versi PDF tersimpan bersama.
        const { error: updateError } = await supabase.rpc('perbarui_rab_draft', {
          p_rab_id: data.rab.id,
          p_nomor_rab: nomor.trim(),
          p_judul: judul.trim(),
          p_total_anggaran: amount,
          p_sumber_dana: sumber.trim(),
          p_catatan: catatan.trim() || null,
          p_path_pdf: uploadedPath,
          p_ukuran_file: fileSize,
        });
        if (updateError) throw updateError;
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
      const html = makeHtml();
      if (Platform.OS === 'web') {
        printHtmlOnWeb(html);
        return;
      }
      await Print.printAsync({ html });
    } catch (e) {
      setError(describeError(e));
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /><Text style={styles.loadingText}>Memuat data RAB…</Text></View>;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AdminShell
        section="daftar-laporan"
        label="Kelola RAB"
        header={(
          <AdminPageHeader
            eyebrow="RENCANA ANGGARAN BIAYA"
            title={data ? 'Kelola RAB' : 'Buat RAB'}
            subtitle="Isi ringkasan RAB, lalu terbitkan agar dapat dilihat warga."
            note="Aplikasi membuat PDF resmi secara otomatis dari data yang Anda isi."
            accessory={(
              <TouchableOpacity style={styles.backChip} accessibilityRole="button" accessibilityLabel="Kembali ke detail laporan" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/daftar-laporan'))}>
                <Text style={styles.backChipText}>‹ Kembali</Text>
              </TouchableOpacity>
            )}
          />
        )}
      >
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]} keyboardShouldPersistTaps="handled">
        {!!error && <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View>}
        {!!notice && <View style={styles.successBox}><Text style={styles.success}>{notice}</Text></View>}

        {!data || data.rab.status === 'draft' ? (
          <View style={styles.card}>
            <AdminSectionTitle first>Rincian RAB</AdminSectionTitle>
            <Field label="Nomor RAB" value={nomor} onChangeText={setNomor} placeholder="Contoh: RAB/2026/001" />
            <Field label="Judul perbaikan" value={judul} onChangeText={setJudul} placeholder="Contoh: Perbaikan jalan RT 02" />
            <Field label="Anggaran perbaikan (Rp)" value={anggaran} onChangeText={(value) => setAnggaran(formatAnggaranInput(value))} placeholder="Contoh: 25.000.000" keyboardType="number-pad" />
            <Field label="Sumber dana" value={sumber} onChangeText={setSumber} placeholder="Contoh: APBDes" />
            <Field label="Catatan (opsional)" value={catatan} onChangeText={setCatatan} placeholder="Catatan tambahan" multiline />
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void previewPdf()} disabled={saving}>
              <Text style={styles.secondaryText}>Pratinjau / cetak PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, saving && styles.disabled]} onPress={() => void saveDraft()} disabled={saving}>
              {saving ? <ActivityIndicator color={C.onPrimary} /> : <Text style={styles.primaryText}>{data ? 'Simpan perubahan draft' : 'Buat draft dan PDF'}</Text>}
            </TouchableOpacity>
            {data?.rab.status === 'draft' && (
              <TouchableOpacity style={[styles.publishButton, publishing && styles.disabled]} onPress={() => void publish()} disabled={publishing || saving}>
                {publishing ? <ActivityIndicator color={C.onPrimary} /> : <Text style={styles.primaryText}>Terbitkan RAB</Text>}
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
            <AdminSectionTitle first>PDF RAB</AdminSectionTitle>
            {data.versions.map((version, index) => (
              <View key={version.id} style={styles.versionRow}>
                <View style={styles.versionText}>
                  <Text style={styles.fieldLabel}>Versi {version.nomor_versi}{index === 0 ? ' · terbaru' : ''}</Text>
                  <Text style={styles.muted}>{formatDateTime(version.waktu_unggah)}</Text>
                </View>
                <TouchableOpacity style={styles.openButton} onPress={() => void downloadPdf(version.path_pdf, `${data.rab.nomor_rab}-v${version.nomor_versi}.pdf`)} disabled={downloadingPath === version.path_pdf}>
                  {downloadingPath === version.path_pdf ? <ActivityIndicator color={C.primary} /> : <Text style={styles.openText}>Unduh PDF</Text>}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/daftar-laporan'))}><Text style={styles.backText}>‹ Kembali ke detail laporan</Text></TouchableOpacity>
        <AdminPageFooter note="Dokumen RAB diterbitkan dari data laporan desa." />
      </ScrollView>
      </AdminShell>
    </KeyboardAvoidingView>
  );
}

type BrowserIframe = {
  style: Record<string, string>;
  contentWindow: {
    document: { open: () => void; write: (markup: string) => void; close: () => void };
    focus: () => void;
    print: () => void;
  } | null;
  onload: (() => void) | null;
  setAttribute: (name: string, value: string) => void;
  remove: () => void;
};

/**
 * expo-print di web mengabaikan opsi `html` dan mencetak seluruh halaman aplikasi.
 * Cetak dokumen RAB lewat iframe tersembunyi agar pratinjau browser hanya berisi
 * dokumen RAB yang rapi, bukan shell admin.
 */
function printHtmlOnWeb(html: string) {
  const browser = globalThis as unknown as {
    document?: {
      createElement: (tag: string) => BrowserIframe;
      body?: { appendChild: (node: BrowserIframe) => void };
    };
    setTimeout: (callback: () => void, delay?: number) => number;
  };
  const documentRef = browser.document;
  if (!documentRef?.body) throw new Error('Pencetakan dokumen hanya tersedia di browser.');

  const iframe = documentRef.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'Dokumen RAB');
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '-10000px';
  iframe.style.width = '1024px';
  iframe.style.height = '1400px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  documentRef.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  if (!frameWindow) {
    iframe.remove();
    throw new Error('Dokumen cetak tidak dapat disiapkan oleh browser.');
  }

  const frameDocument = frameWindow.document;
  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    try {
      frameWindow.focus();
      frameWindow.print();
    } finally {
      // Beri waktu dialog cetak selesai sebelum iframe dilepas.
      browser.setTimeout(() => iframe.remove(), 1200);
    }
  };

  iframe.onload = () => browser.setTimeout(triggerPrint, 120);
  // Fallback untuk browser yang tidak memicu onload pada document.write.
  browser.setTimeout(triggerPrint, 700);
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
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={[styles.input, multiline && styles.multiline]} value={value} onChangeText={onChangeText} placeholder={placeholder} multiline={multiline} keyboardType={keyboardType ?? 'default'} maxLength={multiline ? 1000 : 120} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.background },
  container: { flex: 1, backgroundColor: C.background },
  content: { padding: 20, paddingBottom: 40, backgroundColor: C.background },
  contentDesktop: { paddingHorizontal: 28, paddingTop: 24, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background },
  loadingText: { color: C.textMuted, fontSize: 13, marginTop: 10 },
  title: { color: C.text, fontSize: 23, fontWeight: '800' },
  subtitle: { color: C.textMuted, fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 14 },
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 18, marginTop: 20 },
  field: { marginBottom: 13 },
  fieldLabel: { color: C.textBody, fontWeight: '700', fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.borderInput, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, minHeight: 44, color: C.text, backgroundColor: C.inputBg },
  multiline: { minHeight: 76, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: C.primary, borderRadius: 9, padding: 14, minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 11 },
  publishButton: { backgroundColor: C.primaryDark, borderRadius: 9, padding: 14, minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  primaryText: { color: C.onPrimary, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  secondaryButton: { borderWidth: 1, borderColor: C.primary, borderRadius: 9, padding: 13, minHeight: 46, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: C.primary, fontWeight: '700' },
  errorBox: { backgroundColor: C.dangerSoft, borderRadius: 9, padding: 12, marginTop: 16, borderWidth: 1, borderColor: C.dangerBorder },
  error: { color: C.danger, lineHeight: 20 },
  successBox: { backgroundColor: C.successSoft, borderRadius: 9, padding: 12, marginTop: 16, borderWidth: 1, borderColor: C.primarySoftBorder },
  success: { color: C.successText, lineHeight: 20 },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: '800', marginBottom: 10 },
  versionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EFF4F1', paddingVertical: 12, gap: 8 },
  versionText: { flex: 1 },
  openButton: { paddingHorizontal: 13, paddingVertical: 9, minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: C.primary, borderRadius: 8 },
  openText: { color: C.primary, fontWeight: '700', fontSize: 12 },
  publishedBadge: { color: C.primary, fontWeight: '900', marginBottom: 10, letterSpacing: 0.4, fontSize: 11 },
  summary: { color: C.primaryDark, fontWeight: '800', fontSize: 16, marginTop: 8 },
  muted: { color: C.textMuted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  backButton: { padding: 13, alignItems: 'center', marginTop: 12 },
  backText: { color: C.primary, fontWeight: '700' },
  backChip: { borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 16, minHeight: 40, justifyContent: 'center', marginTop: 12 },
  backChipText: { color: C.textBody, fontWeight: '700', fontSize: 12 },
});
