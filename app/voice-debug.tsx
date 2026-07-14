import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Activity, Mic, RefreshCw, Volume2 } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { SpeechService } from '@/services/speech/SpeechService';
import { TTSService, VoiceDiagnostics, VoiceDiagnosticsSnapshot } from '@/services/voice';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

function colorForRuntime(state: VoiceDiagnosticsSnapshot['runtimeState'], theme: ReturnType<typeof useTheme>): string {
  if (state === 'listening' || state === 'speaking') return theme.colors.accent;
  if (state === 'recovering' || state === 'interrupted') return '#F6C85F';
  if (state === 'offline') return theme.colors.error;
  return theme.colors.textSecondary;
}

function label(value: string): string {
  return value.replace(/_/g, ' ');
}

export default function VoiceDebugScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<VoiceDiagnosticsSnapshot>(VoiceDiagnostics.getSnapshot());
  const [recognitionAvailable, setRecognitionAvailable] = useState<boolean | null>(null);

  useEffect(() => VoiceDiagnostics.subscribe(setSnapshot), []);

  const refresh = async () => {
    setSnapshot(VoiceDiagnostics.getSnapshot());
    setRecognitionAvailable(await SpeechService.isAvailable());
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <Mic size={28} color={colorForRuntime(snapshot.runtimeState, theme)} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.flex}>
            <AppText variant="headline" color="primary">
              Voice Debug
            </AppText>
            <AppText variant="body" color="muted">
              Unified diagnostics for STT, TTS, audio focus, lifecycle and recovery.
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <DebugButton label="Refresh" icon={RefreshCw} onPress={refresh} />
        </View>

        <GlassSurface intensity={28} radius={Radii.xl} style={styles.card}>
          <View style={styles.row}>
            <Activity size={20} color={colorForRuntime(snapshot.runtimeState, theme)} strokeWidth={1.8} />
            <View style={styles.flex}>
              <AppText variant="title" color="primary">
                {label(snapshot.runtimeState)}
              </AppText>
              <AppText variant="caption" color="muted">
                Updated {new Date(snapshot.updatedAt).toLocaleTimeString()}
              </AppText>
            </View>
          </View>
          <Line label="Microphone state" value={label(snapshot.microphoneState)} />
          <Line label="Permission state" value={label(snapshot.permissionState)} />
          <Line label="Speech recognizer" value={label(snapshot.speechRecognizerState)} />
          <Line label="Recognizer available" value={recognitionAvailable === null ? 'not checked' : recognitionAvailable ? 'yes' : 'no'} />
          <Line label="TTS state" value={label(snapshot.ttsState)} />
          <Line label="Audio focus" value={label(snapshot.audioFocus)} />
          <Line label="Conversation state" value={label(snapshot.conversationState)} />
          <Line label="Lifecycle" value={snapshot.lifecycle} />
          <Line label="Recovery attempts" value={String(snapshot.recoveryAttempts)} />
          <Line label="Continuous conversation" value={snapshot.continuousConversation ? 'enabled' : 'disabled'} />
          <Line label="Barge in" value={snapshot.bargeInAvailable ? 'mic tap interrupts TTS' : 'not active'} />
          <Line label="Last error" value={snapshot.lastError ?? 'none'} />
        </GlassSurface>

        <GlassSurface intensity={20} radius={Radii.xl} style={styles.card}>
          <View style={styles.row}>
            <Volume2 size={20} color={theme.colors.textSecondary} strokeWidth={1.8} />
            <View style={styles.flex}>
              <AppText variant="title" color="primary">
                Current Speech
              </AppText>
              <AppText variant="caption" color="muted">
                {TTSService.getCurrentText() || 'No active TTS text.'}
              </AppText>
            </View>
          </View>
        </GlassSurface>
      </ScrollView>
    </Screen>
  );
}

function DebugButton({ label: buttonLabel, icon: Icon, onPress }: { label: string; icon: typeof RefreshCw; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={buttonLabel} style={[styles.button, { backgroundColor: theme.colors.accentSoft }]}>
      <Icon size={16} color={theme.colors.accent} strokeWidth={1.9} />
      <AppText variant="caption" color="accent">
        {buttonLabel}
      </AppText>
    </PressableScale>
  );
}

function Line({ label: lineLabel, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <AppText variant="footnote" color="muted">
        {lineLabel}
      </AppText>
      <AppText variant="caption" color="primary" style={styles.lineValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  button: { minHeight: 42, borderRadius: Radii.pill, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md },
  card: { gap: Spacing.md, padding: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  line: { gap: 4 },
  lineValue: { flexShrink: 1 },
});
