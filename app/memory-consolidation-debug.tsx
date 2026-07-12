import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BrainCircuit, Download, RefreshCw, Sparkles } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { MemoryConsolidationEngine, MemoryConsolidationSnapshot, ConsolidatedMemory } from '@/services/memory';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

const EMPTY: MemoryConsolidationSnapshot = {
  generatedAt: new Date(0).toISOString(),
  rawMemoryCount: 0,
  duplicateGroups: 0,
  promotedCount: 0,
  decayedCount: 0,
  consolidated: [],
  profile: {
    summary: 'JISSI is still building a long-term profile from local memories.',
    preferences: [],
    goals: [],
    relationships: [],
    routines: [],
    achievements: [],
    confidence: 0,
    updatedAt: new Date(0).toISOString(),
  },
};

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function label(value: string): string {
  return value.replace(/_/g, ' ');
}

export default function MemoryConsolidationDebugScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<MemoryConsolidationSnapshot>(EMPTY);
  const [exportText, setExportText] = useState('');

  const load = useCallback(async () => {
    setSnapshot(await MemoryConsolidationEngine.getSnapshot());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const consolidate = async () => {
    setSnapshot(await MemoryConsolidationEngine.consolidate());
  };

  const promoted = snapshot.consolidated.filter((item) => !item.decayed);
  const decayed = snapshot.consolidated.filter((item) => item.decayed);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <BrainCircuit size={28} color={theme.colors.accent} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              Memory Consolidation
            </AppText>
            <AppText variant="body" color="muted">
              Local long-term knowledge, duplicate merging, reinforcement and profile snapshot.
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <DebugButton label="Consolidate" icon={Sparkles} onPress={consolidate} />
          <DebugButton label="Refresh" icon={RefreshCw} onPress={load} />
          <DebugButton label="Export JSON" icon={Download} onPress={async () => setExportText(await MemoryConsolidationEngine.exportJson())} />
        </View>

        <View style={styles.stats}>
          <Stat label="Raw" value={String(snapshot.rawMemoryCount)} />
          <Stat label="Merged" value={String(snapshot.duplicateGroups)} />
          <Stat label="Promoted" value={String(snapshot.promotedCount)} />
          <Stat label="Decayed" value={String(snapshot.decayedCount)} />
        </View>

        <Section title="User Profile Snapshot" count={percent(snapshot.profile.confidence)}>
          <GlassSurface intensity={28} radius={Radii.xl} style={styles.profileCard}>
            <AppText variant="bodyStrong" color="primary">
              {snapshot.profile.summary}
            </AppText>
            <AppText variant="caption" color="muted">
              Updated {new Date(snapshot.profile.updatedAt).toLocaleString()}
            </AppText>
          </GlassSurface>
        </Section>

        <Section title="Promoted long-term memories" count={promoted.length}>
          {promoted.slice(0, 30).map((item) => (
            <MemoryCard key={item.id} item={item} />
          ))}
          {!promoted.length ? <Empty text="No promoted memories yet. Add preferences, goals or routines first." /> : null}
        </Section>

        <Section title="Decayed weak memories" count={decayed.length}>
          {decayed.slice(0, 20).map((item) => (
            <MemoryCard key={item.id} item={item} />
          ))}
          {!decayed.length ? <Empty text="No weak memories have decayed yet." /> : null}
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

function MemoryCard({ item }: { item: ConsolidatedMemory }) {
  return (
    <GlassSurface intensity={item.decayed ? 16 : 24} radius={Radii.lg} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color="primary">
            {item.summary}
          </AppText>
          <AppText variant="caption" color="muted" style={styles.capitalize}>
            {label(item.category)} · strength {item.strength} · {item.pinned ? 'Pinned' : item.decayed ? 'Decayed' : 'Promoted'}
          </AppText>
        </View>
        <AppText variant="bodyStrong" color={item.decayed ? 'muted' : 'accent'}>
          {percent(item.confidence)}
        </AppText>
      </View>
      <AppText variant="footnote" color="tertiary" numberOfLines={2}>
        Sources: {item.sourceKeys.join(', ')}
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

function Stat({ label: statLabel, value }: { label: string; value: string }) {
  return (
    <GlassSurface intensity={22} radius={Radii.lg} style={styles.stat}>
      <AppText variant="footnote" color="muted">
        {statLabel}
      </AppText>
      <AppText variant="title" color="primary">
        {value}
      </AppText>
    </GlassSurface>
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

function Empty({ text }: { text: string }) {
  return (
    <GlassSurface intensity={20} radius={Radii.lg} style={styles.empty}>
      <AppText variant="caption" color="muted">
        {text}
      </AppText>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.xl, maxWidth: 980, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: Spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  actionButton: { flex: 1, minWidth: 150 },
  actionSurface: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  stat: { flex: 1, minWidth: 130, minHeight: 78, justifyContent: 'center', gap: Spacing.xs, padding: Spacing.md },
  section: { gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileCard: { padding: Spacing.lg, gap: Spacing.sm },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1, gap: Spacing.xs },
  capitalize: { textTransform: 'capitalize' },
  empty: { padding: Spacing.lg },
  exportBox: { minHeight: 240, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontFamily: 'Inter_400Regular', fontSize: 13, textAlignVertical: 'top' },
});
