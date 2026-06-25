import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock } from 'lucide-react-native';

/**
 * TEMPORARY PLACEHOLDER — required so the "history" tab declared in
 * app/(tabs)/_layout.tsx resolves to a real route (Expo Router crashes
 * otherwise). This is NOT the real history screen; replace in a later phase.
 */
export default function HistoryScreen() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#FFE3EF', '#F3E8FF', '#E2F0FF']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <Clock size={40} color="#6D5BD0" strokeWidth={1.6} />
        <Text style={styles.title}>History</Text>
        <Text style={styles.sub}>Coming soon</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  title: { fontSize: 22, fontFamily: 'Exo2_700Bold', color: '#5B4B9E', letterSpacing: 1 },
  sub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#8B83AE' },
});
