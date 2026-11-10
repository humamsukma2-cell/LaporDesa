import { Tabs } from 'expo-router';

export default function MasyarakatTabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2196F3', tabBarInactiveTintColor: '#999' }}>
      <Tabs.Screen name="beranda" options={{ title: 'Beranda', headerTitle: 'Beranda' }} />
      <Tabs.Screen name="riwayat" options={{ title: 'Riwayat', headerTitle: 'Riwayat Laporan' }} />
      <Tabs.Screen name="rab" options={{ title: 'RAB', headerTitle: 'Transparansi RAB' }} />
      <Tabs.Screen name="buat-laporan" options={{ title: 'Buat Laporan', headerTitle: 'Buat Laporan' }} />
    </Tabs>
  );
}
