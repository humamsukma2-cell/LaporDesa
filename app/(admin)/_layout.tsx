import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { ADMIN_COLORS as C } from '@/lib/theme';

export default function AdminLayout() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!profile || profile.peran !== 'admin')) {
      router.replace('/');
    }
  }, [profile, loading]);

  if (loading || !profile || profile.peran !== 'admin') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" options={{ title: 'Dashboard Admin' }} />
      <Stack.Screen name="daftar-laporan" options={{ title: 'Daftar Laporan' }} />
      <Stack.Screen name="detail/[id]" options={{ title: 'Detail Laporan' }} />
      <Stack.Screen name="kelola-rab/[id]" options={{ title: 'Kelola RAB' }} />
    </Stack>
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
