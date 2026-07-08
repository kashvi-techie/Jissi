import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Flag,
  Heart,
  MessageCircle,
  NotebookPen,
  Pin,
  Repeat,
  Search,
  Star,
  Trophy,
  UserRound,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { TimelineEvent, TimelineFilter, TimelineService, TimelineSnapshot } from '@/services/timeline';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

const EMPTY: TimelineSnapshot = {
  events: [],
  stats: {
    completedGoals: 0,
    habitsDetected: 0,
    conversationsRemembered: 0,
    milestonesAchieved: 0,
  },
};

const FILTERS: { key: TimelineFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'goals', label: 'Goals' },
  { key: 'habits', label: 'Habits' },
  { key: 'people', label: 'People' },
  { key: 'projects', label: 'Projects' },
  { key: 'learning', label: 'Learning' },
  { key: 'achievements', label: 'Achievements' },
];

const ICONS: Record<TimelineEvent['icon'], LucideIcon> = {
  goal: Flag,
  habit: Repeat,
  person: UserRound,
  project: BriefcaseBusiness,
  learning: BookOpen,
  achievement: Trophy,
  conversation: MessageCircle,
  memory: NotebookPen,
};

function formatDate(timestamp?: string): string {
  if (!timestamp) return 'Saved memories';
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function groupEvents(events: TimelineEvent[]): Array<{ date: string; events: TimelineEvent[] }> {
  const map = new Map<string, TimelineEvent[]>();
  events.forEach((event) => {
    const key = formatDate(event.timestamp);
    map.set(key, [...(map.get(key) ?? []), event]);
  });
  return [...map.entries()].map(([date, grouped]) => ({ date, events: grouped }));
}

export default function TimelineScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<TimelineSnapshot>(EMPTY);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const next = await TimelineService.getSnapshot();
    setSnapshot(next);
    setDraftNotes(Object.fromEntries(next.events.filter((event) => event.note).map((event) => [event.id, event.note ?? ''])));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snapshot.events.filter((event) => {
      const matchesFilter = filter === 'all' || event.filter === filter;
      const matchesQuery = !q || `${event.title} ${event.description} ${event.note ?? ''}`.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, snapshot.events]);

  const groups = useMemo(() => groupEvents(filtered), [filtered]);

  const togglePin = async (event: TimelineEvent) => {
    await TimelineService.togglePinned(event.id);
    await load();
  };

  const toggleFavorite = async (event: TimelineEvent) => {
    await TimelineService.toggleFavorite(event.id);
    await load();
  };

  const saveNote = async (event: TimelineEvent) => {
    await TimelineService.saveNote(event.id, draftNotes[event.id] ?? '');
    setEditingNote(null);
    await load();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <AppText style={styles.heroTitle} color="primary">
            This is your journey.
          </AppText>
          <AppText style={styles.heroSubtitle} color="muted">
            JISSI turns your goals, habits, people and conversations into a living timeline.
          </AppText>
        </View>

        <View style={styles.statsGrid}>
          <Stat label="goals completed" value={snapshot.stats.completedGoals} />
          <Stat label="habits detected" value={snapshot.stats.habitsDetected} />
          <Stat label="conversations remembered" value={snapshot.stats.conversationsRemembered} />
          <Stat label="milestones achieved" value={snapshot.stats.milestonesAchieved} />
        </View>

        <GlassSurface intensity={24} radius={Radii.xl} style={styles.searchBox}>
          <Search size={18} color={theme.colors.textMuted} strokeWidth={1.8} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your journey"
            placeholderTextColor={theme.colors.textTertiary}
            style={[styles.searchInput, { color: theme.colors.textPrimary }]}
          />
        </GlassSurface>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((item) => (
            <PressableScale key={item.key} onPress={() => setFilter(item.key)} accessibilityRole="button" accessibilityState={{ selected: filter === item.key }}>
              <GlassSurface
                intensity={filter === item.key ? 42 : 18}
                radius={Radii.pill}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filter === item.key ? theme.colors.accentSoft : theme.glass.fill,
                    borderColor: filter === item.key ? theme.colors.accent : theme.glass.border,
                  },
                ]}
              >
                <AppText variant="caption" color={filter === item.key ? 'accent' : 'secondary'}>
                  {item.label}
                </AppText>
              </GlassSurface>
            </PressableScale>
          ))}
        </ScrollView>

        <View style={styles.timeline}>
          {groups.map((group) => (
            <View key={group.date} style={styles.group}>
              <View style={styles.dateRow}>
                <CalendarDays size={16} color={theme.colors.accent} strokeWidth={1.8} />
                <AppText variant="caption" color="accent">
                  {group.date}
                </AppText>
              </View>
              {group.events.map((event, index) => (
                <Animated.View key={event.id} entering={FadeInUp.delay(Math.min(index * 45, 260)).duration(260)} style={styles.eventRow}>
                  <View style={styles.rail}>
                    <View style={[styles.dot, { borderColor: theme.colors.accent, backgroundColor: theme.colors.bg }]} />
                    <View style={[styles.line, { backgroundColor: theme.colors.hairline }]} />
                  </View>
                  <TimelineCard
                    event={event}
                    editing={editingNote === event.id}
                    noteValue={draftNotes[event.id] ?? ''}
                    onNoteChange={(text) => setDraftNotes((current) => ({ ...current, [event.id]: text }))}
                    onEditNote={() => setEditingNote(event.id)}
                    onSaveNote={() => saveNote(event)}
                    onPin={() => togglePin(event)}
                    onFavorite={() => toggleFavorite(event)}
                  />
                </Animated.View>
              ))}
            </View>
          ))}
          {!groups.length ? (
            <GlassSurface intensity={24} radius={Radii.xl} style={styles.empty}>
              <AppText variant="bodyStrong" color="primary">
                Your timeline is waiting for its first chapter.
              </AppText>
              <AppText variant="caption" color="muted">
                Create goals, complete planner tasks, build habits, add memories or have meaningful conversations with JISSI.
              </AppText>
            </GlassSurface>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <GlassSurface intensity={24} radius={Radii.lg} style={styles.statCard}>
      <AppText style={styles.statValue} color="primary">
        {value}
      </AppText>
      <AppText variant="footnote" color="muted">
        {label}
      </AppText>
    </GlassSurface>
  );
}

