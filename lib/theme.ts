/**
 * Token warna dan bentuk untuk area admin LaporDesa.
 *
 * Nilai di sini disamakan dengan tampilan dashboard yang sudah disetujui
 * sehingga seluruh layar admin (dashboard, daftar laporan, detail, RAB)
 * memakai palet yang sama.
 */
export const ADMIN_COLORS = {
  background: '#F4F8F6',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F6F4',
  border: '#DCE7E2',
  borderSoft: '#E4ECE8',
  borderInput: '#CBD5E1',
  primary: '#166B57',
  primaryDark: '#07564B',
  primarySoft: '#E9F3EF',
  primarySoftBorder: '#DCEBE4',
  primaryActive: '#226F63',
  navText: '#E0EFEB',
  navMuted: '#B6D5CC',
  text: '#1B3430',
  textStrong: '#1E293B',
  textBody: '#334155',
  textMuted: '#758681',
  textSubtle: '#60756F',
  onPrimary: '#FFFFFF',
  success: '#17805D',
  successSoft: '#E8F3ED',
  successText: '#22543D',
  successBg: '#C6F6D5',
  warning: '#A86A13',
  warningSoft: '#FBF1DF',
  warningText: '#92400E',
  danger: '#B91C1C',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerText: '#9B2C2C',
  inputBg: '#F8FAFC',
  overlay: 'rgba(15, 23, 42, 0.32)',
} as const;

export const ADMIN_RADIUS = {
  sm: 8,
  md: 10,
  lg: 12,
  pill: 999,
} as const;

/** Tinggi header mobile pada shell admin (tombol menu + brand). */
export const ADMIN_MOBILE_HEADER_HEIGHT = 76;