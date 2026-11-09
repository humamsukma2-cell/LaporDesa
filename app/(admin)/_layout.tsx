import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

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
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen
        name="dashboard"
        options={{
          title: 'Dashboard Admin',
        }}
      />
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
