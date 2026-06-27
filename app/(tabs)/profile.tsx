import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/theme';

export default function ProfileScreen() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={Colors.background.gradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <User size={40} color={Colors.accent.indigo} strokeWidth={1.6} />
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.sub}>Coming soon</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  title: { fontSize: 22, fontFamily: 'Exo2_700Bold', color: Colors.text.heading, letterSpacing: 1 },
  sub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text.muted },
});
