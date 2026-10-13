import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

const OCEAN = require('../../../assets/images/intro/earth-ocean.png');
// The Earth grows some fifty times over on its way into the map. On a phone the small land picture
// broke into blocks at that size, so phones get it four times finer (scripts/fine-earth-land.py).
// A browser scales the picture it has already drawn, so the web keeps the small, quick one.
const LAND =
  Platform.OS === 'web'
    ? require('../../../assets/images/intro/earth-land.png')
    : require('../../../assets/images/intro/earth-land-fine.png');
const SHADE = require('../../../assets/images/intro/earth-shade.png');

/** Where the picture looks: the middle of India. */
export const GLOBE_CENTRE = { lng: 80, lat: 16 };
/** The art keeps this much of its box clear around the disc. */
const RIM = 4 / 300;

/** Where a place sits on the globe, as an offset from its centre, in points. */
export function onGlobe(at: { lat: number; lng: number }, size: number) {
  const r = size / 2 - size * RIM;
  const rad = Math.PI / 180;
  const dl = (at.lng - GLOBE_CENTRE.lng) * rad;
  const p = at.lat * rad;
  const p0 = GLOBE_CENTRE.lat * rad;
  return {
    x: r * Math.cos(p) * Math.sin(dl),
    y: -r * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(dl)),
  };
}

/**
 * The Earth, cheap enough to move on any phone: three still pictures. The sea and the light on it
 * stay put; between them the land turns as one piece about the middle of the disc (`turn`, in
 * degrees). It is one true picture of that side of the Earth the whole time, so nothing has to be
 * swapped for anything as it comes to rest. Children turn with the land: a mark put on a place
 * stays on it.
 */
export function Globe({ size, turn, children }: { size: number; turn: SharedValue<number>; children?: ReactNode }) {
  const land = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));
  // The Earth's edge is drawn, not painted: the sea and light pictures are small, and where the
  // Earth is shown several times its size (the horizon under the first button) their own round
  // edge came out in steps. The pictures are cut by a circle a hair inside that edge instead, which
  // stays a clean line at any size. A thin pale ring stands in for the glow that was in the picture.
  const inset = size * RIM + 0.75;
  const disc = size - inset * 2;
  const whole = { left: -inset, top: -inset, width: size, height: size } as const;
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.disc, { left: inset, top: inset, width: disc, height: disc, borderRadius: disc / 2 }]}>
        <Image source={OCEAN} style={[styles.layer, whole]} contentFit="fill" transition={0} />
        <Animated.View style={[styles.layer, whole, land]}>
          <Image source={LAND} style={StyleSheet.absoluteFill} contentFit="fill" transition={0} />
          {children}
        </Animated.View>
        <Image source={SHADE} style={[styles.layer, whole]} contentFit="fill" transition={0} pointerEvents="none" />
      </View>
      <View style={[styles.glow, { left: inset - 1, top: inset - 1, width: disc + 2, height: disc + 2, borderRadius: disc / 2 + 1 }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { position: 'absolute', overflow: 'hidden' },
  layer: { position: 'absolute' },
  glow: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
});
