import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { LatLng } from '@/lib/geo';
import type { SkyPhase } from '@/lib/sun';
import { useSkyPhase } from '@/state/sky';
import { SKY } from '@/theme/sky';
import { Tone } from '@/theme/tone';

import { Sky } from './Sky';

const PhaseContext = createContext<SkyPhase>('day');

/** The sky behind the current screen, for glass that wants to tint itself to match. */
export const useScreenSky = () => SKY[useContext(PhaseContext)];

type Props = {
  /** A screen about one place shows the sky over that place; otherwise the sky at home. */
  place?: LatLng | null;
  /** Darkens the lower part of the sky, where a screen sets long reading text. */
  shade?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * A screen set on the sky: the sky behind, white type (the "sky" tone) and a light status bar
 * while it's in front.
 */
export function SkyScreen({ place, shade, style, children }: Props) {
  const phase = useSkyPhase(place);
  useFocusEffect(lightStatusBar);
  return (
    <PhaseContext.Provider value={phase}>
      <Tone value="sky">
        <View style={[styles.fill, style]}>
          <Sky phase={phase} shade={shade} />
          {children}
        </View>
      </Tone>
    </PhaseContext.Provider>
  );
}

/** White status bar over the sky; whatever comes next sets its own. */
function lightStatusBar() {
  setStatusBarStyle('light');
  return () => setStatusBarStyle('dark');
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
