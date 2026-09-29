// The look of a shared trip's story: a rich colour and a dense, ornate pattern from the state the
// trip is in, printed tone on tone like block-printed fabric (the story sets its words and ticket
// over it). Maroon with paisley for Rajasthan, Warli figures on a mud-red wall for Maharashtra, a
// kolam on temple red for Tamil Nadu. Each pattern is one tile of shapes worked out here in SVG path
// terms: the screen draws it with react-native-svg, the saved picture with the canvas's Path2D.
// Folk and craft motifs only, no religious symbols.

export type PatternShape = {
  d: string;
  /** Lighter or darker than the ground: tone on tone, never a new colour. */
  tone: 'light' | 'dark';
  /** Drawn as a line this wide; filled when absent. */
  stroke?: number;
  alpha: number;
};

export type Pattern = {
  key: 'paisley' | 'buti' | 'warli' | 'kolam' | 'azulejo' | 'weave' | 'jaali';
  w: number;
  h: number;
  shapes: PatternShape[];
};

export type Look = {
  pattern: Pattern;
  /** The ground colour, deep enough for white type. */
  ground: string;
  /** Kerala's kasavu: a gold border along the foot. */
  hem?: boolean;
};

export const HEM_GOLD = '#D9B25F';
/** Kasavu along the foot, in story units: two fine gold lines and a broad band, from the top of the hem. */
export const HEM = { height: 26, bands: [{ y: 2, h: 1 }, { y: 6, h: 1.6 }, { y: 11, h: 11 }] };

// ── Geometry ──────────────────────────────────────────────────────────────────────────────────
type P = [number, number];
const f = (n: number) => Math.round(n * 100) / 100;
const place = (pts: P[], cx: number, cy: number, s: number, deg: number): P[] => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  return pts.map(([x, y]) => [cx + (x * c - y * sn) * s, cy + (x * sn + y * c) * s]);
};
const circle = (cx: number, cy: number, r: number) =>
  `M${f(cx + r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0z`;
/** Cubic curves through control points [start, c1, c2, end, c1, c2, end, …], closed. */
const curves = (pts: P[]) => {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i + 2 < pts.length; i += 3) {
    d += `C${pts.slice(i, i + 3).map(([x, y]) => `${f(x)} ${f(y)}`).join(' ')}`;
  }
  return `${d}Z`;
};
const cubicAt = (a: P, b: P, c: P, d: P, t: number): P => {
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
};

// A paisley (buta) in unit space: a teardrop whose tip curls over to the right.
const BUTA: P[] = [
  [0, 1],
  [-0.78, 0.86], [-0.98, 0.1], [-0.62, -0.36],
  [-0.36, -0.7], [0.02, -0.8], [0.3, -1.02],
  [0.24, -0.74], [0.38, -0.58], [0.58, -0.34],
  [0.88, 0.06], [0.72, 0.82], [0, 1],
];

/** A flower of `n` pointed petals round a centre. */
function rosette(cx: number, cy: number, r: number, n: number, turn = 0) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = ((i / n) * 360 + turn) * (Math.PI / 180);
    const w = (Math.PI / n) * 0.9;
    const tip: P = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    const l: P = [cx + Math.cos(a - w) * r * 0.62, cy + Math.sin(a - w) * r * 0.62];
    const rr: P = [cx + Math.cos(a + w) * r * 0.62, cy + Math.sin(a + w) * r * 0.62];
    d += `M${f(cx)} ${f(cy)}Q${f(l[0])} ${f(l[1])} ${f(tip[0])} ${f(tip[1])}Q${f(rr[0])} ${f(rr[1])} ${f(cx)} ${f(cy)}Z`;
  }
  return d;
}

