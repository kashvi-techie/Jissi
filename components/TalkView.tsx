import React, { memo, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BookOpen, CalendarCheck2, GitBranch, MessageCircle, Settings, Sparkles, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { OrbEngine } from '@/components/orb/OrbEngine';
import { OrbState } from '@/components/orb/PlasmaOrb';
import { VoiceWave } from '@/components/VoiceWave';
import { DailyBriefCard } from '@/components/daily/DailyBriefCard';
import { ConversationTimeline } from '@/components/ConversationTimeline';
import { AIMessage } from '@/services/ai';
import type { DailyBrief } from '@/services/daily';
import type { EmotionState } from '@/services/emotion';
import type { LifeActionType } from '@/services/life';
import { AppText, GlassSurface, PressableScale, VoiceButton, VoiceButtonState } from '@/components/ui';
import { AmbientPresence, LivingAvatar } from '@/components/presence/PresenceEngine';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

export interface TalkViewProps {
  orbState: OrbState;
  voiceState: VoiceButtonState;
  status: string;
  transcript: string;
  messages?: AIMessage[];
  currentMode?: string;
  voiceConfidence?: number;
  lastHeardAt?: string | null;
  conversationDurationMs?: number;
  onMic: () => void;
  onStop: () => void;
  onBack: () => void;
  onMessage?: () => void;
  greeting?: string;
  greetingSubtext?: string;
  goalTitle?: string;
  progressLabel?: string;
  moodLabel?: string;
  focusLabel?: string;
  dashboardCards?: TalkDashboardCard[];
  dailyBrief?: DailyBrief | null;
  onDailyBriefAction?: (prompt: string) => void;
  onPlanner?: () => void;
  onTimeline?: () => void;
  onLifeGraph?: () => void;
  onMemory?: () => void;
  onRelationships?: () => void;
  onSettings?: () => void;
  emotionState?: EmotionState;
  lifeAction?: LifeActionType;
}

interface TalkDashboardCard {
  id: string;
  label: string;
  title: string;
  body: string;
  icon?: LucideIcon;
}

const thinkingPhrases = [
  'Thinking...',
  'Let me figure that out...',
  'One second...',
  'Looking through what I know...',
  'Connecting the pieces...',
];

export const TalkView = memo(function TalkView({
  orbState,
  voiceState,
  status,
  transcript,
  messages = [],
  currentMode,
  voiceConfidence = 0,
  lastHeardAt,
  conversationDurationMs = 0,
  onMic,
  onMessage,
  greeting = 'Good Evening',
  greetingSubtext = 'Ready whenever you are.',
  focusLabel = 'Ready',
  dashboardCards = [],
  dailyBrief,
  onDailyBriefAction,
  onPlanner,
  onTimeline,
  onLifeGraph,
  onMemory,
  onRelationships,
  onSettings,
  emotionState = 'neutral',
  lifeAction,
}: TalkViewProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const orbSize = Math.round(Math.min(width * 0.7, 304));
  const isActive = orbState === 'listening' || orbState === 'speaking' || orbState === 'tool_execution';
  const isThinking = orbState === 'thinking' || orbState === 'tool_execution';
  const isListening = orbState === 'listening';
  const isSpeaking = orbState === 'speaking';
  const waveIntensity = orbState === 'speaking' ? 1.2 : orbState === 'listening' ? 0.9 : 0.58;
  const orbPulse = useSharedValue(0);
  const ringPulse = useSharedValue(0);
  const mouthPulse = useSharedValue(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const visibleCards = useMemo(() => dashboardCards.slice(0, 1), [dashboardCards]);
  const presenceText = isThinking
    ? phraseIndex % 2 === 0 ? 'Give me a second...' : thinkingPhrases[phraseIndex]
    : isListening
      ? transcript || "I'm here."
      : isSpeaking
        ? 'Speaking... tap Talk to interrupt.'
        : messages.length > 0
          ? 'Done.'
          : status;

  useEffect(() => {
    orbPulse.value = withRepeat(withTiming(1, { duration: isSpeaking ? 1050 : isListening ? 1800 : 4600 }), -1, true);
    ringPulse.value = withRepeat(withTiming(1, { duration: isListening ? 1400 : isSpeaking ? 980 : 2800 }), -1, false);
    mouthPulse.value = withRepeat(withTiming(1, { duration: 680 }), -1, true);
  }, [isListening, isSpeaking, mouthPulse, orbPulse, ringPulse]);

  useEffect(() => {
    if (!isThinking) {
      setPhraseIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setPhraseIndex((index) => (index + 1) % thinkingPhrases.length);
    }, 1600);
    return () => clearInterval(timer);
  }, [isThinking]);

  const handleMicPress = () => onMic();

  const orbScale = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + orbPulse.value * (isSpeaking ? 0.045 : isListening ? 0.026 : 0.016) }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: isListening ? 0.34 - ringPulse.value * 0.2 : isSpeaking ? 0.22 - ringPulse.value * 0.12 : isThinking ? 0.18 : 0.08,
    transform: [{ scale: 0.92 + ringPulse.value * (isListening ? 0.22 : 0.1) }],
  }));

  const mouthStyle = useAnimatedStyle(() => ({
    opacity: isSpeaking ? 0.72 : 0,
    transform: [{ scaleX: 0.72 + mouthPulse.value * 0.5 }],
  }));

  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(6,18,34,0)', 'rgba(12,116,164,0.16)', 'rgba(96,56,170,0.12)', 'rgba(0,0,0,0)']}
        locations={[0, 0.38, 0.72, 1]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.noise} />
      <View pointerEvents="none" style={styles.vignette} />
      <AmbientPresence emotion={emotionState} lifeAction={lifeAction} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInUp.delay(40).duration(440)} style={styles.hero}>
          <AppText style={styles.greeting} color="primary">
            {greeting.endsWith('.') ? greeting : `${greeting}.`}
          </AppText>
          <AppText style={styles.subtitle} color="muted">
            {greetingSubtext || 'Ready whenever you are.'}
          </AppText>

          <Animated.View style={[styles.orbStage, orbScale]} accessibilityLabel={`Assistant state: ${status}`}>
            <Animated.View pointerEvents="none" style={[styles.presenceRing, ringStyle]} />
            <LivingAvatar state={orbState} emotion={emotionState} lifeAction={lifeAction} size={orbSize}>
              <VoiceWave active={isActive} size={orbSize * 1.04} intensity={waveIntensity} />
              <OrbEngine state={orbState} size={orbSize} />
              <Animated.View pointerEvents="none" style={[styles.speakingMouth, mouthStyle]} />
            </LivingAvatar>
          </Animated.View>

          <AppText variant="caption" color="accent" style={styles.status}>
            {presenceText}
          </AppText>
          {isThinking ? <TypingIndicator /> : null}
          <VoicePresenceBar
            mode={currentMode || orbState}
            confidence={voiceConfidence}
            lastHeardAt={lastHeardAt}
            durationMs={conversationDurationMs}
          />
          <View style={styles.conversationPreview}>
            {messages.length === 0 && !isThinking ? (
              <GlassSurface intensity={16} radius={Radii.xl} style={styles.emptyConversation}>
                <AppText variant="bodyStrong" color="primary" style={styles.emptyTitle}>
                  What would you like to do today?
                </AppText>
                <AppText variant="caption" color="muted" style={styles.emptyCopy}>
                  Talk, plan, remember something, or just think out loud with JISSI.
                </AppText>
              </GlassSurface>
            ) : (
              <ConversationTimeline messages={messages} thinking={isThinking} />
            )}
          </View>
        </Animated.View>

        {dailyBrief ? <DailyBriefCard brief={dailyBrief} compact onAction={onDailyBriefAction} /> : null}

        <View style={styles.sections}>
          {visibleCards.map((card, index) => (
            <SectionCard key={card.id} card={card} delay={240 + index * 70} />
          ))}
        </View>

        <View style={styles.pageLinks}>
          <PageLink label="Chat" icon={MessageCircle} onPress={onMessage} />
          <PageLink label="Journey" icon={CalendarCheck2} onPress={onTimeline ?? onPlanner} />
          <PageLink label="Life Graph" icon={GitBranch} onPress={onLifeGraph} />
          <PageLink label="Settings" icon={Settings} onPress={onSettings ?? onMemory} />
        </View>
      </ScrollView>

      <View style={styles.fixedTalk}>
        <PressableScale onPress={handleMicPress} accessibilityRole="button" accessibilityLabel="Tap to Talk" style={styles.mobileTalkWrap}>
          <GlassSurface intensity={42} radius={Radii.pill} strong style={styles.mobileTalk}>
            <VoiceButton state={voiceState} onPress={handleMicPress} size={58} />
            <View style={styles.mobileTalkCopy}>
              <AppText variant="bodyStrong" color="primary">
                Tap to Talk
              </AppText>
              <AppText variant="footnote" color="muted" numberOfLines={1}>
                {focusLabel || 'Type instead from chat'}
              </AppText>
            </View>
          </GlassSurface>
        </PressableScale>
      </View>
    </View>
  );
});

