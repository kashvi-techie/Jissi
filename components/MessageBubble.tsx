import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AIMessage } from '@/services/ai';
import { Colors } from '@/constants/colors';
import { Spacing, Radius, Duration } from '@/constants/theme';

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
  const isUser = message.role === 'user';

  // Soft entrance: fade + rise + settle (native-driver, runs once on mount).
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: Duration.entrance,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const entranceStyle = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
      { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
    ],
  };

  if (isUser) {
    return (
      <Animated.View style={[styles.row, styles.rowRight, entranceStyle]}>
        <LinearGradient
          colors={Colors.premiumGradient.bubbleUser}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.userBubble]}
        >
          <Text style={styles.userText}>{message.content}</Text>
          <Text style={styles.userTime}>{formatTime(message.timestamp)}</Text>
        </LinearGradient>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={[styles.row, styles.rowLeft, entranceStyle]}>
      <View style={[styles.bubble, styles.aiBubble]}>
        <Text style={styles.aiText}>{message.content}</Text>
        <Text style={styles.aiTime}>{formatTime(message.timestamp)}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: Spacing.xs },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10, gap: Spacing.xs },
  userBubble: { borderBottomRightRadius: 6 },
  aiBubble: {
    backgroundColor: Colors.frost.fillStrong,
    borderWidth: 1,
    borderColor: Colors.frost.border,
    borderBottomLeftRadius: 6,
  },
  userText: { fontSize: 15, color: Colors.onDark.primary, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  userTime: { fontSize: 10, color: Colors.text.onColorMuted, alignSelf: 'flex-end', fontFamily: 'Inter_400Regular' },
  aiText: { fontSize: 15, color: Colors.onDark.primary, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  aiTime: { fontSize: 10, color: Colors.onDark.muted, alignSelf: 'flex-end', fontFamily: 'Inter_400Regular' },
});
