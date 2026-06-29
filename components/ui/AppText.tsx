import React from 'react';
import { StyleProp, Text, TextProps, TextStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Typography, TypographyVariant } from '@/theme/typography';

type SemanticColor = 'primary' | 'secondary' | 'muted' | 'tertiary' | 'accent' | 'onAccent';

interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  /** A semantic theme colour, or any raw colour string. */
  color?: SemanticColor | string;
  uppercase?: boolean;
  style?: StyleProp<TextStyle>;
}

/**
 * Typographic text bound to the design system. Resolves a semantic colour from
 * the active theme (or accepts a raw colour), so screens never hard-code hex.
 */
export function AppText({ variant = 'body', color = 'primary', uppercase, style, children, ...rest }: AppTextProps) {
  const theme = useTheme();
  const semantic: Record<SemanticColor, string> = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    muted: theme.colors.textMuted,
    tertiary: theme.colors.textTertiary,
    accent: theme.colors.accent,
    onAccent: theme.colors.textOnAccent,
  };
  const resolved = (semantic as Record<string, string>)[color] ?? color;
  return (
    <Text
      {...rest}
      style={[Typography[variant], { color: resolved }, uppercase ? { textTransform: 'uppercase' } : null, style]}
    >
      {children}
    </Text>
  );
}
