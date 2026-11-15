export const CITIZEN_COLORS = {
  background: '#F3F8FD',
  backgroundEnd: '#F8FBFF',
  surface: '#FFFFFF',
  surfaceSubtle: '#F7FAFE',
  surfaceMuted: '#F5F9FD',
  cardBorder: '#DCE9F4',
  cardBorderSoft: '#EAF2F9',
  glass: 'rgba(255,255,255,0.82)',
  glassSoft: 'rgba(234,244,255,0.78)',
  border: 'rgba(255,255,255,0.92)',
  borderBlue: '#D8EAF8',
  primary: '#7CC4FF',
  primaryStrong: '#1672B8',
  primaryDark: '#0C1B2A',
  primarySoft: '#DDF0FF',
  primarySoftDeep: '#CDE8FF',
  text: '#0C1B2A',
  textBody: '#34495B',
  muted: '#536B7F',
  mutedLight: '#71889A',
  black: '#0B0F14',
  white: '#FFFFFF',
  success: '#147A5B',
  successSoft: '#E3F5ED',
  warning: '#8C5A0A',
  warningSoft: '#FFF4DB',
  danger: '#B42332',
  dangerSoft: '#FDEBED',
  input: '#F7FAFE',
  inputBorder: '#DCE9F4',
  shadow: '#A3BED6',
  overlay: 'rgba(12,27,42,0.36)',
} as const;

/** Shadow kartu utama masyarakat: sangat lembut dan konsisten di web maupun native. */
export const CITIZEN_CARD_SHADOW = {
  shadowColor: '#2F5D7E',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 2,
} as const;

export const CITIZEN_RADIUS = {
  card: 16,
  inner: 12,
  field: 12,
  pill: 999,
} as const;

/** Approximation with gradient fills, thin borders and platform shadow; no backdrop blur. */
export const CITIZEN_GLASS_SHADOW = {
  shadowColor: '#416581',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.09,
  shadowRadius: 22,
  elevation: 4,
} as const;

export const CITIZEN_SOFT_SHADOW = {
  shadowColor: '#8CAAC5',
  shadowOffset: { width: 4, height: 5 },
  shadowOpacity: 0.16,
  shadowRadius: 10,
  elevation: 3,
} as const;

export const CITIZEN_PILL_RADIUS = 999;
