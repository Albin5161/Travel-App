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
  key: string;
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


/** A closed outline through straight-edged points. */
const poly = (pts: P[]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
/** A line of `n` short stitches from `a` to `b`, the gaps as long as the stitches. */
function stitches(a: P, b: P, n: number) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 0.55) / n;
    d += `M${f(a[0] + (b[0] - a[0]) * t0)} ${f(a[1] + (b[1] - a[1]) * t0)}L${f(a[0] + (b[0] - a[0]) * t1)} ${f(a[1] + (b[1] - a[1]) * t1)}`;
  }
  return d;
}
/** A ring of `n` stitches round a centre: a circle sewn in running stitch. */
function stitchedRing(cx: number, cy: number, r: number, n: number) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI;
    const a1 = ((i + 0.55) / n) * 2 * Math.PI;
    d += `M${f(cx + Math.cos(a0) * r)} ${f(cy + Math.sin(a0) * r)}A${f(r)} ${f(r)} 0 0 1 ${f(cx + Math.cos(a1) * r)} ${f(cy + Math.sin(a1) * r)}`;
  }
  return d;
}
/** `n` dots evenly round a centre. */
function dotRing(cx: number, cy: number, r: number, n: number, dot: number, turn = 0) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = ((i / n) * 360 + turn) * (Math.PI / 180);
    d += circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, dot);
  }
  return d;
}
/** A ring of `n` teeth pointing outwards, from radius `r1` to `r2`. */
function teeth(cx: number, cy: number, r1: number, r2: number, n: number) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const w = (Math.PI / n) * 0.92;
    d += poly([
      [cx + Math.cos(a - w) * r1, cy + Math.sin(a - w) * r1],
      [cx + Math.cos(a) * r2, cy + Math.sin(a) * r2],
      [cx + Math.cos(a + w) * r1, cy + Math.sin(a + w) * r1],
    ]);
  }
  return d;
}
/** A diamond with stepped edges, `n` steps of `s` to each point: the cross-stitch way of drawing one. */
function steppedDiamond(cx: number, cy: number, n: number, s: number) {
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) pts.push([cx + i * s, cy - (n - i) * s], [cx + (i + 1) * s, cy - (n - i) * s]);
  for (let i = n; i >= 0; i--) pts.push([cx + (i + 1) * s, cy + (n - i) * s], [cx + i * s, cy + (n - i) * s]);
  for (let i = 0; i <= n; i++) pts.push([cx - i * s, cy + (n - i) * s], [cx - (i + 1) * s, cy + (n - i) * s]);
  for (let i = n; i >= 0; i--) pts.push([cx - (i + 1) * s, cy - (n - i) * s], [cx - i * s, cy - (n - i) * s]);
  return poly(pts);
}
/** A coil wound out from a centre: `turns` times round, to radius `r`. */
function spiral(cx: number, cy: number, r: number, turns: number, start = 0) {
  const steps = Math.round(turns * 20);
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = start + t * turns * 2 * Math.PI;
    d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * r * t)} ${f(cy + Math.sin(a) * r * t)}`;
  }
  return d;
}
/** A diamond drawn as rows of weft, each row slipped a little sideways: the blurred edge of tie-dyed thread. */
function ikatDiamond(cx: number, cy: number, w: number, h: number, step: number) {
  let d = '';
  let k = 0;
  for (let y = -h + step / 2; y < h; y += step, k++) {
    const half = w * (1 - Math.abs(y) / h);
    const slip = k % 2 ? 0.7 : -0.7;
    d += `M${f(cx - half + slip)} ${f(cy + y)}H${f(cx + half + slip)}`;
  }
  return d;
}
/** A fish as folk painters draw it: a lens of a body, a notched tail, an eye, three scales. `dir` is 1 or -1. */
function fish(cx: number, cy: number, dir: 1 | -1): PatternShape[] {
  const x = (n: number) => f(cx + n * dir);
  return [
    { d: `M${x(-9)} ${cy}Q${x(0)} ${cy - 6.5} ${x(9)} ${cy}Q${x(0)} ${cy + 6.5} ${x(-9)} ${cy}Z`, tone: 'light', alpha: 0.11 },
    { d: `M${x(-9)} ${cy}Q${x(0)} ${cy - 6.5} ${x(9)} ${cy}Q${x(0)} ${cy + 6.5} ${x(-9)} ${cy}Z`, tone: 'light', alpha: 0.2, stroke: 0.9 },
    { d: `M${x(-9)} ${cy}L${x(-13.5)} ${cy - 4}L${x(-12)} ${cy}L${x(-13.5)} ${cy + 4}Z`, tone: 'light', alpha: 0.18 },
    { d: [-4, -1, 2].map((n) => `M${x(n)} ${cy - 2.6}Q${x(n + 1.8)} ${cy} ${x(n)} ${cy + 2.6}`).join(''), tone: 'dark', alpha: 0.26, stroke: 0.8 },
    { d: circle(cx + 5.6 * dir, cy - 0.6, 0.8), tone: 'dark', alpha: 0.34 },
  ];
}
/** A leaf in outline, crossed with short strokes from tip to stalk, the way Gond painters fill a shape. */
function hatchedLeaf(cx: number, cy: number, s: number, deg: number): PatternShape[] {
  const marks: string[] = [];
  for (let t = 0.3; t < 1.35; t += 0.21) {
    const half = 0.3 * Math.sin((t / 1.5) * Math.PI);
    const [a, b] = place([[t, -half], [t, half]], cx, cy, s, deg);
    marks.push(`M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`);
  }
  return [
    { d: leaf(cx, cy, s, deg), tone: 'light', alpha: 0.1 },
    { d: leaf(cx, cy, s, deg), tone: 'light', alpha: 0.2, stroke: 0.8 },
    { d: marks.join(''), tone: 'dark', alpha: 0.28, stroke: 0.8 },
  ];
}
// A chinar leaf in unit space, stalk down: five pointed lobes.
const CHINAR: P[] = [
  [0, 0.9], [0.12, 0.45], [0.55, 0.75], [0.42, 0.3], [0.95, 0.2], [0.5, -0.05], [0.75, -0.55], [0.28, -0.4],
  [0, -1], [-0.28, -0.4], [-0.75, -0.55], [-0.5, -0.05], [-0.95, 0.2], [-0.42, 0.3], [-0.55, 0.75], [-0.12, 0.45],
];
function chinar(cx: number, cy: number, s: number, deg: number): PatternShape[] {
  const tips = place([[0, 0.5], [0.5, 0.68], [0.82, 0.18], [0.64, -0.46], [0, -0.86], [-0.64, -0.46], [-0.82, 0.18], [-0.5, 0.68], [0, 1.45]], cx, cy, s, deg);
  const from = tips[0];
  return [
    { d: poly(place(CHINAR, cx, cy, s, deg)), tone: 'light', alpha: 0.14 },
    { d: poly(place(CHINAR, cx, cy, s, deg)), tone: 'light', alpha: 0.18, stroke: 0.7 },
    { d: tips.slice(1).map((t) => `M${f(from[0])} ${f(from[1])}L${f(t[0])} ${f(t[1])}`).join(''), tone: 'dark', alpha: 0.26, stroke: 0.7 },
  ];
}
/** A tie-dyed dot: a pale ring where the thread was bound, the ground showing at its middle. */
const tied = (pts: P[]): PatternShape[] => [
  { d: pts.map(([x, y]) => circle(x, y, 1.35)).join(''), tone: 'light', alpha: 0.22 },
  { d: pts.map(([x, y]) => circle(x, y, 0.5)).join(''), tone: 'dark', alpha: 0.4 },
];
const between = (a: P, b: P, n: number): P[] => Array.from({ length: n }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n] as P);

// ── Patterns ──────────────────────────────────────────────────────────────────────────────────

const PATTERNS = {
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
  // Chikankari: white-on-white embroidery from Lucknow. Fine outlined flowers on curling stems,
  // clusters of knots, and a net of pin-pricks (the jaali stitch) across the ground.
  chikan: {
    key: 'chikan',
    w: 48,
    h: 48,
    shapes: [
      texture(48, 48, 3),
      { d: rosette(12, 12, 7.5, 5, -90) + rosette(36, 36, 7.5, 5, 90), tone: 'light', alpha: 0.1 },
      { d: rosette(12, 12, 7.5, 5, -90) + rosette(36, 36, 7.5, 5, 90), tone: 'light', alpha: 0.24, stroke: 0.7 },
      { d: dotRing(12, 12, 2.4, 6, 0.55) + dotRing(36, 36, 2.4, 6, 0.55) + circle(12, 12, 0.8) + circle(36, 36, 0.8), tone: 'light', alpha: 0.3 },
      ...vine([18, 17], [30, 31], 5, 2.6),
      ...vine([41, 29], [46, 18], 3, 2.2),
      ...vine([7, 19], [2, 30], 3, 2.2),
      { d: [circle(36, 9, 0.9), circle(33.6, 12, 0.9), circle(38.4, 12, 0.9), circle(12, 33, 0.9), circle(9.6, 36, 0.9), circle(14.4, 36, 0.9)].join(''), tone: 'light', alpha: 0.28 },
      { d: stitchedRing(36, 10.8, 5.2, 9) + stitchedRing(12, 34.8, 5.2, 9), tone: 'light', alpha: 0.18, stroke: 0.6 },
    ],
  },
  // Bandhani: tie-dye from Kutch. Nothing but bound dots, set out as a diamond with a flower at its heart.
  bandhani: {
    key: 'bandhani',
    w: 32,
    h: 32,
    shapes: [
      ...tied([
        ...between([16, 2], [30, 16], 4),
        ...between([30, 16], [16, 30], 4),
        ...between([16, 30], [2, 16], 4),
        ...between([2, 16], [16, 2], 4),
        [16, 11.5], [20.5, 16], [16, 20.5], [11.5, 16], [16, 16],
        [0, 0], [32, 0], [0, 32], [32, 32],
      ]),
    ],
  },
  // Kasuti: counted-thread embroidery from Dharwad. Stepped diamonds one inside another, a cross at the heart.
  kasuti: {
    key: 'kasuti',
    w: 32,
    h: 32,
    shapes: [
      { d: steppedDiamond(16, 16, 5, 2), tone: 'light', alpha: 0.2, stroke: 0.9 },
      { d: steppedDiamond(16, 16, 2, 2), tone: 'light', alpha: 0.12 },
      { d: 'M14 14L18 18M18 14L14 18', tone: 'dark', alpha: 0.32, stroke: 0.9 },
      { d: 'M-2 -2L2 2M2 -2L-2 2M30 -2L34 2M34 -2L30 2M-2 30L2 34M2 30L-2 34M30 30L34 34M34 30L30 34', tone: 'light', alpha: 0.2, stroke: 0.9 },
      { d: 'M16 1V3M16 29V31M1 16H3M29 16H31', tone: 'light', alpha: 0.2, stroke: 0.9 },
    ],
  },
  // Phulkari: Punjab's flower-work. A diamond in four quarters, each darned in long straight
  // stitches that turn a right angle from the next, so the light catches each one differently.
  phulkari: {
    key: 'phulkari',
    w: 32,
    h: 32,
    shapes: [
      {
        d: [3, 5, 7, 9, 11, 13].map((k) => `M17 ${16 - k}H${f(16 + (14 - k))}M${f(16 - (14 - k))} ${16 + k}H15`).join(''),
        tone: 'light',
        alpha: 0.2,
        stroke: 1.1,
      },
      {
        d: [3, 5, 7, 9, 11, 13].map((k) => `M${16 - k} ${f(16 - (14 - k))}V15M${16 + k} 17V${f(16 + (14 - k))}`).join(''),
        tone: 'light',
        alpha: 0.13,
        stroke: 1.1,
      },
      { d: 'M16 13.4L18.6 16L16 18.6L13.4 16Z', tone: 'dark', alpha: 0.3 },
      { d: poly([[0, -3], [3, 0], [0, 3], [-3, 0]]) + poly([[32, -3], [35, 0], [32, 3], [29, 0]]) + poly([[0, 29], [3, 32], [0, 35], [-3, 32]]) + poly([[32, 29], [35, 32], [32, 35], [29, 32]]), tone: 'light', alpha: 0.18 },
    ],
  },
  // Madhubani: wall painting from Mithila. Fish swimming in pairs, water between them, a line at each bank.
  madhubani: {
    key: 'madhubani',
    w: 44,
    h: 32,
    shapes: [
      ...fish(16, 9, 1),
      ...fish(28, 25, -1),
      { d: 'M0 17Q5.5 14 11 17T22 17T33 17T44 17', tone: 'light', alpha: 0.16, stroke: 0.8 },
      { d: 'M0 0.5H44', tone: 'light', alpha: 0.14, stroke: 0.8 },
      { d: [circle(36, 6, 0.8), circle(39.5, 9.5, 0.8), circle(36, 13, 0.8), circle(8, 21, 0.8), circle(4.5, 24.5, 0.8), circle(8, 28, 0.8)].join(''), tone: 'light', alpha: 0.22 },
    ],
  },
  // Gond: painting from the forests of Madhya Pradesh. Leaves on a branch, every shape filled with small strokes, dots trailing between.
  gond: {
    key: 'gond',
    w: 40,
    h: 40,
    shapes: [
      { d: 'M2 38Q14 30 20 20T38 2', tone: 'light', alpha: 0.18, stroke: 0.9 },
      ...hatchedLeaf(9, 32, 7.5, -80),
      ...hatchedLeaf(16, 25, 7.5, 10),
      ...hatchedLeaf(24, 15, 7.5, -100),
      ...hatchedLeaf(31, 8, 7.5, -10),
      { d: [circle(4, 6, 0.9), circle(8, 10, 0.9), circle(12, 6, 0.9), circle(8, 2, 0.9), circle(28, 34, 0.9), circle(32, 38, 0.9), circle(36, 34, 0.9), circle(32, 30, 0.9)].join(''), tone: 'light', alpha: 0.24 },
      { d: circle(8, 6, 1.3) + circle(32, 34, 1.3), tone: 'dark', alpha: 0.28 },
    ],
  },
  // Kalamkari: pen-drawn cloth from the Andhra coast. One stem winding up the cloth, a flower at each bend, buds and leaves off it.
  kalamkari: {
    key: 'kalamkari',
    w: 44,
    h: 56,
    shapes: [
      { d: 'M22 0C38 10 6 18 22 28C38 38 6 46 22 56', tone: 'light', alpha: 0.2, stroke: 1.1 },
      ...bloom(33, 12, 7, 6),
      ...bloom(11, 40, 7, 6),
      { d: rosette(33, 12, 9, 6, 30) + rosette(11, 40, 9, 6, 30), tone: 'light', alpha: 0.16, stroke: 0.6 },
      { d: [leaf(17, 16, 4.2, 200), leaf(27, 24, 4.2, 20), leaf(27, 44, 4.2, -20), leaf(17, 52, 4.2, 160)].join(''), tone: 'light', alpha: 0.15 },
      { d: [circle(8, 12, 1.5), circle(36, 40, 1.5)].join(''), tone: 'light', alpha: 0.2 },
      { d: 'M14 14Q10 15 8 12M30 42Q34 43 36 40', tone: 'light', alpha: 0.16, stroke: 0.8 },
      { d: dotRing(8, 12, 3.2, 6, 0.45) + dotRing(36, 40, 3.2, 6, 0.45), tone: 'light', alpha: 0.2 },
    ],
  },
  // Ikat: Pochampally's tie-dyed thread. Diamonds whose edges blur, because the colour is in the thread before it's woven.
  ikat: {
    key: 'ikat',
    w: 24,
    h: 32,
    shapes: [
      { d: ikatDiamond(12, 16, 10, 14, 2), tone: 'light', alpha: 0.18, stroke: 1.2 },
      { d: ikatDiamond(12, 16, 4.5, 6, 2), tone: 'dark', alpha: 0.3, stroke: 1.2 },
      { d: ikatDiamond(0, 0, 4.5, 6, 2) + ikatDiamond(24, 0, 4.5, 6, 2) + ikatDiamond(0, 32, 4.5, 6, 2) + ikatDiamond(24, 32, 4.5, 6, 2), tone: 'light', alpha: 0.14, stroke: 1.2 },
    ],
  },
  // Pipli: appliqué from Odisha. A medallion of cloth cut-outs: a scalloped edge, a ring of teeth, a flower.
  pipli: {
    key: 'pipli',
    w: 40,
    h: 40,
    shapes: [
      { d: dotRing(20, 20, 16, 14, 2.6), tone: 'light', alpha: 0.12 },
      { d: circle(20, 20, 14.5), tone: 'dark', alpha: 0.16 },
      { d: teeth(20, 20, 9, 13.5, 14), tone: 'light', alpha: 0.18 },
      { d: circle(20, 20, 9), tone: 'light', alpha: 0.18, stroke: 0.9 },
      { d: rosette(20, 20, 7, 8), tone: 'light', alpha: 0.16 },
      { d: circle(20, 20, 1.8), tone: 'dark', alpha: 0.3 },
      { d: teeth(0, 0, 2.5, 5, 8) + teeth(40, 0, 2.5, 5, 8) + teeth(0, 40, 2.5, 5, 8) + teeth(40, 40, 2.5, 5, 8), tone: 'light', alpha: 0.14 },
    ],
  },
  // Kantha: Bengal's quilting. Everything is running stitch: rings rippling out from a flower, and again from each corner.
  kantha: {
    key: 'kantha',
    w: 40,
    h: 40,
    shapes: [
      { d: stitchedRing(20, 20, 6.5, 10) + stitchedRing(20, 20, 10, 15) + stitchedRing(20, 20, 13.5, 20) + stitchedRing(20, 20, 17, 26), tone: 'light', alpha: 0.2, stroke: 0.9 },
      { d: rosette(20, 20, 4.4, 8), tone: 'light', alpha: 0.18 },
      { d: circle(20, 20, 1.1), tone: 'dark', alpha: 0.3 },
      { d: [[0, 0], [40, 0], [0, 40], [40, 40]].map(([x, y]) => stitchedRing(x, y, 4, 8) + stitchedRing(x, y, 7.5, 12)).join(''), tone: 'light', alpha: 0.16, stroke: 0.9 },
    ],
  },
  // Chinar: the plane-tree leaf of Kashmir, worked in crewel wool on every shawl and rug. Two leaves turning, as if falling.
  chinar: {
    key: 'chinar',
    w: 48,
    h: 52,
    shapes: [
      texture(48, 52, 4),
      ...chinar(13, 14, 10, -24),
      ...chinar(36, 39, 10, 150),
      { d: 'M27 8Q33 6 36 12M21 44Q15 46 12 40', tone: 'light', alpha: 0.16, stroke: 0.8 },
      { d: circle(36, 13, 1.2) + circle(12, 39, 1.2) + circle(40, 18, 0.8) + circle(8, 34, 0.8), tone: 'light', alpha: 0.22 },
    ],
  },
  // A Kullu shawl's border: stepped blocks in a row between ruled bands, as the loom builds a slope from squares.
  kullu: {
    key: 'kullu',
    w: 24,
    h: 30,
    shapes: [
      { d: 'M11 7H13V9H15V11H17V13H19V15H17V17H15V19H13V21H11V19H9V17H7V15H5V13H7V11H9V9H11Z', tone: 'light', alpha: 0.17 },
      { d: 'M11 11H13V13H15V15H13V17H11V15H9V13H11Z', tone: 'dark', alpha: 0.3 },
      { d: 'M-1 13H1V15H-1ZM23 13H25V15H23Z', tone: 'light', alpha: 0.2 },
      { d: 'M0 2H24M0 26H24', tone: 'light', alpha: 0.2, stroke: 1.4 },
      { d: 'M0 4.4H24M0 28.4H24', tone: 'light', alpha: 0.14, stroke: 0.7 },
    ],
  },
  // A Haryana dhurrie: the flat-woven floor rug, in bold facing triangles with a stripe run between.
  dhurrie: {
    key: 'dhurrie',
    w: 28,
    h: 28,
    shapes: [
      { d: 'M0 12L7 2L14 12ZM14 12L21 2L28 12Z', tone: 'light', alpha: 0.15 },
      { d: 'M0 16L7 26L14 16ZM14 16L21 26L28 16Z', tone: 'dark', alpha: 0.2 },
      { d: 'M0 14H28', tone: 'light', alpha: 0.22, stroke: 1.3 },
      { d: 'M7 6.5L8.6 9L7 11.5L5.4 9ZM21 6.5L22.6 9L21 11.5L19.4 9Z', tone: 'dark', alpha: 0.26 },
      { d: 'M0 0.4H28M0 27.6H28', tone: 'light', alpha: 0.14, stroke: 0.8 },
    ],
  },
  // Sohrai: harvest wall painting from Hazaribagh, drawn by combing wet clay. Arches of combed lines, one row up, the next down.
  sohrai: {
    key: 'sohrai',
    w: 32,
    h: 26,
    shapes: [
      { d: [10.5, 7.5, 4.5].map((r) => `M${16 - r} 14A${r} ${r} 0 0 1 ${16 + r} 14`).join(''), tone: 'light', alpha: 0.2, stroke: 1.1 },
      { d: [10.5, 7.5, 4.5].map((r) => `M${-r} 12A${r} ${r} 0 0 0 ${r} 12M${32 - r} 12A${r} ${r} 0 0 0 ${32 + r} 12`).join(''), tone: 'light', alpha: 0.14, stroke: 1.1 },
      { d: circle(16, 12.4, 1.3) + circle(0, 13.6, 1.3) + circle(32, 13.6, 1.3), tone: 'light', alpha: 0.24 },
      { d: 'M0 25H32', tone: 'light', alpha: 0.16, stroke: 0.8 },
      { d: [4, 12, 20, 28].map((x) => `M${x - 1.6} 25L${x} 22.6L${x + 1.6} 25Z`).join(''), tone: 'light', alpha: 0.16 },
    ],
  },
  // Dhokra: lost-wax brass from Bastar, built up from threads of wax. Coils, and a rope of beads between them.
  dhokra: {
    key: 'dhokra',
    w: 30,
    h: 30,
    shapes: [
      { d: spiral(15, 15, 9, 2.6), tone: 'light', alpha: 0.2, stroke: 1.2 },
      { d: [[0, 0], [30, 0], [0, 30], [30, 30]].map(([x, y]) => spiral(x, y, 5, 1.8, Math.PI / 2)).join(''), tone: 'light', alpha: 0.15, stroke: 1.1 },
      { d: [8, 12, 15, 18, 22].map((x) => circle(x, 0, 0.75) + circle(x, 30, 0.75) + circle(0, x, 0.75) + circle(30, x, 0.75)).join(''), tone: 'light', alpha: 0.22 },
      { d: circle(15, 15, 1.2), tone: 'dark', alpha: 0.3 },
    ],
  },
  // Aipan: Kumaon's floor painting, white rice paste on red earth. Drips of ruled lines, and rings of dots between them.
  aipan: {
    key: 'aipan',
    w: 36,
    h: 36,
    shapes: [
      { d: 'M3 0V36M6 0V36M9 0V36', tone: 'light', alpha: 0.18, stroke: 0.9 },
      { d: [3, 6, 9].map((x) => [4.5, 13.5, 22.5, 31.5].map((y) => circle(x, y, 0.95)).join('')).join(''), tone: 'light', alpha: 0.2 },
      { d: circle(23, 9, 5.2), tone: 'light', alpha: 0.2, stroke: 0.9 },
      { d: dotRing(23, 9, 7.6, 10, 0.75) + circle(23, 9, 1.6), tone: 'light', alpha: 0.24 },
      { d: rosette(23, 27, 6.4, 4, 45), tone: 'light', alpha: 0.16 },
      { d: dotRing(23, 27, 7.4, 4, 0.9) + circle(23, 27, 1), tone: 'light', alpha: 0.24 },
      { d: 'M13 18Q18 15.5 23 18T33 18', tone: 'light', alpha: 0.16, stroke: 0.8 },
      { d: 'M13 0Q18 -2.5 23 0T33 0M13 36Q18 33.5 23 36T33 36', tone: 'light', alpha: 0.16, stroke: 0.8 },
    ],
  },
  // An Assamese gamosa: the handwoven cloth with a patterned end. Two stripes, then a row of woven
  // flowers: a stepped diamond with a smaller one at each of its points.
  gamosa: {
    key: 'gamosa',
    w: 32,
    h: 38,
    shapes: [
      { d: 'M0 2.5H32', tone: 'light', alpha: 0.2, stroke: 2.4 },
      { d: 'M0 6.6H32M0 36.6H32', tone: 'light', alpha: 0.16, stroke: 0.8 },
      { d: steppedDiamond(16, 21, 3, 1.6), tone: 'light', alpha: 0.17 },
      { d: steppedDiamond(16, 21, 1, 1.6), tone: 'dark', alpha: 0.3 },
      { d: [[16, 11.4], [16, 30.6], [6.4, 21], [25.6, 21]].map(([x, y]) => poly([[x, y - 2], [x + 2, y], [x, y + 2], [x - 2, y]])).join(''), tone: 'light', alpha: 0.2 },
      { d: poly([[0, 18.5], [2.5, 21], [0, 23.5], [-2.5, 21]]) + poly([[32, 18.5], [34.5, 21], [32, 23.5], [29.5, 21]]), tone: 'dark', alpha: 0.24 },
      { d: circle(0, 30.5, 0.9) + circle(32, 30.5, 0.9) + circle(0, 11.5, 0.9) + circle(32, 11.5, 0.9), tone: 'light', alpha: 0.2 },
    ],
  },
  // Moirang phee: the border on a Manipuri sarong. A row of tall pointed teeth rising from a band.
  moirang: {
    key: 'moirang',
    w: 24,
    h: 26,
    shapes: [
      { d: 'M0 21L4 6L8 21ZM8 21L12 6L16 21ZM16 21L20 6L24 21Z', tone: 'light', alpha: 0.17 },
      { d: 'M4 12.5L5.4 17.5H2.6ZM12 12.5L13.4 17.5H10.6ZM20 12.5L21.4 17.5H18.6Z', tone: 'dark', alpha: 0.26 },
      { d: 'M0 22.6H24', tone: 'light', alpha: 0.22, stroke: 1.5 },
      { d: 'M0 25.2H24', tone: 'light', alpha: 0.14, stroke: 0.7 },
      { d: circle(4, 2.6, 0.8) + circle(12, 2.6, 0.8) + circle(20, 2.6, 0.8), tone: 'light', alpha: 0.2 },
    ],
  },
  // A Khasi check: the woven plaid worn in Meghalaya. A broad band each way, darker where they cross, fine lines beside.
  check: {
    key: 'check',
    w: 24,
    h: 24,
    shapes: [
      { d: 'M3 0H9V24H3Z', tone: 'light', alpha: 0.1 },
      { d: 'M0 3H24V9H0Z', tone: 'light', alpha: 0.1 },
      { d: 'M3 3H9V9H3Z', tone: 'dark', alpha: 0.22 },
      { d: 'M15.5 0V24M18.5 0V24M0 15.5H24M0 18.5H24', tone: 'light', alpha: 0.17, stroke: 0.8 },
      { d: 'M14.7 14.7H19.3V19.3H14.7Z', tone: 'dark', alpha: 0.16 },
    ],
  },
  // A Mizo puan: the wrap-around cloth. Stripes of different weights, a band of zigzag through the middle.
  puan: {
    key: 'puan',
    w: 28,
    h: 34,
    shapes: [
      { d: 'M0 0H28V3.4H0Z', tone: 'light', alpha: 0.15 },
      { d: 'M0 6H28M0 26.5H28M0 28.8H28', tone: 'light', alpha: 0.17, stroke: 0.8 },
      { d: 'M0 16L3.5 10.5L7 16L10.5 10.5L14 16L17.5 10.5L21 16L24.5 10.5L28 16', tone: 'light', alpha: 0.22, stroke: 1.2 },
      { d: 'M0 19.4L3.5 13.9L7 19.4L10.5 13.9L14 19.4L17.5 13.9L21 19.4L24.5 13.9L28 19.4', tone: 'light', alpha: 0.13, stroke: 1.2 },
      { d: 'M0 22H28V24.4H0Z', tone: 'dark', alpha: 0.22 },
      { d: 'M0 31H28V34H0Z', tone: 'light', alpha: 0.1 },
    ],
  },
  // A Naga shawl: broad bands, and between them a row of spears with a small square shield between each pair.
  naga: {
    key: 'naga',
    w: 32,
    h: 34,
    shapes: [
      { d: 'M0 0H32V5H0Z', tone: 'light', alpha: 0.17 },
      { d: 'M0 7H32M0 29H32', tone: 'light', alpha: 0.16, stroke: 0.8 },
      { d: 'M8 26V16M24 26V16', tone: 'light', alpha: 0.22, stroke: 1.3 },
      { d: 'M8 9.5L10.6 14.5L8 17.5L5.4 14.5ZM24 9.5L26.6 14.5L24 17.5L21.4 14.5Z', tone: 'light', alpha: 0.2 },
      { d: 'M13.4 16.4H18.6V21.6H13.4Z', tone: 'light', alpha: 0.2, stroke: 1 },
      { d: 'M15 18H17V20H15ZM-1 18H1V20H-1ZM31 18H33V20H31Z', tone: 'dark', alpha: 0.3 },
      { d: 'M0 31H32V34H0Z', tone: 'dark', alpha: 0.2 },
    ],
  },
  // The key border on a Sikkimese carpet: one line that turns in on itself and carries on.
  fret: {
    key: 'fret',
    w: 24,
    h: 26,
    shapes: [
      { d: 'M0 21H24M20 21V6H4V16H13V11', tone: 'light', alpha: 0.2, stroke: 1.3 },
      { d: 'M0 2H24', tone: 'light', alpha: 0.2, stroke: 1.3 },
      { d: 'M0 24.6H24', tone: 'light', alpha: 0.13, stroke: 0.7 },
      { d: circle(13, 11, 0.9), tone: 'dark', alpha: 0.3 },
    ],
  },
  // Ladakh: a line of peaks along the foot, a cloud curling above them, as on a painted chest or a carpet's edge.
  peaks: {
    key: 'peaks',
    w: 44,
    h: 30,
    shapes: [
      { d: 'M0 30L7 21L11 24.5L20 13L27 22L31 18.5L44 30', tone: 'light', alpha: 0.2, stroke: 1.1 },
      { d: 'M20 13L23.4 17.4L20.6 16.6L18.6 18.6L16.6 17.4Z', tone: 'light', alpha: 0.2 },
      { d: 'M0 30L7 21L11 24.5L20 13L27 22L31 18.5L44 30Z', tone: 'light', alpha: 0.07 },
      { d: 'M28 9C28 4 36 4 36 8.4C36 10.6 33 10.6 33 8.6M36 8.4C37.4 4.6 44 5.4 43 9.4C42.6 11 40.4 10.8 40.6 9.4M26 10.6H43', tone: 'light', alpha: 0.18, stroke: 0.9 },
      { d: 'M2 6.4C2 2.6 8 2.6 8 6C8 7.8 5.6 7.8 5.6 6.2M0.6 8H10', tone: 'light', alpha: 0.13, stroke: 0.9 },
    ],
  },
  // Cane and bamboo from Tripura: basket-work, three strips over and three under.
  cane: {
    key: 'cane',
    w: 24,
    h: 24,
    shapes: [
      { d: 'M1 2.5H11M1 6H11M1 9.5H11M13 14.5H23M13 18H23M13 21.5H23', tone: 'light', alpha: 0.2, stroke: 1.7 },
      { d: 'M14.5 1V11M18 1V11M21.5 1V11M2.5 13V23M6 13V23M9.5 13V23', tone: 'light', alpha: 0.12, stroke: 1.7 },
    ],
  },
} satisfies Record<string, Pattern>;

// Each state has a craft of its own and a ground to match: twenty-eight states, twenty-eight
// patterns, none used twice. (The union territories are below them; Puducherry shares Tamil Nadu's
// kolam, and anywhere not listed gets paisley on indigo.) Chosen as the craft a person from the
// state would most likely name; each can be changed here without touching anything else.
const BY_STATE: Record<string, { key: keyof typeof PATTERNS; ground: string; hem?: boolean }> = {
  'andhra pradesh': { key: 'kalamkari', ground: '#5A2A22' },
  'arunachal pradesh': { key: 'weave', ground: '#22402E' },
  assam: { key: 'gamosa', ground: '#6B1F24' },
  bihar: { key: 'madhubani', ground: '#17414A' },
  chhattisgarh: { key: 'dhokra', ground: '#4B3A1C' },
  goa: { key: 'azulejo', ground: '#1B3364' },
  gujarat: { key: 'bandhani', ground: '#6A1B2E' },
  haryana: { key: 'dhurrie', ground: '#3F2F52' },
  'himachal pradesh': { key: 'kullu', ground: '#2C3A5C' },
  jharkhand: { key: 'sohrai', ground: '#5C3320' },
  karnataka: { key: 'kasuti', ground: '#46275A' },
  kerala: { key: 'buti', ground: '#27432E', hem: true },
  'madhya pradesh': { key: 'gond', ground: '#1F4038' },
  maharashtra: { key: 'warli', ground: '#6A3223' },
  manipur: { key: 'moirang', ground: '#4A1F3C' },
  meghalaya: { key: 'check', ground: '#2A4425' },
  mizoram: { key: 'puan', ground: '#22262E' },
  nagaland: { key: 'naga', ground: '#4A1F22' },
  odisha: { key: 'pipli', ground: '#5C1F3A' },
  punjab: { key: 'phulkari', ground: '#6A2B14' },
  rajasthan: { key: 'paisley', ground: '#651D27' },
  sikkim: { key: 'fret', ground: '#1F3F5A' },
  'tamil nadu': { key: 'kolam', ground: '#5E1C26' },
  telangana: { key: 'ikat', ground: '#1E4A4E' },
  tripura: { key: 'cane', ground: '#4A3A20' },
  'uttar pradesh': { key: 'chikan', ground: '#2F3F4A' },
  uttarakhand: { key: 'aipan', ground: '#6B2A1E' },
  'west bengal': { key: 'kantha', ground: '#3B2550' },
  // Union territories.
  delhi: { key: 'jaali', ground: '#1D2A45' },
  'jammu and kashmir': { key: 'chinar', ground: '#465022' },
  ladakh: { key: 'peaks', ground: '#3A3F5C' },
  puducherry: { key: 'kolam', ground: '#5E1C26' },
};
// Other spellings the place data comes back with.
const ALSO: Record<string, string> = { orissa: 'odisha', uttaranchal: 'uttarakhand', pondicherry: 'puducherry', 'nct of delhi': 'delhi', 'national capital territory of delhi': 'delhi', 'jammu & kashmir': 'jammu and kashmir' };

/** The look for a trip in `state`. */
export function lookFor(state: string): Look {
  const name = state.trim().toLowerCase();
  const s = BY_STATE[ALSO[name] ?? name] ?? { key: 'paisley' as const, ground: '#222D4E' };
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
