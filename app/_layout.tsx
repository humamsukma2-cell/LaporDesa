import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(masyarakat)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(petugas)" />
      </Stack>
    </AuthProvider>
  );
}
