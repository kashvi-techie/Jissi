import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Radii } from '@/theme/tokens';

interface SurfaceProps {
  children?: React.ReactNode;
  radius?: number;
  /** Use the elevated background (for cards that sit above the base surface). */
  raised?: boolean;
  bordered?: boolean;
  floating?: boolean;
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Solid material container — the DEFAULT surface in the restrained system.
 * Opaque fill + hairline + soft shadow (no blur). Reach for `GlassSurface` only
 * when a translucent material is genuinely the right call (overlays, the dock).
 */
export function Surface({
  children,
  radius = Radii.xl,
  raised = false,
  bordered = true,
  floating = false,
  padding,
  style,
}: SurfaceProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: raised ? theme.colors.bgElevated : theme.colors.surface,
          borderRadius: radius,
          borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
          borderColor: theme.colors.hairline,
          padding,
        },
        floating ? theme.shadows.floating : theme.shadows.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}
