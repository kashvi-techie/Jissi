import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import type { EmotionState } from '@/services/emotion';
import type { LifeActionType } from '@/services/life';
import type { OrbState } from '@/components/orb/PlasmaOrb';

const PARTICLES = [
  { x: 0.18, y: 0.22, s: 3, d: 0 },
  { x: 0.72, y: 0.16, s: 2, d: 120 },
  { x: 0.84, y: 0.52, s: 3, d: 240 },
  { x: 0.28, y: 0.76, s: 2, d: 80 },
  { x: 0.58, y: 0.84, s: 2, d: 180 },
  { x: 0.10, y: 0.56, s: 2, d: 300 },
];

const EMOTION_GLOW: Record<EmotionState, string> = {
  focused: 'rgba(61,169,255,0.26)',
  relaxed: 'rgba(93,214,186,0.22)',
  curious: 'rgba(116,139,255,0.24)',
  excited: 'rgba(255,96,202,0.28)',
  stressed: 'rgba(255,164,86,0.22)',
  confused: 'rgba(169,116,255,0.22)',
  tired: 'rgba(111,137,176,0.18)',
  lonely: 'rgba(145,128,255,0.20)',
  frustrated: 'rgba(255,92,124,0.24)',
  neutral: 'rgba(88,185,255,0.20)',
};

const PHASE_SPEED: Record<OrbState, number> = {
  idle: 8200,
  listening: 1800,
  thinking: 2600,
  speaking: 1200,
  tool_execution: 2100,
  offline: 10000,
  error: 950,
};

const PHASE_INTENSITY: Record<OrbState, number> = {
  idle: 0.42,
  listening: 0.82,
  thinking: 0.72,
  speaking: 0.94,
  tool_execution: 0.86,
  offline: 0.2,
  error: 0.78,
};

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}

function lifeBoost(action?: LifeActionType): number {
  if (action === 'congratulate') return 0.24;
  if (action === 'motivate') return 0.14;
  if (action === 'remind') return 0.18;
  return 0;
}

export function PresenceField({
  children,
  state,
  emotion = 'neutral',
  lifeAction,
  size,
}: {
  children: ReactNode;
  state: OrbState;
  emotion?: EmotionState;
  lifeAction?: LifeActionType;
  size: number;
}) {
  const reducedMotion = useReducedMotionPreference();
  const pulse = useSharedValue(0);
  const glance = useSharedValue(0);
  const wave = useSharedValue(0);
  const intensity = Math.min(1, PHASE_INTENSITY[state] + lifeBoost(lifeAction));
  const field = size + 86;
  const glowColor = EMOTION_GLOW[emotion] ?? EMOTION_GLOW.neutral;

  useEffect(() => {
    const speed = reducedMotion ? PHASE_SPEED[state] * 1.8 : PHASE_SPEED[state];
    pulse.value = withRepeat(withTiming(1, { duration: speed, easing: Easing.inOut(Easing.ease) }), -1, true);
    glance.value = withRepeat(withTiming(1, { duration: reducedMotion ? 18000 : 9200, easing: Easing.inOut(Easing.ease) }), -1, true);
    wave.value = withRepeat(withTiming(1, { duration: state === 'thinking' ? 2200 : 3600, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [glance, pulse, reducedMotion, state, wave]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? intensity * 0.38 : interpolate(pulse.value, [0, 1], [intensity * 0.34, intensity * 0.72]),
    transform: [{ scale: reducedMotion ? 1 : interpolate(pulse.value, [0, 1], [0.96, 1.08]) }],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: state === 'idle' || reducedMotion ? 0 : interpolate(wave.value, [0, 0.72, 1], [0.28 * intensity, 0.08, 0]),
    transform: [{ scale: interpolate(wave.value, [0, 1], [0.72, 1.28]) }],
  }));

  const eyeStyle = useAnimatedStyle(() => ({
    opacity: state === 'offline' ? 0.16 : 0.42 + intensity * 0.3,
    transform: [
      { translateX: reducedMotion ? 0 : interpolate(glance.value, [0, 0.5, 1], [-4, 5, -2]) },
      { translateY: state === 'listening' ? -2 : reducedMotion ? 0 : interpolate(glance.value, [0, 1], [1, -1]) },
      { scaleY: state === 'speaking' ? interpolate(pulse.value, [0, 1], [0.55, 1]) : 1 },
    ],
  }));

  return (
    <View pointerEvents="none" style={[styles.presence, { width: field, height: field }]}>
      <Animated.View style={[styles.presenceGlow, { width: field, height: field, borderRadius: field / 2, backgroundColor: glowColor }, glowStyle]} />
      <Animated.View style={[styles.ripple, { width: size * 1.08, height: size * 1.08, borderRadius: size * 0.54, borderColor: glowColor }, rippleStyle]} />
      {!reducedMotion ? <Particles field={field} color={glowColor} /> : null}
      {children}
      <Animated.View style={[styles.eyePair, { top: field / 2 - size * 0.17 }, eyeStyle]}>
        <View style={[styles.eye, { backgroundColor: state === 'error' ? 'rgba(255,180,190,0.88)' : 'rgba(236,251,255,0.82)' }]} />
        <View style={[styles.eye, { backgroundColor: state === 'error' ? 'rgba(255,180,190,0.88)' : 'rgba(236,251,255,0.82)' }]} />
      </Animated.View>
      {state === 'speaking' ? <MouthLight color={glowColor} /> : null}
    </View>
  );
}

export function AmbientPresence({ emotion = 'neutral', lifeAction }: { emotion?: EmotionState; lifeAction?: LifeActionType }) {
  const reducedMotion = useReducedMotionPreference();
  const drift = useSharedValue(0);
  const glowColor = EMOTION_GLOW[emotion] ?? EMOTION_GLOW.neutral;
  const intensity = 0.42 + lifeBoost(lifeAction);

  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: reducedMotion ? 42000 : 26000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [drift, reducedMotion]);

  const auroraStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? intensity * 0.34 : interpolate(drift.value, [0, 1], [intensity * 0.34, intensity * 0.56]),
    transform: [
      { translateX: reducedMotion ? 0 : interpolate(drift.value, [0, 1], [-18, 22]) },
      { translateY: reducedMotion ? 0 : interpolate(drift.value, [0, 1], [12, -14]) },
    ],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, auroraStyle]}>
        <LinearGradient
          colors={['rgba(0,0,0,0)', glowColor, 'rgba(133,92,255,0.10)', 'rgba(0,0,0,0)']}
          locations={[0, 0.36, 0.72, 1]}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {!reducedMotion ? <AmbientParticles color={glowColor} /> : null}
    </View>
  );
}

