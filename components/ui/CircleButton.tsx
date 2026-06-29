import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { GlassSurface } from './GlassSurface';
import { PressableScale } from './PressableScale';
import { useTheme } from '@/theme';
import { Radii } from '@/theme/tokens';

interface CircleButtonProps {
  icon: LucideIcon;
  onPress?: () => void;
  /** Outer diameter. */
  size?: number;
  iconSize?: number;
  /** Highlight (accent border + accent glyph) when true. */
  active?: boolean;
  /** Override the glyph colour (e.g. error red for Stop). */
  tint?: string;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A small round frosted-glass icon button — the auxiliary control next to the
 * voice button (keyboard, stop) and in the header (sparkle, theme). Presentation
 * only; behaviour comes from `onPress`.
 */
export function CircleButton({
  icon: Icon,
  onPress,
  size = 46,
  iconSize = 20,
  active = false,
  tint,
  disabled = false,
  accessibilityLabel,
  style,
}: CircleButtonProps) {
  const theme = useTheme();
  const glyph = tint ?? (active ? theme.colors.accent : theme.colors.textSecondary);
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <GlassSurface
        intensity={28}
        radius={Radii.pill}
        style={[
          styles.btn,
          { width: size, height: size, opacity: disabled ? 0.4 : 1 },
          active && { borderColor: theme.colors.accent },
        ]}
      >
        <Icon size={iconSize} color={glyph} strokeWidth={1.9} />
      </GlassSurface>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center' },
});
