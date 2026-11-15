import React, { createContext, useContext, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Layout tunggal aktor masyarakat.
 * Desktop: satu sidebar biru muda + area konten.
 * Mobile: tanpa sidebar, hanya floating bottom navigation berbentuk kapsul.
 * Layout ini TIDAK memakai AdminShell agar sidebar admin tidak pernah muncul.
 */

const M = {
  background: '#F3F8FD',
  surface: '#FFFFFF',
  border: '#DCE9F4',
  borderSoft: '#EAF2F9',
  sidebar: '#B9E0F5',
  sidebarDeep: '#0C3448',
  sidebarText: '#163A4B',
  sidebarMuted: '#4B6E7E',
  sidebarActive: '#8FCFF0',
  text: '#1B3430',
  textStrong: '#1E293B',
  textMuted: '#6E828C',
  textSubtle: '#5C747E',
  black: '#0B0F14',
  white: '#FFFFFF',
} as const;

const MENU = [
  { title: 'Beranda', route: '/(masyarakat)/(tabs)/beranda', icon: 'home' },
  { title: 'Buat Laporan', route: '/(masyarakat)/(tabs)/buat-laporan', icon: 'plus' },
  { title: 'Riwayat', route: '/(masyarakat)/(tabs)/riwayat', icon: 'clock' },
  { title: 'RAB', route: '/(masyarakat)/(tabs)/rab', icon: 'doc' },
] as const;

type NavIconName = (typeof MENU)[number]['icon'];

/** Ikon navigasi digambar dengan View agar tampil konsisten di web dan Android. */
function NavIcon({ name, color, size = 20 }: { name: NavIconName; color: string; size?: number }) {
  const stroke = Math.max(1.6, size * 0.09);
  if (name === 'home') {
    const cell = (size - stroke * 1.4) / 2;
    return (
      <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', gap: stroke * 1.4 }}>
        <View style={{ width: cell, height: cell, borderRadius: 2, backgroundColor: color }} />
        <View style={{ width: cell, height: cell, borderRadius: 2, backgroundColor: color }} />
        <View style={{ width: cell, height: cell, borderRadius: 2, backgroundColor: color }} />
        <View style={{ width: cell, height: cell, borderRadius: 2, backgroundColor: color }} />
      </View>
    );
  }
  if (name === 'plus') {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: size, height: stroke, borderRadius: stroke, backgroundColor: color }} />
        <View style={{ position: 'absolute', width: stroke, height: size, borderRadius: stroke, backgroundColor: color }} />
      </View>
    );
  }
  if (name === 'clock') {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: stroke, height: size * 0.28, top: size * 0.22, borderRadius: stroke, backgroundColor: color }} />
        <View style={{ position: 'absolute', width: size * 0.26, height: stroke, left: size * 0.5 - stroke / 2, top: size * 0.5 - stroke / 2, borderRadius: stroke, backgroundColor: color }} />
      </View>
    );
  }
  return (
    <View style={{ width: size * 0.8, height: size, borderWidth: stroke, borderColor: color, borderRadius: 3, paddingHorizontal: size * 0.14, justifyContent: 'center', gap: size * 0.11 }}>
      <View style={{ height: stroke, borderRadius: stroke, backgroundColor: color }} />
      <View style={{ height: stroke, width: '72%', borderRadius: stroke, backgroundColor: color }} />
      <View style={{ height: stroke, width: '88%', borderRadius: stroke, backgroundColor: color }} />
    </View>
  );
}

type ShellContextValue = { desktop: boolean; tablet: boolean };
const ShellContext = createContext<ShellContextValue>({ desktop: false, tablet: false });
export const useMasyarakatShell = () => useContext(ShellContext);

/** Transisi halus khusus web; diabaikan pada native. */
const webTransition = Platform.OS === 'web'
  ? ({ transitionProperty: 'background-color, color', transitionDuration: '220ms' } as object)
  : {};

function useActiveMenu() {
  const pathname = usePathname();
  return MENU.find((item) => pathname.includes(item.route.split('/').pop() ?? ''))?.title ?? 'Beranda';
}

