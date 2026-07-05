import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BrainCircuit, Clock, GitBranch, Link2, Trash2 } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';
import { ContextEngine, ContextObject } from '@/services/context';

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function ContextDebugScreen() {
  const theme = useTheme();
  const [context, setContext] = useState<ContextObject | null>(null);
  const [exportText, setExportText] = useState('');

  const load = useCallback(async () => {
    setContext(await ContextEngine.getCurrentContext());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const clear = () => {
    Alert.alert('Clear context?', 'This removes local conversation/task/reference context. Relationship context stored here will also reset.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await ContextEngine.clearData();
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
            <BrainCircuit size={28} color={theme.colors.accent} strokeWidth={1.6} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              Context Debug
            </AppText>
            <AppText variant="body" color="muted">
              Local context object, references, relationships and active routines.
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <DebugButton label="Export JSON" icon={Link2} onPress={async () => setExportText(await ContextEngine.exportJson())} />
          <DebugButton label="Clear data" icon={Trash2} destructive onPress={clear} />
        </View>

        <Section title="Current context" count={context ? percent(context.confidence) : '0%'}>
          <GlassSurface intensity={26} radius={Radii.lg} style={styles.card}>
            <Line label="Conversation" value={context?.conversation?.topic ?? 'None'} />
            <Line label="Task" value={context?.task ? `${context.task.label} (${percent(context.task.confidence)})` : 'None'} />
            <Line label="Temporal" value={context ? `${context.temporal.dayPart}, ${context.temporal.isWeekend ? 'weekend' : 'workday'}` : 'Unknown'} />
            <Line label="Environment" value={context?.environment.network ?? 'unknown'} />
          </GlassSurface>
        </Section>

        <Section title="Active routines" count={context?.routine.active.length ?? 0}>
          {context?.routine.active.length ? (
            context.routine.active.map((routine) => (
              <GlassSurface key={routine.id} intensity={24} radius={Radii.lg} style={styles.card}>
                <View style={styles.rowTop}>
                  <AppText variant="bodyStrong" color="primary" style={styles.flex}>
                    {routine.routineType.replace('_', ' ')}
                  </AppText>
                  <AppText variant="bodyStrong" color="accent">
                    {percent(routine.confidence)}
                  </AppText>
                </View>
                <AppText variant="caption" color="muted">
                  {routine.reason}
                </AppText>
              </GlassSurface>
            ))
          ) : (
            <Empty text="No active routine prediction for the current time." />
          )}
        </Section>

        <Section title="Relationship graph" count={context?.relationships.length ?? 0}>
          {context?.relationships.length ? (
            context.relationships.map((relationship) => (
              <GlassSurface key={relationship.id} intensity={24} radius={Radii.lg} style={styles.card}>
                <View style={styles.rowTop}>
                  <AppText variant="bodyStrong" color="primary" style={styles.flex}>
                    {relationship.name ?? relationship.relationship}
                  </AppText>
                  <AppText variant="caption" color="accent">
                    {relationship.relationship}
                  </AppText>
                </View>
                <AppText variant="footnote" color="muted">
                  Mentions: {relationship.mentionCount} · confidence {percent(relationship.confidence)}
                </AppText>
              </GlassSurface>
            ))
          ) : (
            <Empty text="No relationship context stored yet." />
          )}
        </Section>

        <Section title="Resolved references" count={context?.resolvedReferences.length ?? 0}>
          {context?.resolvedReferences.length ? (
            context.resolvedReferences.map((reference, index) => (
              <GlassSurface key={`${reference.updatedAt}_${index}`} intensity={24} radius={Radii.lg} style={styles.card}>
                <View style={styles.rowTop}>
                  <AppText variant="bodyStrong" color="primary">
                    {reference.phrase} {'->'} {reference.resolvedTo}
                  </AppText>
                  <AppText variant="caption" color="accent">
                    {percent(reference.confidence)}
                  </AppText>
                </View>
                <AppText variant="footnote" color="muted">
                  {reference.reason}
                </AppText>
              </GlassSurface>
            ))
          ) : (
            <Empty text="No pronouns or continuation references resolved yet." />
          )}
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
  icon: typeof Link2;
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

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText variant="bodyStrong" color="primary" style={styles.flex} numberOfLines={2}>
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
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.xl, maxWidth: 920, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerText: { flex: 1, gap: Spacing.xs },
  badge: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.md },
  actionButton: { flex: 1 },
  actionSurface: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md },
  section: { gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1, textTransform: 'capitalize' },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, justifyContent: 'space-between' },
  empty: { padding: Spacing.lg },
  exportBox: { minHeight: 220, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontFamily: 'Inter_400Regular', fontSize: 12 },
});
