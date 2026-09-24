import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { light, shadows } from '@/theme/tokens';

export type ArcPhoto = { id: string; photo: ImageSourcePropType };

type Props = {
  photos: ArcPhoto[];
  width: number;
  /** Faded back when these are inspiration rather than the user's own places. */
  muted?: boolean;
};

const MAX = 7;
// Where the circles sit on the dome, left to right. The ends dip toward the link box so the box
// reads as sitting inside the arc, the way a hand holds a fan.
const ANGLES = [168, 142, 116, 90, 64, 38, 12];
// Biggest at the crown, smaller toward the ends: depth without any 3D.
const SIZES = [54, 62, 70, 78, 70, 62, 54];
// The crown is filled first, so the newest place always takes the top.
const FILL_ORDER = [3, 2, 4, 1, 5, 0, 6];

/**
 * The dome of places behind the link box. It is made of the user's own saves (newest at the
 * crown), so Home shows what they've collected before a single word is read. On first run it
 * holds a few inspiration places, muted, that give way as real ones arrive.
 */
export function PlaceArc({ photos, width, muted }: Props) {
  const R = Math.min(width * 0.34, 132);
  const height = R + SIZES[3] / 2 + 8;
  const cx = width / 2;
  const base = height - 6;

  const slots = photos.slice(0, MAX).map((p, i) => ({ p, slot: FILL_ORDER[i] }));

  return (
    <View style={{ width, height }} pointerEvents="none">
      {slots.map(({ p, slot }, i) => {
        const a = (ANGLES[slot] * Math.PI) / 180;
        const size = SIZES[slot];
        return (
          <Bubble
            key={p.id}
            photo={p.photo}
            size={size}
            x={cx + R * Math.cos(a) - size / 2}
            y={base - R * Math.sin(a) - size / 2}
            order={i}
            muted={muted}
            // The crown sits in front; the ends tuck behind their neighbours.
            z={10 - Math.abs(slot - 3)}
          />
        );
      })}
    </View>
  );
}

function Bubble({
  photo,
  size,
  x,
  y,
  order,
  muted,
  z,
}: {
  photo: ImageSourcePropType;
  size: number;
  x: number;
  y: number;
  order: number;
  muted?: boolean;
  z: number;
}) {
  const reduced = useReducedMotion();
  const rise = useSharedValue(reduced ? 1 : 0);
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    // Rise in from the centre outward, then drift: each bubble on its own slow period, so the
    // dome breathes without ever moving in unison.
    rise.set(withDelay(80 + order * 70, withSpring(1, { duration: 620, dampingRatio: 0.72 })));
    const period = 2600 + order * 330;
    float.set(
      withDelay(
        900 + order * 70,
        withRepeat(
          withSequence(
            withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }),
            withTiming(-1, { duration: period, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      ),
    );
  }, [float, order, reduced, rise]);

  const style = useAnimatedStyle(() => {
    const r = rise.get();
    return {
      opacity: Math.min(1, r * 1.4) * (muted ? 0.72 : 1),
      transform: [{ translateY: (1 - r) * 26 + float.get() * 3 }, { scale: 0.7 + 0.3 * r }],
    };
  });

  return (
    <Animated.View
      style={[styles.bubble, { left: x, top: y, width: size, height: size, borderRadius: size / 2, zIndex: z }, style]}
    >
      <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: light.panel,
    backgroundColor: light.canvasTop,
    boxShadow: shadows.card,
  },
});
