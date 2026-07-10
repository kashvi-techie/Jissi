import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Activity, Download, GitBranch, TimerReset } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { LifeEngine, LifeSnapshot } from '@/services/life';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

const EMPTY: LifeSnapshot = {
  behavior: { routineCount: 0, predictionCount: 0, coffeePattern: false },
  planner: { activeGoals: 0, completedGoals: 0, pendingAgendaItems: 0 },
  emotion: { state: 'neutral', confidence: 0, frustrationSignals: 0, reason: 'No data loaded yet.' },
  context: { relationshipCount: 0, dayPart: 'unknown' },
  timeline: { eventCount: 0, milestonesAchieved: 0 },
  chosenAction: {
    id: 'empty',
    actionType: 'silent',
    title: 'Stay silent',
    message: 'No decision loaded yet.',
    confidence: 1,
    priority: 3,
    reason: 'Debug screen has not loaded.',
    explanation: 'Waiting for LifeEngine snapshot.',
    sources: [],
    cooldownKey: 'empty',
    action: { type: 'none' },
  },
  candidates: [],
  cooldowns: [],
};

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function label(value?: string): string {
  return value ? value.replace(/_/g, ' ') : 'None';
}

export default function LifeDebugScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<LifeSnapshot>(EMPTY);
  const [exportText, setExportText] = useState('');

  const load = useCallback(async () => {
    setSnapshot(await LifeEngine.getSnapshot());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <GitBranch size={28} color={theme.colors.accent} strokeWidth={1.6} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              Life Debug
            </AppText>
            <AppText variant="body" color="muted">
              Deterministic orchestration across behavior, planner, emotion, context and timeline.
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <DebugButton label="Export JSON" icon={Download} onPress={async () => setExportText(await LifeEngine.exportJson())} />
          <DebugButton label="Refresh" icon={TimerReset} onPress={load} />
        </View>

        <Section title="Chosen action" count={percent(snapshot.chosenAction.confidence)}>
          <GlassSurface intensity={30} radius={Radii.lg} style={styles.card}>
            <View style={styles.rowTop}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong" color="primary">
                  {snapshot.chosenAction.title}
                </AppText>
                <AppText variant="caption" color="muted" style={styles.capitalize}>
                  {label(snapshot.chosenAction.actionType)} · priority {snapshot.chosenAction.priority}
                </AppText>
              </View>
              <AppText variant="bodyStrong" color="accent">
                {percent(snapshot.chosenAction.confidence)}
              </AppText>
            </View>
            <AppText variant="caption" color="secondary">
              {snapshot.chosenAction.message}
            </AppText>
            <AppText variant="footnote" color="muted">
              {snapshot.chosenAction.reason}
            </AppText>
            <AppText variant="footnote" color="tertiary">
              {snapshot.chosenAction.explanation}
            </AppText>
          </GlassSurface>
        </Section>

        <Section title="Engine signals">
          <GlassSurface intensity={24} radius={Radii.lg} style={styles.card}>
            <Line label="Behavior" value={`${snapshot.behavior.routineCount} routines, ${snapshot.behavior.predictionCount} predictions`} />
            <Line label="Top routine" value={label(snapshot.behavior.topRoutine)} />
            <Line label="Coffee pattern" value={snapshot.behavior.coffeePattern ? 'Yes' : 'No'} />
            <Line label="Planner" value={`${snapshot.planner.activeGoals} active, ${snapshot.planner.completedGoals} complete`} />
            <Line label="Next task" value={label(snapshot.planner.nextTask)} />
            <Line label="Emotion" value={`${label(snapshot.emotion.state)} (${percent(snapshot.emotion.confidence)})`} />
            <Line label="Friction" value={`${snapshot.emotion.frustrationSignals} recent signals`} />
            <Line label="Context" value={`${label(snapshot.context.task)} · ${snapshot.context.dayPart}`} />
            <Line label="Timeline" value={`${snapshot.timeline.eventCount} events, ${snapshot.timeline.milestonesAchieved} milestones`} />
          </GlassSurface>
        </Section>

        <Section title="Candidates" count={snapshot.candidates.length}>
          {snapshot.candidates.map((candidate) => (
            <GlassSurface key={candidate.id} intensity={24} radius={Radii.lg} style={styles.card}>
              <View style={styles.rowTop}>
                <AppText variant="bodyStrong" color="primary" style={styles.flex}>
                  {candidate.title}
                </AppText>
                <AppText variant="caption" color="accent">
                  {percent(candidate.confidence)}
                </AppText>
              </View>
              <AppText variant="caption" color="secondary">
                {candidate.message}
              </AppText>
              <AppText variant="footnote" color="muted">
                {candidate.reason}
              </AppText>
            </GlassSurface>
          ))}
          {!snapshot.candidates.length ? <Empty text="No candidate action generated right now." /> : null}
        </Section>

        <Section title="Cooldowns" count={snapshot.cooldowns.length}>
          {snapshot.cooldowns.map((cooldown) => (
            <GlassSurface key={cooldown.key} intensity={20} radius={Radii.md} style={styles.cooldownRow}>
              <Activity size={15} color={theme.colors.textMuted} strokeWidth={1.6} />
              <View style={styles.flex}>
                <AppText variant="caption" color="primary">
                  {cooldown.key}
                </AppText>
                <AppText variant="footnote" color="muted">
                  Until {new Date(cooldown.cooldownUntil).toLocaleString()} · shown {cooldown.count}x
                </AppText>
              </View>
            </GlassSurface>
          ))}
          {!snapshot.cooldowns.length ? <Empty text="No active LifeEngine cooldowns." /> : null}
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

function DebugButton({ label: buttonLabel, icon: Icon, onPress }: { label: string; icon: typeof Download; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={buttonLabel} style={styles.actionButton}>
      <GlassSurface intensity={30} radius={Radii.lg} style={styles.actionSurface}>
        <Icon size={17} color={theme.colors.accent} strokeWidth={1.8} />
        <AppText variant="caption" color="accent">
          {buttonLabel}
        </AppText>
      </GlassSurface>
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
      <AppText variant="bodyStrong" color="primary" style={styles.lineValue} numberOfLines={2}>
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
  line: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md, paddingVertical: Spacing.xs },
  lineValue: { flex: 1, textAlign: 'right' },
  cooldownRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  empty: { padding: Spacing.lg },
  exportBox: { minHeight: 220, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontFamily: 'Inter_400Regular', fontSize: 12 },
});
