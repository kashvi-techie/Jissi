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
  /** Canvas size in px. The sphere uses the center; the rest is bloom headroom. */
  size?: number;
}

/**
 * Premium iridescent glass plasma sphere.
 * Transparent shell, thick Fresnel edge, soap-film colour bands, liquid core,
 * soft bloom and smooth reflections. No lightning, particles, fire or smoke.
 */
const SKSL = `
uniform float2 u_res;
uniform float  u_time;
uniform float  u_intensity;
uniform float3 u_deep;
uniform float3 u_mid;
uniform float3 u_hot;

float hash(float2 p){
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(float2 p){
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(float2 p){
  float v = 0.0;
  float a = 0.52;
  for (int i = 0; i < 5; i++){
    v += a * vnoise(p);
    p = p * 2.04 + 9.7;
    a *= 0.50;
  }
  return v;
}

float ellipse(float2 p, float2 c, float2 s, float rot){
  float cs = cos(rot);
  float sn = sin(rot);
  float2 q = p - c;
  q = float2(q.x * cs - q.y * sn, q.x * sn + q.y * cs);
  q /= s;
  return exp(-dot(q, q));
}

float band(float x, float width){
  return 1.0 - smoothstep(0.0, width, abs(x));
}

float3 soap(float h){
  float3 a = float3(0.02, 0.06, 0.23);
  float3 b = float3(0.00, 0.80, 1.00);
  float3 c = float3(0.46, 0.18, 1.00);
  float3 d = float3(1.00, 0.23, 0.72);
  float3 e = float3(1.00, 0.66, 0.42);
  float x = fract(h);
  float3 col = mix(a, b, smoothstep(0.00, 0.24, x));
  col = mix(col, c, smoothstep(0.18, 0.48, x));
  col = mix(col, d, smoothstep(0.42, 0.72, x));
  col = mix(col, e, smoothstep(0.70, 0.92, x));
  return col;
}

half4 main(float2 fragcoord){
  float2 uv = (fragcoord - 0.5 * u_res) / u_res.y;
  float r = length(uv);
  float R = 0.385;
  float t = u_time * (0.085 + 0.055 * u_intensity);
  float inside = 1.0 - smoothstep(R, R + 0.002, r);

  float z = sqrt(max(R * R - r * r, 0.0));
  float3 N = normalize(float3(uv / R, z / R + 0.0001));
  float3 L = normalize(float3(-0.55, 0.55, 0.80));
  float3 L2 = normalize(float3(0.70, -0.28, 0.58));
  float3 V = float3(0.0, 0.0, 1.0);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.15);
  float rim = smoothstep(0.265, R, r);
  float thickEdge = smoothstep(0.305, R, r) * (1.0 - smoothstep(R, R + 0.010, r));
  float light = 0.28 + 0.78 * clamp(dot(N, L), 0.0, 1.0) + 0.28 * clamp(dot(N, L2), 0.0, 1.0);

  float ang = atan(uv.y, uv.x);
  float spin = ang + 0.95 * t + 0.55 * sin(r * 10.0 - t * 1.6);
  float2 flow = uv;
  float cs = cos(t * 0.85);
  float sn = sin(t * 0.85);
  flow = float2(flow.x * cs - flow.y * sn, flow.x * sn + flow.y * cs);
  flow *= 2.7;

  float2 warp = float2(
    fbm(flow + float2(0.0, t * 0.95)),
    fbm(flow + float2(4.7, -t * 0.72))
  );
  float liquid = fbm(flow + 2.25 * warp + float2(sin(t), cos(t)) * 0.45);
  float liquid2 = fbm(flow * 1.45 - 2.0 * warp + float2(7.2, 1.3));

  float ribbonA = band(sin(spin * 2.55 + r * 17.0 + liquid * 4.1), 0.34);
  float ribbonB = band(sin(spin * -3.15 + r * 13.0 - liquid2 * 3.4), 0.28);
  float ribbonC = band(sin(ang * 1.45 - r * 21.0 + t * 1.7), 0.22);
  float ribbons = clamp(ribbonA * 0.58 + ribbonB * 0.44 + ribbonC * 0.30, 0.0, 1.0);

  float coreMask = smoothstep(R * 0.86, R * 0.10, r);
  float hollow = smoothstep(0.01, 0.24, r);
  float3 base = mix(u_deep * 0.52, float3(0.012, 0.032, 0.105), rim * 0.35);
  float3 plasma = mix(soap(liquid * 0.48 + spin * 0.105 + t * 0.14), u_mid * 1.15, 0.18);
  float3 inner = mix(base, plasma, (0.46 + 0.54 * ribbons) * coreMask * hollow);
  inner += soap(liquid2 + 0.36) * ribbons * (0.46 + 0.36 * u_intensity);
  inner += float3(0.06, 0.23, 0.70) * coreMask * (0.25 + 0.30 * u_intensity);
  inner *= light;

  float3 edgeCyan = float3(0.10, 0.78, 1.00);
  float3 edgePink = float3(1.00, 0.25, 0.74);
  float3 edgeViolet = float3(0.44, 0.18, 1.00);
  float3 irid = mix(edgeCyan, edgePink, 0.5 + 0.5 * sin(ang * 2.0 + t * 1.2));
  irid = mix(irid, edgeViolet, 0.35 + 0.35 * sin(ang * -3.0 + r * 20.0));

  float shell = fres * 1.18 + thickEdge * 1.05;
  float3 col = inner;
  col = mix(col, irid * 1.32, clamp(shell, 0.0, 0.88));
  col *= 0.74 + 0.26 * ndv;

  float spec1 = ellipse(uv, float2(-0.145, -0.150), float2(0.034, 0.145), -0.72);
  float spec2 = ellipse(uv, float2(-0.080, -0.245), float2(0.026, 0.085), -1.08);
  float spec3 = ellipse(uv, float2(0.225, 0.105), float2(0.030, 0.110), 0.78);
  float spec4 = ellipse(uv, float2(0.120, 0.255), float2(0.025, 0.080), 0.82);
  float topArc = band(r - (R - 0.018), 0.013) * smoothstep(-2.95, -2.15, ang) * (1.0 - smoothstep(-0.85, -0.25, ang));
  float sideArc = band(r - (R - 0.014), 0.012) * smoothstep(-0.22, 0.22, sin(ang - 0.44));
  float specs = spec1 * 1.05 + spec2 * 0.72 + spec3 * 0.45 + spec4 * 0.34 + topArc * 0.75 + sideArc * 0.42;
  col += mix(float3(1.0, 0.94, 1.0), u_hot, 0.18) * specs;

  float ca = thickEdge * 0.45;
  col.r += ca * 0.16;
  col.g += ca * 0.07;
  col.b += ca * 0.22;

  float innerAlpha = inside * (0.86 + 0.12 * ndv);
  float edgeAlpha = inside * clamp(0.38 + fres * 0.62 + thickEdge * 0.35, 0.0, 1.0);
  float sphereAlpha = max(innerAlpha, edgeAlpha);

  float halo = exp(-(max(r - R, 0.0)) * 14.0) * (1.0 - smoothstep(R + 0.015, R + 0.160, r));
  float haloA = halo * (0.12 + 0.24 * u_intensity);
  float3 haloCol = mix(edgeCyan, edgePink, 0.36 + 0.28 * sin(t)) * (0.55 + 0.45 * u_intensity);

  float alpha = inside > 0.0 ? sphereAlpha : haloA;
  float3 outc = inside > 0.0 ? col : haloCol;
  outc = outc / (1.0 + outc * 0.38);
  return half4(outc * alpha, alpha);
}
`;

const INTENSITY: Record<OrbState, number> = {
  idle: 0.28,
  listening: 0.68,
  thinking: 0.54,
  speaking: 0.88,
};

const BREATH: Record<OrbState, { dur: number; amt: number }> = {
  idle: { dur: 7200, amt: 0.02 },
  listening: { dur: 3400, amt: 0.034 },
  thinking: { dur: 4800, amt: 0.026 },
  speaking: { dur: 2500, amt: 0.04 },
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
    intensity.value = withTiming(INTENSITY[state], { duration: 520, easing: Easing.inOut(Easing.ease) });
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
      { translateY: 3 - float.value * 6 },
      { scale: 0.99 + breath.value * BREATH[state].amt },
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

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});

export default OrbSkia;
export { OrbSkia };
