import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

// The Earth from space (NASA's Blue Marble, made by scripts/intro-earth.py). It grows some thirty
// times over on its way into the map, so phones also get the middle of it four times finer, laid
// over the whole. A browser scales the picture it has already drawn, so the web keeps the one.
const DAY =
  Platform.OS === 'web'
    ? require('../../../assets/images/intro/earth-day-web.jpg')
    : require('../../../assets/images/intro/earth-day.jpg');
const NEAR_PIC = Platform.OS === 'web' ? null : require('../../../assets/images/intro/earth-near.webp');
/** How much of the picture's width the close-up covers, about its middle. */
const NEAR = 0.25;
const SHADE = require('../../../assets/images/intro/earth-shade.png');
/** The glow of the air, in a box twice the Earth's. */
const AIR = require('../../../assets/images/intro/earth-air.png');

/** Where the picture looks: the middle of India. */
export const GLOBE_CENTRE = { lng: 80, lat: 16 };
/** The art keeps this much of its box clear around the disc. */
const RIM = 4 / 300;
/** The Earth's radius, in metres. */
export const EARTH_RADIUS = 6_371_000;
/** How big the Earth's disc is in a globe `size` across, as a radius in points. */
export const discRadius = (size: number) => size / 2 - size * RIM;

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
 * The Earth, cheap enough to move on any phone: still pictures. The light on it stays put; under
 * the light the Earth turns as one piece about the middle of the disc (`turn`, in degrees). It is
 * one true picture of that side of the Earth the whole time, so nothing has to be swapped for
 * anything as it comes to rest. Children turn with it: a mark put on a place stays on it.
 */
export function Globe({
  size,
  turn,
  detail,
  children,
}: {
  size: number;
  turn: SharedValue<number>;
  /** How much of the close-up shows, 0 to 1. Shrunk to the Earth at rest its fine grain reads a
   * shade lighter than the whole picture, at a seam, so it comes in as the zoom starts. */
  detail?: SharedValue<number>;
  children?: ReactNode;
}) {
  const earth = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));
  const nearStyle = useAnimatedStyle(() => ({ opacity: detail ? detail.get() : 1 }));
  // The Earth's edge is drawn, not painted: where the Earth is shown several times its size (the
  // horizon under the first button) a picture's own round edge came out in steps. The pictures
  // are cut by a circle a hair inside that edge instead, which stays a clean line at any size.
  const inset = size * RIM + 0.75;
  const disc = size - inset * 2;
  const whole = { left: -inset, top: -inset, width: size, height: size } as const;
  const near = { left: (size * (1 - NEAR)) / 2 - inset, top: (size * (1 - NEAR)) / 2 - inset, width: size * NEAR, height: size * NEAR } as const;
  return (
    <View style={{ width: size, height: size }}>
      <Image source={AIR} style={[styles.layer, { left: size / 2 - disc, top: size / 2 - disc, width: disc * 2, height: disc * 2 }]} contentFit="fill" transition={0} pointerEvents="none" />
      <View style={[styles.disc, { left: inset, top: inset, width: disc, height: disc, borderRadius: disc / 2 }]}>
        <Animated.View style={[styles.layer, whole, earth]}>
          <Image source={DAY} style={StyleSheet.absoluteFill} contentFit="fill" transition={0} />
          {NEAR_PIC ? (
            <Animated.View style={[styles.layer, near, nearStyle]}>
              <Image source={NEAR_PIC} style={StyleSheet.absoluteFill} contentFit="fill" transition={0} />
            </Animated.View>
          ) : null}
          {children}
        </Animated.View>
        <Image source={SHADE} style={[styles.layer, whole]} contentFit="fill" transition={0} pointerEvents="none" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { position: 'absolute', overflow: 'hidden', backgroundColor: '#0E162C' },
  layer: { position: 'absolute' },
});