function TimelineCard({
  event,
  editing,
  noteValue,
  onNoteChange,
  onEditNote,
  onSaveNote,
  onPin,
  onFavorite,
}: {
  event: TimelineEvent;
  editing: boolean;
  noteValue: string;
  onNoteChange: (text: string) => void;
  onEditNote: () => void;
  onSaveNote: () => void;
  onPin: () => void;
  onFavorite: () => void;
}) {
  const theme = useTheme();
  const Icon = ICONS[event.icon];
  return (
    <GlassSurface intensity={26} radius={Radii.xl} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.iconBadge, { backgroundColor: theme.colors.accentSoft }]}>
          <Icon size={18} color={theme.colors.accent} strokeWidth={1.8} />
        </View>
        <View style={styles.cardTitleBlock}>
          <AppText variant="bodyStrong" color="primary">
            {event.title}
          </AppText>
          <AppText variant="footnote" color="muted" style={styles.capitalize}>
            {event.source} · {event.filter}
          </AppText>
        </View>
        <IconButton active={event.pinned} icon={Pin} label="Pin" onPress={onPin} />
        <IconButton active={event.favorite} icon={Star} label="Favorite" onPress={onFavorite} />
      </View>

      <AppText variant="caption" color="secondary">
        {event.description}
      </AppText>

      {event.confidence !== undefined ? (
        <AppText variant="footnote" color="tertiary">
          Confidence {Math.round(event.confidence * 100)}%
        </AppText>
      ) : null}

      {editing ? (
        <View style={styles.noteEditor}>
          <TextInput
            multiline
            value={noteValue}
            onChangeText={onNoteChange}
            placeholder="Add a personal note"
            placeholderTextColor={theme.colors.textTertiary}
            style={[styles.noteInput, { color: theme.colors.textPrimary, borderColor: theme.colors.hairline }]}
          />
          <PressableScale onPress={onSaveNote} accessibilityRole="button" accessibilityLabel="Save note" style={[styles.saveNote, { backgroundColor: theme.colors.accent }]}>
            <AppText variant="caption" color="onAccent">
              Save note
            </AppText>
          </PressableScale>
        </View>
      ) : event.note ? (
        <PressableScale onPress={onEditNote} accessibilityRole="button" accessibilityLabel="Edit note">
          <GlassSurface intensity={18} radius={Radii.md} style={styles.note}>
            <Heart size={14} color={theme.colors.accent} strokeWidth={1.8} />
            <AppText variant="footnote" color="secondary" style={styles.noteText}>
              {event.note}
            </AppText>
          </GlassSurface>
        </PressableScale>
      ) : (
        <PressableScale onPress={onEditNote} accessibilityRole="button" accessibilityLabel="Add note" style={styles.addNote}>
          <AppText variant="footnote" color="accent">
            Add note
          </AppText>
        </PressableScale>
      )}
    </GlassSurface>
  );
}

