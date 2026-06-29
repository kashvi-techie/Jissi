import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AIMessage } from '@/services/ai';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';

interface MessageBubbleProps {
  message: AIMessage;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const theme = useTheme();
  const isUser = message.role === 'user';

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const animatedStyle = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
      { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
    ],
  };

  if (isUser) {
    return (
      <Animated.View style={[styles.row, styles.right, animatedStyle]}>
        <LinearGradient
          colors={theme.gradients.bubbleUser}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.userBubble]}
        >
          <AppText variant="body" color={theme.colors.textOnAccent}>
            {message.content}
          </AppText>
          <AppText variant="caption" color="rgba(255,255,255,0.8)" style={styles.time}>
            {formatTime(message.timestamp)}
          </AppText>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.row, styles.left, animatedStyle]}>
      <View style={[styles.bubble, styles.aiBubble, { backgroundColor: theme.glass.fillStrong, borderColor: theme.glass.border }]}>
        <AppText variant="body" color="primary">
          {message.content}
        </AppText>
        <AppText variant="caption" color="muted" style={styles.time}>
          {formatTime(message.timestamp)}
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: Spacing.xs },
  right: { justifyContent: 'flex-end' },
  left: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '84%', borderRadius: Radii.lg, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  userBubble: { borderBottomRightRadius: 6 },
  aiBubble: { borderWidth: StyleSheet.hairlineWidth * 1.5, borderBottomLeftRadius: 6 },
  time: { alignSelf: 'flex-end' },
});
