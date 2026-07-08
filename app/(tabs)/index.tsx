import React, { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarClock, Languages, MessageCircle, Sparkles } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { SpeechState } from '@/services/speech/types';
import { TTSService } from '@/services/voice';
import { ProactiveExperience, ProactiveSuggestion } from '@/services/proactive';
import { OnboardingService } from '@/services/onboarding';
import { AssistantState } from '@/hooks/useConversation';
import { useConversationMode } from '@/hooks/useConversationMode';
import { OrbState } from '@/components/orb/PlasmaOrb';
import { TalkView } from '@/components/TalkView';
import { VoiceOverlay } from '@/components/VoiceOverlay';
import { AppText, GlassSurface, PressableScale, Screen, VoiceButtonState } from '@/components/ui';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

const WIDE_BREAKPOINT = 900;

type Phase = 'idle' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'tool_execution' | 'offline' | 'error';

function computePhase(s: SpeechState, a: AssistantState, supported: boolean): Phase {
  if (!supported) return 'offline';
  if (s === 'error') return 'error';
  if (a === 'thinking') return 'thinking';
  if (a === 'speaking') return 'speaking';
  if (s === 'listening') return 'listening';
  if (s === 'processing') return 'tool_execution';
  return 'idle';
}

function phaseToOrb(p: Phase): OrbState {
  if (p === 'listening') return 'listening';
  if (p === 'tool_execution') return 'tool_execution';
  if (p === 'offline') return 'offline';
  if (p === 'error') return 'error';
  if (p === 'thinking' || p === 'processing') return 'thinking';
  if (p === 'speaking') return 'speaking';
  return 'idle';
}

function phaseToVoice(p: Phase, supported: boolean): VoiceButtonState {
  if (!supported || p === 'offline') return 'offline';
  if (p === 'listening') return 'listening';
  if (p === 'tool_execution') return 'tool_execution';
  if (p === 'error') return 'error';
  if (p === 'thinking' || p === 'processing') return 'thinking';
  if (p === 'speaking') return 'speaking';
  return 'idle';
}

function statusShort(p: Phase, supported: boolean): string {
  if (!supported) return 'Unavailable here';
  switch (p) {
    case 'offline':
      return 'Offline';
    case 'listening':
      return 'Listening...';
    case 'tool_execution':
      return 'Using tools...';
    case 'thinking':
    case 'processing':
      return 'Thinking...';
    case 'speaking':
      return 'Speaking...';
    case 'error':
      return 'Try again';
    default:
      return 'Ready';
  }
}

const PROMPT_CARDS: { text: string; icon: LucideIcon }[] = [
  { text: 'Settle a debate: how should you store bread?', icon: Sparkles },
  { text: 'Give me phrases to learn a new language', icon: Languages },
  { text: 'Help create a weekly meal plan for two', icon: CalendarClock },
  { text: 'Help me draft a response to a friend', icon: MessageCircle },
];

