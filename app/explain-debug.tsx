import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Download, Eye, RefreshCw } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { ExplainabilityService, ExplainabilitySnapshot, ExplanationItem } from '@/services/explainability';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

const EMPTY: ExplainabilitySnapshot = {
  generatedAt: new Date(0).toISOString(),
  items: [],
};

function label(value: string): string {
  return value.replace(/_/g, ' ');
}

export default function ExplainDebugScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<ExplainabilitySnapshot>(EMPTY);
  const [exportText, setExportText] = useState('');

  const load = useCallback(async () => {
    setSnapshot(await ExplainabilityService.getSnapshot());
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
            <Eye size={28} color={theme.colors.accent} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              Explainability Debug
            </AppText>
            <AppText variant="body" color="muted">
              Human-readable local reasons for suggestions, planner steps, relationship reminders and Life decisions.
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <DebugButton label="Refresh" icon={RefreshCw} onPress={load} />
          <DebugButton label="Export JSON" icon={Download} onPress={async () => setExportText(await ExplainabilityService.exportJson())} />
        </View>

        <Section title="Generated explanations" count={snapshot.items.length}>
          {snapshot.items.map((item) => (
            <ExplanationCard key={item.id} item={item} />
          ))}
          {!snapshot.items.length ? (
            <GlassSurface intensity={22} radius={Radii.lg} style={styles.empty}>
              <AppText variant="bodyStrong" color="primary">
                No explanation candidates yet.
              </AppText>
              <AppText variant="caption" color="muted">
                Add a planner goal, routine, relationship memory or Life suggestion and JISSI will explain it here.
              </AppText>
            </GlassSurface>
          ) : null}
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

function ExplanationCard({ item }: { item: ExplanationItem }) {
  return (
    <GlassSurface intensity={24} radius={Radii.lg} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color="primary">
            {item.title}
          </AppText>
          <AppText variant="caption" color="muted" style={styles.capitalize}>
            {label(item.kind)} · {item.sourceSystems.map(label).join(', ')}
          </AppText>
        </View>
      </View>
      <AppText variant="caption" color="secondary">
        {item.message}
      </AppText>
      <AppText variant="bodyStrong" color="accent">
        {item.explanation}
      </AppText>
    </GlassSurface>
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
  badge: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: Spacing.xs },
  actions: { flexDirection: 'row', gap: Spacing.md },
  actionButton: { flex: 1 },
  actionSurface: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  section: { gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { gap: Spacing.sm, padding: Spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  flex: { flex: 1, gap: Spacing.xs },
  capitalize: { textTransform: 'capitalize' },
  empty: { minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  exportBox: { minHeight: 220, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontFamily: 'Inter_400Regular', fontSize: 13, textAlignVertical: 'top' },
});
