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

export type StripPhoto = { id: string; photo: ImageSourcePropType };

type Props = {
  photos: StripPhoto[];
  width: number;
  /** Faded back when these are inspiration rather than the user's own places. */
  muted?: boolean;
};

const MAX = 5;
const W = 62;
const H = 76;
// Neighbouring prints overlap by 12pt, like photos dealt onto a table.
const STEP = 50;
// Room kept between the outer prints and the field's ends, allowing for their tilt.
const EDGE = 10;
// Tilt and drop grow toward the ends, so the row reads as a gentle fan rather than a shelf.
const TILT = 4.5;
const DROP = 2;
export const STRIP_HEIGHT = H + 20;

/**
 * A short row of your places as small tilted prints, the newest in front at the centre. Its lower
 * edge tucks behind the link box below it, so the box reads as sitting on your collection. Works
 * at any count: three prints look deliberate, where three bubbles on a dome looked unfinished.
 * On first run it holds a few muted inspiration places that give way as real ones arrive.
 */
export function PhotoStrip({ photos, width, muted }: Props) {
  const shown = photos.slice(0, MAX);
  const n = shown.length;
  // Slots spread evenly about the centre (-1.5 … 1.5 for four), then handed out nearest-first,
  // so the newest place always takes the most central slot.
  const slots = Array.from({ length: n }, (_, i) => i - (n - 1) / 2).sort(
    (a, b) => Math.abs(a) - Math.abs(b) || a - b,
  );

  // Overlap more when the field is narrow (small phones), so no print hangs past its edges.
  const step = n > 1 ? Math.min(STEP, (width - W - EDGE * 2) / (n - 1)) : STEP;

  return (
    <View style={{ width, height: STRIP_HEIGHT }} pointerEvents="none">
      {shown.map((p, i) => {
        const off = slots[i];
        return (
          <Print
            key={p.id}
            photo={p.photo}
            x={width / 2 + off * step - W / 2}
            y={6 + off * off * DROP}
            tilt={off * TILT}
            order={i}
            z={10 - Math.round(Math.abs(off) * 2)}
            muted={muted}
          />
        );
      })}
    </View>
  );
}

function Print({
  photo,
  x,
  y,
  tilt,
  order,
  z,
  muted,
}: {
  photo: ImageSourcePropType;
  x: number;
  y: number;
  tilt: number;
  order: number;
  z: number;
  muted?: boolean;
}) {
  const reduced = useReducedMotion();
  const rise = useSharedValue(reduced ? 1 : 0);
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    // Dealt in from the centre outward, then each drifts on its own slow period.
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
      transform: [
        { translateY: (1 - r) * 28 + float.get() * 2 },
        { rotate: `${tilt * (0.6 + 0.4 * r)}deg` },
        { scale: 0.8 + 0.2 * r },
      ],
    };
  });

  return (
    <Animated.View style={[styles.print, { left: x, top: y, zIndex: z }, style]}>
      <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  print: {
    position: 'absolute',
    width: W,
    height: H,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: light.panel,
    backgroundColor: light.canvasTop,
    boxShadow: shadows.card,
  },
});
