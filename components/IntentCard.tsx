import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { Youtube, Chrome, MessageCircle, Search, Sparkles, HelpCircle } from 'lucide-react-native';
import { IntentResult, IntentType } from '@/engine/intentEngine';
import { Colors } from '@/constants/colors';
import { Spacing, Radius } from '@/constants/theme';

interface IntentCardProps {
  result: IntentResult | null;
}

const META: Record<IntentType, { label: string; icon: any; color: string }> = {
  open_youtube: { label: 'Open YouTube', icon: Youtube, color: Colors.intent.youtube },
  open_chrome: { label: 'Open Chrome', icon: Chrome, color: Colors.intent.chrome },
  open_whatsapp: { label: 'Open WhatsApp', icon: MessageCircle, color: Colors.intent.whatsapp },
  search_google: { label: 'Search', icon: Search, color: Colors.intent.search },
  ask_ai: { label: 'Ask AI', icon: Sparkles, color: Colors.intent.ask },
  unknown: { label: 'Unknown', icon: HelpCircle, color: Colors.intent.unknown },
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
    borderRadius: Radius.lg,
    overflow: 'hidden',
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.glassStrong,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: Spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 15, color: Colors.text.primary, fontFamily: 'Inter_600SemiBold' },
  badge: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: Radius.pill, borderWidth: 1 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  slug: { fontSize: 12, color: Colors.text.muted, fontFamily: 'Inter_400Regular' },
  query: { fontSize: 13, color: Colors.text.primary, fontFamily: 'Inter_400Regular' },
});
