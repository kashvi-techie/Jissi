import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'tool_execution' | 'offline' | 'error';

interface PlasmaOrbProps {
  state?: OrbState;
  size?: number;
}

const CONFIG: Record<OrbState, { breath: number; scaleAmt: number; rot: number; glow: number; glowColor: string }> = {
  idle: { breath: 7200, scaleAmt: 0.018, rot: 54000, glow: 0.36, glowColor: 'rgba(38,132,255,0.14)' },
  listening: { breath: 3200, scaleAmt: 0.036, rot: 30000, glow: 0.74, glowColor: 'rgba(28,180,255,0.22)' },
  thinking: { breath: 4600, scaleAmt: 0.026, rot: 38000, glow: 0.6, glowColor: 'rgba(154,95,255,0.2)' },
  speaking: { breath: 1800, scaleAmt: 0.052, rot: 24000, glow: 0.86, glowColor: 'rgba(45,145,255,0.24)' },
  tool_execution: { breath: 2600, scaleAmt: 0.032, rot: 20000, glow: 0.78, glowColor: 'rgba(255,190,92,0.2)' },
  offline: { breath: 8200, scaleAmt: 0.01, rot: 68000, glow: 0.2, glowColor: 'rgba(120,120,128,0.12)' },
  error: { breath: 1200, scaleAmt: 0.038, rot: 18000, glow: 0.72, glowColor: 'rgba(255,78,104,0.22)' },
};

const VB = 240;
const C = VB / 2;

export function PlasmaOrb({ state = 'idle', size = 220 }: PlasmaOrbProps) {
  const theme = useTheme();
  const [hot, mid, deep] = theme.gradients.orbCore;
  const breath = useSharedValue(0);
  const rotate = useSharedValue(0);
  const flow = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    const cfg = CONFIG[state];
    breath.value = 0;
    rotate.value = 0;
    flow.value = 0;
    breath.value = withRepeat(withTiming(1, { duration: cfg.breath, easing: Easing.inOut(Easing.ease) }), -1, true);
    rotate.value = withRepeat(withTiming(1, { duration: cfg.rot, easing: Easing.linear }), -1, false);
    flow.value = withRepeat(withTiming(1, { duration: Math.max(2800, cfg.rot * 0.22), easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => {
      cancelAnimation(breath);
      cancelAnimation(rotate);
      cancelAnimation(flow);
    };
  }, [state, breath, rotate, flow]);

  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(float);
  }, [float]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(float.value, [0, 1], [3, -3]) }],
  }));
  const sphereStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.99 + breath.value * CONFIG[state].scaleAmt }],
  }));

  const box = size * 1.42;
  const glowOpacity = CONFIG[state].glow;

  return (
    <View style={[styles.wrap, { width: box, height: box }]} pointerEvents="none">
      <Animated.View style={[styles.center, floatStyle]}>
        <Animated.View style={[styles.glow, { width: box, height: box, opacity: glowOpacity, backgroundColor: CONFIG[state].glowColor }, sphereStyle]} />
        <Animated.View style={[styles.center, { width: size, height: size }, sphereStyle]}>
          <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
            <Defs>
              <RadialGradient id="body" cx="39%" cy="31%" r="78%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                <Stop offset="18%" stopColor={hot} stopOpacity="0.92" />
                <Stop offset="48%" stopColor={mid} stopOpacity="0.86" />
                <Stop offset="100%" stopColor={deep} stopOpacity="0.96" />
              </RadialGradient>
              <RadialGradient id="shade" cx="62%" cy="69%" r="68%">
                <Stop offset="0%" stopColor="#000714" stopOpacity="0" />
                <Stop offset="100%" stopColor="#00020A" stopOpacity="0.58" />
              </RadialGradient>
              <LinearGradient id="filmA" x1="18%" y1="12%" x2="88%" y2="86%">
                <Stop offset="0%" stopColor="#62E6FF" stopOpacity="0.96" />
                <Stop offset="34%" stopColor="#366BFF" stopOpacity="0.7" />
                <Stop offset="66%" stopColor="#F149C9" stopOpacity="0.92" />
                <Stop offset="100%" stopColor="#FFC07A" stopOpacity="0.88" />
              </LinearGradient>
              <LinearGradient id="filmB" x1="86%" y1="8%" x2="20%" y2="90%">
                <Stop offset="0%" stopColor="#86F5FF" stopOpacity="0.8" />
                <Stop offset="44%" stopColor="#8E3DFF" stopOpacity="0.72" />
                <Stop offset="100%" stopColor="#FF4D96" stopOpacity="0.8" />
              </LinearGradient>
              <RadialGradient id="glass" cx="34%" cy="23%" r="78%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
                <Stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.05" />
                <Stop offset="100%" stopColor="#88DFFF" stopOpacity="0.28" />
              </RadialGradient>
            </Defs>

            <Circle cx={C} cy={C} r="92" fill="url(#body)" />
            <Circle cx={C} cy={C} r="92" fill="url(#shade)" />

            <G opacity="0.95">
              <Ellipse cx="95" cy="86" rx="78" ry="26" fill="none" stroke="url(#filmA)" strokeWidth="13" strokeLinecap="round" transform="rotate(-31 95 86)" />
              <Ellipse cx="143" cy="136" rx="68" ry="23" fill="none" stroke="url(#filmB)" strokeWidth="12" strokeLinecap="round" transform="rotate(-30 143 136)" />
            </G>

            <G>
              <Ellipse cx="118" cy="118" rx="52" ry="31" fill="#F044C9" opacity="0.18" transform="rotate(-26 118 118)" />
              <Ellipse cx="128" cy="104" rx="62" ry="37" fill="#00B8FF" opacity="0.12" transform="rotate(31 128 104)" />
            </G>

            <Circle cx={C} cy={C} r="91" fill="url(#glass)" />
            <Circle cx={C} cy={C} r="91" fill="none" stroke="#AEEBFF" strokeWidth="3.6" opacity="0.72" />
            <Circle cx={C} cy={C} r="86" fill="none" stroke="#FF64D4" strokeWidth="2.4" opacity="0.34" />
            <Ellipse cx="77" cy="67" rx="19" ry="57" fill="#FFFFFF" opacity="0.76" transform="rotate(-42 77 67)" />
            <Ellipse cx="72" cy="61" rx="8" ry="29" fill="#E9FBFF" opacity="0.88" transform="rotate(-42 72 61)" />
            <Ellipse cx="162" cy="168" rx="10" ry="37" fill="#FFFFFF" opacity="0.25" transform="rotate(43 162 168)" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(38,132,255,0.16)',
    shadowColor: '#6DDFFF',
    shadowOpacity: 0.55,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
  },
});
