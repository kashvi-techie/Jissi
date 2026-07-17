import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { GitBranch, RefreshCw, Sparkles } from 'lucide-react-native';
import { AppText, GlassSurface, PressableScale, Screen } from '@/components/ui';
import {
  CompanionOrchestrator,
  OrchestratorCandidate,
  OrchestratorContext,
  OrchestratorDecision,
} from '@/services/orchestrator';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

const EMPTY_INPUT = {
  userInput: '',
  isListening: false,
  isThinking: false,
  isSpeaking: false,
  requiresConfirmation: false,
};

export default function OrchestratorDebugScreen() {
  const theme = useTheme();
  const [input, setInput] = useState(EMPTY_INPUT);
  const [context, setContext] = useState<OrchestratorContext | null>(null);
  const [decision, setDecision] = useState<OrchestratorDecision | null>(null);

  const refresh = async () => {
    const next = await CompanionOrchestrator.inspect(input);
    setContext(next.context);
    setDecision(next.decision);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <GitBranch size={30} color={theme.colors.accent} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.headerCopy}>
            <AppText style={styles.title} color="primary">
              Orchestrator Debug
            </AppText>
            <AppText variant="caption" color="muted">
              One owner for JISSI's screen before engines compete for attention.
            </AppText>
          </View>
        </View>

        <GlassSurface intensity={24} radius={Radii.xl} style={styles.card}>
          <AppText variant="bodyStrong" color="primary">
            Runtime Context
          </AppText>
          <TextInput
            value={input.userInput}
            onChangeText={(value) => setInput((current) => ({ ...current, userInput: value }))}
            placeholder="Ask JISSI something or simulate the current prompt"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.hairline }]}
          />
          <Toggle label="Listening" value={input.isListening} onValueChange={(value) => setInput((current) => ({ ...current, isListening: value }))} />
          <Toggle label="Thinking" value={input.isThinking} onValueChange={(value) => setInput((current) => ({ ...current, isThinking: value }))} />
          <Toggle label="Speaking" value={input.isSpeaking} onValueChange={(value) => setInput((current) => ({ ...current, isSpeaking: value }))} />
          <Toggle label="Needs confirmation" value={input.requiresConfirmation} onValueChange={(value) => setInput((current) => ({ ...current, requiresConfirmation: value }))} />
          <PressableScale onPress={refresh} accessibilityRole="button" accessibilityLabel="Refresh orchestrator decision" style={[styles.button, { backgroundColor: theme.colors.accentSoft }]}>
            <RefreshCw size={16} color={theme.colors.accent} strokeWidth={1.8} />
            <AppText variant="caption" color="accent">
              Refresh decision
            </AppText>
          </PressableScale>
        </GlassSurface>

        {decision ? (
          <GlassSurface intensity={30} radius={Radii.xl} style={styles.heroCard}>
            <View style={styles.row}>
              <Sparkles size={22} color={theme.colors.accent} strokeWidth={1.8} />
              <View style={styles.flex}>
                <AppText variant="label" color="muted" uppercase>
                  Chosen Engine
                </AppText>
                <AppText variant="headline" color="primary">
                  {decision.chosen_engine}
                </AppText>
              </View>
            </View>
            <Line label="Primary action" value={human(decision.primary_action)} />
            <Line label="Speaking style" value={decision.speaking_style} />
            <Line label="Companion state" value={decision.companion_state} />
            <Line label="Should interrupt" value={yesNo(decision.should_interrupt)} />
            <Line label="Should wait" value={yesNo(decision.should_wait)} />
            <Line label="Ask confirmation" value={yesNo(decision.should_ask_confirmation)} />
            <Line label="Explanation" value={decision.explanation} />
          </GlassSurface>
        ) : null}

        {context ? (
          <GlassSurface intensity={20} radius={Radii.xl} style={styles.card}>
            <AppText variant="bodyStrong" color="primary">
              Current Context
            </AppText>
            <Line label="Workflow" value={context.workflow.active ? `${context.workflow.active.name} (${context.workflow.active.state})` : 'None'} />
            <Line label="Device" value={context.device?.facts.length ? context.device.facts.join(' · ') : 'No urgent device facts'} />
            <Line label="Planner" value={`${context.planner?.agenda.items.length ?? 0} agenda items, ${context.planner?.goals.length ?? 0} goals`} />
            <Line label="Relationships" value={`${context.relationships.length} profiles`} />
            <Line label="Daily brief" value={context.dailyBrief ? context.dailyBrief.greeting : 'Not waiting'} />
            <Line label="Proactive" value={context.proactive[0]?.title ?? 'No suggestion'} />
          </GlassSurface>
        ) : null}

        {decision ? (
          <>
            <Section title="Priority Scores">
              {decision.priority_scores.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} />)}
            </Section>
            <Section title="Rejected Engines">
              {decision.rejected_engines.length ? (
                decision.rejected_engines.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} rejected />)
              ) : (
                <GlassSurface intensity={18} radius={Radii.lg} style={styles.empty}>
                  <AppText variant="caption" color="muted">
                    Nothing was rejected.
                  </AppText>
                </GlassSurface>
              )}
            </Section>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function CandidateCard({ candidate, rejected }: { candidate: OrchestratorCandidate; rejected?: boolean }) {
  return (
    <GlassSurface intensity={rejected ? 16 : 22} radius={Radii.lg} style={styles.candidate}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color="primary">
            {candidate.engine}
          </AppText>
          <AppText variant="caption" color="muted">
            {human(candidate.id)} · priority {candidate.priority} · score {Math.round(candidate.score * 100)}%
          </AppText>
        </View>
        <AppText variant="footnote" color={candidate.accepted ? 'accent' : 'muted'}>
          {candidate.accepted ? 'Chosen' : 'Rejected'}
        </AppText>
      </View>
      <AppText variant="caption" color="secondary">
        {rejected ? candidate.rejectedReason ?? candidate.reason : candidate.reason}
      </AppText>
    </GlassSurface>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="label" color="muted" uppercase>
        {title}
      </AppText>
      {children}
    </View>
  );
}

function Toggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <AppText variant="caption" color="secondary">
        {label}
      </AppText>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
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

function human(value: string): string {
  return value.replace(/_/g, ' ');
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: Spacing.gutter, paddingTop: 56, paddingBottom: 120, gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: Spacing.xs },
  title: { fontFamily: Fonts.bodyBold, fontSize: 36, lineHeight: 42, letterSpacing: 0 },
  card: { gap: Spacing.md, padding: Spacing.lg },
  heroCard: { gap: Spacing.md, padding: Spacing.xl },
  input: { minHeight: 50, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, paddingHorizontal: Spacing.md, fontSize: 15 },
  button: { minHeight: 42, alignSelf: 'flex-start', borderRadius: Radii.pill, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  line: { gap: 4 },
  lineValue: { flexShrink: 1 },
  toggle: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  section: { gap: Spacing.md },
  candidate: { gap: Spacing.sm, padding: Spacing.md },
  empty: { minHeight: 70, alignItems: 'center', justifyContent: 'center', padding: Spacing.md },
});
