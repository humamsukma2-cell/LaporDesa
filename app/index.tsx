import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session) {
      // Redirect to login if not authenticated
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (profile) {
      // Redirect based on role
      switch (profile.peran) {
        case 'masyarakat':
          router.replace('/(masyarakat)/(tabs)/beranda');
          break;
        case 'admin':
          router.replace('/(admin)/dashboard');
          break;
        case 'petugas':
          router.replace('/(petugas)/beranda');
          break;
        default:
          router.replace('/(auth)/login');
      }
    }
  }, [session, profile, loading, segments]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2196F3" />
    </View>
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