/** A paisley at a place, size and turn: the body, an inner echo, a flower in its belly, dots round it. */
function buta(cx: number, cy: number, s: number, deg: number): PatternShape[] {
  const outer = place(BUTA, cx, cy, s, deg);
  const inner = place(BUTA.map(([x, y]) => [x * 0.66, y * 0.66 + 0.18] as P), cx, cy, s, deg);
  const [bx, by] = place([[0, 0.34]], cx, cy, s, deg)[0];
  const halo = place(BUTA.map(([x, y]) => [x * 1.2, y * 1.16 + 0.02] as P), cx, cy, s, deg);
  const dots: string[] = [];
  for (let i = 0; i + 3 < halo.length; i += 3) {
    for (const t of [0.25, 0.6]) {
      const [x, y] = cubicAt(halo[i], halo[i + 1], halo[i + 2], halo[i + 3], t);
      dots.push(circle(x, y, s * 0.07));
    }
  }
  const core = place(BUTA.map(([x, y]) => [x * 0.4, y * 0.4 + 0.3] as P), cx, cy, s, deg);
  const edge = place(BUTA.map(([x, y]) => [x * 1.07, y * 1.06] as P), cx, cy, s, deg);
  return [
    { d: curves(outer), tone: 'light', alpha: 0.13 },
    { d: curves(edge), tone: 'light', alpha: 0.16, stroke: s * 0.05 },
    { d: curves(inner), tone: 'dark', alpha: 0.24, stroke: s * 0.07 },
    { d: curves(core), tone: 'light', alpha: 0.12, stroke: s * 0.05 },
    { d: rosette(bx, by, s * 0.3, 6, deg), tone: 'light', alpha: 0.18 },
    { d: circle(bx, by, s * 0.08), tone: 'dark', alpha: 0.32 },
    { d: dots.join(''), tone: 'light', alpha: 0.2 },
  ];
}

/** A flower in two layers: pointed petals, a turned inner ring of darker ones, a dot at its heart. */
function bloom(cx: number, cy: number, r: number, n = 8): PatternShape[] {
  return [
    { d: rosette(cx, cy, r, n), tone: 'light', alpha: 0.15 },
    { d: rosette(cx, cy, r * 0.58, n, 180 / n), tone: 'dark', alpha: 0.2 },
    { d: circle(cx, cy, r * 0.2), tone: 'light', alpha: 0.24 },
  ];
}

/** A curling stem from one point to another, bending to one side, with a leaf at its middle. */
function vine(a: P, b: P, bend: number, leafSize: number): PatternShape[] {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const nx = -(b[1] - a[1]);
  const ny = b[0] - a[0];
  const len = Math.hypot(nx, ny) || 1;
  const c: P = [mx + (nx / len) * bend, my + (ny / len) * bend];
  const angle = (Math.atan2(ny, nx) * 180) / Math.PI;
  return [
    { d: `M${f(a[0])} ${f(a[1])}Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`, tone: 'light', alpha: 0.14, stroke: 0.8 },
    { d: leaf((a[0] + 2 * c[0] + b[0]) / 4, (a[1] + 2 * c[1] + b[1]) / 4, leafSize, angle), tone: 'light', alpha: 0.13 },
  ];
}

/** A fine field of dots between the motifs, the way block-printed cloth never leaves a gap bare. */
function texture(w: number, h: number, step: number): PatternShape {
  const d: string[] = [];
  for (let y = step / 2; y < h; y += step) {
    for (let x = (Math.round(y / step) % 2 ? step : step / 2); x < w; x += step) d.push(circle(x, y, 0.35));
  }
  return { d: d.join(''), tone: 'light', alpha: 0.09 };
}

/** A small leaf, pointing along `deg`. */
function leaf(cx: number, cy: number, s: number, deg: number) {
  return curves(place([[0, 0], [0.5, -0.45], [1.2, -0.3], [1.5, 0], [1.2, 0.3], [0.5, 0.45], [0, 0]], cx, cy, s, deg));
}

// ── Patterns ──────────────────────────────────────────────────────────────────────────────────

