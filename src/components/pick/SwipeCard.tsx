import { useEffect, useImperativeHandle, useMemo, type Ref } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { PlaceCard } from '@/components/PlaceCard';
import { Text } from '@/components/Text';
import type { Place } from '@/data/types';
import { EASE_OUT, project, SPRING_DRAG, SPRING_SETTLE } from '@/lib/motion';
import { colors, fonts, light } from '@/theme/tokens';

/** Right is 'keep', left is 'skip'. What those mean is the screen's business: Pick keeps places for
 *  the day, Verify confirms what the extraction found. */
export type Dir = 'keep' | 'skip';
export type CardHandle = { swipe: (dir: Dir) => void };

export type SwipeProps = {
  ref?: Ref<CardHandle>;
  place: Place;
  depth: number;
  width: number;
  height: number;
  screenW: number;
  enterFrom: Dir | null;
  /** Newly revealed at the back of the stack: fade in from one step further back. */
  fresh?: boolean;
  /** Shared with the screen: the front card drives this, the backdrop follows it. */
  dragX: SharedValue<number>;
  onCommit: (dir: Dir) => void;
  /** Stamp words shown while dragging right and left. */
  labels?: { keep: string; skip: string };
};

export function SwipeCard({
  ref,
  place,
  depth,
  width,
  height,
  screenW,
  enterFrom,
  fresh,
  dragX,
  onCommit,
  labels = { keep: 'Keep', skip: 'Skip' },
}: SwipeProps) {
  const reduced = useReducedMotion();
  const offscreen = screenW * 1.4;
  const own = useSharedValue(enterFrom ? (enterFrom === 'keep' ? offscreen : -offscreen) : 0);
  // The front card animates the screen's shared value directly, so the backdrop needs no wiring of
  // its own. Cards behind never move sideways, so they keep their own.
  const x = depth === 0 ? dragX : own;
  const y = useSharedValue(0);
  const d = useSharedValue(fresh ? depth + 1 : depth);
  const start = useSharedValue({ x: 0, y: 0 });

  useEffect(() => {
    if (enterFrom) {
      x.set(enterFrom === 'keep' ? offscreen : -offscreen);
      x.set(withSpring(0, SPRING_SETTLE));
    }
    // Mount-only: an undone card flies back in once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    d.set(withSpring(depth, SPRING_SETTLE));
  }, [d, depth]);

  const flyOff = (dir: Dir, velocity = 0) => {
    'worklet';
    const sign = dir === 'keep' ? 1 : -1;
    x.set(
      withTiming(sign * offscreen, { duration: reduced ? 150 : 250, easing: EASE_OUT }, (finished) => {
        if (finished) scheduleOnRN(onCommit, dir);
      }),
    );
    y.set(withTiming(y.get() + velocity * 0.05, { duration: 250, easing: EASE_OUT }));
  };

  useImperativeHandle(ref, () => ({ swipe: (dir: Dir) => flyOff(dir) }));

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(depth === 0)
        .activeOffsetX([-10, 10])
        .onStart(() => {
          start.set({ x: x.get(), y: y.get() });
        })
        .onUpdate((e) => {
          x.set(start.get().x + e.translationX);
          y.set(start.get().y + e.translationY * 0.35);
        })
        .onEnd((e) => {
          const projected = x.get() + project(e.velocityX);
          if (Math.abs(projected) > screenW * 0.4) {
            flyOff(projected > 0 ? 'keep' : 'skip', e.velocityY);
          } else {
            x.set(withSpring(0, { ...SPRING_DRAG, velocity: e.velocityX }));
            y.set(withSpring(0, { ...SPRING_DRAG, velocity: e.velocityY }));
          }
        }),
    // flyOff closes over x/y/onCommit, which are stable for a mounted card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [depth, screenW],
  );

  const style = useAnimatedStyle(() => {
    const depthV = d.get();
    const dragRot = reduced ? 0 : interpolate(x.get(), [-screenW, 0, screenW], [-12, 0, 12]);
    const fanRot = interpolate(depthV, [0, 1, 2], [0, -4, 5], Extrapolation.CLAMP);
    return {
      opacity: interpolate(depthV, [0, 2, 3], [1, 0.85, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: x.get() },
        { translateY: y.get() + depthV * 14 },
        { scale: 1 - depthV * 0.05 },
        { rotate: `${dragRot + fanRot}deg` },
      ],
    };
  });

  const keepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [0, width * 0.35], [0, 1], Extrapolation.CLAMP),
  }));
  const skipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [-width * 0.35, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.card, { width, height, zIndex: 10 - depth, pointerEvents: depth === 0 ? 'auto' : 'none' }, style]}
      >
        <PlaceCard
          place={place}
          style={{ width, height }}
          overlay={
            <>
              <Animated.View style={[styles.stamp, styles.stampKeep, keepStyle]} pointerEvents="none">
                <Text style={[styles.stampText, { color: light.ink }]}>{labels.keep}</Text>
              </Animated.View>
              <Animated.View style={[styles.stamp, styles.stampSkip, skipStyle]} pointerEvents="none">
                <Text style={[styles.stampText, { color: colors.mist }]}>{labels.skip}</Text>
              </Animated.View>
            </>
          }
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', top: 0 },
  stamp: {
    position: 'absolute',
    top: 64,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  stampKeep: { left: 20, backgroundColor: light.panel, transform: [{ rotate: '-8deg' }] },
  stampSkip: {
    right: 20,
    backgroundColor: colors.glassDark,
    borderWidth: 1,
    borderColor: colors.rimStrong,
    transform: [{ rotate: '8deg' }],
  },
  stampText: { fontFamily: fonts.sansSemi, fontSize: 18, letterSpacing: 0.5 },
});