export function MasyarakatShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const desktop = width >= 1024;
  const tablet = width >= 768 && width < 1024;
  const wide = desktop || tablet;
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const active = useActiveMenu();

  async function handleSignOut() {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('[MasyarakatShell] Error signing out:', error);
    }
  }

  const name = profile?.nama ?? 'Warga Desa';
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <ShellContext.Provider value={{ desktop, tablet }}>
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.pageShell}>
          {wide && (
            <View style={[styles.sidebar, tablet && styles.sidebarTablet]}>
              <View>
                <Text style={styles.brandName}>LaporDesa</Text>
                <Text style={styles.brandCaption}>LAYANAN WARGA DESA</Text>
              </View>

              <Text style={styles.sideCaption}>MENU UTAMA</Text>
              <View style={styles.navList}>
                {MENU.map((item) => {
                  const selected = active === item.title;
                  return (
                    <TouchableOpacity
                      key={item.title}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[styles.sideNav, selected && styles.sideNavActive]}
                      onPress={() => router.push(item.route as never)}
                    >
                      <View style={[styles.sideNavDot, selected && styles.sideNavDotActive]} />
                      <Text style={[styles.sideNavText, selected && styles.sideNavTextActive]}>{item.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.sidebarSpacer} />

              <View style={styles.profile}>
                <View style={styles.profileInitialWrap}>
                  <Text style={styles.profileInitial}>{initial}</Text>
                </View>
                <View style={styles.profileIdentity}>
                  <Text style={styles.profileName} numberOfLines={1}>{name}</Text>
                  <Text style={styles.profileRole}>Warga</Text>
                </View>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Keluar akun"
                style={styles.signOutButton}
                onPress={() => void handleSignOut()}
              >
                <Text style={styles.signOutText}>Keluar</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.mainColumn}>
            {wide ? (
              <View style={styles.topbar}>
                <Text style={styles.topbarText}>Ruang pelayanan desa</Text>
                <Text style={styles.topbarBreadcrumb}>LaporDesa / {active}</Text>
              </View>
            ) : (
              <View style={styles.mobileBar}>
                <Text style={styles.mobileBrandName}>LaporDesa</Text>
                <Text style={styles.mobileSection} numberOfLines={1}>{active}</Text>
              </View>
            )}

            <View style={[styles.body, !wide && styles.bodyMobile, !wide && { paddingBottom: 88 + insets.bottom }]}>{children}</View>
          </View>
        </View>

        {!wide && <MasyarakatBottomNav active={active} onNavigate={(route) => router.push(route as never)} />}
      </SafeAreaView>
    </ShellContext.Provider>
  );
}

/**
 * Floating pill navigation untuk mobile.
 * Default transparan, hover & active hitam dengan ikon/teks putih.
 */
function MasyarakatBottomNav({ active, onNavigate }: { active: string; onNavigate: (route: string) => void }) {
  const [hovered, setHovered] = useState('');
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bottomNavWrap, { bottom: 10 + insets.bottom }]} pointerEvents="box-none">
      <View style={styles.bottomNav}>
        {MENU.map((item) => {
          const selected = active === item.title;
          const hot = selected || hovered === item.title;
          return (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={item.title}
              onPress={() => onNavigate(item.route)}
              onHoverIn={() => setHovered(item.title)}
              onHoverOut={() => setHovered('')}
              style={({ pressed }) => [
                styles.bottomNavItem,
                hot && styles.bottomNavItemHot,
                pressed && styles.bottomNavItemPressed,
                webTransition,
              ]}
            >
              <NavIcon name={item.icon} size={18} color={hot ? M.white : '#182A3A'} />
              <Text style={[styles.bottomNavLabel, hot && styles.bottomNavLabelHot]}>
                {item.title === 'Buat Laporan' ? 'Buat' : item.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Header halaman dengan struktur yang sama seperti AdminPageHeader. */
export function MasyarakatPageHeader({ eyebrow, title, subtitle, note }: { eyebrow?: string; title: string; subtitle?: string; note?: string }) {
  const { desktop } = useMasyarakatShell();
  return (
    <View style={[styles.pageHeader, desktop && styles.pageHeaderDesktop]}>
      {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <Text style={[styles.pageTitle, desktop && styles.pageTitleDesktop]}>{title}</Text>
      {!!subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
      {!!note && <Text style={styles.pageNote}>{note}</Text>}
    </View>
  );
}

export function MasyarakatPageFooter({ note = 'Data ditampilkan sesuai laporan Anda.' }: { note?: string }) {
  const { desktop } = useMasyarakatShell();
  return (
    <View style={[styles.pageFooter, desktop && styles.pageFooterDesktop]}>
      <Text style={styles.footerText}>LaporDesa · Pelayanan desa yang lebih transparan</Text>
      <Text style={styles.footerText}>{note}</Text>
    </View>
  );
}

export const MASYARAKAT_COLORS = M;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: M.background },
  pageShell: { flex: 1, width: '100%', maxWidth: 1600, alignSelf: 'center', flexDirection: 'row', backgroundColor: M.background },

  sidebar: { width: 248, backgroundColor: M.sidebar, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 },
  sidebarTablet: { width: 216 },
  brandName: { color: M.sidebarDeep, fontSize: 21, fontWeight: '900', letterSpacing: -0.35 },
  brandCaption: { color: M.sidebarMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.7, marginTop: 4 },
  sideCaption: { color: M.sidebarMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginTop: 38, marginBottom: 10 },
  navList: { gap: 4 },
  sideNav: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, paddingHorizontal: 12, minHeight: 48, marginTop: 2 },
  sideNavActive: { backgroundColor: M.sidebarActive, borderLeftWidth: 3, borderLeftColor: M.sidebarDeep },
  sideNavDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#5D8AA0' },
  sideNavDotActive: { backgroundColor: M.sidebarDeep },
  sideNavText: { color: M.sidebarText, fontSize: 14, fontWeight: '500' },
  sideNavTextActive: { color: M.sidebarDeep, fontWeight: '800' },
  sidebarSpacer: { flex: 1 },

  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(12,52,72,0.16)', paddingTop: 20, marginTop: 16 },
  profileIdentity: { flex: 1, minWidth: 0 },
  profileInitialWrap: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#2C7CA6', alignItems: 'center', justifyContent: 'center', shadowColor: '#0C3448', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 2 },
  profileInitial: { color: M.white, fontWeight: '800', fontSize: 17, lineHeight: 21 },
  profileName: { color: M.sidebarDeep, fontWeight: '800', fontSize: 14, letterSpacing: -0.1 },
  profileRole: { color: M.sidebarMuted, fontSize: 11.5, marginTop: 3, fontWeight: '500' },
  signOutButton: { minHeight: 46, borderRadius: 12, backgroundColor: M.black, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  signOutText: { color: M.white, fontWeight: '700', fontSize: 13.5, letterSpacing: 0.2 },


  mainColumn: { flex: 1, minWidth: 0, backgroundColor: M.background },
  topbar: { height: 64, paddingHorizontal: 40, backgroundColor: M.surface, borderBottomWidth: 1, borderBottomColor: M.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  topbarText: { color: M.textSubtle, fontSize: 12 },
  topbarBreadcrumb: { color: M.textMuted, fontSize: 12 },

  mobileBar: { minHeight: 64, paddingHorizontal: 16, backgroundColor: M.surface, borderBottomWidth: 1, borderBottomColor: M.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mobileBrandName: { color: '#1E7BA8', fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  mobileSection: { marginLeft: 'auto', color: M.textMuted, fontSize: 11, fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  body: { flex: 1, minHeight: 0 },
  bodyMobile: { paddingBottom: 104 },

  bottomNavWrap: { position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center', paddingHorizontal: 20 },
  bottomNav: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: M.border,
    shadowColor: '#173A50',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  bottomNavItem: { flex: 1, minHeight: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 4 },
  bottomNavItemHot: { backgroundColor: M.black },
  bottomNavItemPressed: { opacity: 0.88 },
  bottomNavLabel: { color: '#182A3A', fontSize: 10 },
  bottomNavLabelHot: { color: M.white, fontWeight: '700' },

  pageHeader: { backgroundColor: M.surface, borderBottomWidth: 1, borderBottomColor: M.border, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16 },
  pageHeaderDesktop: { paddingHorizontal: 40, paddingTop: 28, paddingBottom: 24 },
  eyebrow: { color: '#1E7BA8', fontSize: 11.5, letterSpacing: 1.1, fontWeight: '800' },
  pageTitle: { color: M.textStrong, fontSize: 24, lineHeight: 30, fontWeight: '800', marginTop: 6 },
  pageTitleDesktop: { fontSize: 30, lineHeight: 38 },
  pageSubtitle: { color: M.textStrong, fontSize: 15, fontWeight: '600', marginTop: 6 },
  pageNote: { color: '#64748B', fontSize: 14, marginTop: 5, lineHeight: 20 },

  pageFooter: { marginTop: 24, marginHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: M.border, flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingBottom: 24 },
  pageFooterDesktop: { marginHorizontal: 40, paddingBottom: 28 },
  footerText: { color: '#7C909A', fontSize: 10 },
});