const PATTERNS: Record<Pattern['key'], Pattern> = {
  // Paisley in a half-drop: one buta up, the next turned, flowers and dots between.
  paisley: {
    key: 'paisley',
    w: 56,
    h: 64,
    shapes: [
      texture(56, 64, 4),
      ...buta(15, 19, 12, -28),
      ...buta(41, 51, 12, 152),
      ...bloom(43, 14, 6.5),
      ...bloom(13, 50, 6.5),
      ...vine([24, 27], [36, 17], 5, 2.6),
      ...vine([32, 43], [20, 47], 5, 2.6),
      ...vine([50, 22], [56, 33], 3, 2.2),
      ...vine([0, 33], [6, 42], 3, 2.2),
      { d: [circle(28, 1, 1.2), circle(28, 63, 1.2), circle(28, 33, 1.4)].join(''), tone: 'light', alpha: 0.2 },
    ],
  },
  // Buti: a block-printed flower sprig in a half-drop, leaves either side, dots in the gaps.
  buti: {
    key: 'buti',
    w: 44,
    h: 48,
    shapes: [
      texture(44, 48, 4),
      ...bloom(11, 12, 8),
      ...bloom(33, 36, 8),
      { d: [leaf(11, 19, 4, 60), leaf(11, 19, 4, 120), leaf(33, 43, 4, 60), leaf(33, 43, 4, 120)].join(''), tone: 'light', alpha: 0.14 },
      { d: 'M11 19V26M33 43V48M33 0V2', tone: 'light', alpha: 0.14, stroke: 1 },
      { d: [circle(33, 12, 1.1), circle(11, 36, 1.1), circle(22, 24, 1), circle(0, 24, 1), circle(44, 24, 1)].join(''), tone: 'light', alpha: 0.2 },
    ],
  },
  // Warli: a close chain of dancers, as on a mud-plastered wall, a row of small ones between.
  warli: {
    key: 'warli',
    w: 24,
    h: 42,
    shapes: [
      { d: circle(12, 7, 2.3) + 'M7.6 10.4L16.4 10.4L12 16.2ZM12 16.2L7.6 22L16.4 22Z', tone: 'light', alpha: 0.2 },
      { d: 'M8 11.2L0 15.2M16 11.2L24 15.2M9.8 22L8.4 28.4M14.2 22L16 28', tone: 'light', alpha: 0.2, stroke: 1.1 },
      { d: [0, 6, 12, 18].map((x) => `M${x + 3} 36L${x + 6} 32L${x + 9} 36Z`).join(''), tone: 'light', alpha: 0.12 },
      { d: circle(6, 38.5, 0.7) + circle(18, 38.5, 0.7), tone: 'light', alpha: 0.16 },
    ],
  },
  // Kolam: dots in a grid with a line looping round them and a diamond at each heart.
  kolam: {
    key: 'kolam',
    w: 32,
    h: 32,
    shapes: [
      { d: [circle(8, 8, 1.3), circle(24, 8, 1.3), circle(8, 24, 1.3), circle(24, 24, 1.3), circle(16, 16, 1.3)].join(''), tone: 'light', alpha: 0.24 },
      { d: 'M16 2C23 2 30 9 30 16C30 23 23 30 16 30C9 30 2 23 2 16C2 9 9 2 16 2Z', tone: 'light', alpha: 0.16, stroke: 1.1 },
      { d: 'M16 8L24 16L16 24L8 16Z', tone: 'light', alpha: 0.16, stroke: 1.1 },
      { d: 'M0 2.6C1.6 1.6 2.4 0.8 2.6 0M32 2.6C30.4 1.6 29.6 0.8 29.4 0M0 29.4C1.6 30.4 2.4 31.2 2.6 32M32 29.4C30.4 30.4 29.6 31.2 29.4 32', tone: 'light', alpha: 0.16, stroke: 1.1 },
      { d: 'M16 11L21 16L16 21L11 16Z', tone: 'dark', alpha: 0.18 },
    ],
  },
  // Azulejo: Goan tiles, each a ring round a four-petalled flower, quarter flowers at the corners.
  azulejo: {
    key: 'azulejo',
    w: 40,
    h: 40,
    shapes: [
      { d: 'M0 0H40V40H0Z', tone: 'dark', alpha: 0.22, stroke: 0.8 },
      { d: circle(20, 20, 11), tone: 'light', alpha: 0.16, stroke: 1.2 },
      { d: rosette(20, 20, 9, 4, 45), tone: 'light', alpha: 0.16 },
      { d: rosette(20, 20, 6, 4), tone: 'dark', alpha: 0.2 },
      { d: rosette(0, 0, 7, 8) + rosette(40, 0, 7, 8) + rosette(0, 40, 7, 8) + rosette(40, 40, 7, 8), tone: 'light', alpha: 0.13 },
    ],
  },
  // A North-East handloom: zigzag, a row of diamonds, fine stripes, woven close.
  weave: {
    key: 'weave',
    w: 24,
    h: 30,
    shapes: [
      { d: 'M0 6L6 1.5L12 6L18 1.5L24 6', tone: 'light', alpha: 0.2, stroke: 1.2 },
      { d: 'M6 11L10 16L6 21L2 16ZM18 11L22 16L18 21L14 16Z', tone: 'light', alpha: 0.16 },
      { d: 'M6 13.5L8 16L6 18.5L4 16ZM18 13.5L20 16L18 18.5L16 16Z', tone: 'dark', alpha: 0.26 },
      { d: 'M0 25H24M0 27.6H24', tone: 'light', alpha: 0.14, stroke: 0.9 },
    ],
  },
  // Jaali: a carved stone lattice of eight-pointed stars, joined edge to edge.
  jaali: {
    key: 'jaali',
    w: 32,
    h: 32,
    shapes: [
      { d: 'M16 3L29 16L16 29L3 16Z', tone: 'light', alpha: 0.16, stroke: 1.2 },
      { d: 'M6.8 6.8H25.2V25.2H6.8Z', tone: 'light', alpha: 0.16, stroke: 1.2 },
      { d: 'M0 16H3M29 16H32M16 0V3M16 29V32', tone: 'light', alpha: 0.16, stroke: 1.2 },
      { d: rosette(16, 16, 5.5, 8), tone: 'light', alpha: 0.14 },
      { d: circle(16, 16, 1.5), tone: 'dark', alpha: 0.28 },
    ],
  },
};

