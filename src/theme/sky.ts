import type { SkyPhase } from '@/lib/sun';

import { isLight } from './mode';
import { ON_PAPER, ON_SKY, PAPER, SKIES, type SkyLook } from './semantic';

export type { SkyLook };

// The sky behind the app, one look per time of day, in the manner of a weather app's backdrop.
// Our own palettes, tuned so every ink below meets WCAG AA (4.5:1) at the sky's brightest spot
// (the glow's centre, the densest cloud), bare or under glass. After changing a colour, run
// `node --experimental-strip-types scripts/check-sky-contrast.mjs`.

// The canvas behind every screen: the sky as it is at this hour, or, in the light look, paper.
export const SKY: Record<SkyPhase, SkyLook> = isLight
  ? { night: PAPER, dawn: PAPER, sunrise: PAPER, day: PAPER, sunset: PAPER, dusk: PAPER }
  : SKIES;

/**
 * Glass for a pane over something light (a paper map, a photo's bright sky): the sky's deepest
 * colour, mostly opaque, so white type on it stays readable whatever is underneath: at 0.88 over
 * the palest map, the faintest ink still clears 4.5:1.
 */
export function deepGlass(look: SkyLook, alpha = 0.88) {
  return withAlpha(look.stops[0], alpha);
}

/** A sky colour (#RRGGBB) at some opacity, for fades into the sky. */
export function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// The semantic colours (tier two: theme/semantic), as the look that's on has them. Screens only ever
// name these, which is how the whole app changes look without any screen knowing there are two.
// They keep the names they had when the sky was the only look.
const NOW = isLight ? ON_PAPER : ON_SKY;

export const skyInk = NOW.ink;
export const skyFill = NOW.fill;
export const skyCta = NOW.cta;
export const skyOnCta = NOW.onCta;
export const skyOnInk = NOW.onInk;
export const skyAccent = NOW.accent;
export const skyAccentText = NOW.accentText;
/** A chosen answer: an ember wash with an ember rim. */
export const skyAccentWash = NOW.accentWash;
export const skyAccentRim = NOW.accentRim;
export const skySignal = NOW.signal;
/**
 * A fade laid over a map or a photo's top edge so the title and the status bar read on it: the
 * sky's night on the sky, paper in the light look. `alpha` is how much it hides.
 */
export const skyVeil = (alpha: number) => (isLight ? `rgba(255,255,255,${alpha})` : `rgba(4,10,30,${alpha})`);
/** The status bar's style over the canvas. */
export const skyBar: 'light' | 'dark' = isLight ? 'dark' : 'light';
