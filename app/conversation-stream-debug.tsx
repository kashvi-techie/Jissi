import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Activity, Radio } from 'lucide-react-native';
import { AppText, GlassSurface, Screen } from '@/components/ui';
import { ConversationStreamDiagnostics, ConversationStreamSnapshot } from '@/services/conversation';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

function ms(value: number | null): string {
  if (value == null) return 'Waiting';
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}

export default function ConversationStreamDebugScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<ConversationStreamSnapshot>(() => ConversationStreamDiagnostics.getSnapshot());

  useEffect(() => ConversationStreamDiagnostics.subscribe(setSnapshot), []);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={34} radius={Radii.circle} style={styles.badge}>
            <Radio size={28} color={theme.colors.accent} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText style={styles.title} color="primary">
              Conversation Stream Debug
            </AppText>
            <AppText variant="caption" color="muted">
              Presentation streaming metrics for the visible assistant response.
            </AppText>
          </View>
        </View>

        <GlassSurface intensity={28} radius={Radii.xl} style={styles.card}>
          <View style={styles.sectionTitle}>
            <Activity size={18} color={theme.colors.accent} strokeWidth={1.8} />
            <AppText variant="bodyStrong" color="primary">
              Current Stream
            </AppText>
          </View>
          <Line label="Message" value={snapshot.currentMessageId ?? 'None'} />
          <Line label="TTFT" value={ms(snapshot.ttftMs)} />
          <Line label="Tokens/sec" value={snapshot.tokensPerSecond ? snapshot.tokensPerSecond.toFixed(1) : 'Waiting'} />
          <Line label="Streaming duration" value={ms(snapshot.streamingDurationMs)} />
          <Line label="Token count" value={String(snapshot.tokenCount)} />
          <Line label="Interrupted" value={snapshot.interrupted ? 'Yes' : 'No'} />
          <Line label="Completed" value={snapshot.completed ? 'Yes' : 'No'} />
          <Line label="Started" value={snapshot.startedAt ? new Date(snapshot.startedAt).toLocaleTimeString() : 'Not started'} />
          <Line label="Updated" value={new Date(snapshot.updatedAt).toLocaleTimeString()} />
        </GlassSurface>
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
  title: { fontFamily: Fonts.bodyBold, fontSize: 34, lineHeight: 40, letterSpacing: 0 },
  card: { padding: Spacing.lg, gap: Spacing.md },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  line: { gap: 4 },
  lineValue: { lineHeight: 21 },
});
