import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';

import type { Place } from '@/data/types';
import { light } from '@/theme/tokens';

/** How far the drag has to travel before the room has fully become the next place. */
const HANDOVER = 0.45;

type Props = {
  current: Place | undefined;
  next: Place | undefined;
  /** The top card's horizontal offset, shared straight from the gesture. */
  x: SharedValue<number>;
  width: number;
};

/**
 * The room behind the card stack. The current place's photo, blown up and blurred into colour, so
 * swiping reads as moving through somewhere rather than sorting a list. Dragging crossfades it
 * toward the next place and tilts the whole wash warm (keep) or cool (skip), so the decision is
 * felt before it is made.
 *
 * Blur intensity is fixed and the photos crossfade underneath it — animating blur intensity
 * re-renders the blur every frame on Android.
 */
export function AmbientBackdrop({ current, next, x, width }: Props) {
  const reduced = useReducedMotion();
  const span = width * HANDOVER;

  // Parallax drifts the wash against the finger: the room is further away than the card.
  const currentStyle = useAnimatedStyle(() => {
    const t = Math.min(Math.abs(x.get()) / span, 1);
    return {
      opacity: 1 - t,
      transform: reduced
        ? [{ scale: 1.45 }]
        : [{ translateX: x.get() * -0.06 }, { scale: 1.45 + t * 0.08 }],
    };
  });

  const nextStyle = useAnimatedStyle(() => {
    const t = Math.min(Math.abs(x.get()) / span, 1);
    return {
      opacity: t,
      transform: reduced ? [{ scale: 1.45 }] : [{ translateX: x.get() * -0.03 }, { scale: 1.53 - t * 0.08 }],
    };
  });

  // Warm toward Keep, cool toward Skip. Kept under 0.16 so it reads as light changing, not a filter.
  const keepTint = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [0, span], [0, 0.16], Extrapolation.CLAMP),
  }));
  const skipTint = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [-span, 0], [0.14, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {next ? (
        <Animated.View style={[StyleSheet.absoluteFill, nextStyle]}>
          <Image source={next.photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
        </Animated.View>
      ) : null}
      {current ? (
        <Animated.View style={[StyleSheet.absoluteFill, currentStyle]}>
          <Image source={current.photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
        </Animated.View>
      ) : null}

      <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFill} />
      {/* Holds the app on paper without bleaching it: the wash is lightest where type sits, and
          keeps most of its colour in the margins around the card, which is all you actually see. */}
      <LinearGradient
        colors={[
          'rgba(245,244,241,0.80)',
          'rgba(245,244,241,0.40)',
          'rgba(245,244,241,0.44)',
          'rgba(245,244,241,0.86)',
        ]}
        locations={[0, 0.22, 0.74, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: light.accent }, keepTint]} />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#2E3A46' }, skipTint]} />
    </View>
  );
}
