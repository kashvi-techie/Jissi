import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';

interface VoiceWaveProps {
  active: boolean;
  size: number;
  intensity?: number;
}

const BAR_COUNT = 18;

export const VoiceWave = memo(function VoiceWave({ active, size, intensity = 1 }: VoiceWaveProps) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 360 });
      return;
    }
    progress.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(progress);
  }, [active, progress]);

  const bars = Array.from({ length: BAR_COUNT }, (_, index) => index);
  const field = size + 52;

  return (
    <View pointerEvents="none" style={[styles.wrap, { width: field, height: field }]}>
      {bars.map((index) => (
        <WaveBar
          key={index}
          index={index}
          progress={progress}
          active={active}
          radius={field / 2 - 8}
          color={theme.colors.accent}
          intensity={intensity}
        />
      ))}
    </View>
  );
});

function WaveBar({
  index,
  progress,
  active,
  radius,
  color,
  intensity,
}: {
  index: number;
  progress: SharedValue<number>;
  active: boolean;
  radius: number;
  color: string;
  intensity: number;
}) {
  const angle = (index / BAR_COUNT) * Math.PI * 2;
  const style = useAnimatedStyle(() => {
    const phase = (progress.value + index / BAR_COUNT) % 1;
    const height = interpolate(Math.sin(phase * Math.PI * 2), [-1, 1], [8, 24 + 14 * intensity]);
    return {
      opacity: active ? interpolate(progress.value, [0, 1], [0.48, 0.88]) : 0,
      height,
      transform: [
        { translateX: Math.cos(angle) * radius },
        { translateY: Math.sin(angle) * radius },
        { rotate: `${angle + Math.PI / 2}rad` },
      ],
    };
  });

  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', width: 3, borderRadius: 3 },
});
