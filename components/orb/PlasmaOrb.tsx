import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
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

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface PlasmaOrbProps {
  state?: OrbState;
  /** Sphere diameter in px. */
  size?: number;
}

/** Per-state animation parameters. */
const CONFIG: Record<
  OrbState,
  { breath: number; scaleAmt: number; rot: number; flick: number; coreMax: number; rings: boolean }
> = {
  idle: { breath: 7200, scaleAmt: 0.022, rot: 48000, flick: 6000, coreMax: 0.42, rings: false },
  listening: { breath: 3600, scaleAmt: 0.04, rot: 34000, flick: 4200, coreMax: 0.6, rings: true },
  thinking: { breath: 4600, scaleAmt: 0.03, rot: 30000, flick: 3800, coreMax: 0.52, rings: false },
  speaking: { breath: 2600, scaleAmt: 0.045, rot: 26000, flick: 3000, coreMax: 0.68, rings: true },
};

const VB = 220; // SVG authoring space — viewBox scales everything to `size`
const C = VB / 2;

export function PlasmaOrb({ state = 'idle', size = 200 }: PlasmaOrbProps) {
  const theme = useTheme();
  const [core0, core1, core2] = theme.gradients.orbCore;

  // progress shared values (0..1 loops)
  const breath = useSharedValue(0);
  const rot = useSharedValue(0);
  const flick = useSharedValue(0);
  const corePulse = useSharedValue(0);
  const ring = useSharedValue(0);
  const float = useSharedValue(0);

  // per-state scalars read inside worklets
  const scaleAmt = useSharedValue(CONFIG.idle.scaleAmt);
  const coreMax = useSharedValue(CONFIG.idle.coreMax);

  // constant float loop
  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(float);
  }, [float]);

  // re-target all loops whenever the state changes
  useEffect(() => {
    const cfg = CONFIG[state];
    scaleAmt.value = cfg.scaleAmt;
    coreMax.value = cfg.coreMax;

    breath.value = 0;
    breath.value = withRepeat(withTiming(1, { duration: cfg.breath, easing: Easing.inOut(Easing.ease) }), -1, true);
    rot.value = 0;
    rot.value = withRepeat(withTiming(1, { duration: cfg.rot, easing: Easing.linear }), -1, false);
    flick.value = withRepeat(withTiming(1, { duration: cfg.flick, easing: Easing.inOut(Easing.ease) }), -1, true);
    corePulse.value = withRepeat(withTiming(1, { duration: cfg.breath, easing: Easing.inOut(Easing.ease) }), -1, true);
    ring.value = 0;
    if (cfg.rings) {
      ring.value = withRepeat(withTiming(1, { duration: 3600, easing: Easing.out(Easing.ease) }), -1, false);
    }
    return () => {
      cancelAnimation(breath);
      cancelAnimation(rot);
      cancelAnimation(flick);
      cancelAnimation(corePulse);
      cancelAnimation(ring);
    };
  }, [state, breath, rot, flick, corePulse, ring, scaleAmt, coreMax]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(float.value, [0, 1], [7, -7]) }],
  }));
  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * scaleAmt.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(corePulse.value, [0, 1], [0.45, 0.85]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [1, 1.08]) }],
  }));
  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value * 360}deg` }],
  }));
  const flickerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flick.value, [0, 1], [0.35, 0.92]),
  }));
  const coreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(corePulse.value, [0, 1], [0.3, coreMax.value]),
    transform: [{ scale: interpolate(corePulse.value, [0, 1], [0.92, 1.08]) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 1], [0.28, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [1.0, 1.5]) }],
  }));

  const box = size * 1.55;
  const sphere = { width: size, height: size };

  return (
    <View style={[styles.wrap, { width: box, height: box }]} pointerEvents="none">
      <Animated.View style={[styles.center, floatStyle]}>
        {/* halo bloom */}
        <Animated.View style={[styles.layer, { width: box, height: box }, haloStyle]}>
          <Svg width={box} height={box} viewBox="0 0 320 320">
            <Defs>
              <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={theme.gradients.orbHalo} stopOpacity={1} />
                <Stop offset="55%" stopColor={theme.gradients.orbHalo} stopOpacity={0.35} />
                <Stop offset="100%" stopColor={theme.gradients.orbHalo} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx="160" cy="160" r="160" fill="url(#halo)" />
          </Svg>
        </Animated.View>

        {/* listening / speaking rings */}
        {CONFIG[state].rings && (
          <Animated.View style={[styles.layer, { width: size * 1.3, height: size * 1.3 }, ringStyle]}>
            <Svg width={size * 1.3} height={size * 1.3} viewBox="0 0 220 220">
              <Circle cx={C} cy={C} r="104" fill="none" stroke={theme.colors.accent} strokeWidth="1" opacity={0.5} />
              <Circle cx={C} cy={C} r="84" fill="none" stroke={theme.colors.accent} strokeWidth="1" opacity={0.3} />
            </Svg>
          </Animated.View>
        )}

        {/* breathing sphere */}
        <Animated.View style={[styles.center, breatheStyle]}>
          <View style={[sphere, { borderRadius: size / 2, overflow: 'hidden' }]}>
            {/* volumetric body */}
            <Svg width={size} height={size} viewBox="0 0 220 220" style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="body" cx="36%" cy="30%" r="75%">
                  <Stop offset="0%" stopColor={core0} />
                  <Stop offset="42%" stopColor={core1} />
                  <Stop offset="100%" stopColor={core2} />
                </RadialGradient>
                <RadialGradient id="shade" cx="68%" cy="74%" r="70%">
                  <Stop offset="0%" stopColor="#000000" stopOpacity={0} />
                  <Stop offset="100%" stopColor="#000000" stopOpacity={0.45} />
                </RadialGradient>
              </Defs>
              <Circle cx={C} cy={C} r="100" fill="url(#body)" />
              <Circle cx={C} cy={C} r="100" fill="url(#shade)" />
              {/* rim light */}
              <Circle cx={C} cy={C} r="99" fill="none" stroke={core0} strokeWidth="1.2" opacity={0.5} />
            </Svg>

            {/* slow-drifting soft particles (no lightning) */}
            <Animated.View style={[StyleSheet.absoluteFill, rotateStyle]}>
              <Animated.View style={[StyleSheet.absoluteFill, flickerStyle]}>
                <Svg width={size} height={size} viewBox="0 0 220 220">
                  <Circle cx="150" cy="74" r="1.8" fill={core0} opacity={0.45} />
                  <Circle cx="78" cy="150" r="1.5" fill={core0} opacity={0.38} />
                  <Circle cx="156" cy="140" r="1.3" fill={core0} opacity={0.3} />
                  <Circle cx="84" cy="80" r="1.3" fill={core0} opacity={0.28} />
                </Svg>
              </Animated.View>
            </Animated.View>

            {/* pulsing core */}
            <Animated.View style={[StyleSheet.absoluteFill, coreStyle]}>
              <Svg width={size} height={size} viewBox="0 0 220 220">
                <Defs>
                  <RadialGradient id="core" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
                    <Stop offset="30%" stopColor={core0} stopOpacity={0.7} />
                    <Stop offset="100%" stopColor={core1} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={C} cy="98" r="46" fill="url(#core)" />
              </Svg>
            </Animated.View>

            {/* specular highlight (glass reflection) */}
            <Svg width={size} height={size} viewBox="0 0 220 220" style={StyleSheet.absoluteFill}>
              <Ellipse cx="84" cy="72" rx="30" ry="18" fill="#FFFFFF" opacity={0.5} transform="rotate(-22 84 72)" />
              <Ellipse cx="150" cy="156" rx="20" ry="10" fill="#FFFFFF" opacity={0.08} transform="rotate(-22 150 156)" />
            </Svg>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  layer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
