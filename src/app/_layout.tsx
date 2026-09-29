import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_500Medium_Italic,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import * as Font from 'expo-font';
import { useFonts } from 'expo-font';
import { DefaultTheme, router, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { SkyScreen } from '@/components/sky/SkyScreen';
import { LaunchIntro } from '@/components/motion/LaunchIntro';
import { Text } from '@/components/Text';
import { ScreenViews, track } from '@/lib/analytics';
// Imported for its side effect: expo-location needs the geofencing task defined at module scope,
// before any arrival event can reach the app.
import '@/lib/arrival';
import { GroupScripts } from '@/state/group';
import { TripsProvider } from '@/state/trips';
import { SkyPhaseProvider } from '@/state/sky';
import { SKY, skyInk } from '@/theme/sky';
import { space } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DefaultTheme,
  // Navigation's own backing (behind screens, under the tab bar): the sky's deep blue and white type.
  colors: { ...DefaultTheme.colors, background: SKY.night.stops[1], card: SKY.night.stops[1], primary: skyInk.strong, text: skyInk.strong },
};

// Every screen draws its own sky; behind them, and behind a sheet before it draws, is the sky's
// deep blue, never cream, so no white flashes between screens.
const SHEET_BG = SKY.night.stops[1];

export default function RootLayout() {
  const [loaded] = useFonts({
    PlusJakartaSans_500Medium,
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
    if (!loaded) return;
    SplashScreen.hideAsync();
    // Only the maps' sea names use the italic, so it doesn't hold up the first screen: it loads
    // just after. A map drawn before it arrives shows those few words upright for a moment.
    void Font.loadAsync({ PlusJakartaSans_500Medium_Italic }).catch(() => {});
  }, [loaded]);

  if (!loaded || !inBrowser) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: SHEET_BG }}>
      <ThemeProvider value={theme}>
        <TripsProvider>
          <SkyPhaseProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: SHEET_BG },
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
            <Stack.Screen name="search" options={{ animation: 'fade' }} />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="terms" />
            <Stack.Screen name="trip/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="plan/[id]" />
            <Stack.Screen name="recap/[id]" options={{ animation: 'fade' }} />
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
                contentStyle: { backgroundColor: SHEET_BG },
              }}
            />
            <Stack.Screen
              name="vote/[id]"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.92],
                sheetGrabberVisible: true,
                sheetCornerRadius: 32,
                contentStyle: { backgroundColor: SHEET_BG },
              }}
            />
            <Stack.Screen
              name="place/[id]"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.72],
                sheetGrabberVisible: true,
                sheetCornerRadius: 32,
                contentStyle: { backgroundColor: SHEET_BG },
              }}
            />
          </Stack>
          <GroupScripts />
          <ScreenViews />
          {intro && !reduced ? <LaunchIntro onDone={() => setIntro(false)} /> : null}
          </SkyPhaseProvider>
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
    <SkyScreen style={crash.fill}>
      <Text variant="headline" accessibilityRole="header" style={crash.center}>
        Something went wrong
      </Text>
      <Text variant="body" style={crash.center}>
        Your saved places and plans are safe. Try again, or start from home.
      </Text>
      <View style={crash.actions}>
        <Button label="Try again" onPress={() => void retry()} />
        <Button kind="text" label="Go home" onPress={home} />
      </View>
    </SkyScreen>
  );
}

const crash = StyleSheet.create({
  fill: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: space.screen },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', marginTop: 18, gap: 4 },
});
