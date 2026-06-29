import React from 'react';
import { SafeAreaView, StatusBar, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, useThemeMode } from '@/theme';
import { Spacing } from '@/theme/tokens';

interface ScreenProps {
  children: React.ReactNode;
  /** Apply the default horizontal gutter. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Themed screen shell: an ambient background gradient + safe area + the right
 * status-bar style for the active mode. Every screen renders inside this.
 */
export function Screen({ children, padded = true, style }: ScreenProps) {
  const theme = useTheme();
  const { mode } = useThemeMode();
  return (
    <View style={styles.root}>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <LinearGradient
        colors={theme.gradients.background}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={[styles.safe, padded ? { paddingHorizontal: Spacing.gutter } : null, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
});
