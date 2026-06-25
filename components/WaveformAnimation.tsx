import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import { JISSI } from '@/constants/jissiPalette';

interface WaveformAnimationProps {
  isActive: boolean;
}

const BAR_COUNT = 24;
const COLORS = [JISSI.pink, JISSI.lavender, JISSI.blue];

function Bar({ index, isActive }: { index: number; isActive: boolean }) {
  const h = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    if (!isActive) {
      h.setValue(0.2);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(h, {
          toValue: 1,
          duration: 400 + (index % 5) * 90,
          delay: index * 30,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(h, {
          toValue: 0.25,
          duration: 400 + (index % 5) * 90,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    anim.start();
    return () => {
      anim.stop();
      h.setValue(0.2);
    };
  }, [isActive, h, index]);

  const height = h.interpolate({ inputRange: [0, 1], outputRange: [6, 44] });
  return <Animated.View style={[styles.bar, { height, backgroundColor: COLORS[index % COLORS.length] }]} />;
}

export function WaveformAnimation({ isActive }: WaveformAnimationProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <Bar key={i} index={i} isActive={isActive} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 48 },
  bar: { width: 4, borderRadius: 3 },
});
