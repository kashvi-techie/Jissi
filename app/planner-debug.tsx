import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CalendarCheck2, CheckCircle2, Download, Flag, Trash2 } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { PremiumEmptyState } from '@/components/delight/DelightSurfaces';
import { PlannerEngine, PlannerSnapshot } from '@/services/planner';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

const EMPTY: PlannerSnapshot = {
  goals: [],
  agenda: { date: new Date(0).toISOString().slice(0, 10), items: [], reasons: [] },
  history: [],
};

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function label(value: string): string {
  return value.replace(/_/g, ' ');
}

export default function PlannerDebugScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<PlannerSnapshot>(EMPTY);
  const [exportText, setExportText] = useState('');

  const load = useCallback(async () => {
    setSnapshot(await PlannerEngine.getSnapshot());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const clear = () => {
    Alert.alert('Clear planner data?', 'This removes local goals, tasks, progress and planner history from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await PlannerEngine.clearData();
          setExportText('');
          await load();
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <CalendarCheck2 size={28} color={theme.colors.accent} strokeWidth={1.6} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              Planner Debug
            </AppText>
            <AppText variant="body" color="muted">
              Local goals, milestones, tasks, agenda, progress and reasons.
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <DebugButton label="Export JSON" icon={Download} onPress={async () => setExportText(await PlannerEngine.exportJson())} />
          <DebugButton label="Clear data" icon={Trash2} destructive onPress={clear} />
        </View>

        <Section title="Today's agenda" count={snapshot.agenda.items.length}>
          {snapshot.agenda.items.map((item) => (
            <GlassSurface key={item.taskId} intensity={24} radius={Radii.lg} style={styles.card}>
              <View style={styles.rowTop}>
                <AppText variant="bodyStrong" color="primary" style={styles.flex}>
                  {item.title}
                </AppText>
                <AppText variant="caption" color="accent">
                  {item.estimatedMinutes}m
                </AppText>
              </View>
              <AppText variant="footnote" color="muted">
                {item.goalTitle} · {item.reason}
              </AppText>
            </GlassSurface>
          ))}
          {!snapshot.agenda.items.length ? <Empty text="No agenda items yet. Create a goal from chat to begin." /> : null}
          {snapshot.agenda.behaviorHint ? <Hint text={snapshot.agenda.behaviorHint} /> : null}
          {snapshot.agenda.emotionHint ? <Hint text={snapshot.agenda.emotionHint} /> : null}
        </Section>

        <Section title="Goals" count={snapshot.goals.length}>
          {snapshot.goals.map((goal) => (
            <GlassSurface key={goal.id} intensity={26} radius={Radii.lg} style={styles.goalCard}>
              <View style={styles.rowTop}>
                <View style={styles.flex}>
                  <AppText variant="title" color="primary">
                    {goal.title}
                  </AppText>
                  <AppText variant="caption" color="muted" style={styles.capitalize}>
                    {label(goal.domain)} · {label(goal.status)}
                  </AppText>
                </View>
                <AppText variant="bodyStrong" color="accent">
                  {goal.progress.completionPercent}%
                </AppText>
              </View>
              <AppText variant="footnote" color="secondary">
                {goal.motivation}
              </AppText>
              <View style={styles.progressGrid}>
                <Metric label="Consistency" value={percent(goal.progress.consistency)} />
                <Metric label="Streak" value={`${goal.progress.currentStreak}/${goal.progress.longestStreak}`} />
                <Metric label="Tasks" value={`${goal.progress.completedTasks}/${goal.progress.totalTasks}`} />
              </View>
              {goal.milestones.map((milestone) => (
                <View key={milestone.id} style={styles.milestone}>
                  <View style={styles.rowTop}>
                    <AppText variant="bodyStrong" color="primary" style={styles.flex}>
                      {milestone.title}
                    </AppText>
                    <AppText variant="caption" color="muted" style={styles.capitalize}>
                      {label(milestone.status)}
                    </AppText>
                  </View>
                  {milestone.tasks.map((task) => (
                    <View key={task.id} style={styles.taskRow}>
                      <CheckCircle2 size={15} color={task.status === 'completed' ? theme.colors.accent : theme.colors.textMuted} strokeWidth={1.7} />
                      <View style={styles.flex}>
                        <AppText variant="caption" color="primary">
                          {task.title}
                        </AppText>
                        <AppText variant="footnote" color="muted" style={styles.capitalize}>
                          {label(task.status)} · priority {task.priority}
                        </AppText>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </GlassSurface>
          ))}
          {!snapshot.goals.length ? (
            <PremiumEmptyState
              icon={Flag}
              title="Every great journey starts with one goal."
              description="Tell JISSI what you are working toward, and your planner will begin shaping milestones locally."
            />
          ) : null}
        </Section>

        <Section title="History" count={snapshot.history.length}>
          {snapshot.history.slice(0, 40).map((entry) => (
            <GlassSurface key={entry.id} intensity={20} radius={Radii.md} style={styles.historyRow}>
              <Flag size={15} color={theme.colors.textMuted} strokeWidth={1.6} />
              <View style={styles.flex}>
                <AppText variant="caption" color="primary" style={styles.capitalize}>
                  {label(entry.type)}
                </AppText>
                <AppText variant="footnote" color="muted">
                  {new Date(entry.timestamp).toLocaleString()} · {entry.reason}
                </AppText>
              </View>
            </GlassSurface>
          ))}
          {!snapshot.history.length ? <Empty text="Planner history is empty." /> : null}
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

function DebugButton({
  label,
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
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.actionButton}>
      <GlassSurface intensity={30} radius={Radii.lg} style={styles.actionSurface}>
        <Icon size={17} color={destructive ? theme.colors.error : theme.colors.accent} strokeWidth={1.8} />
        <AppText variant="caption" color={destructive ? theme.colors.error : 'accent'}>
          {label}
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

function Metric({ label: metricLabel, value }: { label: string; value: string }) {
  return (
    <GlassSurface intensity={18} radius={Radii.md} style={styles.metric}>
      <AppText variant="footnote" color="muted">
        {metricLabel}
      </AppText>
      <AppText variant="bodyStrong" color="primary">
        {value}
      </AppText>
    </GlassSurface>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <GlassSurface intensity={18} radius={Radii.lg} style={styles.empty}>
      <AppText variant="footnote" color="muted">
        {text}
      </AppText>
    </GlassSurface>
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
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.xl, maxWidth: 980, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerText: { flex: 1, gap: Spacing.xs },
  badge: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.md },
  actionButton: { flex: 1 },
  actionSurface: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md },
  section: { gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  goalCard: { padding: Spacing.lg, gap: Spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  flex: { flex: 1 },
  capitalize: { textTransform: 'capitalize' },
  progressGrid: { flexDirection: 'row', gap: Spacing.sm },
  metric: { flex: 1, minHeight: 58, justifyContent: 'center', padding: Spacing.sm },
  milestone: { gap: Spacing.sm, paddingTop: Spacing.sm },
  taskRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', paddingVertical: Spacing.xs },
  historyRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  empty: { padding: Spacing.lg },
  exportBox: { minHeight: 220, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontFamily: 'Inter_400Regular', fontSize: 12 },
});
