import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { GitBranch, RefreshCw } from 'lucide-react-native';
import { LifeGraphView } from '@/components/lifegraph/LifeGraphView';
import { AppText, GlassSurface, PressableScale, Screen } from '@/components/ui';
import { LifeGraph, LifeGraphEngine } from '@/services/lifegraph';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

export default function LifeGraphScreen() {
  const theme = useTheme();
  const [graph, setGraph] = useState<LifeGraph | null>(null);

  const load = useCallback(async () => {
    setGraph(await LifeGraphEngine.getGraph());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={[styles.heroMark, { backgroundColor: theme.colors.accentSoft }]}>
            <GitBranch size={24} color={theme.colors.accent} strokeWidth={1.8} />
          </View>
          <View style={styles.heroCopy}>
            <AppText style={styles.title} color="primary">
              Life Graph
            </AppText>
            <AppText style={styles.subtitle} color="muted">
              A local visual map of your people, goals, habits, achievements and memories.
            </AppText>
          </View>
          <PressableScale onPress={load} accessibilityRole="button" accessibilityLabel="Refresh Life Graph">
            <GlassSurface intensity={24} radius={Radii.circle} style={styles.refresh}>
              <RefreshCw size={18} color={theme.colors.textSecondary} strokeWidth={1.8} />
            </GlassSurface>
          </PressableScale>
        </View>

        {graph ? (
          <>
            <View style={styles.stats}>
              <Stat label="people" value={graph.stats.people} />
              <Stat label="goals" value={graph.stats.goals} />
              <Stat label="habits" value={graph.stats.habits} />
              <Stat label="memories" value={graph.stats.memories} />
              <Stat label="wins" value={graph.stats.achievements} />
            </View>
            <LifeGraphView graph={graph} />
          </>
        ) : (
          <GlassSurface intensity={24} radius={Radii.xxl} style={styles.loading}>
            <AppText variant="body" color="muted">
              Building your local graph...
            </AppText>
          </GlassSurface>
        )}
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <GlassSurface intensity={22} radius={Radii.lg} style={styles.stat}>
      <AppText style={styles.statValue} color="primary">
        {value}
      </AppText>
      <AppText variant="footnote" color="muted">
        {label}
      </AppText>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.gutter, paddingBottom: 120, gap: Spacing.xl },
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  heroMark: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, gap: Spacing.xs },
  title: { fontFamily: Fonts.bodyBold, fontSize: 38, lineHeight: 44, letterSpacing: 0 },
  subtitle: { fontFamily: Fonts.bodyMedium, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  refresh: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stat: { minWidth: 110, flexGrow: 1, padding: Spacing.md, gap: 2 },
  statValue: { fontFamily: Fonts.bodyBold, fontSize: 24, lineHeight: 30, letterSpacing: 0 },
  loading: { minHeight: 360, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
});
