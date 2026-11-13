import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ADMIN_COLORS as C, ADMIN_RADIUS as R } from '@/lib/theme';

export type AdminSection = 'dashboard' | 'daftar-laporan';

type AdminShellProps = {
  section: AdminSection;
  /** Label topbar/breadcrumb; default mengikuti section. */
  label?: string;
  /** Header halaman yang ditampilkan tetap di atas area gulir. */
  header?: React.ReactNode;
  children: React.ReactNode;
};

type NavTarget = AdminSection;

const SECTION_LABEL: Record<AdminSection, string> = {
  dashboard: 'Dashboard',
  'daftar-laporan': 'Daftar Laporan',
};

/**
 * Kerangka navigasi admin: sidebar di desktop, header + drawer di mobile.
 * Dipakai oleh dashboard, daftar laporan, detail laporan, dan kelola RAB
 * agar seluruh alur admin terasa satu aplikasi.
 */
export function AdminShell({ section, label, header, children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;

  async function handleSignOut() {
    setMenuOpen(false);
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('[AdminShell] Error signing out:', error);
    }
  }

  function navigate(target: NavTarget) {
    setMenuOpen(false);
    if (target === 'dashboard') {
      if (pathname === '/dashboard') return;
      router.push('/(admin)/dashboard');
      return;
    }
    if (pathname === '/daftar-laporan') return;
    router.push('/(admin)/daftar-laporan');
  }

  const adminName = profile?.nama ?? 'Admin Desa';
  const initial = adminName.slice(0, 1).toUpperCase();
  const sectionLabel = label ?? SECTION_LABEL[section];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.pageShell}>
        {desktop && (
          <View style={styles.sidebar}>
            <Text style={styles.brandName}>LaporDesa</Text>
            <Text style={styles.sideCaption}>LAYANAN DESA</Text>

            <NavButton label="Dashboard" active={section === 'dashboard'} onPress={() => navigate('dashboard')} />
            <NavButton label="Daftar laporan" active={section === 'daftar-laporan'} onPress={() => navigate('daftar-laporan')} />

            <View style={styles.sidebarSpacer} />

            <View style={styles.adminProfile}>
              <Text style={styles.adminInitial}>{initial}</Text>
              <View style={styles.adminIdentity}>
                <Text style={styles.adminName} numberOfLines={1}>{adminName}</Text>
                <Text style={styles.adminRole}>Administrator</Text>
              </View>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Keluar akun"
              style={styles.signOutButton}
              onPress={() => void handleSignOut()}
            >
              <LogoutIcon color="#F1D5D5" />
              <Text style={styles.signOutText}>Keluar akun</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.mainColumn}>
          {desktop ? (
            <View style={styles.topbar}>
              <Text style={styles.topbarText}>Ruang pelayanan desa</Text>
              <Text style={styles.topbarBreadcrumb}>LaporDesa / {sectionLabel}</Text>
            </View>
          ) : (
            <View style={styles.mobileBar}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Buka menu navigasi"
                style={styles.menuButton}
                onPress={() => setMenuOpen(true)}
              >
                <Text style={styles.menuGlyph}>☰</Text>
              </TouchableOpacity>
              <View style={styles.mobileBrand}>
                <Text style={styles.mobileBrandName}>LaporDesa</Text>
              </View>
              <Text style={styles.mobileSection} numberOfLines={1}>{sectionLabel}</Text>
            </View>
          )}

          <View style={styles.body}>
            {header}
            {children}
          </View>
        </View>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={styles.drawerScrim} accessibilityLabel="Tutup menu" onPress={() => setMenuOpen(false)} />
          <SafeAreaView style={styles.mobileDrawer} edges={['top', 'bottom']}>
            <View style={styles.drawerBrandRow}>
              <View>
                <Text style={styles.drawerBrandName}>LaporDesa</Text>
                <Text style={styles.drawerCaption}>ADMINISTRASI DESA</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Tutup menu" style={styles.drawerClose} onPress={() => setMenuOpen(false)}>
                <Text style={styles.drawerCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sideCaption}>MENU UTAMA</Text>
            <NavButton label="Dashboard" active={section === 'dashboard'} onPress={() => navigate('dashboard')} />
            <NavButton label="Daftar Laporan" active={section === 'daftar-laporan'} onPress={() => navigate('daftar-laporan')} />

            <View style={styles.drawerSpacer} />

            <View style={styles.adminProfile}>
              <Text style={styles.adminInitial}>{initial}</Text>
              <View style={styles.adminIdentity}>
                <Text style={styles.adminName} numberOfLines={1}>{adminName}</Text>
                <Text style={styles.adminRole}>Administrator</Text>
              </View>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Keluar akun"
              style={styles.signOutButton}
              onPress={() => void handleSignOut()}
            >
              <LogoutIcon color="#F1D5D5" />
              <Text style={styles.signOutText}>Keluar akun</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function NavButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.sideNav, active && styles.sideNavActive]}
      onPress={onPress}
    >
      <View style={[styles.sideNavDot, active && styles.sideNavDotActive]} />
      <Text style={[styles.sideNavText, active && styles.sideNavTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Ikon keluar (pintu + panah) yang digambar dengan View agar konsisten di web & Android. */
export function LogoutIcon({ color = '#F1D5D5', size = 20 }: { color?: string; size?: number }) {
  return (
    <View style={[styles.logoutIcon, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.logoutDoor, { borderColor: color }]} />
      <View style={[styles.logoutShaft, { backgroundColor: color }]} />
      <View style={[styles.logoutHead, { borderColor: color }]} />
    </View>
  );
}

/** Header halaman yang seragam untuk seluruh layar admin. */
export function AdminPageHeader({
  eyebrow,
  title,
  subtitle,
  note,
  accessory,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  note?: string;
  accessory?: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  return (
    <View style={[styles.pageHeader, desktop && styles.pageHeaderDesktop]}>
      <View style={styles.pageHeaderText}>
        {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text style={[styles.pageTitle, desktop && styles.pageTitleDesktop]}>{title}</Text>
        {!!subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
        {!!note && <Text style={styles.pageNote}>{note}</Text>}
      </View>
      {!!accessory && <View style={styles.pageHeaderAccessory}>{accessory}</View>}
    </View>
  );
}

/** Catatan kaki ringan di akhir halaman admin. */
export function AdminPageFooter({ note = 'Data ditampilkan sesuai hak akses admin desa.' }: { note?: string }) {
  return (
    <View style={styles.pageFooter}>
      <Text style={styles.footerText}>LaporDesa · Pelayanan desa yang lebih transparan</Text>
      <Text style={styles.footerText}>{note}</Text>
    </View>
  );
}

/** Kartu panel standar admin (putih, border lembut, sudut membulat). */
export function AdminPanel({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

/** Label seksi dengan garis aksen hijau. */
export function AdminSectionTitle({ children, first = false }: { children: string; first?: boolean }) {
  return (
    <View style={[styles.sectionTitleRow, first && styles.sectionTitleRowFirst]}>
      <View style={styles.sectionTitleBar} />
      <Text style={styles.sectionTitleText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  pageShell: { flex: 1, width: '100%', maxWidth: 1600, alignSelf: 'center', flexDirection: 'row', backgroundColor: C.background },

  sidebar: { width: 248, backgroundColor: C.primaryDark, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 },
  brandName: { color: C.onPrimary, fontSize: 21, fontWeight: '900', letterSpacing: -0.35 },
  sideCaption: { color: C.navMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginTop: 38, marginBottom: 12 },
  sideNav: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: R.md, paddingHorizontal: 14, minHeight: 48, justifyContent: 'flex-start', marginTop: 6 },
  sideNavActive: { backgroundColor: C.primaryActive, borderLeftWidth: 3, borderLeftColor: '#A8D8C2' },
  sideNavDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(224, 239, 235, 0.45)' },
  sideNavDotActive: { backgroundColor: '#FFFFFF' },
  sideNavText: { color: C.navText, fontWeight: '500', fontSize: 14 },
  sideNavTextActive: { color: C.onPrimary, fontWeight: '700' },
  sidebarSpacer: { flex: 1 },

  adminProfile: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 18, marginTop: 14 },
  adminIdentity: { flex: 1, minWidth: 0 },
  adminInitial: { width: 40, height: 40, borderRadius: 11, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', paddingTop: 10, color: C.onPrimary, backgroundColor: '#1C7164', fontWeight: '800' },
  adminName: { color: C.onPrimary, fontWeight: '700', fontSize: 13 },
  adminRole: { color: '#C5DCD6', fontSize: 11, marginTop: 3 },
  signOutButton: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: R.md, paddingHorizontal: 14, minHeight: 46, marginTop: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.06)' },
  signOutText: { color: '#F1D5D5', fontWeight: '600', fontSize: 14 },

  logoutIcon: { position: 'relative' },
  logoutDoor: { position: 'absolute', left: 0, top: 2, width: 7, height: 16, borderWidth: 1.6, borderRightWidth: 0, borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
  logoutShaft: { position: 'absolute', left: 7, top: 9, width: 8, height: 1.6, borderRadius: 1 },
  logoutHead: { position: 'absolute', right: 0, top: 6.2, width: 6, height: 6, borderTopWidth: 1.6, borderRightWidth: 1.6, transform: [{ rotate: '45deg' }] },

  mainColumn: { flex: 1, minWidth: 0, backgroundColor: C.background },
  topbar: { height: 64, paddingHorizontal: 40, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: '#E2E8E4', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  topbarText: { color: '#61756F', fontSize: 12 },
  topbarBreadcrumb: { color: '#8A9A95', fontSize: 12 },
  mobileBar: { minHeight: 76, paddingHorizontal: 20, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuButton: { width: 44, height: 44, borderRadius: 11, backgroundColor: '#F1F7F5', alignItems: 'center', justifyContent: 'center' },
  menuGlyph: { color: C.primaryDark, fontSize: 20, fontWeight: '700' },
  mobileBrand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mobileBrandName: { color: C.textStrong, fontWeight: '700', fontSize: 16 },
  mobileSection: { marginLeft: 'auto', color: C.textMuted, fontSize: 11, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  body: { flex: 1, minHeight: 0 },

  pageHeader: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: '#E2E8E4', paddingHorizontal: 20, paddingTop: 26, paddingBottom: 22 },
  pageHeaderDesktop: { paddingHorizontal: 40, paddingTop: 30, paddingBottom: 26, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 },
  pageHeaderText: { flexShrink: 1 },
  pageHeaderAccessory: { flexShrink: 0 },
  eyebrow: { color: '#166534', fontSize: 12, letterSpacing: 1.1, fontWeight: '800' },
  pageTitle: { color: C.textStrong, fontSize: 27, fontWeight: '800', marginTop: 6 },
  pageTitleDesktop: { fontSize: 30 },
  pageSubtitle: { color: C.textStrong, fontSize: 15, fontWeight: '600', marginTop: 6 },
  pageNote: { color: '#64748B', fontSize: 14, marginTop: 5, lineHeight: 20 },

  pageFooter: { marginTop: 24, marginHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E0EAE5', flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  footerText: { color: '#7B8A85', fontSize: 10 },

  panel: { backgroundColor: C.surface, padding: 20, borderRadius: R.lg, borderWidth: 1, borderColor: C.border },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 22, marginBottom: 12 },
  sectionTitleRowFirst: { marginTop: 0 },
  sectionTitleBar: { width: 3, height: 17, borderRadius: 2, backgroundColor: C.primary },
  sectionTitleText: { color: C.text, fontSize: 16, fontWeight: '800' },

  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: C.overlay },
  drawerScrim: { flex: 1 },
  mobileDrawer: { width: '78%', maxWidth: 320, backgroundColor: C.primaryDark, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 },
  drawerBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58 },
  drawerBrandName: { color: C.onPrimary, fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  drawerCaption: { color: '#C5DCD6', fontSize: 9, letterSpacing: 0.7, marginTop: 3 },
  drawerClose: { marginLeft: 'auto', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  drawerCloseText: { color: '#E6F2EE', fontSize: 28 },
  drawerSpacer: { flex: 1 },
});
