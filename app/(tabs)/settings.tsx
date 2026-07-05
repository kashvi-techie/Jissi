import React from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Bell, Brain, Lock, Mic, Palette, Settings2, Sparkles } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Screen, GlassSurface, AppText } from '@/components/ui';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

const SECTIONS: { title: string; detail: string; icon: LucideIcon }[] = [
  { title: 'Voice', detail: 'Speech recognition, TTS voice, pacing and pronunciation.', icon: Mic },
  { title: 'Personality', detail: 'Warmth, response style, greeting behavior and brevity.', icon: Sparkles },
  { title: 'Memory', detail: 'Saved preferences, relationship recall and future routines.', icon: Brain },
  { title: 'Privacy', detail: 'Local data handling, permissions and account safety.', icon: Lock },
  { title: 'Notifications', detail: 'Future reminders, nudges and proactive companion moments.', icon: Bell },
  { title: 'Theme', detail: 'Dark, light and premium visual controls.', icon: Palette },
  { title: 'Future AI settings', detail: 'Provider, model and tool configuration later.', icon: Settings2 },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <Settings2 size={30} color={theme.colors.textSecondary} strokeWidth={1.5} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              Settings
            </AppText>
            <AppText variant="body" color="muted">
              Companion controls, organized for Sprint 2 and beyond.
            </AppText>
          </View>
        </View>

        <View style={styles.list}>
          {SECTIONS.map((section) => (
            <SettingsSection key={section.title} {...section} />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function SettingsSection({ title, detail, icon: Icon }: { title: string; detail: string; icon: LucideIcon }) {
  const theme = useTheme();
  return (
    <GlassSurface intensity={30} radius={Radii.lg} style={styles.row}>
      <View style={[styles.icon, { backgroundColor: theme.colors.accentSoft }]}>
        <Icon size={18} color={theme.colors.accent} strokeWidth={1.8} />
      </View>
      <View style={styles.rowText}>
        <AppText variant="bodyStrong" color="primary">
          {title}
        </AppText>
        <AppText variant="caption" color="muted">
          {detail}
        </AppText>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.lg },
  contentWide: { maxWidth: 820, alignSelf: 'center', width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerText: { flex: 1, gap: Spacing.xs },
  badge: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  list: { gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: Spacing.xs },
});
