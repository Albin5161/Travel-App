import type { SkyPhase } from '@/lib/sun';

// The sky behind the app, one look per time of day, in the manner of a weather app's backdrop.
// Our own palettes: saturated enough at the bottom that white type stays readable over them.

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
    stops: ['#1D2A5C', '#5E5A92', '#C77A86'],
    glow: { color: '#F2A07E', x: 0.3, y: 1.05, r: 0.9, opacity: 0.55 },
    clouds: 0.14,
    stars: 0.35,
    glass: 'rgba(30,28,70,0.26)',
    bar: 'light',
  },
  sunrise: {
    stops: ['#2F5FA8', '#6F8FC4', '#D9957B'],
    glow: { color: '#FFC58F', x: 0.25, y: 0.95, r: 0.85, opacity: 0.6 },
    clouds: 0.32,
    stars: 0,
    glass: 'rgba(22,44,96,0.22)',
    bar: 'light',
  },
  day: {
    stops: ['#1F5FB4', '#3F82CF', '#72A9DF'],
    glow: { color: '#FFFFFF', x: 0.2, y: -0.05, r: 0.8, opacity: 0.28 },
    clouds: 0.42,
    stars: 0,
    glass: 'rgba(14,50,110,0.22)',
    bar: 'light',
  },
  sunset: {
    stops: ['#2A4E93', '#7A6FA6', '#D9836A'],
    glow: { color: '#FFB27A', x: 0.8, y: 0.95, r: 0.9, opacity: 0.6 },
    clouds: 0.32,
    stars: 0,
    glass: 'rgba(40,40,96,0.24)',
    bar: 'light',
  },
  dusk: {
    stops: ['#101A40', '#3E3B72', '#9C5B72'],
    glow: { color: '#E48A6E', x: 0.75, y: 1.05, r: 0.9, opacity: 0.45 },
    clouds: 0.1,
    stars: 0.5,
    glass: 'rgba(20,20,56,0.3)',
    bar: 'light',
  },
};

// White type on the sky, in the four strengths a weather app uses.
export const skyInk = {
  strong: '#FFFFFF',
  soft: 'rgba(255,255,255,0.82)',
  faint: 'rgba(255,255,255,0.6)',
  line: 'rgba(255,255,255,0.18)',
  rim: 'rgba(255,255,255,0.22)',
  // Behind small type only: a soft shadow that keeps it readable over the brightest part of a sky.
  shadow: '0 1px 2px rgba(0,0,0,0.18)',
} as const;
