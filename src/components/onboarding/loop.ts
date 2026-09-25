import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Each onboarding illustration is a short film on one clock, t: 0 → 1, looping while its page is
// the one on screen. Every element reads its own window of t, so the whole story stays in sync and
// runs on the UI thread without a single React render.

export const EASE = Easing.bezierFn(0.23, 1, 0.32, 1);
export const EASE_MOVE = Easing.bezierFn(0.77, 0, 0.175, 1);
/** A small overshoot for things that land: pins, avatars, a reaction. */
export const LAND = Easing.bezierFn(0.34, 1.56, 0.64, 1);

/** Where a story rests under Reduce Motion: fully told, before it clears for the next loop. */
export const REST = 0.86;
/** Every story clears across this window, so the loop restarts from an empty frame. */
export const CLEAR: [number, number] = [0.92, 0.98];

/** 0 → 1 across [a, b] of the clock, clamped. */
export function seg(t: number, a: number, b: number) {
  'worklet';
  return Math.min(1, Math.max(0, (t - a) / (b - a)));
}

/** Rises across [a, b], falls across [c, d]. */
export function hold(t: number, a: number, b: number, c: number, d: number) {
  'worklet';
  return Math.min(seg(t, a, b), 1 - seg(t, c, d));
}

/** How much of the end-of-loop clear has happened: multiply anything that should vanish by 1 - this. */
export function cleared(t: number) {
  'worklet';
  return seg(t, CLEAR[0], CLEAR[1]);
}

/**
 * The page's clock. Plays only while the page is active; frozen when it isn't, so a page you peek
 * at mid-swipe holds still. Returning to a page part-way through lets it finish quickly and clear,
 * then replays from the top, instead of jumping back to an empty frame.
 */
export function useLoop(active: boolean, duration: number) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? REST : 0);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(t);
      t.set(REST);
      return;
    }
    if (!active) {
      cancelAnimation(t);
      return;
    }
    const loop = withRepeat(
      withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration, easing: Easing.linear })),
      -1,
      false,
    );
    t.set(t.get() > 0.02 ? withSequence(withTiming(1, { duration: 320, easing: Easing.linear }), loop) : loop);
    return () => cancelAnimation(t);
  }, [active, duration, reduced, t]);

  return t;
}
