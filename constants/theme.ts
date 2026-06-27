/**
 * JISSI design tokens — SPACING, RADIUS, DURATION, ELEVATION.
 *
 * Numeric design primitives. Use these instead of magic numbers for layout
 * rhythm, corner rounding, animation timing, and shadow elevation.
 * Colour tokens live in `./colors`.
 */
import { Colors } from './colors';

/** 4-based spacing scale (padding / margin / gap). */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  screen: 22,
} as const;

/** Corner-radius scale. `circle` is for fully-round elements. */
export const Radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  xl3: 32,
  pill: 99,
  circle: 999,
} as const;

/** Animation durations (ms). */
export const Duration = {
  fast: 200,
  morph: 260,
  entrance: 340,
  base: 400,
  pulseActive: 1100,
  ring: 1800,
  glow: 2200,
  pulse: 2600,
  float: 5200,
  drift: 16000,
} as const;

/** Ready-to-spread RN shadow/elevation style objects. */
export const Elevation = {
  orb: {
    shadowColor: Colors.shadow.violet,
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  micButton: {
    shadowColor: Colors.shadow.violet,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  micCard: {
    shadowColor: Colors.shadow.sky,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  // Premium Home (dark) floating depth.
  panel: {
    shadowColor: Colors.shadow.black,
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18,
  },
  orbDark: {
    shadowColor: Colors.shadow.glow,
    shadowOpacity: 0.6,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  micDark: {
    shadowColor: Colors.shadow.mic,
    shadowOpacity: 0.65,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
} as const;
