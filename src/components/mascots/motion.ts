import { cubicBezier, css } from 'react-native-reanimated';

// The mascots' motion: small loops on opacity and transform only, as CSS animations that run off
// the JS thread on phones and as real CSS on the web.

// Solid, so the tail (a turned square tucked under the bubble) doesn't show through it.
export const BUBBLE = '#F2F2F6';
export const BUBBLE_INK = '#14131A';

// Keyframes, registered once.
/** A slow rise and fall. */
const RISE = css.keyframes({ '0%': { transform: [{ translateY: 0 }] }, '50%': { transform: [{ translateY: -1.2 }] }, '100%': { transform: [{ translateY: 0 }] } });
// A blink: shut for about a tenth of a second, once per cycle.
const EYES_OPEN = css.keyframes({ '0%': { opacity: 1 }, '95%': { opacity: 1 }, '96%': { opacity: 0 }, '98.5%': { opacity: 0 }, '99.5%': { opacity: 1 } });
const EYES_SHUT = css.keyframes({ '0%': { opacity: 0 }, '95%': { opacity: 0 }, '96%': { opacity: 1 }, '98.5%': { opacity: 1 }, '99.5%': { opacity: 0 } });
// Mouth open, mouth shut, about four syllables a second.
const FLAP_FRAMES = css.keyframes({ '0%': { opacity: 1 }, '55%': { opacity: 1 }, '56%': { opacity: 0 }, '100%': { opacity: 0 } });
const PULSE = css.keyframes({ '0%': { opacity: 0.8 }, '50%': { opacity: 1 }, '100%': { opacity: 0.8 } });
// Two little hops of joy.
const HOPS = css.keyframes({
  '0%': { transform: [{ translateY: 0 }] },
  '25%': { transform: [{ translateY: -9 }] },
  '50%': { transform: [{ translateY: 0 }] },
  '72%': { transform: [{ translateY: -5 }] },
  '100%': { transform: [{ translateY: 0 }] },
});
const RISE_IN = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 4 }, { scale: 0.94 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});

const RISE_OUT = css.keyframes({
  from: { opacity: 1, transform: [{ translateY: 0 }] },
  to: { opacity: 0, transform: [{ translateY: -4 }] },
});

const blinking = { animationTimingFunction: 'linear', animationIterationCount: 'infinite' } as const;
export const motion = css.create({
  // Each breathes at its own pace, so the two never rise in step.
  ammaBreath: { animationName: RISE, animationDuration: '3.2s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' },
  kidBreath: { animationName: RISE, animationDuration: '2.6s', animationDelay: '0.7s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' },
  ammaOpen: { animationName: EYES_OPEN, animationDuration: '4.6s', ...blinking },
  ammaShut: { animationName: EYES_SHUT, animationDuration: '4.6s', ...blinking },
  kidOpen: { animationName: EYES_OPEN, animationDuration: '3.7s', ...blinking },
  kidShut: { animationName: EYES_SHUT, animationDuration: '3.7s', ...blinking },
  flap: { animationName: FLAP_FRAMES, animationDuration: '260ms', animationTimingFunction: 'linear', animationIterationCount: 'infinite' },
  // The phone's light, softly brighter and dimmer as the reel plays.
  glow: { animationName: PULSE, animationDuration: '2.4s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' },
  hop: { animationName: HOPS, animationDuration: '900ms', animationTimingFunction: 'ease-in-out' },
  // A new line pops up from its tail.
  pop: { animationName: RISE_IN, animationDuration: '280ms', animationDelay: '120ms', animationFillMode: 'both', animationTimingFunction: cubicBezier(0.23, 1, 0.32, 1) },
  // The line before drifts up and away as the next arrives, and stays gone.
  fadeAway: { animationName: RISE_OUT, animationDuration: '240ms', animationFillMode: 'forwards', animationTimingFunction: 'ease-out' },
  tilt: { transitionProperty: 'transform', transitionDuration: 400, transitionTimingFunction: 'ease-in-out' },
  // The stamp's joke: in just after the stamp lands (its thud is at 350ms), then a hop.
  popAfterStamp: { animationName: RISE_IN, animationDuration: '260ms', animationDelay: '450ms', animationFillMode: 'both', animationTimingFunction: cubicBezier(0.23, 1, 0.32, 1) },
  hopAfterStamp: { animationName: HOPS, animationDuration: '700ms', animationDelay: '500ms', animationTimingFunction: 'ease-in-out' },
});

