import React from 'react';
import { StyleSheet, View, Text, Pressable, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Copy, Sparkles } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, Radius } from '@/constants/theme';

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
          <Sparkles size={16} color={Colors.brand.lavender} strokeWidth={2} />
          <Text style={styles.headerText}>Recognized Speech</Text>
        </View>
        {Platform.OS === 'web' && hasText ? (
          <Pressable onPress={copy} hitSlop={8}>
            <Copy size={16} color={Colors.text.muted} strokeWidth={2} />
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
    borderRadius: Radius.xl,
    overflow: 'hidden',
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border.glassStrong,
    minHeight: 90,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerText: { fontSize: 13, color: Colors.text.primary, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
  body: { fontSize: 15, color: Colors.text.primary, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  interim: { color: Colors.text.muted },
  placeholder: { fontSize: 14, color: Colors.text.muted, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
});
