import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Download, Heart, History, Trash2, UserRound } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { RelationshipProfile, RelationshipService } from '@/services/relationships';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function countMemories(profile: RelationshipProfile): number {
  return profile.memories.length + profile.likes.length + profile.dislikes.length + profile.importantEvents.length;
}

export default function RelationshipDebugScreen() {
  const theme = useTheme();
  const [profiles, setProfiles] = useState<RelationshipProfile[]>([]);
  const [selected, setSelected] = useState<RelationshipProfile | null>(null);
  const [exportText, setExportText] = useState('');

  const load = useCallback(async () => {
    const next = await RelationshipService.getProfiles();
    setProfiles(next);
    setSelected((current) => next.find((profile) => profile.id === current?.id) ?? next[0] ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const clear = () => {
    Alert.alert('Clear relationship memory?', 'This removes local relationship profiles stored in the existing memory system.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await RelationshipService.clearData();
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
            <UserRound size={28} color={theme.colors.accent} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              Relationship Debug
            </AppText>
            <AppText variant="body" color="muted">
              Local-first people memory, profile cards, timelines, likes and placeholders.
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <DebugButton label="Export JSON" icon={Download} onPress={async () => setExportText(await RelationshipService.exportJson())} />
          <DebugButton label="Clear data" icon={Trash2} destructive onPress={clear} />
        </View>

        <View style={styles.grid}>
          {profiles.map((profile) => (
            <PressableScale key={profile.id} onPress={() => setSelected(profile)} accessibilityRole="button" accessibilityLabel={`Open ${profile.name}`}>
              <GlassSurface intensity={selected?.id === profile.id ? 38 : 24} radius={Radii.xl} style={[styles.card, selected?.id === profile.id && { borderColor: theme.colors.accent }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.avatar, { backgroundColor: theme.colors.accentSoft }]}>
                    <UserRound size={24} color={theme.colors.accent} strokeWidth={1.7} />
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" color="primary" numberOfLines={1}>
                      {profile.name}
                    </AppText>
                    <AppText variant="caption" color="muted" style={styles.capitalize}>
                      {profile.relationship.replace('_', ' ')}
                    </AppText>
                  </View>
                </View>
                <Line label="Last interaction" value={formatDate(profile.lastDiscussed)} />
                <Line label="Memories" value={String(countMemories(profile))} />
              </GlassSurface>
            </PressableScale>
          ))}
          {!profiles.length ? (
            <GlassSurface intensity={24} radius={Radii.xl} style={styles.empty}>
              <Heart size={24} color={theme.colors.textMuted} strokeWidth={1.7} />
              <AppText variant="bodyStrong" color="primary">
                No relationship profiles yet.
              </AppText>
              <AppText variant="caption" color="muted" style={styles.center}>
                Try: Remember that Amit Sir likes AI.
              </AppText>
            </GlassSurface>
          ) : null}
        </View>

        {selected ? (
          <GlassSurface intensity={28} radius={Radii.xl} style={styles.detail}>
            <AppText variant="title" color="primary">
              {selected.name}
            </AppText>
            <Line label="Nickname" value={selected.nickname ?? 'Not set'} />
            <Line label="Known since" value={formatDate(selected.firstMet)} />
            <Line label="Likes" value={selected.likes.join(', ') || 'None stored'} />
            <Line label="Dislikes" value={selected.dislikes.join(', ') || 'None stored'} />
            <Line label="Tags" value={selected.tags.join(', ') || 'None'} />
            <Line label="Birthday/Event placeholders" value={`${selected.importantEvents.length} local placeholder${selected.importantEvents.length === 1 ? '' : 's'}`} />

            <View style={styles.timelineHeader}>
              <History size={16} color={theme.colors.accent} strokeWidth={1.8} />
              <AppText variant="bodyStrong" color="primary">
                Timeline
              </AppText>
            </View>
            {selected.timeline.slice(0, 20).map((event) => (
              <GlassSurface key={event.id} intensity={18} radius={Radii.md} style={styles.timelineRow}>
                <AppText variant="caption" color="primary">
                  {event.title}
                </AppText>
                <AppText variant="footnote" color="muted">
                  {formatDate(event.timestamp)} · {event.detail}
                </AppText>
              </GlassSurface>
            ))}
          </GlassSurface>
        ) : null}

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

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <AppText variant="footnote" color="muted">
        {label}
      </AppText>
      <AppText variant="caption" color="primary" numberOfLines={2}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.xl, maxWidth: 980, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: Spacing.xs },
  actions: { flexDirection: 'row', gap: Spacing.md },
  actionButton: { flex: 1 },
  actionSurface: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  card: { width: 220, minHeight: 164, gap: Spacing.md, padding: Spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: Spacing.xs },
  capitalize: { textTransform: 'capitalize' },
  line: { gap: Spacing.xs },
  detail: { gap: Spacing.md, padding: Spacing.lg },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  timelineRow: { padding: Spacing.md, gap: Spacing.xs },
  empty: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  center: { textAlign: 'center' },
  exportBox: { minHeight: 220, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontFamily: 'Inter_400Regular', fontSize: 13, textAlignVertical: 'top' },
});
