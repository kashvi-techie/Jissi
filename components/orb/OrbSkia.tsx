import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { OrbState } from './PlasmaOrb';

export interface OrbProps {
  state?: OrbState;
  /** Canvas size in px (sphere ≈ 0.84 × size; the rest is bloom/halo headroom). */
  size?: number;
}

/**
 * SkSL fragment shader — "a calm energy core in glass".
 * Volumetric sphere shading from a faked normal, domain-warped FBM (a slow,
 * organic nebula — no lightning), a soft bloom core, a gentle Fresnel rim and a
 * soft external halo. Driven by u_time (Reanimated clock) + u_intensity (state).
 */
const SKSL = `
uniform float2 u_res;
uniform float  u_time;
uniform float  u_intensity;
uniform float3 u_deep;
uniform float3 u_mid;
uniform float3 u_hot;

float hash(float2 p){ p = fract(p * float2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(float2 p){
  float2 i = floor(p); float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + float2(1.0, 0.0)), c = hash(i + float2(0.0, 1.0)), d = hash(i + float2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(float2 p){ float v = 0.0; float a = 0.55; for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = p * 2.03 + 11.0; a *= 0.5; } return v; }

half4 main(float2 fragcoord){
  float2 uv = (fragcoord - 0.5 * u_res) / u_res.y;
  float r = length(uv);
  float R = 0.40;
  // Very slow, fluid time — the core drifts like a nebula, never electric.
  float t = u_time * 0.06;

  float inside = step(r, R);
  float z = sqrt(max(R * R - r * r, 0.0));
  float3 N = normalize(float3(uv, z + 0.0001));
  float3 L = normalize(float3(-0.4, 0.55, 0.75));
  float3 V = float3(0.0, 0.0, 1.0);
  float diff = clamp(dot(N, L), 0.0, 1.0);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.5);

  // Domain-warped fbm (fbm of fbm) → smooth, organic, slowly folding fluid.
  float2 p = uv * 2.1;
  float2 q = float2(fbm(p + float2(0.0, t)), fbm(p + float2(5.2, -t)));
  float2 w = float2(fbm(p + 1.6 * q + float2(8.3, 2.8) + 0.10 * t),
                    fbm(p + 1.6 * q + float2(2.1, 9.2) - 0.08 * t));
  float neb  = fbm(p + 2.0 * w);
  float neb2 = fbm(p * 1.25 + 3.0 * w + 4.0);
  float core = smoothstep(0.40, 0.02, r);

  // Gentle layered colour: deep base → mid plasma → soft hot wisps + bloom core.
  float3 col = mix(u_deep, u_mid, clamp(neb * 1.2, 0.0, 1.0));
  col = mix(col, u_hot, clamp(neb2 * neb * 1.0, 0.0, 1.0));
  col += u_hot * core * (0.55 + 0.45 * u_intensity);
  col *= (0.42 + 0.78 * diff);
  // Iridescent rim — a soft cyan→magenta hue shift toward the sphere edge.
  float3 irid = mix(float3(0.30, 0.55, 1.00), float3(0.95, 0.38, 0.78), fres);
  col = mix(col, irid, fres * 0.5);
  col *= mix(0.92, 1.12, u_intensity);

  // Soft halo that fades to EXACTLY zero before the canvas edge (floating sphere,
  // no square): mask = 1 at the sphere edge, 0 by r = 0.485.
  float haloFall = exp(-(r - R) * 7.0);
  float mask = 1.0 - smoothstep(R, 0.485, r);
  float haloA = haloFall * mask * (0.45 + 0.45 * u_intensity);
  float3 haloCol = u_mid * (0.6 + 0.45 * u_intensity);

  float alpha = inside > 0.5 ? 1.0 : clamp(haloA, 0.0, 1.0);
  float3 outc = inside > 0.5 ? col : haloCol;
  outc = outc / (1.0 + outc * 0.5);
  // Premultiplied alpha: RGB is scaled by alpha, so alpha = 0 is fully transparent.
  return half4(outc * alpha, alpha);
}
`;

const INTENSITY: Record<OrbState, number> = { idle: 0.22, listening: 0.6, thinking: 0.45, speaking: 0.85 };
const BREATH: Record<OrbState, { dur: number; amt: number }> = {
  idle: { dur: 7200, amt: 0.022 },
  listening: { dur: 3600, amt: 0.04 },
  thinking: { dur: 4600, amt: 0.03 },
  speaking: { dur: 2600, amt: 0.045 },
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function OrbSkia({ state = 'idle', size = 260 }: OrbProps) {
  const theme = useTheme();
  const [light, mid, deep] = theme.gradients.orbCore;
  const colDeep = useMemo(() => hexToRgb(deep), [deep]);
  const colMid = useMemo(() => hexToRgb(mid), [mid]);
  const colHot = useMemo(() => hexToRgb(light), [light]);

  const effect = useMemo(() => Skia.RuntimeEffect.Make(SKSL), []);

  const clock = useClock();
  const intensity = useSharedValue(INTENSITY.idle);
  const breath = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    intensity.value = withTiming(INTENSITY[state], { duration: 500, easing: Easing.inOut(Easing.ease) });
    const cfg = BREATH[state];
    breath.value = 0;
    breath.value = withRepeat(withTiming(1, { duration: cfg.dur, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(breath);
  }, [state, intensity, breath]);

  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(float);
  }, [float]);

  const uniforms = useDerivedValue(() => ({
    u_res: [size, size],
    u_time: clock.value / 1000,
    u_intensity: intensity.value,
    u_deep: colDeep,
    u_mid: colMid,
    u_hot: colHot,
  }));

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: 5 - float.value * 10 },
      { scale: 1 + breath.value * BREATH[state].amt },
    ],
  }));

  if (!effect) {
    return <View style={{ width: size, height: size }} />;
  }

  return (
    <Animated.View style={[styles.wrap, wrapStyle]}>
      <Canvas style={{ width: size, height: size }}>
        <Fill>
          <Shader source={effect} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: 'center', justifyContent: 'center' } });

export default OrbSkia;
export { OrbSkia };
