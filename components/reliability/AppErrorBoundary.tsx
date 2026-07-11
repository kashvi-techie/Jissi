import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { AppText, GlassSurface, PressableScale } from '@/components/ui';
import { Radii, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme';

interface AppErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundaryInner extends React.Component<React.PropsWithChildren<{ accent: string }>, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Production reliability: keep crashes visible in native logs without
    // exposing stack traces in the app UI.
    console.error('[JISSI] Unhandled UI error', error, info.componentStack);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.root}>
        <GlassSurface intensity={38} radius={Radii.xxl} strong style={styles.card}>
          <View style={[styles.icon, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <AlertTriangle size={28} color={this.props.accent} strokeWidth={1.8} />
          </View>
          <AppText variant="title" color="primary" style={styles.center}>
            JISSI needed a quick reset.
          </AppText>
          <AppText variant="body" color="muted" style={styles.center}>
            Your local data is safe. Try reopening this screen.
          </AppText>
          <PressableScale onPress={this.retry} accessibilityRole="button" accessibilityLabel="Retry JISSI screen" style={styles.button}>
            <AppText variant="bodyStrong" color="onAccent">
              Try again
            </AppText>
          </PressableScale>
        </GlassSurface>
      </View>
    );
  }
}

export function AppErrorBoundary({ children }: React.PropsWithChildren) {
  const theme = useTheme();
  return <AppErrorBoundaryInner accent={theme.colors.accent}>{children}</AppErrorBoundaryInner>;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, backgroundColor: '#020712' },
  card: { width: '100%', maxWidth: 460, alignItems: 'center', gap: Spacing.md, padding: Spacing.xl },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  button: { marginTop: Spacing.sm, minHeight: 48, borderRadius: Radii.pill, paddingHorizontal: Spacing.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5DDCFF' },
});
