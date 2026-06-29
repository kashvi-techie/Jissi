import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Moon, Sun, User } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { useTheme, useThemeMode } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  const theme = useTheme();
  const { mode, toggle } = useThemeMode();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  return (
    <Screen>
      <View style={[styles.center, isWide && styles.centerWide]}>
        <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
          <User size={30} color={theme.colors.textSecondary} strokeWidth={1.5} />
        </GlassSurface>
        <AppText variant="headline" color="primary" style={styles.title}>
          Kashvi
        </AppText>
        <AppText variant="body" color="muted" style={styles.sub}>
          Creator of JISSI
        </AppText>

        <PressableScale onPress={toggle} accessibilityRole="button" accessibilityLabel="Toggle appearance" style={styles.rowWrap}>
          <GlassSurface intensity={36} radius={Radii.lg} style={styles.row}>
            {mode === 'dark' ? (
              <Sun size={20} color={theme.colors.textSecondary} strokeWidth={1.8} />
            ) : (
              <Moon size={20} color={theme.colors.textSecondary} strokeWidth={1.8} />
            )}
            <AppText variant="bodyStrong" color="primary" style={{ flex: 1 }}>
              Appearance
            </AppText>
            <AppText variant="bodyStrong" color="accent">
              {mode === 'dark' ? 'Dark' : 'Light'}
            </AppText>
          </GlassSurface>
        </PressableScale>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  centerWide: { maxWidth: 720, alignSelf: 'center', width: '100%' },
  badge: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: Spacing.sm },
  sub: { textAlign: 'center' },
  rowWrap: { alignSelf: 'stretch', marginTop: Spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
});
