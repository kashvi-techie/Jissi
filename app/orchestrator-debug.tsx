import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { CheckCircle2, GitBranch, Play, RefreshCw, RotateCcw, XCircle } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { detectIntent } from '@/engine/intentEngine';
import { AgentOrchestrator, OrchestratorGraph, OrchestratorNodeState } from '@/services/agent';
import { DecisionEngine, DecisionResult } from '@/services/decision';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

const SAMPLE_REQUEST = "Open Chrome, search React documentation, then open Maps";

function human(value: string): string {
  return value.replace(/_/g, ' ');
}

function colorForNode(state: OrchestratorNodeState, theme: ReturnType<typeof useTheme>): string {
  if (state === 'completed') return theme.colors.accent;
  if (state === 'failed' || state === 'unsupported') return theme.colors.error;
  if (state === 'waiting_confirmation' || state === 'skipped') return '#F6C85F';
  return theme.colors.textSecondary;
}

function colorForGraph(state: OrchestratorGraph['state'], theme: ReturnType<typeof useTheme>): string {
  if (state === 'Completed') return theme.colors.accent;
  if (state === 'Failed') return theme.colors.error;
  if (state === 'Waiting Confirmation') return '#F6C85F';
  return theme.colors.textSecondary;
}

export default function OrchestratorDebugScreen() {
  const theme = useTheme();
  const [request, setRequest] = useState(SAMPLE_REQUEST);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [graph, setGraph] = useState<OrchestratorGraph | null>(null);

  const build = async () => {
    const intent = detectIntent(request);
    const nextDecision = await DecisionEngine.decide({ input: request, intent });
    const nextGraph = AgentOrchestrator.buildGraph({
      request,
      parsedIntent: intent?.intent ?? 'unknown',
      decision: nextDecision,
    });
    setDecision(nextDecision);
    setGraph(nextGraph);
    return nextGraph;
  };

  const execute = async (confirmed = false) => {
    const current = graph ?? await build();
    if (!current) return;
    const executed = await AgentOrchestrator.execute(current, confirmed);
    setGraph(executed);

    if (executed.state === 'Waiting Confirmation') {
      Alert.alert(executed.finalReport ?? 'Confirmation required', 'Confirm this step to continue execution.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => execute(true) },
      ]);
    }
  };

  const retry = async () => {
    if (!graph) return;
    setGraph(await AgentOrchestrator.retry(graph, false));
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <GitBranch size={30} color={theme.colors.accent} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.headerCopy}>
            <AppText variant="headline" color="primary">
              Orchestrator Debug
            </AppText>
            <AppText variant="body" color="muted">
              Multi-step deterministic execution over TaskPlanner, SkillExecutor and Android actions.
            </AppText>
          </View>
        </View>

        <GlassSurface intensity={24} radius={Radii.xl} style={styles.card}>
          <AppText variant="title" color="primary">
            Parsed request
          </AppText>
          <TextInput
            value={request}
            onChangeText={setRequest}
            placeholder="Text Rahul that I'm late and then open Maps"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.hairline }]}
          />
          <View style={styles.actions}>
            <DebugButton label="Build" icon={GitBranch} onPress={build} />
            <DebugButton label="Execute" icon={Play} onPress={() => execute(false)} />
            {graph?.state === 'Waiting Confirmation' ? <DebugButton label="Confirm" icon={CheckCircle2} onPress={() => execute(true)} /> : null}
            {graph?.state === 'Failed' ? <DebugButton label="Retry" icon={RotateCcw} onPress={retry} /> : null}
          </View>
        </GlassSurface>

        {decision ? (
          <GlassSurface intensity={20} radius={Radii.xl} style={styles.card}>
            <Line label="Decision action" value={human(decision.action)} />
            <Line label="Confidence" value={`${Math.round(decision.confidence * 100)}%`} />
            <Line label="Explanation" value={decision.explanation} />
          </GlassSurface>
        ) : null}

        {graph ? (
          <>
            <GlassSurface intensity={28} radius={Radii.xl} style={styles.card}>
              <View style={styles.row}>
                {graph.state === 'Failed' ? (
                  <XCircle size={21} color={theme.colors.error} strokeWidth={1.8} />
                ) : (
                  <CheckCircle2 size={21} color={colorForGraph(graph.state, theme)} strokeWidth={1.8} />
                )}
                <View style={styles.flex}>
                  <AppText variant="title" color="primary">
                    {graph.state}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {graph.finalReport ?? 'Graph is ready.'}
                  </AppText>
                </View>
              </View>
              <Line label="Current running step" value={graph.currentNodeId ?? 'none'} />
              <Line label="Completed steps" value={graph.completedNodeIds.length ? graph.completedNodeIds.join(', ') : 'none'} />
              <Line label="Failed steps" value={graph.failedNodeIds.length ? graph.failedNodeIds.join(', ') : 'none'} />
              <Line label="Retries" value={String(graph.retries)} />
              <Line label="Rollback state" value={human(graph.rollbackState)} />
              <Line label="Estimated duration" value={`${graph.estimatedDurationMs}ms`} />
              <Line label="Actual duration" value={graph.durationMs ? `${graph.durationMs}ms` : 'not finished'} />
            </GlassSurface>

            <GlassSurface intensity={22} radius={Radii.xl} style={styles.card}>
              <AppText variant="title" color="primary">
                Execution graph
              </AppText>
              {graph.nodes.map((node, index) => (
                <View key={node.id} style={styles.nodeRow}>
                  <View style={[styles.nodeIndex, { borderColor: colorForNode(node.state, theme) }]}>
                    <AppText variant="footnote" color="primary">
                      {index + 1}
                    </AppText>
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="caption" color="primary">
                      {node.label}
                    </AppText>
                    <AppText variant="footnote" color="muted">
                      {human(node.state)} · depends on {node.dependsOn.length ? node.dependsOn.join(', ') : 'none'} · retries {node.retries}/{node.retryLimit}
                    </AppText>
                    {node.error ? (
                      <AppText variant="footnote" color="error">
                        {node.error}
                      </AppText>
                    ) : null}
                  </View>
                </View>
              ))}
              {graph.edges.length ? (
                graph.edges.map((edge) => <Line key={`${edge.from}_${edge.to}`} label="Edge" value={`${edge.from} -> ${edge.to} if ${human(edge.condition)}`} />)
              ) : (
                <Line label="Edges" value="Single-node graph." />
              )}
            </GlassSurface>

            <GlassSurface intensity={20} radius={Radii.xl} style={styles.card}>
              <AppText variant="title" color="primary">
                Live execution timeline
              </AppText>
              {graph.timeline.map((item) => (
                <Line key={item.id} label={human(item.state)} value={item.message} />
              ))}
            </GlassSurface>
          </>
        ) : (
          <GlassSurface intensity={18} radius={Radii.lg} style={styles.empty}>
            <AppText variant="body" color="muted">
              Build a graph to inspect orchestration.
            </AppText>
          </GlassSurface>
        )}

        <PressableScale onPress={() => setGraph(null)} accessibilityRole="button" accessibilityLabel="Reset orchestrator debug" style={styles.reset}>
          <RefreshCw size={16} color={theme.colors.textSecondary} strokeWidth={1.8} />
          <AppText variant="caption" color="muted">
            Reset graph
          </AppText>
        </PressableScale>
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
  content: { width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: Spacing.xs },
  card: { gap: Spacing.md, padding: Spacing.lg },
  input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, paddingHorizontal: Spacing.md, fontSize: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  button: { minHeight: 42, borderRadius: Radii.pill, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  nodeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.xs },
  nodeIndex: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  line: { gap: 4 },
  lineValue: { flexShrink: 1 },
  empty: { padding: Spacing.lg, alignItems: 'center' },
  reset: { minHeight: 42, alignSelf: 'center', borderRadius: Radii.pill, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md },
});
