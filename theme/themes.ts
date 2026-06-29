import { ViewStyle } from 'react-native';

/**
 * JISSI Design System — themed tokens.
 *
 * Philosophy (v2): RESTRAINT. Pitch-black (dark) or pearl-white (light) negative
 * space, one intentional accent, the orb as the only light source. Glass is an
 * accent material, not a background. No gradients-everywhere.
 *
 * Two modes: `dark` (deep space, soft purple bloom, electric blue) and `light`
 * (Apple pearl, silver, blue plasma). Semantic only — screens never touch hex.
 */
export type ThemeMode = 'dark' | 'light';
export type BlurTint = 'light' | 'dark' | 'default';

type Gradient = readonly [string, string, ...string[]];

export interface Theme {
  mode: ThemeMode;
  colors: {
    bg: string;
    bgElevated: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textTertiary: string;
    textOnAccent: string;
    accent: string;
    accentSoft: string;
    /** Secondary brand hue (indigo) — used in gradients alongside `accent`. */
    accentAlt: string;
    /** Plasma glow (violet) — heavy-glow accents on active elements. */
    glow: string;
    /** Electric blue — waveform / plasma highlights. */
    blue: string;
    hairline: string;
    /** Subtle fill for chips / pressed states. */
    fill: string;
    /** Ambient light the orb casts onto nearby UI. */
    orbLight: string;
    // assistant phase colours
    idle: string;
    listening: string;
    thinking: string;
    speaking: string;
    error: string;
  };
  gradients: {
    background: Gradient;
    orbCore: Gradient;
    orbHalo: string;
    accent: Gradient;
    bubbleUser: Gradient;
  };
  glass: {
    fill: string;
    fillStrong: string;
    border: string;
    highlight: string;
    blurTint: BlurTint;
  };
  shadows: {
    card: ViewStyle;
    floating: ViewStyle;
    orbGlow: ViewStyle;
  };
}

export const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    bg: '#0A0A0D',
    bgElevated: '#141418',
    surface: '#16161B',
    textPrimary: '#F2F2F5',
    textSecondary: '#A6A6B2',
    textMuted: '#6E6E7A',
    textTertiary: '#42424C',
    textOnAccent: '#FFFFFF',
    accent: '#7C8CFF',
    accentSoft: 'rgba(124,140,255,0.14)',
    accentAlt: '#9B6CFF',
    glow: '#8B7CFF',
    blue: '#60A5FA',
    hairline: 'rgba(255,255,255,0.07)',
    fill: 'rgba(255,255,255,0.045)',
    orbLight: 'rgba(124,140,255,0.20)',
    idle: '#7A7A86',
    listening: '#7C8CFF',
    thinking: '#9B6CFF',
    speaking: '#60A5FA',
    error: '#FF6B6B',
  },
  gradients: {
    background: ['#101014', '#0A0A0D', '#070708'],
    orbCore: ['#CFE3FF', '#6E7BFF', '#3A1A5E'],
    orbHalo: 'rgba(124,124,255,0.30)',
    accent: ['#7C8CFF', '#9B6CFF'],
    bubbleUser: ['#7C8CFF', '#9B6CFF'],
  },
  glass: {
    fill: 'rgba(255,255,255,0.04)',
    fillStrong: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.08)',
    highlight: 'rgba(255,255,255,0.12)',
    blurTint: 'dark',
  },
  shadows: {
    card: { shadowColor: '#000000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 10 },
    floating: { shadowColor: '#000000', shadowOpacity: 0.6, shadowRadius: 34, shadowOffset: { width: 0, height: 22 }, elevation: 18 },
    orbGlow: { shadowColor: '#8B7CFF', shadowOpacity: 0.5, shadowRadius: 60, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  },
};

export const lightTheme: Theme = {
  mode: 'light',
  colors: {
    bg: '#FBFBFD',
    bgElevated: '#FFFFFF',
    surface: '#F2F2F8',
    textPrimary: '#1C1C1E',
    textSecondary: '#5B5B63',
    textMuted: '#86868B',
    textTertiary: '#AEAEB4',
    textOnAccent: '#FFFFFF',
    accent: '#5B6CFF',
    accentSoft: 'rgba(91,108,255,0.10)',
    accentAlt: '#9B6CFF',
    glow: '#8B7CFF',
    blue: '#60A5FA',
    hairline: 'rgba(0,0,0,0.07)',
    fill: 'rgba(0,0,0,0.04)',
    orbLight: 'rgba(124,124,255,0.16)',
    idle: '#9A9AA0',
    listening: '#5B6CFF',
    thinking: '#9B6CFF',
    speaking: '#3B82F6',
    error: '#F0506E',
  },
  gradients: {
    background: ['#FFFFFF', '#FAFAFC', '#F1F1FA'],
    orbCore: ['#E6ECFF', '#6E7BFF', '#3A1A5E'],
    orbHalo: 'rgba(124,124,255,0.24)',
    accent: ['#5B6CFF', '#9B6CFF'],
    bubbleUser: ['#5B6CFF', '#9B6CFF'],
  },
  glass: {
    fill: 'rgba(255,255,255,0.6)',
    fillStrong: 'rgba(255,255,255,0.78)',
    border: 'rgba(0,0,0,0.05)',
    highlight: 'rgba(255,255,255,0.9)',
    blurTint: 'light',
  },
  shadows: {
    card: { shadowColor: '#3A3D52', shadowOpacity: 0.08, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
    floating: { shadowColor: '#3A3D52', shadowOpacity: 0.12, shadowRadius: 32, shadowOffset: { width: 0, height: 16 }, elevation: 10 },
    orbGlow: { shadowColor: '#8B7CFF', shadowOpacity: 0.4, shadowRadius: 54, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  },
};

export const themes: Record<ThemeMode, Theme> = { dark: darkTheme, light: lightTheme };
