import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Activity, Clock3 } from 'lucide-react-native';
import { AppText, GlassSurface, Screen } from '@/components/ui';
import { ConversationDiagnosticsSnapshot, ConversationStateMachine } from '@/services/conversation';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

function ms(value: number | null): string {
  if (value == null) return 'Waiting';
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}

export default function ConversationDebugScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<ConversationDiagnosticsSnapshot>(() => ConversationStateMachine.getSnapshot());

  useEffect(() => ConversationStateMachine.subscribe(setSnapshot), []);

  const latency = snapshot.latency;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={34} radius={Radii.circle} style={styles.badge}>
            <Activity size={28} color={theme.colors.accent} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText style={styles.title} color="primary">
              Conversation Debug
            </AppText>
            <AppText variant="caption" color="muted">
              State, latency and transition history for the current turn.
            </AppText>
          </View>
        </View>

        <GlassSurface intensity={28} radius={Radii.xl} style={styles.card}>
          <Line label="Current state" value={snapshot.currentState} />
          <Line label="Previous state" value={snapshot.previousState} />
          <Line label="Companion message" value={snapshot.companionMessage} />
          <Line label="Current task" value={snapshot.currentTask} />
          <Line label="Current engine" value={snapshot.currentEngine} />
          <Line label="Retry count" value={String(snapshot.retryCount)} />
          <Line label="Pending actions" value={snapshot.pendingActions.length ? snapshot.pendingActions.join(', ') : 'None'} />
        </GlassSurface>

        <GlassSurface intensity={24} radius={Radii.xl} style={styles.card}>
          <View style={styles.sectionTitle}>
            <Clock3 size={18} color={theme.colors.accent} strokeWidth={1.8} />
            <AppText variant="bodyStrong" color="primary">
              Latency
            </AppText>
          </View>
          <Line label="Time to first token" value={ms(latency.timeToFirstTokenMs)} />
          <Line label="Time to final response" value={ms(latency.timeToFinalResponseMs)} />
          <Line label="Thinking duration" value={ms(latency.thinkingDurationMs)} />
          <Line label="TTS duration" value={ms(latency.ttsDurationMs)} />
          <Line label="Execution duration" value={ms(latency.executionDurationMs)} />
        </GlassSurface>

        <View style={styles.history}>
          <AppText variant="label" color="muted" uppercase>
            Transition History
          </AppText>
          {snapshot.transitionHistory.length === 0 ? (
            <GlassSurface intensity={18} radius={Radii.lg} style={styles.empty}>
              <AppText variant="caption" color="muted">
                Start a conversation to see transitions.
              </AppText>
            </GlassSurface>
          ) : (
            snapshot.transitionHistory.map((item) => (
              <GlassSurface key={item.id} intensity={18} radius={Radii.lg} style={styles.transition}>
                <AppText variant="bodyStrong" color="primary">
                  {item.from} {'->'} {item.to}
                </AppText>
                <AppText variant="caption" color="muted">
                  {item.reason}
                </AppText>
                <AppText variant="footnote" color="tertiary">
                  {new Date(item.timestamp).toLocaleTimeString()} · +{ms(item.elapsedMs)}
                </AppText>
              </GlassSurface>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <AppText variant="footnote" color="muted">
        {label}
      </AppText>
      <AppText variant="caption" color="primary" style={styles.lineValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, paddingTop: 56, paddingBottom: 120, gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  badge: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: Spacing.xs },
  title: { fontFamily: Fonts.bodyBold, fontSize: 36, lineHeight: 42, letterSpacing: 0 },
  card: { padding: Spacing.lg, gap: Spacing.md },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  line: { gap: 4 },
  lineValue: { lineHeight: 21 },
  history: { gap: Spacing.md },
  transition: { padding: Spacing.md, gap: Spacing.xs },
  empty: { minHeight: 72, alignItems: 'center', justifyContent: 'center', padding: Spacing.md },
});
