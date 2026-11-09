import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function BerandaMasyarakatScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();

  async function handleSignOut() {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Selamat Datang,</Text>
        <Text style={styles.name}>{profile?.nama}</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(masyarakat)/buat-laporan')}
        >
          <Text style={styles.primaryButtonText}>+ Buat Laporan Baru</Text>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Cara Melaporkan Kerusakan:</Text>
          <Text style={styles.infoText}>
            1. Tekan tombol "Buat Laporan Baru"{'\n'}
            2. Pilih kategori infrastruktur{'\n'}
            3. Isi deskripsi kerusakan{'\n'}
            4. Ambil foto kerusakan (max 3 foto){'\n'}
            5. Ambil lokasi GPS di tempat kerusakan{'\n'}
            6. Isi patokan lokasi (contoh: "depan masjid RT 02"){'\n'}
            7. Kirim laporan
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Penting:</Text>
          <Text style={styles.infoText}>
            • Anda harus berada di lokasi kerusakan saat mengambil GPS{'\n'}
            • Foto dan patokan lokasi wajib diisi{'\n'}
            • Laporan akan diverifikasi oleh admin desa{'\n'}
            • Anda dapat memantau status laporan di menu Riwayat
          </Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <Text style={styles.logoutButtonText}>Keluar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 24,
    paddingTop: 32,
  },
  greeting: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    padding: 16,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  logoutButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  logoutButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
  },
});
