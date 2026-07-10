import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BrainCircuit, Download, GitPullRequestArrow } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { DecisionEngine, DecisionSnapshot } from '@/services/decision';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function label(value: string): string {
  return value.replace(/_/g, ' ');
}

export default function DecisionDebugScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<DecisionSnapshot | null>(null);
  const [exportText, setExportText] = useState('');

  const load = useCallback(async () => {
    setSnapshot(await DecisionEngine.getLastSnapshot());
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
            <BrainCircuit size={28} color={theme.colors.accent} strokeWidth={1.6} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              Decision Debug
            </AppText>
            <AppText variant="body" color="muted">
              Deterministic action classification before AI generation.
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <DebugButton label="Export JSON" icon={Download} onPress={async () => setExportText(await DecisionEngine.exportJson())} />
          <DebugButton label="Refresh" icon={GitPullRequestArrow} onPress={load} />
        </View>

        {snapshot ? (
          <>
            <Section title="Final chosen action" count={percent(snapshot.finalDecision.confidence)}>
              <GlassSurface intensity={30} radius={Radii.lg} style={styles.card}>
                <View style={styles.rowTop}>
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" color="primary" style={styles.capitalize}>
                      {label(snapshot.finalDecision.action)}
                    </AppText>
                    <AppText variant="caption" color="muted">
                      {snapshot.finalDecision.sourceSystems.join(', ')}
                    </AppText>
                  </View>
                  <AppText variant="bodyStrong" color="accent">
                    {percent(snapshot.finalDecision.confidence)}
                  </AppText>
                </View>
                <AppText variant="caption" color="secondary">
                  {snapshot.finalDecision.explanation}
                </AppText>
                {snapshot.finalDecision.cooldown ? (
                  <AppText variant="footnote" color="muted">
                    Cooldown until {new Date(snapshot.finalDecision.cooldown).toLocaleString()}
                  </AppText>
                ) : null}
              </GlassSurface>
            </Section>

            <Section title="Candidate actions" count={snapshot.candidates.length}>
              {snapshot.candidates.map((candidate, index) => (
                <GlassSurface key={`${candidate.action}_${index}`} intensity={candidate.accepted ? 30 : 20} radius={Radii.lg} style={styles.card}>
                  <View style={styles.rowTop}>
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong" color={candidate.accepted ? 'accent' : 'primary'} style={styles.capitalize}>
                        {label(candidate.action)}
                      </AppText>
                      <AppText variant="caption" color="muted">
                        {candidate.sourceSystems.join(', ')}
                      </AppText>
                    </View>
                    <AppText variant="caption" color={candidate.accepted ? 'accent' : 'muted'}>
                      {percent(candidate.confidence)}
                    </AppText>
                  </View>
                  <AppText variant="caption" color="secondary">
                    {candidate.explanation}
                  </AppText>
                  <AppText variant="footnote" color={candidate.accepted ? 'accent' : 'tertiary'}>
                    {candidate.accepted ? 'Accepted as final action.' : candidate.rejectedReason}
                  </AppText>
                </GlassSurface>
              ))}
            </Section>
          </>
        ) : (
          <GlassSurface intensity={24} radius={Radii.lg} style={styles.empty}>
            <AppText variant="bodyStrong" color="primary">
              No decision recorded yet.
            </AppText>
            <AppText variant="caption" color="muted">
              Send a message to JISSI, then return here to inspect the decision tree.
            </AppText>
          </GlassSurface>
        )}

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
  empty: { padding: Spacing.lg, gap: Spacing.sm },
  exportBox: { minHeight: 220, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontFamily: 'Inter_400Regular', fontSize: 12 },
});
