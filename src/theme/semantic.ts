import type { SkyPhase } from '@/lib/sun';

import { black, ember, green, ink, navy, paper, red, white } from './primitives';

// Tier two of the design system, as plain data: what each colour is for, in each of the app's two
// looks. Nothing here knows which look is on (theme/sky picks), so this file can also be read by
// scripts that check the colours (scripts/check-sky-contrast.mjs).

export type SkyLook = {
  /** Top to bottom. */
  stops: [string, string, string];
  /** Where the light comes from, as fractions of the screen, and how strong it is. */
  glow: { color: string; x: number; y: number; r: number; opacity: number };
  /** Soft cloud banks, 0 for none. */
  clouds: number;
  stars: number;
  /** The glass cards' tint: a darker note of the same sky, so a card reads as sky seen through ice. */
  glass: string;
  /** The status bar's style over this sky. */
  bar: 'light' | 'dark';
};

export const SKIES: Record<SkyPhase, SkyLook> = {
  night: {
    stops: [...navy.night],
    glow: { color: '#6F8CC8', x: 0.75, y: 0.08, r: 0.55, opacity: 0.18 },
    clouds: 0.06,
    stars: 1,
    glass: 'rgba(8,16,40,0.34)',
    bar: 'light',
  },
  dawn: {
    stops: [...navy.dawn],
    glow: { color: '#D8826A', x: 0.3, y: 1.05, r: 0.9, opacity: 0.26 },
    clouds: 0.08,
    stars: 0.35,
    glass: 'rgba(24,22,60,0.34)',
    bar: 'light',
  },
  sunrise: {
    stops: [...navy.sunrise],
    glow: { color: '#E8966A', x: 0.25, y: 0.95, r: 0.85, opacity: 0.2 },
    clouds: 0.09,
    stars: 0,
    glass: 'rgba(16,36,84,0.34)',
    bar: 'light',
  },
  day: {
    stops: [...navy.day],
    glow: { color: '#FFFFFF', x: 0.2, y: -0.05, r: 0.8, opacity: 0.1 },
    clouds: 0.08,
    stars: 0,
    glass: 'rgba(10,40,96,0.34)',
    bar: 'light',
  },
  sunset: {
    stops: [...navy.sunset],
    glow: { color: '#E48C60', x: 0.8, y: 0.95, r: 0.9, opacity: 0.22 },
    clouds: 0.1,
    stars: 0,
    glass: 'rgba(32,30,80,0.34)',
    bar: 'light',
  },
  dusk: {
    stops: [...navy.dusk],
    glow: { color: '#C87460', x: 0.75, y: 1.05, r: 0.9, opacity: 0.3 },
    clouds: 0.06,
    stars: 0.5,
    glass: 'rgba(16,16,48,0.36)',
    bar: 'light',
  },
};

// The light look has no sky: the same pale canvas at every hour, white panels on it, a dark status bar.
export const PAPER: SkyLook = {
  stops: [paper[200], paper[100], paper[100]],
  glow: { color: paper[0], x: 0.5, y: 0, r: 0.6, opacity: 0 },
  clouds: 0,
  stars: 0,
  glass: paper[0],
  bar: 'dark',
};

// What a colour is for, not what it is. Each is one primitive (theme/primitives), chosen by the
// look that's on (theme/mode): white type and frosted fills on the sky, ink and white panels on
// paper. Screens only ever name these, which is how the whole app changes look without any screen
// knowing there are two. They keep the names they had when the sky was the only look.

export type Semantic = {
  ink: { strong: string; soft: string; faint: string; line: string; rim: string; outline: string; shadow: string };
  fill: { pane: string; raised: string; pressed: string; well: string };
  cta: string;
  /** Words and icons on the main button. */
  onCta: string;
  /** Words and icons on a surface filled with the strong ink: a chosen chip, a count's badge. */
  onInk: string;
  accent: string;
  accentText: string;
  accentWash: string;
  accentRim: string;
  signal: { up: string; down: string };
};

export const ON_SKY: Semantic = {
  // White type on the sky, in the four strengths a weather app uses.
  ink: {
    strong: paper[0],
    soft: white(0.9),
    faint: white(0.8),
    line: white(0.18),
    rim: white(0.22),
    /** Empty rings, grabbers and unticked boxes: visible as an outline at 3:1. */
    outline: white(0.6),
    // Behind small type only: a soft shadow that keeps it readable over the brightest part of a sky.
    shadow: '0 1px 2px rgba(0,0,0,0.18)',
  },
  // Fills over the sky, from quietest to strongest.
  fill: { pane: white(0.1), raised: white(0.16), pressed: white(0.22), well: 'rgba(0,0,0,0.14)' },
  /** The main button: black, with a light rim so its edge holds on a night sky. */
  cta: ink[950],
  onCta: paper[0],
  onInk: ink[950],
  // The one warm note over the sky. Headline orange passes AA only as large type (3:1); anything
  // smaller (a label, a date, an icon) uses the lighter peach, which passes 4.5:1.
  accent: ember[300],
  accentText: ember[200],
  accentWash: 'rgba(255,168,119,0.16)',
  accentRim: 'rgba(255,168,119,0.75)',
  // Good and bad news in small type, for deep glass: saturated as far as 4.5:1 allows there.
  signal: { up: green[300], down: red[300] },
};

export const ON_PAPER: Semantic = {
  // Ink on the pale canvas. Every strength used for words passes 4.5:1 on it.
  ink: {
    strong: ink[900],
    soft: ink[600],
    faint: ink[500],
    line: black(0.08),
    rim: black(0.12),
    outline: black(0.45),
    shadow: '0 0 0 rgba(0,0,0,0)',
  },
  // A control is a white surface on the canvas; a pane inside a panel is a faint grey.
  fill: { pane: black(0.04), raised: paper[0], pressed: black(0.08), well: black(0.06) },
  cta: ink[900],
  onCta: paper[0],
  onInk: paper[0],
  // Ember dark enough for paper: 600 for large type, 700 for small.
  accent: ember[600],
  accentText: ember[700],
  accentWash: 'rgba(226,118,60,0.12)',
  accentRim: 'rgba(212,98,43,0.7)',
  signal: { up: green[700], down: red[700] },
};
