import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/theme';
import { Blur, Radii } from '@/theme/tokens';

interface GlassSurfaceProps {
  children?: React.ReactNode;
  /** expo-blur intensity (defaults to the regular blur token). */
  intensity?: number;
  radius?: number;
  /** Use the stronger frosted fill (for focal surfaces). */
  strong?: boolean;
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The atomic frosted-glass surface: a themed `BlurView` with a translucent fill
 * and a hairline border. `overflow: hidden` clips the blur to the radius — so
 * any shadow must live on a parent (see `GlassCard`).
 */
export function GlassSurface({
  children,
  intensity = Blur.regular,
  radius = Radii.lg,
  strong = false,
  bordered = true,
  style,
}: GlassSurfaceProps) {
  const theme = useTheme();
  return (
    <BlurView
      intensity={intensity}
      tint={theme.glass.blurTint}
      style={[
        styles.base,
        {
          borderRadius: radius,
          backgroundColor: strong ? theme.glass.fillStrong : theme.glass.fill,
          borderColor: theme.glass.border,
          borderWidth: bordered ? StyleSheet.hairlineWidth * 1.5 : 0,
        },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
