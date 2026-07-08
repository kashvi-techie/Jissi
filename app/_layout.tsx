import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
import { ThemeProvider } from '@/theme';
// Side-effect: installs built-in tools + bridges them into AIService (dormant
// until EXPO_PUBLIC_TOOLS_ENABLED=true). No runtime effect while the flag is off.
import '@/services/tools/register';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useFrameworkReady();

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
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider>
      <AssistantProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="behavior-debug" options={{ headerShown: false }} />
          <Stack.Screen name="context-debug" options={{ headerShown: false }} />
          <Stack.Screen name="emotion-debug" options={{ headerShown: false }} />
          <Stack.Screen name="planner-debug" options={{ headerShown: false }} />
          <Stack.Screen name="proactive-debug" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="light" />
        <FloatingOrbOverlay />
      </AssistantProvider>
    </ThemeProvider>
  );
}
