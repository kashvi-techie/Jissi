import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mic, Square, WifiOff, AlertTriangle } from 'lucide-react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { useTheme } from '@/theme';

export type VoiceButtonState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'tool_execution' | 'offline' | 'error' | 'disabled';

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
  const disabled = state === 'disabled' || state === 'offline';

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

  // Thinking / tool rotation.
  useEffect(() => {
    if (state !== 'thinking' && state !== 'tool_execution') {
      cancelAnimation(rotate);
      rotate.value = 0;
      return;
    }
    rotate.value = withRepeat(withTiming(1, { duration: state === 'tool_execution' ? 2100 : 3200, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(rotate);
  }, [state, rotate]);

  // Speaking pulse.
  useEffect(() => {
    if (state !== 'speaking' && state !== 'error') {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: state === 'error' ? 760 : 1500, easing: Easing.inOut(Easing.ease) }), -1, true);
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
        {(state === 'thinking' || state === 'tool_execution') && (
          <Animated.View
            style={[
              styles.thinkRing,
              {
                width: thinkSize,
                height: thinkSize,
                borderRadius: thinkSize / 2,
                borderTopColor: state === 'tool_execution' ? '#FFBE5C' : theme.colors.accent,
                borderRightColor: state === 'tool_execution' ? theme.colors.accent : theme.colors.accentAlt,
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
            style={[
              styles.core,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                opacity: disabled ? 0.4 : 1,
                backgroundColor: state === 'error' ? theme.colors.error : undefined,
              },
            ]}
          >
            {state === 'offline' || state === 'disabled' ? (
              <WifiOff size={size * 0.3} color={theme.colors.textOnAccent} strokeWidth={2} />
            ) : state === 'error' ? (
              <AlertTriangle size={size * 0.3} color={theme.colors.textOnAccent} strokeWidth={2} />
            ) : state === 'listening' ? (
              <VoiceGlyph kind="waveform" size={size} progress={ripple1} />
            ) : state === 'speaking' ? (
              <VoiceGlyph kind="equalizer" size={size} progress={pulse} />
            ) : state === 'thinking' || state === 'tool_execution' ? (
              <Square size={size * 0.26} color={theme.colors.textOnAccent} fill={theme.colors.textOnAccent} strokeWidth={2} />
            ) : (
              <Mic size={size * 0.32} color={theme.colors.textOnAccent} strokeWidth={2} />
            )}
          </LinearGradient>
        </Animated.View>
      </View>
    </PressableScale>
  );
}

function VoiceGlyph({ kind, size, progress }: { kind: 'waveform' | 'equalizer'; size: number; progress: SharedValue<number> }) {
  return (
    <View style={styles.voiceGlyph}>
      {[0, 1, 2, 3, 4].map((bar) => (
        <VoiceBar key={bar} bar={bar} kind={kind} size={size} progress={progress} />
      ))}
    </View>
  );
}

function VoiceBar({ bar, kind, size, progress }: { bar: number; kind: 'waveform' | 'equalizer'; size: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const phase = (progress.value + bar * 0.13) % 1;
    const lift = Math.sin(phase * Math.PI);
    const base = kind === 'waveform' ? 0.26 : 0.32;
    const range = kind === 'waveform' ? 0.28 : 0.42;
    return {
      height: size * (base + range * Math.max(0.18, lift)),
      opacity: kind === 'waveform' ? 0.82 : 0.92,
      transform: [{ translateY: kind === 'waveform' ? Math.cos(phase * Math.PI) * 2 : 0 }],
    };
  });
  return <Animated.View style={[styles.voiceBar, { width: Math.max(3, size * 0.045), borderRadius: size * 0.03 }, style]} />;
}

const styles = StyleSheet.create({
  field: { alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute', borderWidth: 2 },
  thinkRing: { position: 'absolute', borderWidth: 2, borderColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent' },
  core: { alignItems: 'center', justifyContent: 'center' },
  voiceGlyph: { height: '48%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  voiceBar: { backgroundColor: 'rgba(255,255,255,0.92)' },
});
