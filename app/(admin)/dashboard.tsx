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

export default function DashboardAdminScreen() {
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
        <Text style={styles.greeting}>Dashboard Admin</Text>
        <Text style={styles.name}>{profile?.nama}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.placeholder}>
          Dashboard Admin{'\n\n'}
          (Akan diimplementasi di tahap berikutnya)
        </Text>

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
  placeholder: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 48,
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