export default function HomeScreen() {
  const {
    speechState,
    assistantState,
    transcript,
    interimTranscript,
    messages,
    error,
    isSupported,
    stop,
    toggle,
    sendPrompt,
  } = useConversationMode();

  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const [talkOpen, setTalkOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<ProactiveSuggestion | null>(null);

  const openTopic = (text: string) => {
    setTalkOpen(true);
    sendPrompt(text);
  };
  const closeTalk = () => {
    stop();
    setTalkOpen(false);
  };
  const goHistory = () => router.push('/(tabs)/history' as never);

  const phase = computePhase(speechState, assistantState, isSupported);
  const canSuggest = phase === 'idle' && !talkOpen;

  useEffect(() => {
    let cancelled = false;
    const checkOnboarding = async () => {
      const complete = await OnboardingService.isComplete();
      if (!cancelled && !complete) {
        router.replace('/onboarding' as never);
      }
    };
    checkOnboarding();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const loadSuggestion = async () => {
      if (!canSuggest) {
        setSuggestion(null);
        return;
      }
      const suggestions = await ProactiveExperience.getSuggestions({
        userTalking: speechState === 'listening' || speechState === 'processing',
        voiceActive: assistantState === 'thinking' || assistantState === 'speaking',
      });
      if (!cancelled) setSuggestion(suggestions[0] ?? null);
    };
    loadSuggestion();
    return () => {
      cancelled = true;
    };
  }, [assistantState, canSuggest, speechState, talkOpen]);

  const acceptSuggestion = async () => {
    if (!suggestion) return;
    await ProactiveExperience.recordFeedback(suggestion, 'accepted');
    setSuggestion(null);
    if (suggestion.action.type === 'prompt') {
      openTopic(suggestion.action.prompt);
    } else if (suggestion.action.type === 'open_debug') {
      router.push(suggestion.action.route as never);
    }
  };

  const dismissSuggestion = async () => {
    if (!suggestion) return;
    await ProactiveExperience.recordFeedback(suggestion, 'ignored');
    setSuggestion(null);
  };
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? '';
  const voiceTranscript =
    phase === 'listening'
      ? interimTranscript || transcript || lastUser
      : phase === 'speaking'
        ? lastAssistant
        : phase === 'thinking' || phase === 'processing' || phase === 'tool_execution'
          ? lastUser
          : error || lastAssistant || lastUser;

  return (
    <Screen>
      {isWide ? (
        <View style={styles.deskRoot}>
          <View style={styles.deskCenter}>
            <AppText style={[styles.hello, { color: theme.colors.accent }]}>Hello.</AppText>
            <AppText style={[styles.helloSub, { color: theme.colors.textMuted }]}>How can I help you today?</AppText>

            {suggestion ? (
              <ProactiveCard suggestion={suggestion} onAccept={acceptSuggestion} onDismiss={dismissSuggestion} />
            ) : null}

            <View style={styles.cardRow}>
              {PROMPT_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <PressableScale
                    key={card.text}
                    onPress={() => openTopic(card.text)}
                    accessibilityRole="button"
                    accessibilityLabel={card.text}
                    style={styles.cardWrap}
                  >
                    <GlassSurface intensity={18} radius={Radii.lg} style={styles.card}>
                      <AppText variant="callout" color="secondary" numberOfLines={3}>
                        {card.text}
                      </AppText>
                      <View style={styles.cardIcon}>
                        <Icon size={16} color={theme.colors.textSecondary} strokeWidth={1.8} />
                      </View>
                    </GlassSurface>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        </View>
      ) : (
        <TalkView
          orbState={phaseToOrb(phase)}
          voiceState={phaseToVoice(phase, isSupported)}
          status={statusShort(phase, isSupported)}
          transcript={voiceTranscript}
          messages={messages}
          onMic={() => {
            TTSService.unlockWeb();
            if (isSupported) toggle();
          }}
          onStop={stop}
          onBack={stop}
          onMessage={goHistory}
        />
      )}

      {!isWide && suggestion ? (
        <View style={styles.mobileSuggestion}>
          <ProactiveCard suggestion={suggestion} onAccept={acceptSuggestion} onDismiss={dismissSuggestion} compact />
        </View>
      ) : null}

      {isWide ? (
        <VoiceOverlay
          visible={talkOpen}
          orbState={phaseToOrb(phase)}
          voiceState={phaseToVoice(phase, isSupported)}
          status={statusShort(phase, isSupported)}
          transcript={voiceTranscript}
          messages={messages}
          onMic={() => {
            TTSService.unlockWeb();
            toggle();
          }}
          onStop={stop}
          onBack={closeTalk}
          onMessage={goHistory}
        />
      ) : null}
    </Screen>
  );
}

function ProactiveCard({
  suggestion,
  compact,
  onAccept,
  onDismiss,
}: {
  suggestion: ProactiveSuggestion;
  compact?: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <GlassSurface intensity={24} radius={Radii.lg} style={[styles.proactiveCard, compact && styles.proactiveCompact]}>
      <PressableScale onPress={onAccept} accessibilityRole="button" accessibilityLabel={suggestion.message} style={styles.proactiveMain}>
        <AppText variant="bodyStrong" color="primary" numberOfLines={1}>
          {suggestion.title}
        </AppText>
        <AppText variant="caption" color="muted" numberOfLines={compact ? 2 : 3}>
          {suggestion.message}
        </AppText>
      </PressableScale>
      <PressableScale onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss suggestion" style={styles.dismissButton}>
        <AppText variant="footnote" color="muted">
          Not now
        </AppText>
      </PressableScale>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  deskRoot: { flex: 1 },
  deskCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 920, alignSelf: 'center', width: '100%' },
  hello: { fontFamily: Fonts.bodyBold, fontSize: 46, lineHeight: 54, letterSpacing: 0 },
  helloSub: { fontFamily: Fonts.bodyBold, fontSize: 40, lineHeight: 48, letterSpacing: 0 },
  cardRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.huge, width: '100%' },
  cardWrap: { flex: 1 },
  card: { padding: Spacing.lg, minHeight: 130, justifyContent: 'space-between' },
  proactiveCard: { width: '100%', maxWidth: 620, marginTop: Spacing.xl, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  proactiveCompact: { maxWidth: '100%', marginTop: 0 },
  proactiveMain: { flex: 1, gap: Spacing.xs },
  dismissButton: { minHeight: 40, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  mobileSuggestion: { position: 'absolute', left: Spacing.gutter, right: Spacing.gutter, top: Spacing.xxl },
  cardIcon: {
    alignSelf: 'flex-end',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
