import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function MasyarakatLayout() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!profile || profile.peran !== 'masyarakat')) {
      router.replace('/');
    }
  }, [profile, loading]);

  if (loading || !profile || profile.peran !== 'masyarakat') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: '#999',
      }}
    >
      <Tabs.Screen
        name="beranda"
        options={{
          title: 'Beranda',
          headerTitle: 'Beranda',
        }}
      />
      <Tabs.Screen
        name="riwayat"
        options={{
          title: 'Riwayat',
          headerTitle: 'Riwayat Laporan',
        }}
      />
      <Tabs.Screen
        name="buat-laporan"
        options={{
          href: null, // Hide from tab bar
          title: 'Buat Laporan',
        }}
      />
      <Tabs.Screen
        name="detail/[id]"
        options={{
          href: null, // Hide from tab bar
          title: 'Detail Laporan',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
