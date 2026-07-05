import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { HeartPulse, Download, Signal, Trash2 } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { EmotionEngine, EmotionSnapshot } from '@/services/emotion';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

const EMPTY: EmotionSnapshot = {
  current: {
    state: 'neutral',
    confidence: 0.4,
    reasons: ['No strong local emotion signals yet.'],
    signals: [],
    deliveryStyle: 'Use JISSI’s normal warm conversational style.',
    updatedAt: new Date(0).toISOString(),
  },
  signals: [],
  history: [],
  trends: [],
};

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function label(value: string): string {
  return value.replace(/_/g, ' ');
}

export default function EmotionDebugScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<EmotionSnapshot>(EMPTY);
  const [exportText, setExportText] = useState('');

  const load = useCallback(async () => {
    setSnapshot(await EmotionEngine.getSnapshot());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const clear = () => {
    Alert.alert('Clear emotion data?', 'This removes local emotion signals and summaries from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await EmotionEngine.clearData();
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
            <HeartPulse size={28} color={theme.colors.accent} strokeWidth={1.6} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              Emotion Debug
            </AppText>
            <AppText variant="body" color="muted">
              Local emotional estimates, signals, reasons and trends. Nothing leaves this device.
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <DebugButton label="Export JSON" icon={Download} onPress={async () => setExportText(await EmotionEngine.exportJson())} />
          <DebugButton label="Clear data" icon={Trash2} destructive onPress={clear} />
        </View>

        <Section title="Current emotion" count={percent(snapshot.current.confidence)}>
          <GlassSurface intensity={28} radius={Radii.lg} style={styles.card}>
            <View style={styles.rowTop}>
              <AppText variant="title" color="primary" style={styles.capitalize}>
                {label(snapshot.current.state)}
              </AppText>
              <AppText variant="bodyStrong" color="accent">
                {percent(snapshot.current.confidence)}
              </AppText>
            </View>
            <AppText variant="caption" color="secondary">
              {snapshot.current.deliveryStyle}
            </AppText>
            {snapshot.current.wellbeingSuggestion ? (
              <AppText variant="footnote" color="muted">
                {snapshot.current.wellbeingSuggestion}
              </AppText>
            ) : null}
          </GlassSurface>
        </Section>

        <Section title="Reasons" count={snapshot.current.reasons.length}>
          {snapshot.current.reasons.map((reason) => (
            <GlassSurface key={reason} intensity={22} radius={Radii.lg} style={styles.reasonRow}>
              <Signal size={16} color={theme.colors.textMuted} strokeWidth={1.6} />
              <AppText variant="caption" color="primary" style={styles.flex}>
                {reason}
              </AppText>
            </GlassSurface>
          ))}
        </Section>

        <Section title="Trends" count={snapshot.trends.length}>
          {snapshot.trends.map((trend) => (
            <GlassSurface key={trend.range} intensity={24} radius={Radii.lg} style={styles.card}>
              <View style={styles.rowTop}>
                <AppText variant="bodyStrong" color="primary" style={styles.capitalize}>
                  {label(trend.range)}
                </AppText>
                <AppText variant="caption" color="accent">
                  {percent(trend.confidence)}
                </AppText>
              </View>
              <AppText variant="footnote" color="muted">
                {trend.summary}
              </AppText>
            </GlassSurface>
          ))}
        </Section>

        <Section title="Daily history" count={snapshot.history.length}>
          {snapshot.history.slice(0, 14).map((item) => (
            <GlassSurface key={item.date} intensity={24} radius={Radii.lg} style={styles.card}>
              <View style={styles.rowTop}>
                <AppText variant="bodyStrong" color="primary">
                  {item.date}
                </AppText>
                <AppText variant="caption" color="accent" style={styles.capitalize}>
                  {label(item.dominantEmotion)} · {percent(item.confidence)}
                </AppText>
              </View>
              <AppText variant="footnote" color="muted">
                {item.signalCount} signals · {item.reasons[0] ?? 'No strong reason yet.'}
              </AppText>
            </GlassSurface>
          ))}
          {!snapshot.history.length ? <Empty text="No daily emotional summaries yet." /> : null}
        </Section>

        <Section title="Raw signals" count={snapshot.signals.length}>
          {snapshot.signals.slice(0, 40).map((signal) => (
            <GlassSurface key={signal.id} intensity={20} radius={Radii.md} style={styles.signalRow}>
              <View style={styles.signalText}>
                <AppText variant="caption" color="primary" style={styles.capitalize}>
                  {label(signal.emotion)} · {label(signal.type)}
                </AppText>
                <AppText variant="footnote" color="muted">
                  {new Date(signal.timestamp).toLocaleString()} · {percent(signal.confidence)}
                </AppText>
                <AppText variant="footnote" color="tertiary">
                  {signal.reason}
                </AppText>
              </View>
            </GlassSurface>
          ))}
          {!snapshot.signals.length ? <Empty text="No emotion signals recorded yet." /> : null}
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
  icon: typeof Download;
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
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  reasonRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  signalRow: { padding: Spacing.md },
  signalText: { gap: Spacing.xs },
  flex: { flex: 1 },
  capitalize: { textTransform: 'capitalize' },
  empty: { padding: Spacing.lg },
  exportBox: { minHeight: 220, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontFamily: 'Inter_400Regular', fontSize: 12 },
});
