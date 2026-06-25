import React from 'react';
import { StyleSheet, View, Text, Pressable, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Copy, Sparkles } from 'lucide-react-native';
import { JISSI } from '@/constants/jissiPalette';

interface RecognizedTextCardProps {
  transcript: string;
  interimTranscript: string;
}

export function RecognizedTextCard({ transcript, interimTranscript }: RecognizedTextCardProps) {
  const hasText = !!(transcript || interimTranscript);
  const copy = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(transcript).catch(() => {});
    }
  };
  return (
    <BlurView intensity={40} tint="light" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Sparkles size={16} color={JISSI.lavender} strokeWidth={2} />
          <Text style={styles.headerText}>Recognized Speech</Text>
        </View>
        {Platform.OS === 'web' && hasText ? (
          <Pressable onPress={copy} hitSlop={8}>
            <Copy size={16} color={JISSI.textMuted} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
      {hasText ? (
        <Text style={styles.body}>
          {transcript}
          {interimTranscript ? (
            <Text style={styles.interim}>
              {transcript ? ' ' : ''}
              {interimTranscript}
            </Text>
          ) : null}
        </Text>
      ) : (
        <Text style={styles.placeholder}>Your spoken words will appear here…</Text>
      )}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: JISSI.glassBorder,
    minHeight: 90,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { fontSize: 13, color: JISSI.textDark, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
  body: { fontSize: 15, color: JISSI.textDark, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  interim: { color: JISSI.textMuted },
  placeholder: { fontSize: 14, color: JISSI.textMuted, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
});
