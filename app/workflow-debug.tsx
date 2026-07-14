import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Pause, Play, RefreshCw, Route, Square, XCircle } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { WorkflowEngine, WorkflowRegistry, WorkflowRun } from '@/services/workflows';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

function label(value: string): string {
  return value.replace(/_/g, ' ');
}

function colorFor(state: WorkflowRun['state'], theme: ReturnType<typeof useTheme>): string {
  if (state === 'completed') return theme.colors.accent;
  if (state === 'failed' || state === 'cancelled') return theme.colors.error;
  if (state === 'waiting_confirmation' || state === 'paused') return '#F6C85F';
  return theme.colors.textSecondary;
}

export default function WorkflowDebugScreen() {
  const theme = useTheme();
  const [selectedId, setSelectedId] = useState('navigate_home');
  const [currentRun, setCurrentRun] = useState<WorkflowRun | null>(null);
  const [history, setHistory] = useState<WorkflowRun[]>([]);

  const load = useCallback(async () => {
    setHistory(await WorkflowEngine.history());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const execute = async () => {
    const run = await WorkflowEngine.execute(selectedId);
    setCurrentRun(run);
    await load();
  };

  const pause = async () => {
    if (!currentRun) return;
    const run = await WorkflowEngine.pause(currentRun);
    setCurrentRun(run);
    await load();
  };

  const resume = async () => {
    if (!currentRun) return;
    const run = await WorkflowEngine.resume(currentRun);
    setCurrentRun(run);
    await load();
  };

  const cancel = async () => {
    if (!currentRun) return;
    const run = await WorkflowEngine.cancel(currentRun);
    setCurrentRun(run);
    await load();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <Route size={28} color={theme.colors.accent} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.flex}>
            <AppText variant="headline" color="primary">
              Workflow Debug
            </AppText>
            <AppText variant="body" color="muted">
              Multi-step capability workflows with graph, status, duration, retries and history.
            </AppText>
          </View>
        </View>

        <Section title="Workflow registry">
          {WorkflowRegistry.list().map((workflow) => (
            <PressableScale key={workflow.id} onPress={() => setSelectedId(workflow.id)} accessibilityRole="button" accessibilityLabel={workflow.name}>
              <GlassSurface intensity={selectedId === workflow.id ? 30 : 18} radius={Radii.lg} style={styles.card}>
                <View style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: selectedId === workflow.id ? theme.colors.accent : theme.colors.textMuted }]} />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" color="primary">
                      {workflow.name}
                    </AppText>
                    <AppText variant="caption" color="muted">
                      {workflow.description}
                    </AppText>
                  </View>
                  <AppText variant="caption" color="secondary">
                    {workflow.steps.length} steps
                  </AppText>
                </View>
              </GlassSurface>
            </PressableScale>
          ))}
        </Section>

        <View style={styles.actions}>
          <DebugButton label="Execute" icon={Play} onPress={execute} />
          <DebugButton label="Pause" icon={Pause} onPress={pause} />
          <DebugButton label="Resume" icon={RefreshCw} onPress={resume} />
          <DebugButton label="Cancel" icon={Square} onPress={cancel} />
        </View>

        {currentRun ? (
          <>
            <GlassSurface intensity={28} radius={Radii.xl} style={styles.card}>
              <View style={styles.row}>
                {currentRun.state === 'failed' ? (
                  <XCircle size={20} color={theme.colors.error} strokeWidth={1.8} />
                ) : (
                  <Route size={20} color={colorFor(currentRun.state, theme)} strokeWidth={1.8} />
                )}
                <View style={styles.flex}>
                  <AppText variant="title" color="primary">
                    {currentRun.name}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {label(currentRun.state)} · {currentRun.summary ?? 'Running graph ready.'}
                  </AppText>
                </View>
              </View>
              <Line label="Current step" value={currentRun.currentStepId ?? 'none'} />
              <Line label="Duration" value={currentRun.durationMs ? `${currentRun.durationMs}ms` : 'not finished'} />
              <Line label="Estimated" value={`${currentRun.estimatedDurationMs}ms`} />
              <Line label="Retries" value={String(currentRun.retryCount)} />
              <Line label="Rollback" value={label(currentRun.rollbackState)} />
              <Line label="Errors" value={currentRun.errors.length ? currentRun.errors.join(' | ') : 'none'} />
            </GlassSurface>

            <Section title="Workflow graph">
              {currentRun.graph.nodes.map((step, index) => (
                <GlassSurface key={step.id} intensity={20} radius={Radii.lg} style={styles.card}>
                  <View style={styles.row}>
                    <View style={[styles.stepIndex, { borderColor: colorFor(step.state, theme) }]}>
                      <AppText variant="footnote" color="primary">
                        {index + 1}
                      </AppText>
                    </View>
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong" color="primary">
                        {step.label}
                      </AppText>
                      <AppText variant="caption" color="muted">
                        {label(step.capabilityId)} · {label(step.state)} · retry {step.retryCount}/{step.retryLimit}
                      </AppText>
                    </View>
                  </View>
                  <Line label="Depends on" value={step.dependsOn.length ? step.dependsOn.join(', ') : 'none'} />
                  <Line label="Condition" value={label(step.condition)} />
                  <Line label="Result" value={step.result?.message ?? step.error ?? 'not executed'} />
                </GlassSurface>
              ))}
              {currentRun.graph.edges.map((edge) => (
                <Line key={`${edge.from}_${edge.to}`} label="Edge" value={`${edge.from} -> ${edge.to} if ${label(edge.condition)}`} />
              ))}
            </Section>

            <Section title="Timeline">
              {currentRun.timeline.map((item) => (
                <Line key={item.id} label={label(item.state)} value={item.message} />
              ))}
            </Section>
          </>
        ) : null}

        <Section title="History" count={history.length}>
          {history.map((run) => (
            <GlassSurface key={run.id} intensity={18} radius={Radii.lg} style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.dot, { backgroundColor: colorFor(run.state, theme) }]} />
                <View style={styles.flex}>
                  <AppText variant="caption" color="primary">
                    {run.name}
                  </AppText>
                  <AppText variant="footnote" color="muted">
                    {label(run.state)} · {run.durationMs ? `${run.durationMs}ms` : 'not finished'}
                  </AppText>
                </View>
              </View>
            </GlassSurface>
          ))}
        </Section>
      </ScrollView>
    </Screen>
  );
}

function DebugButton({ label: buttonLabel, icon: Icon, onPress }: { label: string; icon: typeof Play; onPress: () => void }) {
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

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
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
  content: { width: '100%', maxWidth: 980, alignSelf: 'center', paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  section: { gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { gap: Spacing.sm, padding: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stepIndex: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  button: { minHeight: 42, borderRadius: Radii.pill, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md },
  line: { gap: 4 },
  lineValue: { flexShrink: 1 },
});
