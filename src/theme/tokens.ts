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

export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  sans: 'Geist_400Regular',
  sansMedium: 'Geist_500Medium',
  sansSemi: 'Geist_600SemiBold',
} as const;

export const radii = { thumb: 14, card: 28, sheet: 32, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, gutter: 24 } as const;
