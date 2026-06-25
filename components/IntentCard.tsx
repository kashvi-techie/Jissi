import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { Youtube, Chrome, MessageCircle, Search, Sparkles, HelpCircle } from 'lucide-react-native';
import { IntentResult, IntentType } from '@/engine/intentEngine';
import { JISSI } from '@/constants/jissiPalette';

interface IntentCardProps {
  result: IntentResult | null;
}

const META: Record<IntentType, { label: string; icon: any; color: string }> = {
  open_youtube: { label: 'Open YouTube', icon: Youtube, color: '#FB7185' },
  open_chrome: { label: 'Open Chrome', icon: Chrome, color: JISSI.blue },
  open_whatsapp: { label: 'Open WhatsApp', icon: MessageCircle, color: '#34D399' },
  search_google: { label: 'Search', icon: Search, color: JISSI.lavender },
  ask_ai: { label: 'Ask AI', icon: Sparkles, color: JISSI.pink },
  unknown: { label: 'Unknown', icon: HelpCircle, color: JISSI.textMuted },
};

export function IntentCard({ result }: IntentCardProps) {
  if (!result) return null;
  const meta = META[result.intent];
  const Icon = meta.icon;
  return (
    <BlurView intensity={40} tint="light" style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: meta.color + '22' }]}>
        <Icon size={20} color={meta.color} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.label}>{meta.label}</Text>
          <View style={[styles.badge, { borderColor: meta.color }]}>
            <Text style={[styles.badgeText, { color: meta.color }]}>{result.confidence}</Text>
          </View>
        </View>
        <Text style={styles.slug}>{result.intent}</Text>
        {result.query ? (
          <Text style={styles.query} numberOfLines={1}>
            “{result.query}”
          </Text>
        ) : null}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 16,
    borderWidth: 1,
    borderColor: JISSI.glassBorder,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 15, color: JISSI.textDark, fontFamily: 'Inter_600SemiBold' },
  badge: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 99, borderWidth: 1 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  slug: { fontSize: 12, color: JISSI.textMuted, fontFamily: 'Inter_400Regular' },
  query: { fontSize: 13, color: JISSI.textDark, fontFamily: 'Inter_400Regular' },
});