function TypingIndicator() {
  return (
    <View style={styles.typingDots} accessibilityLabel="JISSI is thinking">
      <View style={styles.typingDot} />
      <View style={[styles.typingDot, styles.typingDotMid]} />
      <View style={styles.typingDot} />
    </View>
  );
}

function VoicePresenceBar({
  mode,
  confidence,
  lastHeardAt,
  durationMs,
}: {
  mode: string;
  confidence: number;
  lastHeardAt?: string | null;
  durationMs: number;
}) {
  const confidenceLabel = confidence > 0 ? `${Math.round(confidence * 100)}%` : 'Ready';
  return (
    <GlassSurface intensity={16} radius={Radii.pill} style={styles.presenceBar}>
      <AppText variant="footnote" color="secondary" numberOfLines={1}>
        {titleCase(mode)}
      </AppText>
      <View style={styles.presenceDivider} />
      <AppText variant="footnote" color="muted" numberOfLines={1}>
        Voice {confidenceLabel}
      </AppText>
      <View style={styles.presenceDivider} />
      <AppText variant="footnote" color="muted" numberOfLines={1}>
        {lastHeardAt ? `Heard ${relativeHeard(lastHeardAt)}` : formatDuration(durationMs)}
      </AppText>
    </GlassSurface>
  );
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function relativeHeard(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'recently';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function SectionCard({ card, delay }: { card: TalkDashboardCard; delay: number }) {
  const theme = useTheme();
  const Icon = card.icon ?? Sparkles;
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(380)}>
      <GlassSurface intensity={24} radius={Radii.xl} style={styles.sectionCard}>
        <View style={[styles.sectionIcon, { backgroundColor: theme.colors.accentSoft }]}>
          <Icon size={17} color={theme.colors.accent} strokeWidth={1.8} />
        </View>
        <View style={styles.sectionText}>
          <AppText variant="footnote" color="muted" numberOfLines={1}>
            {card.label}
          </AppText>
          <AppText variant="bodyStrong" color="primary" numberOfLines={1}>
            {card.title}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={2}>
            {card.body}
          </AppText>
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

function PageLink({ label, icon: Icon, onPress }: { label: string; icon: LucideIcon; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.pageLink}>
      <Icon size={17} color={theme.colors.textSecondary} strokeWidth={1.8} />
      <AppText variant="footnote" color="secondary">
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  noise: { ...StyleSheet.absoluteFillObject, opacity: 0.12, backgroundColor: 'rgba(255,255,255,0.012)' },
  vignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  scrollContent: { paddingTop: 64, paddingHorizontal: 24, paddingBottom: 148, gap: 36 },
  hero: { minHeight: 640, alignItems: 'center', justifyContent: 'center', gap: 20 },
  greeting: { fontFamily: Fonts.bodyBold, fontSize: 34, lineHeight: 42, letterSpacing: 0, textAlign: 'center' },
  subtitle: { fontFamily: Fonts.bodyMedium, fontSize: 16, lineHeight: 24, letterSpacing: 0, textAlign: 'center' },
  orbStage: { minHeight: 320, alignItems: 'center', justifyContent: 'center' },
  presenceRing: {
    position: 'absolute',
    width: 336,
    height: 336,
    borderRadius: 168,
    borderWidth: 1,
    borderColor: 'rgba(125,226,255,0.7)',
    backgroundColor: 'rgba(93,220,255,0.05)',
    shadowColor: '#5ddcff',
    shadowOpacity: 0.28,
    shadowRadius: 38,
  },
  speakingMouth: {
    position: 'absolute',
    bottom: '30%',
    alignSelf: 'center',
    width: 46,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.76)',
    shadowColor: '#ffffff',
    shadowOpacity: 0.52,
    shadowRadius: 16,
  },
  status: { textAlign: 'center' },
  typingDots: { height: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  typingDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.56)' },
  typingDotMid: { opacity: 0.8, transform: [{ translateY: -2 }] },
  presenceBar: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  presenceDivider: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.12)' },
  conversationPreview: { width: '100%', maxWidth: 560, minHeight: 18 },
  emptyConversation: { minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 18 },
  emptyTitle: { textAlign: 'center' },
  emptyCopy: { textAlign: 'center', maxWidth: 360 },
  sections: { gap: 12 },
  sectionCard: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  sectionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sectionText: { flex: 1, gap: 4 },
  pageLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pageLink: { minHeight: 44, flexGrow: 1, minWidth: '46%', borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.035)' },
  fixedTalk: { position: 'absolute', left: 20, right: 20, bottom: 24 },
  mobileTalkWrap: { width: '100%' },
  mobileTalk: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingLeft: 12, paddingRight: 22 },
  mobileTalkCopy: { flex: 1, gap: 2 },
});
