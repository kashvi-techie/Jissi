/**
 * JISSI Design System — primitive tokens (theme-INDEPENDENT).
 *
 * These scales never change between light/dark. Colour, gradients, glass and
 * shadows live in `./themes` because those DO change per mode.
 */

/** 4-based spacing scale. */
export const Spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  giant: 64,
  /** default screen horizontal gutter */
  gutter: 22,
} as const;

/** Corner-radius scale. `pill` for chips, `circle` for fully-round. */
export const Radii = {
  none: 0,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  xxxl: 36,
  pill: 999,
  circle: 9999,
} as const;

/** expo-blur intensities (0–100). */
export const Blur = {
  subtle: 18,
  soft: 30,
  regular: 44,
  heavy: 64,
  intense: 90,
} as const;

/** Animation durations (ms). `breath`/`drift`/`pulse` are the ambient loops. */
export const Durations = {
  instant: 90,
  fast: 160,
  base: 240,
  slow: 360,
  slower: 520,
  pulse: 2400,
  breath: 4200,
  drift: 16000,
} as const;

/**
 * Cubic-bezier control points for easings. Components build the easing with
 * `Easing.bezier(...Easings.standard)` so tokens stay decoupled from Reanimated.
 */
export const Easings = {
  standard: [0.2, 0, 0, 1],
  decelerate: [0, 0, 0, 1],
  accelerate: [0.3, 0, 1, 1],
  emphasized: [0.2, 0, 0, 1],
} as const;

/** Reanimated spring configs (pass straight to `withSpring`). */
export const Springs = {
  gentle: { damping: 18, stiffness: 140, mass: 1 },
  snappy: { damping: 16, stiffness: 220, mass: 0.9 },
  bouncy: { damping: 11, stiffness: 180, mass: 1 },
  press: { damping: 20, stiffness: 320, mass: 0.7 },
} as const;
