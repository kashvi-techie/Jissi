import React, { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BookOpen, Brain, CalendarCheck2, MessageSquare, Settings, Sparkles, X } from 'lucide-react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { OrbEngine } from '@/components/orb/OrbEngine';
import { OrbState } from '@/components/orb/PlasmaOrb';
import { ConversationTimeline } from '@/components/ConversationTimeline';
import { VoiceWave } from '@/components/VoiceWave';
import { AIMessage } from '@/services/ai';
import type { EmotionState } from '@/services/emotion';
import type { LifeActionType } from '@/services/life';
import { AppText, GlassSurface, PressableScale, VoiceButton, VoiceButtonState } from '@/components/ui';
import { AmbientPresence, PresenceField } from '@/components/presence/PresenceEngine';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

export interface TalkViewProps {
  orbState: OrbState;
  voiceState: VoiceButtonState;
  status: string;
  transcript: string;
  messages?: AIMessage[];
  onMic: () => void;
  onStop: () => void;
  onBack: () => void;
  onMessage?: () => void;
  greeting?: string;
  goalTitle?: string;
  progressLabel?: string;
  moodLabel?: string;
  focusLabel?: string;
  onPlanner?: () => void;
  onTimeline?: () => void;
  onMemory?: () => void;
  onSettings?: () => void;
  emotionState?: EmotionState;
  lifeAction?: LifeActionType;
}

export const TalkView = memo(function TalkView({
  orbState,
  voiceState,
  status,
  transcript,
  messages = [],
  onMic,
  onBack,
  onMessage,
  greeting = 'Good Evening',
  goalTitle = 'Choose a goal',
  progressLabel = '0% today',
  moodLabel = 'Neutral',
  focusLabel = 'Ready',
  onPlanner,
  onTimeline,
  onMemory,
  onSettings,
  emotionState = 'neutral',
  lifeAction,
}: TalkViewProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const orbSize = Math.round(Math.min(width * 0.72, 340));
  const isActive = orbState === 'listening' || orbState === 'speaking' || orbState === 'tool_execution';
  const isThinking = orbState === 'thinking' || orbState === 'tool_execution';
  const waveIntensity = orbState === 'speaking' ? 1.25 : orbState === 'listening' ? 0.9 : 0.65;
  const orbPulse = useSharedValue(0);

  useEffect(() => {
    orbPulse.value = withRepeat(withTiming(1, { duration: orbState === 'speaking' ? 1200 : 4200 }), -1, true);
  }, [orbPulse, orbState]);

  const orbScale = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + orbPulse.value * (orbState === 'speaking' ? 0.055 : 0.018) }],
  }));

  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(8,28,48,0.0)', 'rgba(8,124,176,0.18)', 'rgba(106,52,180,0.16)', 'rgba(0,0,0,0.0)']}
        locations={[0, 0.36, 0.68, 1]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.noise} />
      <View pointerEvents="none" style={styles.vignette} />
      <AmbientPresence emotion={emotionState} lifeAction={lifeAction} />

      <View style={styles.topArea}>
        <Animated.View entering={FadeInUp.delay(40).duration(420)} style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <AppText style={styles.greeting} color="primary" numberOfLines={1}>
              {greeting}
            </AppText>
            <AppText variant="caption" color="muted">
              JISSI is ready when you are.
            </AppText>
          </View>
          <PressableScale onPress={onMessage} accessibilityRole="button" accessibilityLabel="Conversation">
            <GlassSurface intensity={28} radius={Radii.circle} style={styles.headerButton}>
              <MessageSquare size={18} color={theme.colors.textSecondary} strokeWidth={1.9} />
            </GlassSurface>
          </PressableScale>
        </Animated.View>

        <View style={styles.metricsGrid}>
          <MetricCard delay={90} label="Current Goal" value={goalTitle} />
          <MetricCard delay={150} label="Today's Progress" value={progressLabel} />
          <MetricCard delay={210} label="Current Mood" value={moodLabel} />
          <MetricCard delay={270} label="Current Focus" value={focusLabel} />
        </View>
      </View>

      <View style={styles.body}>
        <Animated.View style={[styles.orbStage, orbScale]} accessibilityLabel={`Assistant state: ${status}`}>
          <PresenceField state={orbState} emotion={emotionState} lifeAction={lifeAction} size={orbSize}>
            <VoiceWave active={isActive} size={orbSize * 1.02} intensity={waveIntensity} />
            <OrbEngine state={orbState} size={orbSize} />
          </PresenceField>
        </Animated.View>
        <AppText variant="caption" color="accent" style={styles.status}>
          {status}
        </AppText>
        {transcript ? (
          <AppText color="primary" style={styles.transcript}>
            {transcript}
          </AppText>
        ) : null}
        <ConversationTimeline messages={messages} thinking={isThinking} />
      </View>

      <View style={styles.actionCards}>
        <FloatingAction label="Planner" icon={CalendarCheck2} onPress={onPlanner} delay={80} />
        <FloatingAction label="Timeline" icon={BookOpen} onPress={onTimeline} delay={140} />
        <FloatingAction label="Memory" icon={Brain} onPress={onMemory} delay={200} />
        <FloatingAction label="Settings" icon={Settings} onPress={onSettings} delay={260} />
      </View>

      <View style={styles.dock}>
        <GlassSurface intensity={36} radius={Radii.pill} style={styles.inputPill}>
          <PressableScale onPress={onBack} accessibilityRole="button" accessibilityLabel="Close voice mode" style={styles.stopMini}>
            <X size={18} color={theme.colors.textMuted} strokeWidth={1.9} />
          </PressableScale>
          <View style={styles.inputCopy}>
            <AppText variant="caption" color="primary" numberOfLines={1}>
              Tap and talk to JISSI
            </AppText>
            <AppText variant="footnote" color="muted" numberOfLines={1}>
              Voice, goals, memory and timeline
            </AppText>
          </View>
          <VoiceButton state={voiceState} onPress={onMic} size={64} />
        </GlassSurface>
      </View>
    </View>
  );
});

