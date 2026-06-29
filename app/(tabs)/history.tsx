import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Clock } from 'lucide-react-native';
import { Screen, GlassSurface, AppText } from '@/components/ui';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

export default function HistoryScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  return (
    <Screen>
      <View style={[styles.center, isWide && styles.centerWide]}>
        <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
          <Clock size={30} color={theme.colors.textSecondary} strokeWidth={1.5} />
        </GlassSurface>
        <AppText variant="headline" color="primary" style={styles.title}>
          History
        </AppText>
        <AppText variant="body" color="muted" style={styles.sub}>
          Your conversations will live here.
        </AppText>
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
});
