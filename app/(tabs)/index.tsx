import React, { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarClock, Languages, MessageCircle, Sparkles } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { SpeechState } from '@/services/speech/types';
import { AssistantState } from '@/hooks/useConversation';
import { useConversationMode } from '@/hooks/useConversationMode';
import { OrbState } from '@/components/orb/PlasmaOrb';
import { TalkView } from '@/components/TalkView';
import { VoiceOverlay } from '@/components/VoiceOverlay';
import { AppText, GlassSurface, PressableScale, Screen, VoiceButtonState } from '@/components/ui';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

/**
 * HOME — voice-first on mobile (orb + status + pills + mic dock), Gemini-style on
 * desktop ("Hello." + prompt cards + floating input dock). A session starts via
 * the existing useConversationMode; while active the full-screen VoiceOverlay
 * takes over. No business logic / navigation changed.
 */

const WIDE_BREAKPOINT = 900;

type Phase = 'idle' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'error';

function computePhase(s: SpeechState, a: AssistantState): Phase {
  if (s === 'error') return 'error';
  if (a === 'thinking') return 'thinking';
  if (a === 'speaking') return 'speaking';
  if (s === 'listening') return 'listening';
  if (s === 'processing') return 'processing';
  return 'idle';
}

function phaseToOrb(p: Phase): OrbState {
  if (p === 'listening') return 'listening';
  if (p === 'thinking' || p === 'processing') return 'thinking';
  if (p === 'speaking') return 'speaking';
  return 'idle';
}

function phaseToVoice(p: Phase, supported: boolean): VoiceButtonState {
  if (!supported) return 'disabled';
  if (p === 'listening') return 'listening';
  if (p === 'thinking' || p === 'processing') return 'thinking';
  if (p === 'speaking') return 'speaking';
  return 'idle';
}

function statusShort(p: Phase, supported: boolean): string {
  if (!supported) return 'Unavailable here';
  switch (p) {
    case 'listening':
      return 'Listening…';
    case 'thinking':
    case 'processing':
      return 'Thinking…';
    case 'speaking':
      return 'Speaking…';
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

  // Desktop only: whether the talk overlay is open. Decoupled from the session so
  // "stop" pauses the turn without closing the conversation; only "back" closes.
  const [talkOpen, setTalkOpen] = useState(false);
  const openTopic = (text: string) => {
    setTalkOpen(true);
    sendPrompt(text);
  };
  const closeTalk = () => {
    stop();
    setTalkOpen(false);
  };
  const goHistory = () => router.push('/(tabs)/history' as never);

  const phase = computePhase(speechState, assistantState);

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? '';
  const voiceTranscript =
    phase === 'listening'
      ? interimTranscript || transcript || lastUser
      : phase === 'speaking'
        ? lastAssistant
        : phase === 'thinking' || phase === 'processing'
          ? lastUser
          : error || lastAssistant || lastUser;

  return (
    <Screen>
      {isWide ? (
        /* ── Desktop: Gemini-style landing ─────────────────────────────── */
        <View style={styles.deskRoot}>
          <View style={styles.deskCenter}>
            <AppText style={[styles.hello, { color: theme.colors.accent }]}>Hello.</AppText>
            <AppText style={[styles.helloSub, { color: theme.colors.textMuted }]}>How can I help you today?</AppText>

            <View style={styles.cardRow}>
              {PROMPT_CARDS.map((c) => {
                const Icon = c.icon;
                return (
                  <PressableScale
                    key={c.text}
                    onPress={() => openTopic(c.text)}
                    accessibilityRole="button"
                    accessibilityLabel={c.text}
                    style={styles.cardWrap}
                  >
                    <GlassSurface intensity={18} radius={Radii.lg} style={styles.card}>
                      <AppText variant="callout" color="secondary" numberOfLines={3}>
                        {c.text}
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
        /* ── Mobile: direct talk (no home) ─────────────────────────────── */
        <TalkView
          orbState={phaseToOrb(phase)}
          voiceState={phaseToVoice(phase, isSupported)}
          status={statusShort(phase, isSupported)}
          transcript={voiceTranscript}
          onMic={() => {
            if (isSupported) toggle();
          }}
          onStop={stop}
          onBack={stop}
          onMessage={goHistory}
        />
      )}

      {/* Desktop: talk overlays the landing. Stop pauses the turn; back closes it. */}
      {isWide ? (
        <VoiceOverlay
          visible={talkOpen}
          orbState={phaseToOrb(phase)}
          voiceState={phaseToVoice(phase, isSupported)}
          status={statusShort(phase, isSupported)}
          transcript={voiceTranscript}
          onMic={toggle}
          onStop={stop}
          onBack={closeTalk}
          onMessage={goHistory}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Desktop
  deskRoot: { flex: 1 },
  deskCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 920, alignSelf: 'center', width: '100%' },
  hello: { fontFamily: Fonts.bodyBold, fontSize: 46, lineHeight: 54, letterSpacing: -1 },
  helloSub: { fontFamily: Fonts.bodyBold, fontSize: 40, lineHeight: 48, letterSpacing: -0.8 },
  cardRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.huge, width: '100%' },
  cardWrap: { flex: 1 },
  card: { padding: Spacing.lg, minHeight: 130, justifyContent: 'space-between' },
  cardIcon: { alignSelf: 'flex-end', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
});
