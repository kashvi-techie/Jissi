import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Activity, Database, Download, Trash2 } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';
import { BehaviorEngine, BehaviorSnapshot } from '@/services/behavior';

const EMPTY: BehaviorSnapshot = { events: [], routines: [], predictions: [] };

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function BehaviorDebugScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<BehaviorSnapshot>(EMPTY);
  const [exportText, setExportText] = useState('');

  const load = useCallback(async () => {
    setSnapshot(await BehaviorEngine.getSnapshot());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleExport = async () => {
    setExportText(await BehaviorEngine.exportJson());
  };

  const handleClear = () => {
    Alert.alert('Clear behavior data?', 'This removes local behavior events and routines from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await BehaviorEngine.clearData();
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
            <Activity size={28} color={theme.colors.accent} strokeWidth={1.6} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              Behavior Debug
            </AppText>
            <AppText variant="body" color="muted">
              Local routines, predictions and raw events. Nothing leaves this device.
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <DebugButton icon={Download} label="Export JSON" onPress={handleExport} />
          <DebugButton icon={Trash2} label="Clear data" destructive onPress={handleClear} />
        </View>

        <Section title="Detected routines" count={snapshot.routines.length}>
          {snapshot.routines.length ? (
            snapshot.routines.map((routine) => (
              <GlassSurface key={routine.id} intensity={26} radius={Radii.lg} style={styles.card}>
                <View style={styles.cardTop}>
                  <AppText variant="bodyStrong" color="primary" style={styles.cardTitle}>
                    {routine.label}
                  </AppText>
                  <AppText variant="bodyStrong" color="accent">
                    {percent(routine.confidence)}
                  </AppText>
                </View>
                <AppText variant="caption" color="muted">
                  {routine.reason}
                </AppText>
                <AppText variant="footnote" color="tertiary">
                  {routine.eventCount} events · {routine.hourWindow.start}:00-{routine.hourWindow.end}:00
                </AppText>
              </GlassSurface>
            ))
          ) : (
            <EmptyLine text="No routines detected yet. JISSI needs repeated local events first." />
          )}
        </Section>

        <Section title="Predictions" count={snapshot.predictions.length}>
          {snapshot.predictions.length ? (
            snapshot.predictions.map((prediction) => (
              <GlassSurface key={prediction.id} intensity={26} radius={Radii.lg} style={styles.card}>
                <View style={styles.cardTop}>
                  <AppText variant="bodyStrong" color="primary" style={styles.cardTitle}>
                    {prediction.routineType.replace('_', ' ')}
                  </AppText>
                  <AppText variant="bodyStrong" color="accent">
                    {percent(prediction.confidence)}
                  </AppText>
                </View>
                <AppText variant="caption" color="secondary">
                  {prediction.suggestion}
                </AppText>
                <AppText variant="footnote" color="muted">
                  {prediction.reason}
                </AppText>
              </GlassSurface>
            ))
          ) : (
            <EmptyLine text="No prediction for the current time window." />
          )}
        </Section>

        <Section title="Raw events" count={snapshot.events.length}>
          {snapshot.events.slice(0, 30).map((event) => (
            <GlassSurface key={event.id} intensity={20} radius={Radii.md} style={styles.eventRow}>
              <Database size={16} color={theme.colors.textMuted} strokeWidth={1.6} />
              <View style={styles.eventText}>
                <AppText variant="caption" color="primary">
                  {event.category} {event.intent ? `· ${event.intent}` : ''}
                </AppText>
                <AppText variant="footnote" color="muted">
                  {new Date(event.timestamp).toLocaleString()} · {percent(event.confidence)}
                </AppText>
              </View>
            </GlassSurface>
          ))}
          {!snapshot.events.length ? <EmptyLine text="No behavior events recorded yet." /> : null}
        </Section>

        {exportText ? (
          <Section title="Export JSON">
            <TextInput
              multiline
              value={exportText}
              editable={false}
              style={[styles.exportBox, { color: theme.colors.textSecondary, borderColor: theme.colors.hairline }]}
            />
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function DebugButton({
  icon: Icon,
  label,
  destructive,
  onPress,
}: {
  icon: typeof Download;
  label: string;
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

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText variant="title" color="primary">
          {title}
        </AppText>
        {typeof count === 'number' ? (
          <AppText variant="caption" color="muted">
            {count}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function EmptyLine({ text }: { text: string }) {
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardTitle: { flex: 1, textTransform: 'capitalize' },
  eventRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  eventText: { flex: 1, gap: Spacing.xs },
  empty: { padding: Spacing.lg },
  exportBox: { minHeight: 220, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontFamily: 'Inter_400Regular', fontSize: 12 },
});
