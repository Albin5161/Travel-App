// The pattern behind a shared trip: a folk or craft motif from the state the trip is in, so the
// story says where it's from before anyone reads a word (Warli dancers for Mumbai, a kasavu border
// for Kerala). Each is one small tile of plain shapes, drawn by us, in SVG path terms: the share
// screen draws it with react-native-svg, the saved picture with the canvas's Path2D. Geometric and
// folk motifs only, no religious symbols, faint white on the sky so the words stay easy to read.

export type PatternShape = {
  d: string;
  /** Filled, or drawn as a line this wide. */
  stroke?: number;
  /** How strongly it shows, before the pattern's own strength. */
  alpha?: number;
  /** Kasavu's gold; everything else is white. */
  gold?: boolean;
};

export type Pattern = {
  key: 'warli' | 'kasavu' | 'kolam' | 'bandhani' | 'azulejo' | 'weave' | 'jaali';
  w: number;
  h: number;
  shapes: PatternShape[];
  /** Drawn once along the bottom edge, repeated sideways only, like a woven border; else tiled all over. */
  hem?: boolean;
};

export const PATTERN_GOLD = '#E6C36A';
/** How strongly the whole pattern shows over the sky. */
export const PATTERN_ALPHA = 0.13;

const circle = (cx: number, cy: number, r: number) => `M${cx + r} ${cy}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0z`;

const PATTERNS: Record<Pattern['key'], Pattern> = {
  // Warli: the dancers' chain. Two triangles and a circle each, hands meeting across the tile's edge.
  warli: {
    key: 'warli',
    w: 36,
    h: 52,
    shapes: [
      { d: circle(18, 13, 3.4) },
      { d: 'M11.5 18.5L24.5 18.5L18 27Z' },
      { d: 'M18 27L11.5 35.5L24.5 35.5Z' },
      { d: 'M12 19.5L0 25M24 19.5L36 25', stroke: 1.6 },
      { d: 'M14 35.5L12 45M22 35.5L25 44.5', stroke: 1.6 },
    ],
  },
  // Kasavu: the gold border of a Kerala mundu along the bottom edge, two fine lines and a broad band.
  kasavu: {
    key: 'kasavu',
    w: 8,
    h: 26,
    hem: true,
    shapes: [
      { d: 'M0 2h8v1h-8z', gold: true, alpha: 5.5 },
      { d: 'M0 6h8v1.6h-8z', gold: true, alpha: 6 },
      { d: 'M0 11h8v11h-8z', gold: true, alpha: 7 },
    ],
  },
  // Kolam: a grid of dots with a line looping round them, and a small diamond at the heart.
  kolam: {
    key: 'kolam',
    w: 40,
    h: 40,
    shapes: [
      { d: [circle(10, 10, 1.5), circle(30, 10, 1.5), circle(10, 30, 1.5), circle(30, 30, 1.5)].join('') },
      { d: 'M20 3C29 3 37 11 37 20C37 29 29 37 20 37C11 37 3 29 3 20C3 11 11 3 20 3Z', stroke: 1.3 },
      { d: 'M20 14L26 20L20 26L14 20Z', stroke: 1.3 },
      { d: 'M0 3.5C2 2 3 1 3.5 0M40 3.5C38 2 37 1 36.5 0M0 36.5C2 38 3 39 3.5 40M40 36.5C38 38 37 39 36.5 40', stroke: 1.3 },
    ],
  },
  // Bandhani: tie-dye dots, four round an empty middle, in a staggered grid.
  bandhani: {
    key: 'bandhani',
    w: 24,
    h: 24,
    shapes: [
      {
        d: [
          circle(6, 3, 1.2), circle(9, 6, 1.2), circle(6, 9, 1.2), circle(3, 6, 1.2),
          circle(18, 15, 1.2), circle(21, 18, 1.2), circle(18, 21, 1.2), circle(15, 18, 1.2),
        ].join(''),
        // Small dots read fainter than lines at the same strength.
        alpha: 1.7,
      },
    ],
  },
  // Azulejo: a Goan tile, its edge, a ring, a four-petalled flower and quarter circles at the corners.
  azulejo: {
    key: 'azulejo',
    w: 48,
    h: 48,
    shapes: [
      { d: 'M0 0H48V48H0Z', stroke: 0.8, alpha: 0.7 },
      { d: circle(24, 24, 13), stroke: 1.2 },
      {
        d: 'M24 13C27.5 17 27.5 20 24 24C20.5 20 20.5 17 24 13ZM35 24C31 27.5 28 27.5 24 24C28 20.5 31 20.5 35 24ZM24 35C20.5 31 20.5 28 24 24C27.5 28 27.5 31 24 35ZM13 24C17 20.5 20 20.5 24 24C20 27.5 17 27.5 13 24Z',
      },
      { d: 'M9 0A9 9 0 0 1 0 9M39 0A9 9 0 0 0 48 9M0 39A9 9 0 0 1 9 48M48 39A9 9 0 0 0 39 48', stroke: 1.2 },
    ],
  },
  // A North-East handloom: a zigzag band, a row of diamonds, and two fine stripes.
  weave: {
    key: 'weave',
    w: 32,
    h: 40,
    shapes: [
      { d: 'M0 8L8 2L16 8L24 2L32 8', stroke: 1.4 },
      { d: 'M8 16L13 22L8 28L3 22Z' },
      { d: 'M24 16L29 22L24 28L19 22Z', stroke: 1.3 },
      { d: 'M0 34H32M0 37.5H32', stroke: 1 },
    ],
  },
  // Jaali: a carved stone lattice of eight-pointed stars, joined edge to edge.
  jaali: {
    key: 'jaali',
    w: 40,
    h: 40,
    shapes: [
      { d: 'M20 5L35 20L20 35L5 20Z', stroke: 1.2 },
      { d: 'M9.4 9.4H30.6V30.6H9.4Z', stroke: 1.2 },
      { d: 'M0 20H5M35 20H40M20 0V5M20 35V40', stroke: 1.2 },
      { d: circle(20, 20, 2.6) },
    ],
  },
};

