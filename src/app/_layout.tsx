import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_500Medium_Italic,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { LaunchIntro } from '@/components/motion/LaunchIntro';
// Imported for its side effect: expo-location needs the geofencing task defined at module scope,
// before any arrival event can reach the app.
import '@/lib/arrival';
import { TripsProvider } from '@/state/trips';
import { light } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: light.canvas, card: light.canvas, primary: light.ink, text: light.ink },
};

export default function RootLayout() {
  const [loaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_500Medium_Italic,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
  });
  const reduced = useReducedMotion();
  // The opening animation plays once per launch, over home; skipped with Reduce Motion.
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: light.canvas }}>
      <ThemeProvider value={theme}>
        <TripsProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: light.canvas },
              animation: reduced ? 'fade' : 'default',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="analysing" options={{ animation: 'fade', gestureEnabled: false }} />
            {/* Home's card grows into this page itself (CityOpenOverlay), so the screen doesn't animate.
                The edge swipe is off because it would slide the page away instead of shrinking it. */}
            <Stack.Screen name="city/[id]" options={{ animation: 'none', gestureEnabled: false }} />
            <Stack.Screen name="citymap/[id]" options={{ animation: 'fade' }} />
            <Stack.Screen name="pick/[id]" />
            <Stack.Screen name="plan/[id]" />
            <Stack.Screen
              name="place/[id]"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.72],
                sheetGrabberVisible: true,
                sheetCornerRadius: 32,
                contentStyle: { backgroundColor: light.panel },
              }}
            />
          </Stack>
          {intro && !reduced ? <LaunchIntro onDone={() => setIntro(false)} /> : null}
        </TripsProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
