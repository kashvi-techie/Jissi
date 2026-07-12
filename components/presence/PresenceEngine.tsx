import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
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

export type AvatarState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'happy'
  | 'excited'
  | 'proud'
  | 'curious'
  | 'sleepy'
  | 'focused'
  | 'confused'
  | 'offline';

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

function resolveAvatarState(state: OrbState, emotion: EmotionState, lifeAction?: LifeActionType): AvatarState {
  if (state === 'offline' || state === 'error') return state === 'error' ? 'confused' : 'offline';
  if (state === 'listening') return 'listening';
  if (state === 'thinking' || state === 'tool_execution') return 'thinking';
  if (state === 'speaking') return 'speaking';
  if (lifeAction === 'congratulate') return 'proud';
  if (emotion === 'excited') return 'excited';
  if (emotion === 'curious') return 'curious';
  if (emotion === 'focused') return 'focused';
  if (emotion === 'confused' || emotion === 'frustrated') return 'confused';
  if (emotion === 'tired') return 'sleepy';
  if (emotion === 'relaxed') return 'happy';
  return 'idle';
}

function avatarIntensity(avatar: AvatarState): number {
  if (avatar === 'excited' || avatar === 'proud') return 0.22;
  if (avatar === 'happy' || avatar === 'curious') return 0.12;
  if (avatar === 'sleepy' || avatar === 'offline') return -0.12;
  return 0;
}

export function LivingAvatar({
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
  const avatarState = useMemo(() => resolveAvatarState(state, emotion, lifeAction), [emotion, lifeAction, state]);
  return (
    <PresenceField state={state} emotion={emotion} lifeAction={lifeAction} size={size} avatarState={avatarState}>
      {children}
    </PresenceField>
  );
}

export function PresenceField({
  children,
  state,
  emotion = 'neutral',
  lifeAction,
  size,
  avatarState,
}: {
  children: ReactNode;
  state: OrbState;
  emotion?: EmotionState;
  lifeAction?: LifeActionType;
  size: number;
  avatarState?: AvatarState;
}) {
  const reducedMotion = useReducedMotionPreference();
  const avatar = avatarState ?? resolveAvatarState(state, emotion, lifeAction);
  const pulse = useSharedValue(0);
  const glance = useSharedValue(0);
  const wave = useSharedValue(0);
  const blink = useSharedValue(0);
  const tilt = useSharedValue(0);
  const intensity = Math.max(0.08, Math.min(1, PHASE_INTENSITY[state] + lifeBoost(lifeAction) + avatarIntensity(avatar)));
  const field = size + 86;
  const glowColor = EMOTION_GLOW[emotion] ?? EMOTION_GLOW.neutral;

  useEffect(() => {
    const speed = reducedMotion ? PHASE_SPEED[state] * 1.8 : PHASE_SPEED[state];
    pulse.value = withRepeat(withTiming(1, { duration: speed, easing: Easing.inOut(Easing.ease) }), -1, true);
    glance.value = withRepeat(withTiming(1, { duration: avatar === 'focused' ? 14000 : reducedMotion ? 18000 : 9200, easing: Easing.inOut(Easing.ease) }), -1, true);
    wave.value = withRepeat(withTiming(1, { duration: state === 'thinking' ? 2200 : 3600, easing: Easing.inOut(Easing.ease) }), -1, false);
    blink.value = reducedMotion
      ? 0
      : withRepeat(
        withSequence(
          withDelay(5200, withTiming(1, { duration: 90 })),
          withTiming(0, { duration: 130 }),
          withDelay(1800, withTiming(1, { duration: 80 })),
          withTiming(0, { duration: 120 })
        ),
        -1,
        false
      );
    tilt.value = withRepeat(withTiming(1, { duration: avatar === 'confused' ? 3600 : 7200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [avatar, blink, glance, pulse, reducedMotion, state, tilt, wave]);

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
      { translateX: reducedMotion || avatar === 'focused' ? 0 : interpolate(glance.value, [0, 0.5, 1], [-4, 5, -2]) },
      { translateY: avatar === 'thinking' || avatar === 'curious' ? -5 : avatar === 'listening' ? -2 : avatar === 'sleepy' ? 4 : reducedMotion ? 0 : interpolate(glance.value, [0, 1], [1, -1]) },
      { rotateZ: avatar === 'confused' ? `${interpolate(tilt.value, [0, 1], [-5, 5])}deg` : '0deg' },
      { scaleX: avatar === 'listening' ? 1.12 : avatar === 'sleepy' ? 0.92 : 1 },
      { scaleY: interpolate(blink.value, [0, 1], [avatar === 'sleepy' ? 0.58 : avatar === 'happy' || avatar === 'proud' ? 0.72 : state === 'speaking' ? 0.78 : 1, 0.12]) },
    ],
  }));

  const avatarShellStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: reducedMotion ? 0 : interpolate(pulse.value, [0, 1], [avatar === 'sleepy' ? 1 : -1, avatar === 'excited' ? -5 : 2]) },
      { rotateZ: reducedMotion ? '0deg' : `${interpolate(tilt.value, [0, 1], [avatar === 'confused' ? -1.8 : -0.8, avatar === 'confused' ? 2.2 : 0.8])}deg` },
      { scale: reducedMotion ? 1 : interpolate(pulse.value, [0, 1], [avatar === 'proud' ? 1.02 : 0.99, avatar === 'excited' ? 1.045 : avatar === 'speaking' ? 1.025 : 1.01]) },
    ],
  }));

  return (
    <View pointerEvents="none" style={[styles.presence, { width: field, height: field }]}>
      <Animated.View style={[styles.presenceGlow, { width: field, height: field, borderRadius: field / 2, backgroundColor: glowColor }, glowStyle]} />
      <Animated.View style={[styles.ripple, { width: size * 1.08, height: size * 1.08, borderRadius: size * 0.54, borderColor: glowColor }, rippleStyle]} />
      {!reducedMotion ? <Particles field={field} color={glowColor} /> : null}
      <Animated.View style={avatarShellStyle}>
        {children}
      </Animated.View>
      <Animated.View style={[styles.eyePair, { top: field / 2 - size * 0.17 }, eyeStyle]}>
        <View style={[styles.eye, expressiveEyeStyle(avatar, state)]} />
        <View style={[styles.eye, expressiveEyeStyle(avatar, state), avatar === 'confused' && styles.eyeRaised]} />
      </Animated.View>
      {state === 'speaking' || avatar === 'happy' || avatar === 'proud' ? <MouthLight color={glowColor} avatar={avatar} /> : null}
    </View>
  );
}

