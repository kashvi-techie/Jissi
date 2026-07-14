import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BellRing, Download, History, Trash2 } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { ProactiveEngine, ProactiveEngineSnapshot, ProactiveMoment, ProactiveMomentStatus, ProactiveExperience } from '@/services/proactive';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

const EMPTY: ProactiveEngineSnapshot = {
  suggestions: [],
  candidates: [],
  history: [],
  analytics: { shown: 0, dismissed: 0, accepted: 0, completed: 0 },
};

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function label(value: string): string {
  return value.replace(/_/g, ' ');
}

export default function ProactiveDebugScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<ProactiveEngineSnapshot>(EMPTY);
  const [exportText, setExportText] = useState('');

  const load = useCallback(async () => {
    setSnapshot(await ProactiveEngine.getSnapshot());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const clear = () => {
    Alert.alert('Clear proactive data?', 'This removes local proactive feedback from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await ProactiveEngine.clearData();
          await ProactiveExperience.clearData();
          setExportText('');
          await load();
        },
      },
    ]);
  };

  const feedback = async (moment: ProactiveMoment, status: ProactiveMomentStatus) => {
    await ProactiveEngine.record(moment, status);
    await load();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <BellRing size={28} color={theme.colors.accent} strokeWidth={1.6} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              Proactive Debug
            </AppText>
            <AppText variant="body" color="muted">
              Local proactive moments, priority, confidence, reasons, engine sources and feedback analytics.
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <DebugButton label="Export JSON" icon={Download} onPress={async () => setExportText(await ProactiveEngine.exportJson())} />
          <DebugButton label="Clear data" icon={Trash2} destructive onPress={clear} />
        </View>

        <Section title="Analytics">
          <GlassSurface intensity={24} radius={Radii.lg} style={styles.card}>
            <Line label="Shown" value={String(snapshot.analytics.shown)} />
            <Line label="Dismissed" value={String(snapshot.analytics.dismissed)} />
            <Line label="Accepted" value={String(snapshot.analytics.accepted)} />
            <Line label="Completed" value={String(snapshot.analytics.completed)} />
            <Line label="Blocked" value={snapshot.blockedReason ?? 'No'} />
          </GlassSurface>
        </Section>

        <Section title="Active suggestions" count={snapshot.suggestions.length}>
          {snapshot.suggestions.map((moment) => (
            <MomentCard key={moment.id} moment={moment} onFeedback={feedback} />
          ))}
          {!snapshot.suggestions.length ? <Empty text="No proactive moment passed threshold right now." /> : null}
        </Section>

        <Section title="All candidates" count={snapshot.candidates.length}>
          {snapshot.candidates.map((moment) => (
            <MomentCard key={moment.id} moment={moment} onFeedback={feedback} compact />
          ))}
          {!snapshot.candidates.length ? <Empty text="No candidates generated from local engines yet." /> : null}
        </Section>

        <Section title="History" count={snapshot.history.length}>
          {snapshot.history.slice(0, 40).map((entry) => (
            <GlassSurface key={entry.id} intensity={20} radius={Radii.md} style={styles.historyRow}>
              <History size={15} color={theme.colors.textMuted} strokeWidth={1.6} />
              <View style={styles.flex}>
                <AppText variant="caption" color="primary" style={styles.capitalize}>
                  {label(entry.status)}
                </AppText>
                <AppText variant="footnote" color="muted">
                  {new Date(entry.timestamp).toLocaleString()} · {percent(entry.confidenceBefore)} to {percent(entry.confidenceAfter)}
                </AppText>
              </View>
            </GlassSurface>
          ))}
          {!snapshot.history.length ? <Empty text="No proactive feedback recorded yet." /> : null}
        </Section>

        {exportText ? (
          <Section title="Export">
            <TextInput
              multiline
              editable={false}
              value={exportText}
              style={[styles.exportBox, { color: theme.colors.textSecondary, borderColor: theme.colors.hairline }]}
            />
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function MomentCard({
  moment,
  compact,
  onFeedback,
}: {
  moment: ProactiveMoment;
  compact?: boolean;
  onFeedback: (moment: ProactiveMoment, status: ProactiveMomentStatus) => void;
}) {
  return (
    <GlassSurface intensity={26} radius={Radii.lg} style={styles.card}>
      <View style={styles.rowTop}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color="primary">
            {moment.title}
          </AppText>
          <AppText variant="caption" color="muted" style={styles.capitalize}>
            {moment.source} · priority {moment.priority} · {moment.engines.join(', ')}
          </AppText>
        </View>
        <AppText variant="bodyStrong" color="accent">
          {percent(moment.confidence)}
        </AppText>
      </View>
      <AppText variant="caption" color="secondary" numberOfLines={compact ? 2 : undefined}>
        {moment.message}
      </AppText>
      <AppText variant="footnote" color="muted">
        Reason: {moment.reason}
      </AppText>
      <AppText variant="footnote" color="muted">
        Context: {moment.context}
      </AppText>
      <AppText variant="footnote" color="tertiary">
        Expires: {new Date(moment.expiry).toLocaleString()}
      </AppText>
      {!compact ? (
        <View style={styles.feedbackRow}>
          <MiniButton label="Shown" onPress={() => onFeedback(moment, 'shown')} />
          <MiniButton label="Do now" onPress={() => onFeedback(moment, 'accepted')} />
          <MiniButton label="Remind later" onPress={() => onFeedback(moment, 'remind_later')} />
          <MiniButton label="Dismiss" onPress={() => onFeedback(moment, 'dismissed')} />
          <MiniButton label="Completed" onPress={() => onFeedback(moment, 'completed')} />
        </View>
      ) : null}
    </GlassSurface>
  );
}

function DebugButton({
  label: buttonLabel,
  icon: Icon,
  destructive,
  onPress,
}: {
  label: string;
  icon: typeof Download;
  destructive?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={buttonLabel} style={styles.actionButton}>
      <GlassSurface intensity={30} radius={Radii.lg} style={styles.actionSurface}>
        <Icon size={17} color={destructive ? theme.colors.error : theme.colors.accent} strokeWidth={1.8} />
        <AppText variant="caption" color={destructive ? theme.colors.error : 'accent'}>
          {buttonLabel}
        </AppText>
      </GlassSurface>
    </PressableScale>
  );
}

function MiniButton({ label: buttonLabel, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={buttonLabel} style={styles.miniButton}>
      <AppText variant="footnote" color="accent">
        {buttonLabel}
      </AppText>
    </PressableScale>
  );
}

function Section({ title, count, children }: { title: string; count?: number | string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText variant="title" color="primary">
          {title}
        </AppText>
        {count !== undefined ? (
          <AppText variant="caption" color="muted">
            {count}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Line({ label: lineLabel, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <AppText variant="caption" color="muted">
        {lineLabel}
      </AppText>
      <AppText variant="bodyStrong" color="primary">
        {value}
      </AppText>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <GlassSurface intensity={22} radius={Radii.lg} style={styles.empty}>
      <AppText variant="caption" color="muted">
        {text}
      </AppText>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.xl, maxWidth: 940, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerText: { flex: 1, gap: Spacing.xs },
  badge: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.md },
  actionButton: { flex: 1 },
  actionSurface: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md },
  section: { gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  flex: { flex: 1 },
  capitalize: { textTransform: 'capitalize' },
  feedbackRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingTop: Spacing.sm },
  miniButton: { minHeight: 34, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: Radii.md, backgroundColor: 'rgba(255,255,255,0.05)' },
  historyRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  empty: { padding: Spacing.lg },
  exportBox: { minHeight: 220, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontFamily: 'Inter_400Regular', fontSize: 12 },
});
