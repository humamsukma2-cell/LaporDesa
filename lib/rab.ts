import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

export const RAB_BUCKET = 'rab-pdf';
export const RAB_MAX_SIZE = 50 * 1024 * 1024;

export type RabInfo = {
  id: string;
  laporan_id: string;
  nomor_rab: string;
  judul: string;
  total_anggaran: number | string;
  sumber_dana: string;
  catatan: string | null;
  status: 'draft' | 'published';
  created_at: string;
  published_at: string | null;
};

export type RabVersionInfo = {
  id: string;
  nomor_versi: number;
  path_pdf: string;
  ukuran_file: number;
  waktu_unggah: string;
};

export type RabWithVersion = { rab: RabInfo; version: RabVersionInfo | null };
export type RabForAdmin = { rab: RabInfo; versions: RabVersionInfo[] };

const RAB_COLUMNS = 'id, laporan_id, nomor_rab, judul, total_anggaran, sumber_dana, catatan, status, created_at, published_at';
const VERSION_COLUMNS = 'id, nomor_versi, path_pdf, ukuran_file, waktu_unggah';

export async function fetchPublishedRab(laporanId: string): Promise<RabWithVersion | null> {
  const { data, error } = await supabase
    .from('rab')
    .select(RAB_COLUMNS)
    .eq('laporan_id', laporanId)
    .eq('status', 'published')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const rab = data as unknown as RabInfo;
  const { data: versionData, error: versionError } = await supabase
    .from('rab_versi')
    .select(VERSION_COLUMNS)
    .eq('rab_id', rab.id)
    .order('nomor_versi', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) throw versionError;

  return { rab, version: (versionData as unknown as RabVersionInfo) ?? null };
}

export async function fetchRabForAdmin(laporanId: string): Promise<RabForAdmin | null> {
  const { data, error } = await supabase
    .from('rab')
    .select(RAB_COLUMNS)
    .eq('laporan_id', laporanId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const rab = data as unknown as RabInfo;
  const { data: versions, error: versionError } = await supabase
    .from('rab_versi')
    .select(VERSION_COLUMNS)
    .eq('rab_id', rab.id)
    .order('nomor_versi', { ascending: false });
  if (versionError) throw versionError;

  return { rab, versions: (versions ?? []) as unknown as RabVersionInfo[] };
}

export async function openRabPdf(path: string): Promise<void> {
  const { data, error } = await supabase.storage.from(RAB_BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Tautan PDF RAB tidak tersedia.');
  await WebBrowser.openBrowserAsync(data.signedUrl);
}

export function formatRupiah(value: number | string): string {
  const numeric = typeof value === 'string' ? Number(value) : value;
  const safe = Number.isFinite(numeric) ? numeric : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Ukuran tidak tersedia';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
