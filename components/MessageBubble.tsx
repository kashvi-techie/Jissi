import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AIMessage } from '@/services/ai';
import { JISSI } from '@/constants/jissiPalette';

interface MessageBubbleProps {
  message: AIMessage;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  if (isUser) {
    return (
      <View style={[styles.row, styles.rowRight]}>
        <LinearGradient
          colors={[JISSI.lavender, JISSI.pink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.userBubble]}
        >
          <Text style={styles.userText}>{message.content}</Text>
          <Text style={styles.userTime}>{formatTime(message.timestamp)}</Text>
        </LinearGradient>
      </View>
    );
  }
  return (
    <View style={[styles.row, styles.rowLeft]}>
      <View style={[styles.bubble, styles.aiBubble]}>
        <Text style={styles.aiText}>{message.content}</Text>
        <Text style={styles.aiTime}>{formatTime(message.timestamp)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 4 },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  userBubble: { borderBottomRightRadius: 6 },
  aiBubble: { backgroundColor: JISSI.glass, borderWidth: 1, borderColor: JISSI.glassBorder, borderBottomLeftRadius: 6 },
  userText: { fontSize: 15, color: '#FFFFFF', fontFamily: 'Inter_400Regular', lineHeight: 21 },
  userTime: { fontSize: 10, color: 'rgba(255,255,255,0.8)', alignSelf: 'flex-end', fontFamily: 'Inter_400Regular' },
  aiText: { fontSize: 15, color: JISSI.textDark, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  aiTime: { fontSize: 10, color: JISSI.textMuted, alignSelf: 'flex-end', fontFamily: 'Inter_400Regular' },
});
