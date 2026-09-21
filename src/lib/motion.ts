import { Platform } from 'react-native';
import { Easing, FadeIn, FadeInDown, FadeOut, Keyframe, LinearTransition } from 'react-native-reanimated';

// The app targets iOS and Android; web is only a preview. Reanimated's web entering
// animations stay invisible in background tabs, so web skips them.
const native = <T,>(anim: T): T | undefined => (Platform.OS === 'web' ? undefined : anim);

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

export const DURATION = { press: 120, small: 180, ui: 260, uiMax: 300, cinematic: 450 } as const;

export const SPRING_SETTLE = { duration: 400, dampingRatio: 1 } as const;
export const SPRING_DRAG = { duration: 400, dampingRatio: 0.8 } as const;
export const SPRING_SHEET = { duration: 300, dampingRatio: 0.8 } as const;
// Only for the once-per-link pin drop (rare delight tier).
export const SPRING_LAND = { duration: 500, dampingRatio: 0.72 } as const;

// Where a flick would come to rest (Apple's exponential decay form).
export function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Opacity 0 → 1, y +12 → 0, 300ms ease-out. Build at module scope, not in render. */
export const fadeUp = (delay = 0) =>
  native(
    FadeInDown.duration(DURATION.uiMax)
      .easing(EASE_OUT)
      .delay(delay)
      .withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] }),
  );

export const CREDIT_IN = native(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 8 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
  }).duration(DURATION.uiMax),
);

export const CARD_IN = native(
  new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.96 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
  }).duration(DURATION.uiMax),
);

// Shared builders, built once at module scope.
export const FADE_IN = native(FadeIn.duration(DURATION.small));
export const FADE_OUT = native(FadeOut.duration(150));
export const NUDGE_IN = native(FadeInDown.duration(DURATION.ui).easing(EASE_OUT));
export const REFLOW = native(LinearTransition.duration(DURATION.ui));
