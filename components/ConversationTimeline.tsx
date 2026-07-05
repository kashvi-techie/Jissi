import React, { memo, useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AIMessage } from '@/services/ai';
import { AppText } from '@/components/ui';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

interface ConversationTimelineProps {
  messages: AIMessage[];
  thinking?: boolean;
}

export const ConversationTimeline = memo(function ConversationTimeline({ messages, thinking = false }: ConversationTimelineProps) {
  const scrollRef = useRef<ScrollView>(null);
  const recent = useMemo(() => messages.slice(-5), [messages]);

  useEffect(() => {
    const handle = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(handle);
  }, [recent.length, thinking]);

  if (recent.length === 0 && !thinking) return null;

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
        return <TimelineBubble key={message.id} message={message} grouped={grouped} />;
      })}
      {thinking ? <TypingIndicator /> : null}
    </ScrollView>
  );
});

const TimelineBubble = memo(function TimelineBubble({ message, grouped }: { message: AIMessage; grouped: boolean }) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  return (
    <Animated.View style={[styles.row, isUser ? styles.right : styles.left, grouped && styles.grouped]}>
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
        <AppText variant="caption" color="primary" numberOfLines={3}>
          {message.content}
        </AppText>
      </View>
    </Animated.View>
  );
});

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
  scroller: { width: '100%', maxHeight: 156 },
  content: { gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs },
  row: { flexDirection: 'row', marginTop: Spacing.xs },
  grouped: { marginTop: 1 },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  assistantBubble: { borderBottomLeftRadius: 6 },
  userBubble: { borderBottomRightRadius: 6 },
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
  dot: { width: 5, height: 5, borderRadius: 3 },
});
