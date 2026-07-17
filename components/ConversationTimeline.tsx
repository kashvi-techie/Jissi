import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AIMessage } from '@/services/ai';
import { ConversationStreamDiagnostics } from '@/services/conversation';
import { AppText } from '@/components/ui';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

interface ConversationTimelineProps {
  messages: AIMessage[];
  thinking?: boolean;
}

export const ConversationTimeline = memo(function ConversationTimeline({ messages, thinking = false }: ConversationTimelineProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [visibleMessages, setVisibleMessages] = useState<AIMessage[]>([]);
  const lastUserWhileThinkingRef = useRef<string | null>(null);
  const activeStreamRef = useRef<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamPending, setStreamPending] = useState(false);
  const recent = useMemo(() => visibleMessages.slice(-3), [visibleMessages]);

  useEffect(() => {
    let streamCompleted = false;
    const latest = messages[messages.length - 1];
    if (!latest) {
      if (activeStreamRef.current) ConversationStreamDiagnostics.interrupt();
      activeStreamRef.current = null;
      setVisibleMessages([]);
      setStreamingId(null);
      setStreamPending(false);
      return;
    }

    if (latest.role === 'user') {
      if (activeStreamRef.current) ConversationStreamDiagnostics.interrupt();
      activeStreamRef.current = null;
      setStreamingId(null);
      setStreamPending(false);
      if (thinking && lastUserWhileThinkingRef.current && lastUserWhileThinkingRef.current !== latest.id) {
        setRedirecting(true);
        const clear = setTimeout(() => setRedirecting(false), 1800);
        setVisibleMessages(messages);
        return () => clearTimeout(clear);
      }
      lastUserWhileThinkingRef.current = thinking ? latest.id : null;
      setVisibleMessages(messages);
      return;
    }

    lastUserWhileThinkingRef.current = null;
    const withoutLatestAssistant = messages.slice(0, -1);
    setVisibleMessages(withoutLatestAssistant);
    setStreamingId(latest.id);
    setStreamPending(true);
    activeStreamRef.current = latest.id;
    ConversationStreamDiagnostics.start(latest.id);

    const chunks = latest.content.match(/\S+\s*/g) ?? [latest.content];
    let index = 0;
    const firstDelay = Math.min(520, Math.max(140, latest.content.length * 2));
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      setStreamPending(false);
      interval = setInterval(() => {
        index = Math.min(chunks.length, index + (latest.content.length > 420 ? 3 : 2));
        const nextContent = chunks.slice(0, index).join('');
        ConversationStreamDiagnostics.chunk(index);
        setVisibleMessages([...withoutLatestAssistant, { ...latest, content: nextContent }]);
        if (index >= chunks.length) {
          streamCompleted = true;
          activeStreamRef.current = null;
          setStreamingId(null);
          ConversationStreamDiagnostics.complete();
          if (interval) clearInterval(interval);
        }
      }, latest.content.length > 900 ? 34 : 48);
    }, firstDelay);

    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
      if (!streamCompleted && activeStreamRef.current === latest.id) {
        ConversationStreamDiagnostics.interrupt();
        activeStreamRef.current = null;
      }
      setStreamingId((current) => current === latest.id ? null : current);
      setStreamPending(false);
    };
  }, [messages, thinking]);

  useEffect(() => {
    const handle = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(handle);
  }, [recent, thinking, streamPending]);

  if (recent.length === 0 && !thinking && !redirecting) return null;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroller}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      accessibilityLabel="Recent conversation"
    >
      {recent.map((message, index) => {
        const previous = recent[index - 1];
        const grouped = previous?.role === message.role;
        return <TimelineBubble key={message.id} message={message} grouped={grouped} streaming={message.id === streamingId} />;
      })}
      {redirecting ? <SystemBubble text="Okay, let's do that instead." /> : null}
      {thinking || streamPending ? <TypingIndicator /> : null}
    </ScrollView>
  );
});

const TimelineBubble = memo(function TimelineBubble({ message, grouped, streaming }: { message: AIMessage; grouped: boolean; streaming?: boolean }) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  return (
    <Animated.View entering={FadeInUp.duration(320).springify().damping(18)} style={[styles.row, isUser ? styles.right : styles.left, grouped && styles.grouped]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          {
            backgroundColor: isUser ? theme.colors.accentSoft : theme.glass.fillStrong,
            borderColor: isUser ? theme.colors.accent : theme.glass.border,
          },
        ]}
      >
        <AppText variant="body" color="primary" numberOfLines={4}>
          {message.content}
          {streaming ? <Cursor /> : null}
        </AppText>
      </View>
    </Animated.View>
  );
});

function Cursor() {
  const theme = useTheme();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 620, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.24 + pulse.value * 0.76,
  }));
  return <Animated.Text style={[styles.cursor, { color: theme.colors.accent }, style]}> |</Animated.Text>;
}

function SystemBubble({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInUp.duration(260).springify().damping(18)} style={[styles.row, styles.left]}>
      <View style={[styles.systemBubble, { borderColor: theme.glass.border, backgroundColor: theme.glass.fill }]}>
        <AppText variant="footnote" color="secondary">
          {text}
        </AppText>
      </View>
    </Animated.View>
  );
}

function TypingIndicator() {
  const theme = useTheme();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 760, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => {
      pulse.value = 0;
    };
  }, [pulse]);

  return (
    <View style={[styles.typing, { backgroundColor: theme.glass.fillStrong, borderColor: theme.glass.border }]}>
      {[0, 1, 2].map((dot) => (
        <TypingDot key={dot} pulse={pulse} dot={dot} />
      ))}
    </View>
  );
}

function TypingDot({ pulse, dot }: { pulse: SharedValue<number>; dot: number }) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.55 * Math.abs(Math.sin((pulse.value + dot * 0.18) * Math.PI)),
    transform: [{ translateY: -3 * Math.sin((pulse.value + dot * 0.18) * Math.PI) }],
  }));
  return <Animated.View style={[styles.dot, { backgroundColor: theme.colors.accent }, style]} />;
}

const styles = StyleSheet.create({
  scroller: { width: '100%', maxHeight: 236 },
  content: { gap: Spacing.sm, paddingHorizontal: Spacing.xs, paddingBottom: Spacing.xs },
  row: { flexDirection: 'row', marginTop: Spacing.sm },
  grouped: { marginTop: 3 },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '86%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
  },
  assistantBubble: { borderBottomLeftRadius: 8 },
  userBubble: { borderBottomRightRadius: 8 },
  typing: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  systemBubble: {
    maxWidth: '84%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  cursor: { fontWeight: '700' },
});
