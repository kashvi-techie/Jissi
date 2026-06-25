import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { WaveformAnimation } from '@/components/WaveformAnimation';
import { JISSI } from '@/constants/jissiPalette';

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
    borderRadius: 24,
    overflow: 'hidden',
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: JISSI.glassBorder,
  },
  label: { fontSize: 14, color: JISSI.textDark, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4 },
  interim: { fontSize: 14, color: JISSI.textMuted, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
