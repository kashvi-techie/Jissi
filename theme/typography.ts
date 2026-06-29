/**
 * JISSI Design System — typography (v2, Apple-grade hierarchy).
 *
 * Exo-2 is reserved for the brand wordmark + the hero display line only. Inter
 * carries all real reading hierarchy (SF-like), with tight optical tracking on
 * large sizes and generous line-heights so nothing feels cramped.
 */
export const Fonts = {
  brand: 'Exo2_700Bold',
  brandSemi: 'Exo2_600SemiBold',
  brandRegular: 'Exo2_400Regular',
  /** Thin weight reserved for large, calm display text (hero status, greetings). */
  light: 'Inter_300Light',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export type TypographyVariant =
  | 'wordmark'
  | 'display'
  | 'headline'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'bodyStrong'
  | 'callout'
  | 'caption'
  | 'footnote'
  | 'label';

interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

export const Typography: Record<TypographyVariant, TypeStyle> = {
  /** The "JISSI" lock-up — wide tracked uppercase, Exo-2. */
  wordmark: { fontFamily: Fonts.brand, fontSize: 22, lineHeight: 26, letterSpacing: 6 },
  /** Hero line — large, thin, effortless. Spacing carries it, not weight. */
  display: { fontFamily: Fonts.light, fontSize: 40, lineHeight: 46, letterSpacing: -0.6 },
  headline: { fontFamily: Fonts.light, fontSize: 30, lineHeight: 36, letterSpacing: -0.4 },
  title: { fontFamily: Fonts.body, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  subtitle: { fontFamily: Fonts.body, fontSize: 16, lineHeight: 22, letterSpacing: 0.1 },
  body: { fontFamily: Fonts.body, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  bodyStrong: { fontFamily: Fonts.bodyMedium, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  callout: { fontFamily: Fonts.body, fontSize: 15, lineHeight: 21, letterSpacing: 0 },
  caption: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
  footnote: { fontFamily: Fonts.body, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  /** Micro uppercase labels (status, eyebrows). */
  label: { fontFamily: Fonts.bodyMedium, fontSize: 11, lineHeight: 14, letterSpacing: 1.4 },
};