type Craft = { key: Pattern['key']; name: string };

// The state's own craft where there's a fitting one; a jaali, which belongs to no one place, elsewhere.
const BY_STATE: Record<string, Craft> = {
  maharashtra: { key: 'warli', name: 'Warli painting' },
  kerala: { key: 'kasavu', name: 'Kasavu weave' },
  'tamil nadu': { key: 'kolam', name: 'Kolam' },
  puducherry: { key: 'kolam', name: 'Kolam' },
  karnataka: { key: 'kolam', name: 'Rangoli' },
  'andhra pradesh': { key: 'kolam', name: 'Muggulu' },
  telangana: { key: 'kolam', name: 'Muggulu' },
  rajasthan: { key: 'bandhani', name: 'Bandhani' },
  gujarat: { key: 'bandhani', name: 'Bandhani' },
  goa: { key: 'azulejo', name: 'Azulejo tiles' },
  meghalaya: { key: 'weave', name: 'Khasi weave' },
  nagaland: { key: 'weave', name: 'Naga weave' },
  assam: { key: 'weave', name: 'Assamese handloom' },
  manipur: { key: 'weave', name: 'Manipuri handloom' },
  mizoram: { key: 'weave', name: 'Mizo handloom' },
  tripura: { key: 'weave', name: 'Tripuri handloom' },
  'arunachal pradesh': { key: 'weave', name: 'Arunachali handloom' },
  sikkim: { key: 'weave', name: 'Sikkimese handloom' },
};

/** The pattern for a trip in `state`, and the line that credits it ("Warli painting, Maharashtra"). */
export function patternFor(state: string): { pattern: Pattern; credit: string } {
  const craft = BY_STATE[state.trim().toLowerCase()];
  if (!craft) return { pattern: PATTERNS.jaali, credit: 'Jaali lattice' };
  return { pattern: PATTERNS[craft.key], credit: `${craft.name}, ${state.trim()}` };
}