// The state's own craft and a ground to match; paisley on indigo where there isn't a clear one.
const BY_STATE: Record<string, { key: Pattern['key']; ground: string; hem?: boolean }> = {
  maharashtra: { key: 'warli', ground: '#6A3223' },
  kerala: { key: 'buti', ground: '#27432E', hem: true },
  'tamil nadu': { key: 'kolam', ground: '#5E1C26' },
  puducherry: { key: 'kolam', ground: '#5E1C26' },
  karnataka: { key: 'kolam', ground: '#46275A' },
  'andhra pradesh': { key: 'kolam', ground: '#1E4A4E' },
  telangana: { key: 'kolam', ground: '#1E4A4E' },
  rajasthan: { key: 'paisley', ground: '#651D27' },
  gujarat: { key: 'buti', ground: '#25305A' },
  goa: { key: 'azulejo', ground: '#1B3364' },
  'jammu and kashmir': { key: 'paisley', ground: '#465022' },
  ladakh: { key: 'paisley', ground: '#465022' },
  'himachal pradesh': { key: 'paisley', ground: '#465022' },
  punjab: { key: 'buti', ground: '#5B2A1C' },
  delhi: { key: 'jaali', ground: '#1D2A45' },
  'uttar pradesh': { key: 'jaali', ground: '#1D2A45' },
  'west bengal': { key: 'buti', ground: '#5E1C26' },
  meghalaya: { key: 'weave', ground: '#22402E' },
  nagaland: { key: 'weave', ground: '#4A1F22' },
  assam: { key: 'weave', ground: '#22402E' },
  manipur: { key: 'weave', ground: '#22402E' },
  mizoram: { key: 'weave', ground: '#22402E' },
  tripura: { key: 'weave', ground: '#22402E' },
  'arunachal pradesh': { key: 'weave', ground: '#22402E' },
  sikkim: { key: 'weave', ground: '#22402E' },
};

/** The look for a trip in `state`. */
export function lookFor(state: string): Look {
  const s = BY_STATE[state.trim().toLowerCase()] ?? { key: 'paisley' as const, ground: '#222D4E' };
  return { pattern: PATTERNS[s.key], ground: s.ground, hem: s.hem };
}

/**
 * How strongly every pattern prints, on screen and in the saved picture alike. Turned down to 0.6
 * after Albin's phone test (29 Sep 2026): at full strength the cloth competed with the ticket.
 */
const STRENGTH = 0.6;

/** The colour a shape is drawn in, tone on tone. */
export const shapeColour = (shape: PatternShape) => {
  const a = Math.round(shape.alpha * STRENGTH * 1000) / 1000;
  return shape.tone === 'light' ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
};
