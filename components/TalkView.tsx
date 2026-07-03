import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { ArrowLeft, MessageSquare, Search, X } from 'lucide-react-native';
import { OrbEngine } from '@/components/orb/OrbEngine';
import { OrbState } from '@/components/orb/PlasmaOrb';
import { AppText, CircleButton, PressableScale, VoiceButton, VoiceButtonState } from '@/components/ui';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Spacing } from '@/theme/tokens';

export interface TalkViewProps {
  orbState: OrbState;
  voiceState: VoiceButtonState;
  /** Short status line under the top bar ("Listening…", "Thinking…"). */
  status: string;
  transcript: string;
  onMic: () => void;
  /** Stop the current turn (the ✕) WITHOUT leaving the conversation. */
  onStop: () => void;
  /** Leave the conversation (the back arrow). */
  onBack: () => void;
  /** Top-right conversation icon. */
  onMessage?: () => void;
}

/**
 * The voice conversation surface (reference screen 1): back · message · status ·
 * iridescent orb · transcript · [search · mic · ✕]. Pure presentation — it forwards
 * the conversation handlers and owns no logic. Used inline as the mobile screen and
 * inside a Modal (VoiceOverlay) on desktop.
 */
export function TalkView({ orbState, voiceState, status, transcript, onMic, onStop, onBack, onMessage }: TalkViewProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const orbSize = Math.round(Math.min(width * 0.58, 300));

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.ambientGlow} />
      {/* Top bar */}
      <View style={styles.topBar}>
        <PressableScale onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
          <View style={styles.topBtn}>
            <ArrowLeft size={22} color={theme.colors.textSecondary} strokeWidth={1.9} />
          </View>
        </PressableScale>
        <PressableScale onPress={onMessage} accessibilityRole="button" accessibilityLabel="Conversation">
          <View style={styles.topBtn}>
            <MessageSquare size={20} color={theme.colors.textSecondary} strokeWidth={1.9} />
          </View>
        </PressableScale>
      </View>

      <AppText variant="caption" color="muted" style={styles.status}>
        {status}
      </AppText>

      {/* Orb + transcript */}
      <View style={styles.body}>
        <OrbEngine state={orbState} size={orbSize} />
        {transcript ? (
          <AppText color="primary" style={styles.transcript}>
            {transcript}
          </AppText>
        ) : null}
      </View>

      {/* Dock: search · mic · close */}
      <View style={styles.dock}>
        <CircleButton icon={Search} size={48} iconSize={18} accessibilityLabel="Search" />
        <VoiceButton state={voiceState} onPress={onMic} size={62} />
        <CircleButton icon={X} size={48} iconSize={18} onPress={onStop} accessibilityLabel="Stop" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  ambientGlow: {
    position: 'absolute',
    top: 74,
    alignSelf: 'center',
    width: 320,
    height: 420,
    borderRadius: 160,
    backgroundColor: 'rgba(0,82,160,0.16)',
    transform: [{ scaleX: 1.25 }],
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.sm },
  topBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  status: { textAlign: 'center', marginTop: Spacing.sm },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.xxl, paddingBottom: 26 },
  transcript: {
    textAlign: 'center',
    fontFamily: Fonts.bodyMedium,
    fontSize: 20,
    lineHeight: 29,
    letterSpacing: 0,
    maxWidth: 320,
    paddingHorizontal: Spacing.lg,
  },

  dock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xxl, paddingBottom: Spacing.xxxl, paddingTop: Spacing.md },
});
