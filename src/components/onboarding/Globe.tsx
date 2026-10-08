import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

const OCEAN = require('../../../assets/images/intro/earth-ocean.png');
const LAND = require('../../../assets/images/intro/earth-land.png');
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
  return (
    <View style={{ width: size, height: size }}>
      <Image source={OCEAN} style={StyleSheet.absoluteFill} contentFit="fill" transition={0} />
      <Animated.View style={[StyleSheet.absoluteFill, land]}>
        <Image source={LAND} style={StyleSheet.absoluteFill} contentFit="fill" transition={0} />
        {children}
      </Animated.View>
      <Image source={SHADE} style={StyleSheet.absoluteFill} contentFit="fill" transition={0} pointerEvents="none" />
    </View>
  );
}
