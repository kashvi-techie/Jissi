import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Constants from 'expo-constants';
import {
  Bell,
  Brain,
  Clock,
  Lock,
  Mic,
  Moon,
  Palette,
  Settings2,
  Sparkles,
  Sun,
  User,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { useTheme, useThemeMode } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';
import { ConversationRepository } from '@/services/conversation';
import { memoryStore } from '@/services/tools/memory/MemoryStore';

interface DashboardStats {
  conversationCount: number;
  estimatedHoursSpent: number;
  memoriesStored: number;
  favoriteTopic: string;
  lastConversationAt: string | null;
}

const SETTINGS: { title: string; detail: string; icon: LucideIcon }[] = [
  { title: 'Voice', detail: 'TTS, STT and pronunciation controls', icon: Mic },
  { title: 'Personality', detail: 'Warmth, brevity and companion tone', icon: Sparkles },
  { title: 'Memory', detail: 'Saved preferences and future recall', icon: Brain },
  { title: 'Privacy', detail: 'Local data, permissions and safety', icon: Lock },
  { title: 'Notifications', detail: 'Future proactive nudges', icon: Bell },
  { title: 'Theme', detail: 'Dark, light and premium visuals', icon: Palette },
  { title: 'AI settings', detail: 'Future provider and model controls', icon: Settings2 },
];

function formatDate(value: string | null): string {
  if (!value) return 'No conversations yet';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { mode, toggle } = useThemeMode();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [stats, setStats] = useState<DashboardStats>({
    conversationCount: 0,
    estimatedHoursSpent: 0,
    memoriesStored: 0,
    favoriteTopic: 'Still learning',
    lastConversationAt: null,
  });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = async () => {
        const [conversationStats, memoriesStored] = await Promise.all([
          ConversationRepository.getConversationStats(),
          memoryStore.count().catch(() => 0),
        ]);
        if (cancelled) return;
        setStats({ ...conversationStats, memoriesStored });
      };

      load();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const version = Constants.expoConfig?.version ?? '1.0.2';

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <User size={30} color={theme.colors.textSecondary} strokeWidth={1.5} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              Kashvi
            </AppText>
            <AppText variant="body" color="muted">
              Creator dashboard for JISSI
            </AppText>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Conversations" value={String(stats.conversationCount)} />
          <StatCard label="Hours spent" value={`${stats.estimatedHoursSpent}h`} />
          <StatCard label="Memories stored" value={String(stats.memoriesStored)} />
          <StatCard label="Current version" value={version} />
        </View>

        <GlassSurface intensity={36} radius={Radii.xl} strong style={styles.panel}>
          <View style={styles.panelRow}>
            <Clock size={19} color={theme.colors.accent} strokeWidth={1.8} />
            <View style={styles.panelText}>
              <AppText variant="bodyStrong" color="primary">
                Last conversation
              </AppText>
              <AppText variant="body" color="muted">
                {formatDate(stats.lastConversationAt)}
              </AppText>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.panelRow}>
            <Sparkles size={19} color={theme.colors.accent} strokeWidth={1.8} />
            <View style={styles.panelText}>
              <AppText variant="bodyStrong" color="primary">
                Favourite topic
              </AppText>
              <AppText variant="body" color="muted" numberOfLines={1}>
                {stats.favoriteTopic}
              </AppText>
            </View>
          </View>
        </GlassSurface>

        <PressableScale onPress={toggle} accessibilityRole="button" accessibilityLabel="Toggle appearance">
          <GlassSurface intensity={36} radius={Radii.lg} style={styles.row}>
            {mode === 'dark' ? (
              <Sun size={20} color={theme.colors.textSecondary} strokeWidth={1.8} />
            ) : (
              <Moon size={20} color={theme.colors.textSecondary} strokeWidth={1.8} />
            )}
            <AppText variant="bodyStrong" color="primary" style={styles.rowTitle}>
              Appearance
            </AppText>
            <AppText variant="bodyStrong" color="accent">
              {mode === 'dark' ? 'Dark' : 'Light'}
            </AppText>
          </GlassSurface>
        </PressableScale>

        <View style={styles.sectionHeader}>
          <AppText variant="title" color="primary">
            Settings
          </AppText>
          <AppText variant="caption" color="muted" uppercase>
            Sprint 2 structure
          </AppText>
        </View>

        <View style={styles.settingsList}>
          {SETTINGS.map((item) => (
            <SettingRow
              key={item.title}
              title={item.title}
              detail={item.detail}
              Icon={item.icon}
              onPress={() => router.push('/settings')}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <GlassSurface intensity={32} radius={Radii.lg} style={styles.statCard}>
      <AppText variant="title" color="primary" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="caption" color="muted" uppercase numberOfLines={1}>
        {label}
      </AppText>
    </GlassSurface>
  );
}

function SettingRow({
  title,
  detail,
  Icon,
  onPress,
}: {
  title: string;
  detail: string;
  Icon: LucideIcon;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${title} settings`}>
      <GlassSurface intensity={26} radius={Radii.lg} style={styles.settingRow}>
        <View style={[styles.settingIcon, { backgroundColor: theme.colors.accentSoft }]}>
          <Icon size={18} color={theme.colors.accent} strokeWidth={1.8} />
        </View>
        <View style={styles.panelText}>
          <AppText variant="bodyStrong" color="primary">
            {title}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {detail}
          </AppText>
        </View>
      </GlassSurface>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.lg },
  contentWide: { maxWidth: 820, alignSelf: 'center', width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerText: { flex: 1, gap: Spacing.xs },
  badge: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  statCard: { width: '47.8%', minHeight: 94, justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg },
  panel: { padding: Spacing.lg, gap: Spacing.lg },
  panelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  panelText: { flex: 1, gap: Spacing.xs },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  rowTitle: { flex: 1 },
  sectionHeader: { marginTop: Spacing.md, gap: Spacing.xs },
  settingsList: { gap: Spacing.md },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  settingIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
