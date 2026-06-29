import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Blur, Radii, Spacing } from '@/theme/tokens';
import { GlassSurface } from './GlassSurface';

interface GlassCardProps {
  children?: React.ReactNode;
  padding?: number;
  radius?: number;
  intensity?: number;
  /** Use the larger floating shadow instead of the resting card shadow. */
  floating?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A floating frosted card: theme shadow on the outer View (so it isn't clipped),
 * frosted glass + padding on the inner surface. The default premium container.
 */
export function GlassCard({
  children,
  padding = Spacing.xl,
  radius = Radii.xl,
  intensity = Blur.heavy,
  floating = false,
  style,
}: GlassCardProps) {
  const theme = useTheme();
  return (
    <View style={[floating ? theme.shadows.floating : theme.shadows.card, { borderRadius: radius }, style]}>
      <GlassSurface intensity={intensity} radius={radius} strong style={{ padding }}>
        {children}
      </GlassSurface>
    </View>
  );
}
