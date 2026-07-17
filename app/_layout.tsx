import { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts } from 'expo-font';
import {
  Exo2_400Regular,
  Exo2_700Bold,
  Exo2_600SemiBold,
} from '@expo-google-fonts/exo-2';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { AssistantProvider } from '@/services/AssistantContext';
import { FloatingOrbOverlay } from '@/components/FloatingOrbOverlay';
import { AppErrorBoundary } from '@/components/reliability/AppErrorBoundary';
import { ThemeProvider } from '@/theme';
// Side-effect: installs built-in tools + bridges them into AIService (dormant
// until EXPO_PUBLIC_TOOLS_ENABLED=true). No runtime effect while the flag is off.
import '@/services/tools/register';


SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn('[JISSI] Splash preventAutoHide failed', error);
});

const STARTUP_TIMEOUT_MS = 3000;

export default function RootLayout() {
  useFrameworkReady();
  const splashHiddenRef = useRef(false);
  const [startupReady, setStartupReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

  const [fontsLoaded, fontError] = useFonts({
    Exo2_400Regular,
    Exo2_700Bold,
    Exo2_600SemiBold,
    Inter_300Light,
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setStartupError((current) => current ?? 'Startup took longer than expected.');
      setStartupReady(true);
    }, STARTUP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (fontError) {
      console.warn('[JISSI] Font loading failed; continuing startup with system fonts.', fontError);
      setStartupError('Fonts could not finish loading, so JISSI started with system fonts.');
    }
    if (fontsLoaded || fontError) {
      setStartupReady(true);
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (!startupReady || splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch((error) => {
      console.warn('[JISSI] Splash hide failed', error);
    });
  }, [startupReady]);

  if (!startupReady) {
    return <StartupFallback message="Starting JISSI..." />;
  }

  if (startupError && !fontsLoaded && !fontError) {
    return <StartupFallback message="JISSI is starting with a lighter boot path." />;
  }

  return (
    <ThemeProvider>
      <AppErrorBoundary>
        <AssistantProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="timeline" options={{ headerShown: false }} />
            <Stack.Screen name="conversation-debug" options={{ headerShown: false }} />
            <Stack.Screen name="conversation-stream-debug" options={{ headerShown: false }} />
            <Stack.Screen name="human-conversation-debug" options={{ headerShown: false }} />
            <Stack.Screen name="notifications-debug" options={{ headerShown: false }} />
            <Stack.Screen name="orchestrator-debug" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="light" />
          <FloatingOrbOverlay />
        </AssistantProvider>
      </AppErrorBoundary>
    </ThemeProvider>
  );
}

function StartupFallback({ message }: { message: string }) {
  return (
    <View style={styles.startupRoot}>
      <View style={styles.startupOrb} />
      <Text style={styles.startupText}>{message}</Text>
      <View style={styles.startupLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  startupRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, backgroundColor: '#020712' },
  startupOrb: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#5DDCFF',
    shadowColor: '#5DDCFF',
    shadowOpacity: 0.58,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
  },
  startupText: { color: 'rgba(255,255,255,0.72)', fontSize: 15, letterSpacing: 0, textAlign: 'center' },
  startupLine: { width: 132, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' },
});
