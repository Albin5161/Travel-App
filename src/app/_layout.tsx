import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_500Medium_Italic,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { DefaultTheme, router, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { LaunchIntro } from '@/components/motion/LaunchIntro';
import { Text } from '@/components/Text';
import { ScreenViews, track } from '@/lib/analytics';
// Imported for its side effect: expo-location needs the geofencing task defined at module scope,
// before any arrival event can reach the app.
import '@/lib/arrival';
import { GroupScripts } from '@/state/group';
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
  const inBrowser = useInBrowser();
  // The opening animation plays once per launch, over home; skipped with Reduce Motion.
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded || !inBrowser) return null;

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
            {/* No edge swipe: it would fight the card swipe, and leaving mid-check saves nothing. */}
            <Stack.Screen name="verify" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="addplaces" options={{ animation: 'fade', gestureEnabled: false }} />
            {/* Home's card grows into this page itself (CityOpenOverlay), so the screen doesn't animate.
                The edge swipe is off because it would slide the page away instead of shrinking it. */}
            <Stack.Screen name="city/[id]" options={{ animation: 'none', gestureEnabled: false }} />
            <Stack.Screen name="citymap/[id]" options={{ animation: 'fade' }} />
            {/* Questions before a plan: its own back handling steps through them, so no edge swipe. */}
            <Stack.Screen name="credits" />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="terms" />
            <Stack.Screen name="trip/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="plan/[id]" />
            <Stack.Screen name="share/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="group/[id]" />
            <Stack.Screen name="join" options={{ animation: 'fade' }} />
            <Stack.Screen name="join/[code]" options={{ animation: 'fade' }} />
            <Stack.Screen
              name="addstop/[id]"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.86],
                sheetGrabberVisible: true,
                sheetCornerRadius: 32,
                contentStyle: { backgroundColor: light.panel },
              }}
            />
            <Stack.Screen
              name="vote/[id]"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.92],
                sheetGrabberVisible: true,
                sheetCornerRadius: 32,
                contentStyle: { backgroundColor: light.panel },
              }}
            />
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
          <GroupScripts />
          <ScreenViews />
          {intro && !reduced ? <LaunchIntro onDone={() => setIntro(false)} /> : null}
        </TripsProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/**
 * If anything crashes, this instead of a blank page. Trips and places are saved on the phone as they
 * change, so starting again from home loses nothing but the screen you were on.
 */
/**
 * On the web each page is also built ahead of time as HTML, where there's no screen: every size
 * reads 0 there, and when the browser takes that HTML over, React keeps sizes it finds in it rather
 * than correcting them. Opened directly (a reload, a reopened tab), the intro came out 0 wide, one
 * letter per line. So the app draws nothing in that HTML, and draws itself once it's running in the
 * browser, with the real screen. The fonts load in that moment anyway; nothing shows any later.
 */
const noSubscribe = () => () => {};
function useInBrowser() {
  return useSyncExternalStore(noSubscribe, () => true, () => Platform.OS !== 'web');
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    track('app crashed', { kind: error.name || 'Error' });
  }, [error]);
  const home = () => {
    // On the web a fresh load is the surest reset; the saved trips come back from storage.
    if (Platform.OS === 'web') window.location.assign('/');
    else {
      router.replace('/');
      void retry();
    }
  };
  return (
    <View style={crash.fill}>
      <Text variant="headline" style={crash.center}>
        Something went wrong
      </Text>
      <Text variant="body" color={light.inkSoft} style={crash.center}>
        Your saved places and plans are safe. Try again, or start from home.
      </Text>
      <View style={crash.actions}>
        <Button label="Try again" onPress={() => void retry()} />
        <Button kind="text" label="Go home" onPress={home} />
      </View>
    </View>
  );
}

const crash = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32, backgroundColor: light.canvas },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', marginTop: 18, gap: 4 },
});
