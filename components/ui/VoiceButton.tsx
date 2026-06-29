import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mic } from 'lucide-react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { useTheme } from '@/theme';

export type VoiceButtonState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'disabled';

interface VoiceButtonProps {
  state: VoiceButtonState;
  onPress?: () => void;
  /** Core diameter (the glowing disc). Spec calls for ~90–110. */
  size?: number;
}

/**
 * The hero microphone. One control, four expressive states:
 *  - idle      → gentle breathing
 *  - listening → expanding ripple rings
 *  - thinking  → rotating accent ring
 *  - speaking  → quick pulse
 * Behaviour is entirely the caller's (`onPress`); this only animates.
 */
export function VoiceButton({ state, onPress, size = 96 }: VoiceButtonProps) {
  const theme = useTheme();
  const disabled = state === 'disabled';

  const breathe = useSharedValue(0);
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  const rotate = useSharedValue(0);
  const pulse = useSharedValue(0);

  // Ambient breathing — always on unless disabled.
  useEffect(() => {
    if (disabled) {
      cancelAnimation(breathe);
      breathe.value = 0;
      return;
    }
    breathe.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(breathe);
  }, [disabled, breathe]);

  // Listening ripples.
  useEffect(() => {
    if (state !== 'listening') {
      cancelAnimation(ripple1);
      cancelAnimation(ripple2);
      ripple1.value = 0;
      ripple2.value = 0;
      return;
    }
    ripple1.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.out(Easing.ease) }), -1, false);
    ripple2.value = withDelay(
      1500,
      withRepeat(withTiming(1, { duration: 3000, easing: Easing.out(Easing.ease) }), -1, false)
    );
    return () => {
      cancelAnimation(ripple1);
      cancelAnimation(ripple2);
    };
  }, [state, ripple1, ripple2]);

  // Thinking rotation.
  useEffect(() => {
    if (state !== 'thinking') {
      cancelAnimation(rotate);
      rotate.value = 0;
      return;
    }
    rotate.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(rotate);
  }, [state, rotate]);

  // Speaking pulse.
  useEffect(() => {
    if (state !== 'speaking') {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [state, pulse]);

  // pulse.value is held at 0 unless speaking, so this single expression covers
  // both the breathing and the speaking-pulse scale.
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: (1 + breathe.value * 0.04) * (1 + pulse.value * 0.12) }],
  }));
  const ripple1Style = useAnimatedStyle(() => ({
    opacity: interpolate(ripple1.value, [0, 1], [0.45, 0]),
    transform: [{ scale: interpolate(ripple1.value, [0, 1], [1, 1.9]) }],
  }));
  const ripple2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ripple2.value, [0, 1], [0.4, 0]),
    transform: [{ scale: interpolate(ripple2.value, [0, 1], [1, 1.9]) }],
  }));
  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value * 360}deg` }],
  }));

  const field = size * 1.8;
  const thinkSize = size + 16;

  return (
    <PressableScale onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel="Microphone">
      <View style={[styles.field, { width: field, height: field }]}>
        {state === 'listening' && (
          <Animated.View
            style={[styles.ripple, { width: size, height: size, borderRadius: size / 2, borderColor: theme.colors.accent }, ripple1Style]}
          />
        )}
        {state === 'listening' && (
          <Animated.View
            style={[styles.ripple, { width: size, height: size, borderRadius: size / 2, borderColor: theme.colors.glow }, ripple2Style]}
          />
        )}
        {state === 'thinking' && (
          <Animated.View
            style={[
              styles.thinkRing,
              {
                width: thinkSize,
                height: thinkSize,
                borderRadius: thinkSize / 2,
                borderTopColor: theme.colors.accent,
                borderRightColor: theme.colors.accentAlt,
              },
              rotateStyle,
            ]}
          />
        )}
        <Animated.View style={[coreStyle, theme.shadows.orbGlow]}>
          <LinearGradient
            colors={theme.gradients.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.core, { width: size, height: size, borderRadius: size / 2, opacity: disabled ? 0.4 : 1 }]}
          >
            <Mic size={size * 0.32} color={theme.colors.textOnAccent} strokeWidth={2} />
          </LinearGradient>
        </Animated.View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  field: { alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute', borderWidth: 2 },
  thinkRing: { position: 'absolute', borderWidth: 2, borderColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent' },
  core: { alignItems: 'center', justifyContent: 'center' },
});
