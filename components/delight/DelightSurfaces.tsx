import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Award, Quote, Sparkles } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppText, GlassSurface } from '@/components/ui';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';
import type { DelightAchievement, DelightQuote } from '@/services/delight';

const CONFETTI = ['#67e8f9', '#a78bfa', '#f0abfc', '#fda4af', '#fde68a', '#86efac'];

export function PremiumEmptyState({
  title,
  description,
  icon: Icon = Sparkles,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInUp.duration(360)}>
      <GlassSurface intensity={28} radius={Radii.xl} style={styles.emptyCard}>
        <View style={styles.illustration}>
          <View style={[styles.orbGlow, { backgroundColor: theme.colors.accentSoft }]} />
          <View style={[styles.orb, { borderColor: theme.colors.accent }]}>
            <Icon size={30} color={theme.colors.accent} strokeWidth={1.5} />
          </View>
        </View>
        <AppText variant="bodyStrong" color="primary" style={styles.centerText}>
          {title}
        </AppText>
        <AppText variant="body" color="muted" style={styles.centerText}>
          {description}
        </AppText>
      </GlassSurface>
    </Animated.View>
  );
}

export function GlassSkeleton({ lines = 3 }: { lines?: number }) {
  const theme = useTheme();
  return (
    <GlassSurface intensity={22} radius={Radii.xl} style={styles.skeletonCard}>
      <View style={[styles.skeletonAvatar, { backgroundColor: theme.colors.fill }]} />
      <View style={styles.skeletonLines}>
        {Array.from({ length: lines }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.skeletonLine,
              {
                width: index === lines - 1 ? '48%' : index === 0 ? '72%' : '92%',
                backgroundColor: theme.colors.fill,
              },
            ]}
          />
        ))}
      </View>
    </GlassSurface>
  );
}

export function DailyQuoteCard({ quote }: { quote: DelightQuote }) {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInUp.duration(420)}>
      <GlassSurface intensity={22} radius={Radii.xl} style={styles.quoteCard}>
        <View style={[styles.smallIcon, { backgroundColor: theme.colors.accentSoft }]}>
          <Quote size={16} color={theme.colors.accent} strokeWidth={1.8} />
        </View>
        <View style={styles.flex}>
          <AppText style={styles.quoteText} color="primary">
            {quote.text}
          </AppText>
          <AppText variant="footnote" color="muted">
            {quote.author}
          </AppText>
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

export function AchievementToast({ achievement }: { achievement: DelightAchievement }) {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInUp.duration(460)} style={styles.toastWrap} pointerEvents="none">
      <GlassSurface intensity={42} radius={Radii.xl} strong style={styles.toast}>
        <View style={styles.confettiLayer}>
          {CONFETTI.map((color, index) => (
            <View
              key={color}
              style={[
                styles.confetti,
                {
                  backgroundColor: color,
                  left: 18 + index * 30,
                  top: index % 2 ? 8 : 24,
                  transform: [{ rotate: `${index * 16}deg` }],
                },
              ]}
            />
          ))}
        </View>
        <View style={[styles.achievementIcon, { backgroundColor: theme.colors.accentSoft }]}>
          <Award size={22} color={theme.colors.accent} strokeWidth={1.8} />
        </View>
        <View style={styles.flex}>
          <AppText variant="caption" color="accent" uppercase>
            Achievement unlocked
          </AppText>
          <AppText variant="bodyStrong" color="primary">
            {achievement.title}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={2}>
            {achievement.description}
          </AppText>
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: Spacing.xs },
  emptyCard: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  illustration: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  orbGlow: { position: 'absolute', width: 104, height: 104, borderRadius: 52, opacity: 0.8 },
  orb: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  centerText: { textAlign: 'center', maxWidth: 360 },
  skeletonCard: { minHeight: 108, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, overflow: 'hidden' },
  skeletonAvatar: { width: 48, height: 48, borderRadius: 24, opacity: 0.78 },
  skeletonLines: { flex: 1, gap: Spacing.sm },
  skeletonLine: { height: 12, borderRadius: 8, opacity: 0.75 },
  quoteCard: { minHeight: 96, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.lg },
  smallIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  quoteText: { fontFamily: Fonts.bodyMedium, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  toastWrap: { position: 'absolute', left: Spacing.gutter, right: Spacing.gutter, top: Spacing.xxl, zIndex: 40, alignItems: 'center' },
  toast: { width: '100%', maxWidth: 520, minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, overflow: 'hidden' },
  confettiLayer: { ...StyleSheet.absoluteFillObject },
  confetti: { position: 'absolute', width: 8, height: 14, borderRadius: 3, opacity: 0.86 },
  achievementIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
