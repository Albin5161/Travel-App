import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { TripsProvider } from '@/state/trips';
import { light } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: light.canvas, card: light.canvas, primary: light.ink, text: light.ink },
};

export default function RootLayout() {
  const [loaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
  });
  const reduced = useReducedMotion();

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
            <Stack.Screen name="index" />
            <Stack.Screen name="analysing" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="city/[id]" options={{ animation: 'fade' }} />
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
        </TripsProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
