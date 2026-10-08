// Tier one of the design system: the raw colours, named for what they are, never for what they do.
// Nothing outside theme/ should import this file. Screens and components use the semantic colours
// (tier two: theme/sky for anything on the canvas, `light` and `colors` in theme/tokens for paper
// cards and type over photos), each of which is one of these, chosen per look.

/** White and near-white papers, lightest first. */
export const paper = {
  0: '#FFFFFF',
  50: '#F7F6F2',
  100: '#F5F4F1',
  200: '#ECEAE6',
  300: '#E6E3DC',
} as const;

/**
 * Neutral greys with no tint, lightest first: the light look's surfaces, lines and its one quiet
 * ink. Measured from Airbnb's screens (9 Oct 2026), where four small steps of grey do the work of
 * shadows. 600 passes 4.5:1 on every step up to 200.
 */
export const grey = {
  50: '#F7F7F7',
  100: '#F2F2F2',
  200: '#EBEBEB',
  300: '#DDDDDD',
  600: '#6A6A6A',
  900: '#222222',
} as const;

/** Neutral inks, lightest first. 500 is the lightest that passes 4.5:1 on paper 200. */
export const ink = {
  300: '#A3A3A3',
  500: '#646464',
  600: '#5E5E5E',
  900: '#111111',
  950: '#0E0F12',
} as const;

/** The one warm note. 300 and 200 are for small type on a dark sky; 600 and 700 for type on paper. */
export const ember = {
  200: '#FFD6BE',
  300: '#FFA877',
  500: '#E2763C',
  600: '#D4622B',
  700: '#A34A1C',
} as const;

/** Good and bad news. The 300s are for dark glass, the 700s for paper. */
export const green = { 300: '#4ADE80', 700: '#126E34' } as const;
export const red = { 300: '#FFB09A', 700: '#B42318' } as const;

/** The sky, one ramp per time of day: top, middle, bottom. */
export const navy = {
  night: ['#060B1F', '#13224A', '#26406E'],
  dawn: ['#18224F', '#3F3C72', '#6C3C56'],
  sunrise: ['#1F4383', '#36528B', '#6A3F3B'],
  day: ['#184A91', '#235293', '#2E61A5'],
  sunset: ['#213C7A', '#454375', '#723F3A'],
  dusk: ['#0E1738', '#302D5E', '#633A50'],
} as const;

/** White and black at a strength, for fills and lines that let what's behind show through. */
export const white = (alpha: number) => `rgba(255,255,255,${alpha})`;
export const black = (alpha: number) => `rgba(17,17,17,${alpha})`;
