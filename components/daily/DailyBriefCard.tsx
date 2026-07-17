import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Heart, Sparkles, Target, Trophy, Users } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AppText, GlassSurface, PressableScale } from '@/components/ui';
import type { DailyBrief } from '@/services/daily';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

export function DailyBriefCard({
  brief,
  compact,
  onAction,
}: {
  brief: DailyBrief;
  compact?: boolean;
  onAction?: (prompt: string) => void;
}) {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInUp.duration(520)} style={compact ? styles.compactWrap : styles.wrap}>
      <GlassSurface intensity={30} radius={Radii.xxl} strong style={[styles.card, compact && styles.compactCard]}>
        <View style={styles.header}>
          <View style={[styles.mark, { backgroundColor: theme.colors.accentSoft }]}>
            <Sparkles size={18} color={theme.colors.accent} strokeWidth={1.8} />
          </View>
          <View style={styles.headerText}>
            <AppText style={styles.greeting} color="primary" numberOfLines={2}>
              {brief.greeting}
            </AppText>
            <AppText variant="caption" color="muted" numberOfLines={2}>
              Your daily brief, composed locally from your journey.
            </AppText>
          </View>
        </View>

        <View style={styles.priority}>
          <Target size={18} color={theme.colors.accent} strokeWidth={1.8} />
          <View style={styles.priorityText}>
            <AppText variant="footnote" color="muted">
              {brief.todaysFocus.label}
            </AppText>
            <AppText variant="bodyStrong" color="primary" numberOfLines={2}>
              {brief.todaysFocus.value}
            </AppText>
          </View>
        </View>

        <View style={styles.lines}>
          <BriefLine icon={Heart} label={brief.moodSummary.label} value={brief.moodSummary.value} />
          <BriefLine icon={Trophy} label={brief.habitStreak.label} value={brief.habitStreak.value} />
          {!compact ? <BriefLine icon={Users} label={brief.relationshipReminder.label} value={brief.relationshipReminder.value} /> : null}
        </View>

        <View style={styles.thought}>
          <AppText variant="caption" color="primary">
            "{brief.companionThought}"
          </AppText>
          <AppText variant="footnote" color="muted">
            - JISSI
          </AppText>
        </View>

        <PressableScale
          onPress={() => onAction?.(brief.suggestedAction.value)}
          accessibilityRole="button"
          accessibilityLabel="Start suggested first step"
          style={styles.action}
        >
          <AppText variant="footnote" color="accent" numberOfLines={2}>
            Suggested first step: {brief.suggestedAction.value}
          </AppText>
        </PressableScale>
      </GlassSurface>
    </Animated.View>
  );
}

function BriefLine({ icon: Icon, label, value }: { icon: typeof Sparkles; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.line}>
      <Icon size={15} color={theme.colors.textMuted} strokeWidth={1.8} />
      <View style={styles.lineText}>
        <AppText variant="footnote" color="muted" numberOfLines={1}>
          {label}
        </AppText>
        <AppText variant="caption" color="primary" numberOfLines={2}>
          {value}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 760 },
  compactWrap: { width: '100%' },
  card: { padding: 26, gap: 20, overflow: 'hidden' },
  compactCard: { padding: Spacing.xl, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  mark: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 4 },
  greeting: { fontFamily: Fonts.bodyBold, fontSize: 28, lineHeight: 34, letterSpacing: 0 },
  priority: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 2 },
  priorityText: { flex: 1, gap: 3 },
  lines: { gap: 10 },
  line: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineText: { flex: 1, gap: 2 },
  thought: { gap: 4, paddingTop: 4 },
  action: {
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(93,220,255,0.10)',
  },
});