function IconButton({ active, icon: Icon, label, onPress }: { active: boolean; icon: LucideIcon; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} style={styles.iconButton}>
      <Icon size={16} color={active ? theme.colors.accent : theme.colors.textMuted} fill={active ? theme.colors.accent : 'transparent'} strokeWidth={1.8} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.xl, maxWidth: 980, width: '100%', alignSelf: 'center' },
  hero: { gap: Spacing.sm, paddingTop: Spacing.xl },
  heroTitle: { fontFamily: Fonts.bodyBold, fontSize: 38, lineHeight: 46, letterSpacing: 0 },
  heroSubtitle: { fontFamily: Fonts.bodyMedium, fontSize: 17, lineHeight: 25, letterSpacing: 0, maxWidth: 640 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  statCard: { flexGrow: 1, flexBasis: 160, minHeight: 92, justifyContent: 'center', padding: Spacing.lg },
  statValue: { fontFamily: Fonts.bodyBold, fontSize: 30, lineHeight: 36, letterSpacing: 0 },
  searchBox: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg },
  searchInput: { flex: 1, minHeight: 52, fontFamily: Fonts.bodyMedium, fontSize: 16 },
  filters: { gap: Spacing.sm, paddingRight: Spacing.gutter },
  filterChip: { minHeight: 40, paddingHorizontal: Spacing.lg, justifyContent: 'center' },
  timeline: { gap: Spacing.xl },
  group: { gap: Spacing.md },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: 3 },
  eventRow: { flexDirection: 'row', alignItems: 'stretch', gap: Spacing.md },
  rail: { width: 22, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginTop: Spacing.lg },
  line: { width: 2, flex: 1, marginTop: Spacing.xs },
  card: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cardTitleBlock: { flex: 1, gap: Spacing.xxs },
  capitalize: { textTransform: 'capitalize' },
  iconButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  noteEditor: { gap: Spacing.sm },
  noteInput: { minHeight: 72, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.md, padding: Spacing.md, fontFamily: Fonts.bodyMedium, fontSize: 14, textAlignVertical: 'top' },
  saveNote: { alignSelf: 'flex-end', minHeight: 36, borderRadius: Radii.pill, paddingHorizontal: Spacing.lg, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md },
  noteText: { flex: 1 },
  addNote: { alignSelf: 'flex-start', minHeight: 34, justifyContent: 'center' },
  empty: { padding: Spacing.xl, gap: Spacing.sm },
});
