import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { MessageCircle, Search } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, GlassSurface, AppText } from '@/components/ui';
import { GlassSkeleton, PremiumEmptyState } from '@/components/delight/DelightSurfaces';
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
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = async () => {
        const next = await ConversationRepository.getAllConversations();
        if (!cancelled) {
          setConversations(next);
          setLoading(false);
        }
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
            <MessageCircle size={30} color={theme.colors.accent} strokeWidth={1.5} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText style={styles.title} color="primary">
              Chat
            </AppText>
            <AppText style={styles.subtitle} color="muted">
              A quiet place for every conversation with JISSI.
            </AppText>
          </View>
        </View>

        <GlassSurface intensity={28} radius={Radii.lg} style={styles.searchBox}>
          <Search size={18} color={theme.colors.textMuted} strokeWidth={1.8} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search chats"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, { color: theme.colors.textPrimary }]}
          />
        </GlassSurface>

        {loading ? (
          <View style={styles.list}>
            {[0, 1, 2].map((item) => (
              <GlassSkeleton key={item} lines={3} />
            ))}
          </View>
        ) : filtered.length === 0 ? (
          <PremiumEmptyState
            icon={MessageCircle}
            title={query.trim() ? 'No chats found.' : 'No chats yet. Let\'s create something memorable.'}
            description={query.trim() ? 'Try a softer search term or start a fresh conversation with JISSI.' : 'Your meaningful chats will appear here with calm date grouping and quick search.'}
          />
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
  content: { paddingHorizontal: Spacing.gutter, paddingTop: 56, paddingBottom: 120, gap: 28 },
  contentWide: { maxWidth: 880, alignSelf: 'center', width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  headerText: { flex: 1, gap: Spacing.xs },
  badge: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Exo2_700Bold', fontSize: 44, lineHeight: 50, letterSpacing: 0 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, height: 56 },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 16, height: 48, padding: 0 },
  group: { gap: Spacing.md },
  list: { gap: Spacing.md },
  card: { padding: Spacing.xl, gap: Spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardTitle: { flex: 1 },
});
