export const colors = {
  night: '#0D0F0E',
  basalt: '#1B1D1A',
  basaltRaised: '#242622',
  olive: '#545A45',
  stone: '#8A8574',
  ash: '#9B9B9B',
  mist: '#EEEAE3',
  ember: '#E2763C',
  glassLight: 'rgba(255,255,255,0.14)',
  glassDark: 'rgba(13,15,14,0.38)',
  rim: 'rgba(255,255,255,0.16)',
  rimStrong: 'rgba(255,255,255,0.32)',
  hairline: 'rgba(255,255,255,0.08)',
  mapRoad: '#2A2D29',
  mapCoast: 'rgba(255,255,255,0.07)',
} as const;

// Light direction (Atlys-like): airy paper UI, photos carry the colour, black primary button.
// Screens move over one at a time; see Tone in ./tone.
export const light = {
  canvasTop: '#ECEAE6',
  canvas: '#F5F4F1',
  panel: '#FFFFFF',
  ink: '#111111',
  inkSoft: '#5E5E5E',
  inkFaint: '#A3A3A3',
  line: 'rgba(17,17,17,0.08)',
  lineStrong: 'rgba(17,17,17,0.16)',
  field: '#FFFFFF',
  cta: '#111111',
  ctaInk: '#FFFFFF',
  photoInk: '#FFFFFF',
  photoInkSoft: 'rgba(255,255,255,0.72)',
  photoLine: 'rgba(255,255,255,0.22)',
  accent: '#E2763C',
  // Map, drawn as paper: pale land, soft blue-grey sea, quiet roads.
  mapLand: '#F7F6F2',
  mapSea: '#DDE6E7',
  mapCoast: 'rgba(17,17,17,0.10)',
  mapRoad: '#E6E3DC',
  mapTrail: 'rgba(17,17,17,0.28)',
  mapLabel: 'rgba(17,17,17,0.38)',
  mapSeaLabel: 'rgba(40,70,80,0.30)',
} as const;

export const shadows = {
  field: '0 6px 20px rgba(17,17,17,0.06)',
  card: '0 10px 24px rgba(17,17,17,0.14)',
  panel: '0 -8px 30px rgba(17,17,17,0.05)',
  cta: '0 8px 20px rgba(17,17,17,0.22)',
  pin: '0 4px 10px rgba(17,17,17,0.25)',
  button: '0 2px 8px rgba(17,17,17,0.08)',
} as const;

// Headings in Plus Jakarta Sans, heavy and tightly tracked; everything you read in Geist.
// Jakarta sits taller than it looks (ascent + descent = 1.26 em): keep heading line heights at
// 1.1x the size or more, or iOS shaves the tops off the capitals.
export const fonts = {
  display: 'PlusJakartaSans_800ExtraBold',
  displayBold: 'PlusJakartaSans_700Bold',
  displaySemi: 'PlusJakartaSans_600SemiBold',
  displayMedium: 'PlusJakartaSans_500Medium',
  displayItalic: 'PlusJakartaSans_500Medium_Italic',
  sans: 'Geist_400Regular',
  sansMedium: 'Geist_500Medium',
  sansSemi: 'Geist_600SemiBold',
} as const;

// The type scale: six sizes, all even, every line height on the 4pt grid. Nothing in the app sets
// a size off this list. tag is for a few words or a number (badges, pin numbers, tab labels,
// credits), never a sentence. hero is the one exception: the big name on a city or place.
export const fontSize = { tag: 10, label: 12, body: 14, title: 16, headline: 20, display: 32, hero: 40 } as const;
export const lineHeight = { tag: 12, label: 16, body: 20, title: 24, headline: 24, display: 36, hero: 44 } as const;
type Step = keyof typeof fontSize;
/** A size with its line height, to spread into a style: `{ ...textSize.label }`. */
export const textSize = Object.fromEntries(
  (Object.keys(fontSize) as Step[]).map((k) => [k, { fontSize: fontSize[k], lineHeight: lineHeight[k] }]),
) as { [K in Step]: { fontSize: (typeof fontSize)[K]; lineHeight: (typeof lineHeight)[K] } };

// glass: every frosted card; pane: a lighter panel or row inside one.
// field: every text box (and the code's digit boxes), 16 everywhere.
export const radii = { thumb: 14, pane: 16, field: 16, glass: 24, card: 28, sheet: 32, pill: 999 } as const;

// screen: the side margin of every screen on the sky, and of its header and footer.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, screen: 20, xl: 24, xxl: 32, gutter: 24 } as const;