function Particles({ field, color }: { field: number; color: string }) {
  return (
    <>
      {PARTICLES.map((particle, index) => (
        <PresenceParticle key={index} particle={particle} field={field} color={color} />
      ))}
    </>
  );
}

function PresenceParticle({ particle, field, color }: { particle: { x: number; y: number; s: number; d: number }; field: number; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6800 + particle.d * 8, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [particle.d, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.16, 0.42]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [4, -8]) }],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: particle.s,
          height: particle.s,
          borderRadius: particle.s / 2,
          left: field * particle.x,
          top: field * particle.y,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

function AmbientParticles({ color }: { color: string }) {
  return (
    <>
      {PARTICLES.slice(0, 5).map((particle, index) => (
        <View
          key={index}
          style={[
            styles.ambientParticle,
            {
              left: `${particle.x * 100}%`,
              top: `${particle.y * 100}%`,
              width: particle.s + 1,
              height: particle.s + 1,
              borderRadius: particle.s,
              backgroundColor: color,
            },
          ]}
        />
      ))}
    </>
  );
}

function MouthLight({ color }: { color: string }) {
  const talk = useSharedValue(0);
  useEffect(() => {
    talk.value = withRepeat(withTiming(1, { duration: 540, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [talk]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(talk.value, [0, 1], [0.18, 0.64]),
    transform: [{ scaleX: interpolate(talk.value, [0, 1], [0.62, 1.08]) }],
  }));
  return <Animated.View style={[styles.mouth, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  presence: { alignItems: 'center', justifyContent: 'center' },
  presenceGlow: { position: 'absolute' },
  ripple: { position: 'absolute', borderWidth: 1 },
  particle: { position: 'absolute' },
  eyePair: { position: 'absolute', flexDirection: 'row', gap: 18 },
  eye: {
    width: 9,
    height: 4,
    borderRadius: 4,
    shadowColor: '#ffffff',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  mouth: { position: 'absolute', bottom: '34%', width: 32, height: 4, borderRadius: 4 },
  ambientParticle: { position: 'absolute', opacity: 0.28 },
});