function expressiveEyeStyle(avatar: AvatarState, state: OrbState) {
  return {
    width: avatar === 'listening' ? 11 : avatar === 'focused' ? 8 : 9,
    height: avatar === 'sleepy' ? 3 : avatar === 'happy' || avatar === 'proud' ? 3 : 4,
    backgroundColor: state === 'error' || avatar === 'confused' ? 'rgba(255,200,214,0.88)' : 'rgba(236,251,255,0.84)',
  };
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

function MouthLight({ color, avatar }: { color: string; avatar: AvatarState }) {
  const talk = useSharedValue(0);
  useEffect(() => {
    talk.value = withRepeat(withTiming(1, { duration: avatar === 'speaking' ? 540 : 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [avatar, talk]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(talk.value, [0, 1], [avatar === 'speaking' ? 0.18 : 0.24, avatar === 'speaking' ? 0.64 : 0.48]),
    transform: [
      { scaleX: interpolate(talk.value, [0, 1], [avatar === 'speaking' ? 0.62 : 0.86, avatar === 'speaking' ? 1.08 : 1.18]) },
      { translateY: avatar === 'proud' || avatar === 'happy' ? -2 : 0 },
    ],
  }));
  return <Animated.View style={[styles.mouth, avatar !== 'speaking' && styles.smileMouth, { backgroundColor: color }, style]} />;
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
  eyeRaised: { marginTop: -2 },
  mouth: { position: 'absolute', bottom: '34%', width: 32, height: 4, borderRadius: 4 },
  smileMouth: { width: 42, height: 3, borderRadius: 8 },
  ambientParticle: { position: 'absolute', opacity: 0.28 },
});
