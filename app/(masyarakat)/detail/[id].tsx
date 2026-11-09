import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

export default function DetailLaporanScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>
        Halaman Detail Laporan{'\n\n'}
        (Akan diimplementasi di tahap berikutnya)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  placeholder: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
