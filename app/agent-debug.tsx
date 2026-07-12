import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Bot, CheckCircle2, Download, Play, RefreshCw, RotateCcw, Trash2 } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { detectIntent } from '@/engine/intentEngine';
import { AgentExecutionRecord, AgentRouter, AgentRouteResult } from '@/services/agent';
import { DecisionEngine, DecisionResult } from '@/services/decision';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

const SAMPLE_INPUT = 'open YouTube';

function human(value: string): string {
  return value.replace(/_/g, ' ');
}

function colorFor(state: AgentExecutionRecord['state'], theme: ReturnType<typeof useTheme>): string {
  if (state === 'success') return theme.colors.accent;
  if (state === 'failed') return theme.colors.error;
  if (state === 'asking_confirmation') return '#F6C85F';
  return theme.colors.textSecondary;
}

export default function AgentDebugScreen() {
  const theme = useTheme();
  const [input, setInput] = useState(SAMPLE_INPUT);
  const [payloadText, setPayloadText] = useState('');
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [lastResult, setLastResult] = useState<AgentRouteResult | null>(null);
  const [history, setHistory] = useState<AgentExecutionRecord[]>([]);
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
    setHistory(await AgentRouter.getHistory());
  };

  useEffect(() => {
    load();
  }, []);

  const route = async (confirmed = false) => {
    if (parsedPayload === null) {
      Alert.alert('Invalid payload JSON', 'Fix the payload JSON before routing.');
      return;
    }

    const intent = detectIntent(input);
    const nextDecision = await DecisionEngine.decide({ input, intent });
    setDecision(nextDecision);
    const result = await AgentRouter.route({
      input,
      decision: nextDecision,
      payload: parsedPayload,
      confirmed,
    });
    setLastResult(result);
    await load();

    if (result.record.state === 'asking_confirmation') {
      Alert.alert(result.message, result.record.plan?.explanation ?? 'Confirmation required.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => confirm(result.record.id) },
      ]);
    }
  };

  const confirm = async (id: string) => {
    const result = await AgentRouter.confirm(id);
    setLastResult(result);
    await load();
  };

  const retry = async (id: string) => {
    const result = await AgentRouter.retry(id);
    setLastResult(result);
    await load();
  };

  const clear = async () => {
    await AgentRouter.clearHistory();
    setLastResult(null);
    setHistory([]);
    setExportText('');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <Bot size={30} color={theme.colors.accent} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.headerCopy}>
            <AppText variant="headline" color="primary">
              Agent Debug
            </AppText>
            <AppText variant="body" color="muted">
              DecisionEngine to Android ActionRegistry routing, confirmation, retry, timeout and history.
            </AppText>
          </View>
        </View>

        <GlassSurface intensity={24} radius={Radii.xl} style={styles.card}>
          <AppText variant="title" color="primary">
            Route request
          </AppText>
          <TextInput
            value={input}
            onChangeText={setInput}
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
            <DebugButton label="Route" icon={Play} onPress={() => route(false)} />
            <DebugButton label="Export" icon={Download} onPress={async () => setExportText(await AgentRouter.exportJson())} />
            <DebugButton label="Clear" icon={Trash2} onPress={clear} />
          </View>
        </GlassSurface>

        {decision ? (
          <GlassSurface intensity={24} radius={Radii.xl} style={styles.card}>
            <Line label="Decision action" value={human(decision.action)} />
            <Line label="Confidence" value={`${Math.round(decision.confidence * 100)}%`} />
            <Line label="Explanation" value={decision.explanation} />
          </GlassSurface>
        ) : null}

        {lastResult ? (
          <GlassSurface intensity={28} radius={Radii.xl} style={styles.card}>
            <View style={styles.row}>
              <CheckCircle2 size={20} color={colorFor(lastResult.record.state, theme)} strokeWidth={1.8} />
              <View style={styles.flex}>
                <AppText variant="title" color="primary" style={styles.capitalize}>
                  {human(lastResult.record.state)}
                </AppText>
                <AppText variant="caption" color="muted">
                  {lastResult.message}
                </AppText>
              </View>
            </View>
            {lastResult.record.plan ? (
              <>
                <Line label="Mapped action" value={human(lastResult.record.plan.actionType)} />
                <Line label="Reason" value={lastResult.record.plan.explanation} />
                <Line label="Sensitive" value={lastResult.record.plan.sensitive ? 'Yes' : 'No'} />
              </>
            ) : null}
            {lastResult.record.state === 'asking_confirmation' ? (
              <DebugButton label="Confirm" icon={CheckCircle2} onPress={() => confirm(lastResult.record.id)} />
            ) : null}
            {lastResult.record.state === 'failed' ? (
              <DebugButton label="Retry" icon={RotateCcw} onPress={() => retry(lastResult.record.id)} />
            ) : null}
          </GlassSurface>
        ) : null}

        <View style={styles.sectionHeader}>
          <AppText variant="title" color="primary">
            Execution History
          </AppText>
          <PressableScale onPress={load} accessibilityRole="button" accessibilityLabel="Refresh history">
            <RefreshCw size={18} color={theme.colors.textSecondary} strokeWidth={1.8} />
          </PressableScale>
        </View>

        {history.length ? (
          history.map((item) => (
            <GlassSurface key={item.id} intensity={20} radius={Radii.lg} style={styles.historyCard}>
              <View style={styles.row}>
                <View style={[styles.dot, { backgroundColor: colorFor(item.state, theme) }]} />
                <View style={styles.flex}>
                  <AppText variant="caption" color="primary" style={styles.capitalize}>
                    {human(item.state)} {item.plan ? `- ${human(item.plan.actionType)}` : ''}
                  </AppText>
                  <AppText variant="footnote" color="muted" numberOfLines={2}>
                    {item.input || item.error}
                  </AppText>
                </View>
                <AppText variant="footnote" color="muted">
                  {item.attempts}x
                </AppText>
              </View>
            </GlassSurface>
          ))
        ) : (
          <GlassSurface intensity={18} radius={Radii.lg} style={styles.empty}>
            <AppText variant="body" color="muted">
              No agent executions yet.
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
  payload: { minHeight: 120, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontSize: 13, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  button: { minHeight: 42, borderRadius: Radii.pill, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
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
