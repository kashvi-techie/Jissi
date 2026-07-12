import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { CheckCircle2, Download, Play, RefreshCw, Sparkles, XCircle } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { detectIntent } from '@/engine/intentEngine';
import { DecisionEngine, DecisionResult } from '@/services/decision';
import { RealWorldSkillExecution, RealWorldSkillRegistry, RealWorldSkillValidation } from '@/services/skills';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

const SAMPLE_COMMAND = 'Navigate to GLA University';

function human(value: string): string {
  return value.replace(/_/g, ' ');
}

function validationColor(validation: RealWorldSkillValidation, theme: ReturnType<typeof useTheme>): string {
  return validation.valid ? theme.colors.accent : theme.colors.error;
}

export default function SkillsDebugScreen() {
  const theme = useTheme();
  const [command, setCommand] = useState(SAMPLE_COMMAND);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [lastExecution, setLastExecution] = useState<RealWorldSkillExecution | null>(null);
  const [tick, setTick] = useState(0);

  const skills = useMemo(() => RealWorldSkillRegistry.list(), [tick]);
  const available = useMemo(() => RealWorldSkillRegistry.available(), [tick]);
  const unsupported = useMemo(() => RealWorldSkillRegistry.unsupported(), [tick]);
  const matchedSkill = useMemo(() => RealWorldSkillRegistry.match(command), [command, tick]);
  const validation = useMemo(() => matchedSkill?.validate(command) ?? null, [matchedSkill, command]);

  useEffect(() => {
    setTick((value) => value + 1);
  }, []);

  const execute = async (confirmed = false) => {
    const intent = detectIntent(command);
    const nextDecision = await DecisionEngine.decide({ input: command, intent });
    setDecision(nextDecision);

    const result = await RealWorldSkillRegistry.execute(command, nextDecision, confirmed);
    if (!result) {
      Alert.alert('No skill matched', 'This command did not match the installed real-world skills.');
      return;
    }

    setLastExecution(result);
    if (result.plan?.state === 'waiting_confirmation') {
      Alert.alert(result.plan.finalResult ?? 'Confirmation required', 'Confirm this skill execution?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => execute(true) },
      ]);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <Sparkles size={30} color={theme.colors.accent} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.headerCopy}>
            <AppText variant="headline" color="primary">
              Skills Debug
            </AppText>
            <AppText variant="body" color="muted">
              Real-world deterministic app skills running through the execution framework.
            </AppText>
          </View>
        </View>

        <GlassSurface intensity={24} radius={Radii.xl} style={styles.card}>
          <AppText variant="title" color="primary">
            Command
          </AppText>
          <TextInput
            value={command}
            onChangeText={setCommand}
            placeholder="Play lo-fi music"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.hairline }]}
          />
          <View style={styles.actions}>
            <DebugButton label="Execute" icon={Play} onPress={() => execute(false)} />
            <DebugButton label="Refresh" icon={RefreshCw} onPress={() => setTick((value) => value + 1)} />
          </View>
        </GlassSurface>

        <GlassSurface intensity={22} radius={Radii.xl} style={styles.card}>
          <Line label="Matched skill" value={matchedSkill ? matchedSkill.name : 'none'} />
          {validation ? (
            <>
              <Line label="Validation" value={validation.valid ? 'available' : 'unsupported'} tone={validationColor(validation, theme)} />
              <Line label="Reason" value={validation.reason} />
              <Line label="Action" value={validation.actionType ? human(validation.actionType) : 'none'} />
              <Line label="Confirmation" value={validation.needsConfirmation ? 'required' : 'not required'} />
            </>
          ) : (
            <Line label="Validation" value="No installed skill matched this command." />
          )}
        </GlassSurface>

        {decision ? (
          <GlassSurface intensity={20} radius={Radii.xl} style={styles.card}>
            <Line label="Parsed intent" value={detectIntent(command)?.intent ?? 'unknown'} />
            <Line label="Decision action" value={human(decision.action)} />
            <Line label="Confidence" value={`${Math.round(decision.confidence * 100)}%`} />
          </GlassSurface>
        ) : null}

        {lastExecution ? (
          <GlassSurface intensity={28} radius={Radii.xl} style={styles.card}>
            <View style={styles.row}>
              {lastExecution.validation.valid ? (
                <CheckCircle2 size={20} color={theme.colors.accent} strokeWidth={1.8} />
              ) : (
                <XCircle size={20} color={theme.colors.error} strokeWidth={1.8} />
              )}
              <View style={styles.flex}>
                <AppText variant="title" color="primary">
                  Last execution
                </AppText>
                <AppText variant="caption" color="muted">
                  {lastExecution.validation.reason}
                </AppText>
              </View>
            </View>
            <Line label="Skill" value={human(lastExecution.skillId)} />
            <Line label="Plan state" value={lastExecution.plan ? human(lastExecution.plan.state) : 'not created'} />
            <Line label="Duration" value={`${lastExecution.durationMs}ms`} />
            <Line label="Result" value={lastExecution.result?.message ?? lastExecution.plan?.finalResult ?? 'No execution result'} />
            {lastExecution.plan?.humanPlan.map((line) => (
              <Line key={line} label="Plan" value={line} />
            ))}
          </GlassSurface>
        ) : null}

        <View style={styles.grid}>
          <SkillList title="Installed skills" skills={skills} />
          <SkillList title="Available skills" skills={available} />
          <SkillList title="Unsupported skills" skills={unsupported} />
        </View>

        {lastExecution ? (
          <TextInput
            multiline
            editable={false}
            value={JSON.stringify(lastExecution, null, 2)}
            style={[styles.exportBox, { color: theme.colors.textSecondary, borderColor: theme.colors.hairline }]}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function SkillList({ title, skills }: { title: string; skills: ReturnType<typeof RealWorldSkillRegistry.list> }) {
  const theme = useTheme();
  return (
    <GlassSurface intensity={18} radius={Radii.xl} style={styles.card}>
      <View style={styles.sectionHeader}>
        <AppText variant="title" color="primary">
          {title}
        </AppText>
        <Download size={16} color={theme.colors.textMuted} strokeWidth={1.8} />
      </View>
      {skills.length ? (
        skills.map((skill) => {
          const availability = skill.availability();
          return (
            <View key={skill.id} style={styles.skillRow}>
              <View style={[styles.dot, { backgroundColor: validationColor(availability, theme) }]} />
              <View style={styles.flex}>
                <AppText variant="caption" color="primary">
                  {skill.name}
                </AppText>
                <AppText variant="footnote" color="muted">
                  {availability.reason}
                </AppText>
              </View>
            </View>
          );
        })
      ) : (
        <AppText variant="body" color="muted">
          Nothing here yet.
        </AppText>
      )}
    </GlassSurface>
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

function Line({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.line}>
      <AppText variant="footnote" color="muted">
        {label}
      </AppText>
      <AppText variant="caption" color="primary" style={[styles.lineValue, tone ? { color: tone } : null]}>
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
  flex: { flex: 1 },
  line: { gap: 4 },
  lineValue: { flexShrink: 1 },
  grid: { gap: Spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  exportBox: { minHeight: 260, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontSize: 12, textAlignVertical: 'top' },
});
