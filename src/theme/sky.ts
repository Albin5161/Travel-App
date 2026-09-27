import type { SkyPhase } from '@/lib/sun';

// The sky behind the app, one look per time of day, in the manner of a weather app's backdrop.
// Our own palettes, tuned so every ink below meets WCAG AA (4.5:1) at the sky's brightest spot
// (the glow's centre, the densest cloud), bare or under glass. After changing a colour, run
// `node --experimental-strip-types scripts/check-sky-contrast.mjs`.

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

export const SKY: Record<SkyPhase, SkyLook> = {
  night: {
    stops: ['#060B1F', '#13224A', '#26406E'],
    glow: { color: '#6F8CC8', x: 0.75, y: 0.08, r: 0.55, opacity: 0.18 },
    clouds: 0.06,
    stars: 1,
    glass: 'rgba(8,16,40,0.34)',
    bar: 'light',
  },
  dawn: {
    stops: ['#18224F', '#3F3C72', '#6C3C56'],
    glow: { color: '#D8826A', x: 0.3, y: 1.05, r: 0.9, opacity: 0.26 },
    clouds: 0.08,
    stars: 0.35,
    glass: 'rgba(24,22,60,0.34)',
    bar: 'light',
  },
  sunrise: {
    stops: ['#1F4383', '#36528B', '#6A3F3B'],
    glow: { color: '#E8966A', x: 0.25, y: 0.95, r: 0.85, opacity: 0.2 },
    clouds: 0.09,
    stars: 0,
    glass: 'rgba(16,36,84,0.34)',
    bar: 'light',
  },
  day: {
    stops: ['#184A91', '#235293', '#2E61A5'],
    glow: { color: '#FFFFFF', x: 0.2, y: -0.05, r: 0.8, opacity: 0.1 },
    clouds: 0.08,
    stars: 0,
    glass: 'rgba(10,40,96,0.34)',
    bar: 'light',
  },
  sunset: {
    stops: ['#213C7A', '#454375', '#723F3A'],
    glow: { color: '#E48C60', x: 0.8, y: 0.95, r: 0.9, opacity: 0.22 },
    clouds: 0.1,
    stars: 0,
    glass: 'rgba(32,30,80,0.34)',
    bar: 'light',
  },
  dusk: {
    stops: ['#0E1738', '#302D5E', '#633A50'],
    glow: { color: '#C87460', x: 0.75, y: 1.05, r: 0.9, opacity: 0.3 },
    clouds: 0.06,
    stars: 0.5,
    glass: 'rgba(16,16,48,0.36)',
    bar: 'light',
  },
};

/**
 * Glass for a pane over something light (a paper map, a photo's bright sky): the sky's deepest
 * colour, mostly opaque, so white type on it stays readable whatever is underneath.
 */
export function deepGlass(look: SkyLook, alpha = 0.78) {
  const n = parseInt(look.stops[0].slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// The one warm note over the sky. Headline orange passes AA only as large type (3:1); anything
// smaller (a label, a date, an icon) uses the lighter peach, which passes 4.5:1.
export const skyAccent = '#FFA877';
export const skyAccentText = '#FFD6BE';
/** A chosen answer: an ember wash with an ember rim. */
export const skyAccentWash = 'rgba(255,168,119,0.16)';
export const skyAccentRim = 'rgba(255,168,119,0.75)';

/** Good and bad news in small type (safety signals), light enough for 4.5:1 on glass. */
export const skySignal = { up: '#B2F2C9', down: '#FFD0C6' } as const;

/** The main button: black, with a light rim so its edge holds on a night sky. */
export const skyCta = '#0E0F12';

// Fills over the sky, from quietest to strongest.
export const skyFill = {
  /** A panel or row inside a glass card. */
  pane: 'rgba(255,255,255,0.1)',
  /** A control: chip, field, pill, round button. */
  raised: 'rgba(255,255,255,0.16)',
  /** A control while focused or pressed, or an empty track. */
  pressed: 'rgba(255,255,255,0.22)',
  /** A recessed well a control slides in. */
  well: 'rgba(0,0,0,0.14)',
} as const;

// White type on the sky, in the four strengths a weather app uses.
export const skyInk = {
  strong: '#FFFFFF',
  soft: 'rgba(255,255,255,0.9)',
  faint: 'rgba(255,255,255,0.8)',
  line: 'rgba(255,255,255,0.18)',
  rim: 'rgba(255,255,255,0.22)',
  /** Empty rings, grabbers and unticked boxes: visible as an outline at 3:1. */
  outline: 'rgba(255,255,255,0.6)',
  // Behind small type only: a soft shadow that keeps it readable over the brightest part of a sky.
  shadow: '0 1px 2px rgba(0,0,0,0.18)',
} as const;
