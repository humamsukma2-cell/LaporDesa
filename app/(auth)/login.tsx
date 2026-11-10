import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signIn } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { profile, profileError, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!profile) return;
    const roleRoutes = {
      masyarakat: '/(masyarakat)/(tabs)/beranda',
      admin: '/(admin)/dashboard',
      petugas: '/(petugas)/beranda',
    } as const;
    const destination = roleRoutes[profile.peran as keyof typeof roleRoutes];
    if (destination) {
      router.replace(destination);
    } else {
      setErrorMessage('Peran akun tidak dikenali. Hubungi admin desa.');
    }
  }, [profile, router]);

  async function handleLogin() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setErrorMessage('Email dan password harus diisi.');
      return;
    }

    setErrorMessage('');
    setLoading(true);
    try {
      const data = await signIn(normalizedEmail, password);
      if (!data.user) {
        throw new Error('Login tidak berhasil. Periksa email dan password, lalu coba lagi.');
      }

      // AuthContext akan memuat profil, lalu effect di atas mengarahkan sesuai peran.
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      const lowerMessage = message.toLowerCase();
      setErrorMessage(
        lowerMessage.includes('invalid login credentials') || lowerMessage.includes('invalid_credentials')
          ? 'Email atau password salah. Periksa kembali dan coba lagi.'
          : message || 'Tidak dapat masuk. Periksa koneksi internet dan coba lagi.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>LaporDesa</Text>
          <Text style={styles.subtitle}>
            Aplikasi Pemantauan Kerusakan Infrastruktur Desa
          </Text>

          <View style={styles.form}>
            {!!(errorMessage || profileError) && (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage || profileError}</Text>
              </View>
            )}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="nama@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Masukkan password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading || authLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Masuk</Text>
              )}
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Belum punya akun? </Text>
              <TouchableOpacity
                onPress={() => router.push('/(auth)/register')}
                disabled={loading}
              >
                <Text style={styles.registerLink}>Daftar di sini</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 48,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#B3D9FF',
  },
  errorBox: {
    backgroundColor: '#FDECEA',
    borderColor: '#F44336',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#B71C1C',
    fontSize: 14,
    lineHeight: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    fontSize: 14,
    color: '#666',
  },
  registerLink: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
});
