import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import type { SkyPhase } from '@/lib/sun';
import { useHomeSky } from '@/state/sky';
import { SKY, skyBar } from '@/theme/sky';
import { Tone } from '@/theme/tone';

import { Sky } from './Sky';

const PhaseContext = createContext<SkyPhase>('day');

/** The sky behind the current screen, for glass that wants to tint itself to match. */
export const useScreenSky = () => SKY[useContext(PhaseContext)];

// On the web a pushed screen just appears (the native stack slides it in on phones). So there the
// content fades up each time its screen comes to the front, while the sky behind stays put: moving
// between screens reads as the same sky with new things on it.
const ENTER = Platform.OS === 'web';
// Long and soft enough to read as a glide, short enough never to make anyone wait: the content
// eases in along a gentle deceleration rather than snapping most of the way in the first frames.
const ENTER_MS = 420;
const ENTER_RISE = 12;
const ENTER_EASE = Easing.bezier(0.33, 0, 0.2, 1);

type Props = {
  /** Darkens the lower part of the sky, where a screen sets long reading text. */
  shade?: number;
  /** Off for a screen that arrives by its own animation (the city page grows out of its card). */
  enter?: boolean;
  /** Layout for the content (padding, alignment); the sky always fills the screen. */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * A screen set on the sky: the sky behind, white type (the "sky" tone), a light status bar while
 * it's in front, and a gentle fade-up of its content as it arrives.
 */
export function SkyScreen({ shade, enter = true, style, children }: Props) {
  const phase = useHomeSky();
  const reduced = useReducedMotion();
  const shown = useSharedValue(1);
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(skyBar);
      if (ENTER && enter && !reduced) {
        shown.set(0);
        shown.set(withTiming(1, { duration: ENTER_MS, easing: ENTER_EASE }));
      }
      return () => setStatusBarStyle('dark');
    }, [enter, reduced, shown]),
  );
  const arrive = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (1 - shown.get()) * ENTER_RISE }],
  }));
  return (
    <PhaseContext.Provider value={phase}>
      <Tone value="sky">
        <View style={styles.fill}>
          <Sky phase={phase} shade={shade} />
          <Animated.View style={[styles.fill, style, arrive]}>{children}</Animated.View>
        </View>
      </Tone>
    </PhaseContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