function MetricCard({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(420)} style={styles.metricWrap}>
      <GlassSurface intensity={22} radius={Radii.lg} style={styles.metricCard}>
        <AppText variant="footnote" color="muted" numberOfLines={1}>
          {label}
        </AppText>
        <AppText variant="caption" color="primary" numberOfLines={1}>
          {value}
        </AppText>
      </GlassSurface>
    </Animated.View>
  );
}

function FloatingAction({
  label,
  icon: Icon,
  onPress,
  delay,
}: {
  label: string;
  icon: typeof Sparkles;
  onPress?: () => void;
  delay: number;
}) {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(360)} style={styles.floatingActionWrap}>
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        <GlassSurface intensity={28} radius={Radii.xl} style={styles.floatingAction}>
          <Icon size={17} color={theme.colors.accent} strokeWidth={1.8} />
          <AppText variant="footnote" color="secondary" numberOfLines={1}>
            {label}
          </AppText>
        </GlassSurface>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  noise: { ...StyleSheet.absoluteFillObject, opacity: 0.18, backgroundColor: 'rgba(255,255,255,0.012)' },
  vignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  topArea: { paddingTop: Spacing.lg, gap: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  headerCopy: { flex: 1, gap: Spacing.xs },
  greeting: { fontFamily: Fonts.bodyBold, fontSize: 26, lineHeight: 32, letterSpacing: 0 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metricWrap: { width: '48.6%' },
  metricCard: { minHeight: 66, justifyContent: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  status: { textAlign: 'center', marginTop: -Spacing.sm },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingBottom: 6 },
  orbStage: { alignItems: 'center', justifyContent: 'center' },
  transcript: {
    textAlign: 'center',
    fontFamily: Fonts.bodyMedium,
    fontSize: 21,
    lineHeight: 30,
    letterSpacing: 0,
    maxWidth: 340,
    paddingHorizontal: Spacing.lg,
  },
  actionCards: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.md },
  floatingActionWrap: { flex: 1 },
  floatingAction: { minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.xs },
  dock: { paddingBottom: Spacing.xl, paddingTop: Spacing.xs },
  inputPill: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingLeft: Spacing.lg, paddingRight: Spacing.xs },
  inputCopy: { flex: 1, gap: 2 },
  stopMini: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
