import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { WaveformAnimation } from '@/components/WaveformAnimation';
import { Colors } from '@/constants/colors';
import { Spacing, Radius } from '@/constants/theme';

interface ListeningCardProps {
  isListening: boolean;
  interimTranscript: string;
}

export function ListeningCard({ isListening, interimTranscript }: ListeningCardProps) {
  if (!isListening) return null;
  return (
    <BlurView intensity={40} tint="light" style={styles.card}>
      <Text style={styles.label}>Listening…</Text>
      <WaveformAnimation isActive={isListening} />
      {interimTranscript ? <Text style={styles.interim}>{interimTranscript}</Text> : null}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    paddingVertical: 18,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.glassStrong,
  },
  label: { fontSize: 14, color: Colors.text.primary, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4 },
  interim: { fontSize: 14, color: Colors.text.muted, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
