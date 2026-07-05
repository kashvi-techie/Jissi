import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { Clock, MessageCircle, Search } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, GlassSurface, AppText } from '@/components/ui';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';
import { ConversationRepository, Conversation } from '@/services/conversation';

type GroupName = 'Today' | 'Yesterday' | 'Older';

const GROUPS: GroupName[] = ['Today', 'Yesterday', 'Older'];

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function groupConversation(conversation: Conversation): GroupName {
  const updated = new Date(conversation.updatedAt).getTime();
  const today = startOfDay(new Date());
  const yesterday = today - 24 * 60 * 60 * 1000;
  if (updated >= today) return 'Today';
  if (updated >= yesterday) return 'Yesterday';
  return 'Older';
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function preview(conversation: Conversation): string {
  return conversation.messages.find((message) => message.role === 'assistant')?.content
    || conversation.messages[0]?.content
    || 'No messages yet';
}

export default function HistoryScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = async () => {
        const next = await ConversationRepository.getAllConversations();
        if (!cancelled) setConversations(next);
      };
      load();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((conversation) => {
      const haystack = `${conversation.title ?? ''} ${conversation.messages.map((m) => m.content).join(' ')}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [conversations, query]);

  const grouped = useMemo(() => {
    return GROUPS.map((name) => ({
      name,
      items: filtered.filter((conversation) => groupConversation(conversation) === name),
    }));
  }, [filtered]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <Clock size={30} color={theme.colors.textSecondary} strokeWidth={1.5} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              History
            </AppText>
            <AppText variant="body" color="muted">
              Conversations grouped by recency.
            </AppText>
          </View>
        </View>

        <GlassSurface intensity={28} radius={Radii.lg} style={styles.searchBox}>
          <Search size={18} color={theme.colors.textMuted} strokeWidth={1.8} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search conversations"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, { color: theme.colors.textPrimary }]}
          />
        </GlassSurface>

        {filtered.length === 0 ? (
          <GlassSurface intensity={34} radius={Radii.xl} style={styles.empty}>
            <MessageCircle size={26} color={theme.colors.textMuted} strokeWidth={1.6} />
            <AppText variant="bodyStrong" color="primary">
              No conversations found
            </AppText>
            <AppText variant="body" color="muted" style={styles.emptyText}>
              JISSI will keep your meaningful chats here once they begin.
            </AppText>
          </GlassSurface>
        ) : (
          grouped.map((group) => (
            <View key={group.name} style={styles.group}>
              {group.items.length > 0 ? (
                <>
                  <AppText variant="label" color="muted" uppercase>
                    {group.name}
                  </AppText>
                  <View style={styles.list}>
                    {group.items.map((conversation) => (
                      <GlassSurface key={conversation.id} intensity={26} radius={Radii.lg} style={styles.card}>
                        <View style={styles.cardTop}>
                          <AppText variant="bodyStrong" color="primary" numberOfLines={1} style={styles.cardTitle}>
                            {conversation.title || 'Untitled conversation'}
                          </AppText>
                          <AppText variant="footnote" color="muted">
                            {conversation.messages.length}
                          </AppText>
                        </View>
                        <AppText variant="caption" color="muted" numberOfLines={2}>
                          {preview(conversation)}
                        </AppText>
                        <AppText variant="footnote" color="tertiary">
                          {formatTime(conversation.updatedAt)}
                        </AppText>
                      </GlassSurface>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.lg },
  contentWide: { maxWidth: 820, alignSelf: 'center', width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerText: { flex: 1, gap: Spacing.xs },
  badge: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, height: 52 },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 16, height: 48, padding: 0 },
  empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  emptyText: { textAlign: 'center' },
  group: { gap: Spacing.md },
  list: { gap: Spacing.md },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardTitle: { flex: 1 },
});
