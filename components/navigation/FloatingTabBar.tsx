import React from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, User } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { PressableScale } from '@/components/ui';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

/** Minimal structural shape of the bits we use from the bottom-tab navigator. */
interface FloatingTabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
}

/**
 * Floating pill tab bar: History · the JISSI orb · Profile. The centre orb is the
 * home/assistant launcher. Pure presentation over the existing tab routes — the
 * route structure and navigation are unchanged.
 */
export function FloatingTabBar({ state, navigation }: FloatingTabBarProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const current = state.routes[state.index]?.name;
  const go = (name: string) => navigation.navigate(name);

  // Mobile Home is the full-screen talk view (reference 1) — no bottom nav there.
  // The bottom bar still appears on History / Profile (and on wide screens).
  if (current === 'index' && width < 900) return null;

  const side = (name: string, Icon: LucideIcon, label: string) => {
    const focused = current === name;
    return (
      <PressableScale onPress={() => go(name)} accessibilityRole="button" accessibilityLabel={label} style={styles.side}>
        <Icon
          size={22}
          color={focused ? theme.colors.accent : theme.colors.textMuted}
          strokeWidth={focused ? 2.2 : 1.8}
        />
      </PressableScale>
    );
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BlurView
        intensity={36}
        tint={theme.glass.blurTint}
        style={[styles.bar, { borderColor: theme.colors.hairline, backgroundColor: theme.glass.fill }]}
      >
        {side('history', Clock, 'History')}

        <PressableScale onPress={() => go('index')} accessibilityRole="button" accessibilityLabel="Home" style={styles.centerWrap}>
          <LinearGradient
            colors={theme.gradients.accent}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[styles.orb, theme.shadows.orbGlow]}
          >
            <View style={styles.orbHighlight} />
          </LinearGradient>
        </PressableScale>

        {side('profile', User, 'Profile')}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 6, paddingBottom: Platform.OS === 'ios' ? 28 : 16 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxxl,
    paddingHorizontal: Spacing.xxl,
    height: 64,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
    overflow: 'hidden',
  },
  side: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  centerWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  orb: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  orbHighlight: {
    position: 'absolute',
    top: 9,
    left: 12,
    width: 16,
    height: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});
