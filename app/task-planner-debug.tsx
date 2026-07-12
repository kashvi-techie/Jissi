import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { CheckCircle2, Clock3, Download, ListChecks, Play, RefreshCw, RotateCcw, Trash2, XCircle } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { detectIntent } from '@/engine/intentEngine';
import { DecisionEngine, DecisionResult } from '@/services/decision';
import { SkillExecutor, SkillRegistry, TaskExecutionPlan, TaskPlanner } from '@/services/agent';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

const SAMPLE_COMMAND = 'open YouTube';

function human(value: string): string {
  return value.replace(/_/g, ' ');
}

function colorFor(state: TaskExecutionPlan['state'], theme: ReturnType<typeof useTheme>): string {
  if (state === 'completed') return theme.colors.accent;
  if (state === 'failed' || state === 'cancelled') return theme.colors.error;
  if (state === 'waiting_confirmation' || state === 'waiting_external') return '#F6C85F';
  return theme.colors.textSecondary;
}

export default function TaskPlannerDebugScreen() {
  const theme = useTheme();
  const [command, setCommand] = useState(SAMPLE_COMMAND);
  const [payloadText, setPayloadText] = useState('');
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [plan, setPlan] = useState<TaskExecutionPlan | null>(null);
  const [history, setHistory] = useState<TaskExecutionPlan[]>([]);
  const [exportText, setExportText] = useState('');

  const parsedPayload = useMemo(() => {
    if (!payloadText.trim()) return undefined;
    try {
      return JSON.parse(payloadText);
    } catch {
      return null;
    }
  }, [payloadText]);

  const load = async () => {
    setHistory(await SkillExecutor.getHistory());
  };

  useEffect(() => {
    load();
  }, []);

  const buildPlan = async () => {
    if (parsedPayload === null) {
      Alert.alert('Invalid payload JSON', 'Fix the payload JSON before planning.');
      return null;
    }

    const intent = detectIntent(command);
    const nextDecision = await DecisionEngine.decide({ input: command, intent });
    const nextPlan = TaskPlanner.createPlan({
      userCommand: command,
      parsedIntent: intent?.intent ?? 'unknown',
      decision: nextDecision,
      payload: parsedPayload,
    });

    setDecision(nextDecision);
    setPlan(nextPlan);

    if (!nextPlan) {
      Alert.alert('No executable plan', 'The command did not map to a registered Android skill.');
    }
    return nextPlan;
  };

  const execute = async (confirmed = false) => {
    const nextPlan = plan ?? await buildPlan();
    if (!nextPlan) return;

    const executed = await SkillExecutor.execute(nextPlan, confirmed);
    setPlan(executed);
    await load();

    if (executed.state === 'waiting_confirmation') {
      Alert.alert(executed.finalResult ?? 'Confirmation required', 'This action needs your confirmation.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => execute(true) },
      ]);
    }
  };

  const retry = async () => {
    if (!plan) return;
    const retried = await SkillExecutor.retry(plan, false);
    setPlan(retried);
    await load();
  };

  const clear = async () => {
    await SkillExecutor.clearHistory();
    setHistory([]);
    setExportText('');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <ListChecks size={30} color={theme.colors.accent} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.headerCopy}>
            <AppText variant="headline" color="primary">
              Task Planner Debug
            </AppText>
            <AppText variant="body" color="muted">
              DecisionEngine to AgentRouter to deterministic skills to Android actions.
            </AppText>
          </View>
        </View>

        <GlassSurface intensity={24} radius={Radii.xl} style={styles.card}>
          <AppText variant="title" color="primary">
            User command
          </AppText>
          <TextInput
            value={command}
            onChangeText={setCommand}
            placeholder="open YouTube"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.hairline }]}
          />
          <TextInput
            multiline
            value={payloadText}
            onChangeText={setPayloadText}
            placeholder={'Optional payload JSON, e.g. {"url":"https://example.com"}'}
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.payload, { color: theme.colors.textPrimary, borderColor: theme.colors.hairline }]}
          />
          <View style={styles.actions}>
            <DebugButton label="Plan" icon={ListChecks} onPress={buildPlan} />
            <DebugButton label="Execute" icon={Play} onPress={() => execute(false)} />
            <DebugButton label="Export" icon={Download} onPress={async () => setExportText(await SkillExecutor.exportJson())} />
            <DebugButton label="Clear" icon={Trash2} onPress={clear} />
          </View>
        </GlassSurface>

        {decision ? (
          <GlassSurface intensity={22} radius={Radii.xl} style={styles.card}>
            <Line label="Parsed intent" value={plan?.parsedIntent ?? 'unknown'} />
            <Line label="Decision action" value={human(decision.action)} />
            <Line label="Confidence" value={`${Math.round(decision.confidence * 100)}%`} />
            <Line label="Decision reason" value={decision.explanation} />
          </GlassSurface>
        ) : null}

        {plan ? (
          <GlassSurface intensity={28} radius={Radii.xl} style={styles.card}>
            <View style={styles.row}>
              <Clock3 size={20} color={colorFor(plan.state, theme)} strokeWidth={1.8} />
              <View style={styles.flex}>
                <AppText variant="title" color="primary" style={styles.capitalize}>
                  {human(plan.state)}
                </AppText>
                <AppText variant="caption" color="muted">
                  {plan.finalResult ?? `${plan.steps.length} planned step${plan.steps.length === 1 ? '' : 's'}.`}
                </AppText>
              </View>
            </View>

            <Line label="Generated execution plan" value={plan.humanPlan.join('\n')} />
            <Line label="Current step" value={plan.currentStepId ?? 'none'} />
            <Line label="Completed steps" value={plan.completedStepIds.length ? plan.completedStepIds.join(', ') : 'none'} />
            <Line label="Failed steps" value={plan.failedStepIds.length ? plan.failedStepIds.join(', ') : 'none'} />
            <Line label="Retry count" value={String(plan.retryCount)} />
            <Line label="Duration" value={plan.durationMs ? `${plan.durationMs}ms` : 'not finished'} />

            {plan.state === 'waiting_confirmation' ? (
              <DebugButton label="Confirm" icon={CheckCircle2} onPress={() => execute(true)} />
            ) : null}
            {plan.state === 'failed' ? (
              <DebugButton label="Retry" icon={RotateCcw} onPress={retry} />
            ) : null}
          </GlassSurface>
        ) : null}

        {plan ? (
          <GlassSurface intensity={20} radius={Radii.xl} style={styles.card}>
            <AppText variant="title" color="primary">
              Steps
            </AppText>
            {plan.steps.map((step) => (
              <View key={step.id} style={styles.stepRow}>
                {step.state === 'failed' ? (
                  <XCircle size={18} color={theme.colors.error} strokeWidth={1.8} />
                ) : (
                  <CheckCircle2 size={18} color={colorFor(step.state, theme)} strokeWidth={1.8} />
                )}
                <View style={styles.flex}>
                  <AppText variant="caption" color="primary">
                    {step.label}
                  </AppText>
                  <AppText variant="footnote" color="muted">
                    {human(step.skillId)} · {human(step.state)} · retries {step.retryCount}/{step.retryLimit}
                  </AppText>
                </View>
              </View>
            ))}
          </GlassSurface>
        ) : null}

        <GlassSurface intensity={20} radius={Radii.xl} style={styles.card}>
          <AppText variant="title" color="primary">
            Skill Registry
          </AppText>
          {SkillRegistry.list().map((skill) => (
            <Line
              key={skill.id}
              label={human(skill.id)}
              value={`${skill.description} Confirmation: ${skill.supports_confirmation ? 'yes' : 'no'}`}
            />
          ))}
        </GlassSurface>

        {plan?.timeline.length ? (
          <GlassSurface intensity={20} radius={Radii.xl} style={styles.card}>
            <AppText variant="title" color="primary">
              Execution Timeline
            </AppText>
            {plan.timeline.map((item) => (
              <Line key={item.id} label={human(item.state)} value={item.message} />
            ))}
          </GlassSurface>
        ) : null}

        <View style={styles.sectionHeader}>
          <AppText variant="title" color="primary">
            Execution History
          </AppText>
          <PressableScale onPress={load} accessibilityRole="button" accessibilityLabel="Refresh task planner history">
            <RefreshCw size={18} color={theme.colors.textSecondary} strokeWidth={1.8} />
          </PressableScale>
        </View>

        {history.length ? (
          history.map((item) => (
            <GlassSurface key={item.id} intensity={18} radius={Radii.lg} style={styles.historyCard}>
              <View style={styles.row}>
                <View style={[styles.dot, { backgroundColor: colorFor(item.state, theme) }]} />
                <View style={styles.flex}>
                  <AppText variant="caption" color="primary" style={styles.capitalize}>
                    {human(item.state)}
                  </AppText>
                  <AppText variant="footnote" color="muted" numberOfLines={2}>
                    {item.userCommand}
                  </AppText>
                </View>
                <AppText variant="footnote" color="muted">
                  {item.steps.length} step
                </AppText>
              </View>
            </GlassSurface>
          ))
        ) : (
          <GlassSurface intensity={18} radius={Radii.lg} style={styles.empty}>
            <AppText variant="body" color="muted">
              No task executions yet.
            </AppText>
          </GlassSurface>
        )}

        {exportText ? (
          <TextInput
            multiline
            editable={false}
            value={exportText}
            style={[styles.exportBox, { color: theme.colors.textSecondary, borderColor: theme.colors.hairline }]}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function DebugButton({ label, icon: Icon, onPress }: { label: string; icon: typeof Play; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.button, { backgroundColor: theme.colors.accentSoft }]}>
      <Icon size={16} color={theme.colors.accent} strokeWidth={1.9} />
      <AppText variant="caption" color="accent">
        {label}
      </AppText>
    </PressableScale>
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
  content: { width: '100%', maxWidth: 980, alignSelf: 'center', paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: Spacing.xs },
  card: { gap: Spacing.md, padding: Spacing.lg },
  input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, paddingHorizontal: Spacing.md, fontSize: 15 },
  payload: { minHeight: 110, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontSize: 13, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  button: { minHeight: 42, borderRadius: Radii.pill, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  flex: { flex: 1 },
  line: { gap: 4 },
  lineValue: { flexShrink: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyCard: { padding: Spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: { padding: Spacing.lg, alignItems: 'center' },
  exportBox: { minHeight: 220, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontSize: 12, textAlignVertical: 'top' },
  capitalize: { textTransform: 'capitalize' },
});
