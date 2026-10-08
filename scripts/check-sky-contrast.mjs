// Checks that every ink on the sky meets WCAG AA (4.5:1) at each sky's brightest spots: its three
// stops, the glow at full strength, and the densest cloud, both bare and under the glass tint.
// Then the same for the light look: every ink for words on the canvas and on a white panel.
// Run with Node 22: node --experimental-strip-types --import ./scripts/ts-paths.mjs scripts/check-sky-contrast.mjs

import { ON_PAPER, ON_SKY, PAPER, SKIES } from '../src/theme/semantic.ts';

const SKY = SKIES;
const skyInk = ON_SKY.ink;
const skySignal = ON_SKY.signal;

const AA = 4.5;
const WHITE = [255, 255, 255];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgba = (s) => {
  const [r, g, b, a] = s.match(/[\d.]+/g).map(Number);
  return { rgb: [r, g, b], a };
};
const mix = (fg, a, bg) => fg.map((v, i) => v * a + bg[i] * (1 - a));
const lum = (c) => {
  const [r, g, b] = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// White inks at their opacity, and the good/bad-news colours (solid).
const inks = {
  strong: { c: WHITE, a: 1 },
  soft: { c: WHITE, a: rgba(skyInk.soft).a },
  faint: { c: WHITE, a: rgba(skyInk.faint).a },
  // Only ever drawn on deep glass (sheets, the city page's panel), so checked there.
  'signal up': { c: hex(skySignal.up), a: 1, deepOnly: true },
  'signal down': { c: hex(skySignal.down), a: 1, deepOnly: true },
};
let failed = 0;

for (const [phase, look] of Object.entries(SKY)) {
  const stops = look.stops.map(hex);
  const glass = rgba(look.glass);
  const glow = hex(look.glow.color);
  // The glow sits over whichever end of the sky it's placed at.
  const under = look.glow.y < 0.5 ? stops[0] : stops[2];
  const spots = {
    top: stops[0],
    middle: stops[1],
    bottom: stops[2],
    glow: mix(glow, look.glow.opacity, under),
    cloud: mix(WHITE, look.clouds, stops[1]),
  };
  const worst = [];
  for (const [ink, { c, a, deepOnly }] of Object.entries(inks)) {
    let min = Infinity;
    let where = '';
    for (const [spot, bg] of Object.entries(spots)) {
      const surfaces = deepOnly
        ? [['deep glass', mix(stops[0], 0.8, bg)]]
        : [
            ['bare', bg],
            ['glass', mix(glass.rgb, glass.a, bg)],
          ];
      for (const [surface, back] of surfaces) {
        const r = ratio(mix(c, a, back), back);
        if (r < min) [min, where] = [r, `${surface} ${spot}`];
      }
    }
    if (min < AA) failed++;
    worst.push(`${ink} ${min.toFixed(2)}${min < AA ? ' FAIL' : ''} (${where})`);
  }
  console.log(`${phase.padEnd(8)} ${worst.join('   ')}`);
}

// The light look: solid inks on the canvas's two papers and on a white panel.
{
  const backs = { canvas: hex(PAPER.stops[1]), panel: hex(PAPER.glass), pane: hex(ON_PAPER.fill.pane), control: hex(ON_PAPER.fill.raised) };
  const words = {
    strong: ON_PAPER.ink.strong,
    soft: ON_PAPER.ink.soft,
    faint: ON_PAPER.ink.faint,
    'accent text': ON_PAPER.accentText,
    'signal up': ON_PAPER.signal.up,
    'signal down': ON_PAPER.signal.down,
  };
  const worst = [];
  for (const [ink, colour] of Object.entries(words)) {
    let min = Infinity;
    let where = '';
    for (const [name, back] of Object.entries(backs)) {
      const r = ratio(hex(colour), back);
      if (r < min) [min, where] = [r, name];
    }
    if (min < AA) failed++;
    worst.push(`${ink} ${min.toFixed(2)}${min < AA ? ' FAIL' : ''} (${where})`);
  }
  console.log(`${'light'.padEnd(8)} ${worst.join('   ')}`);
}

if (failed) {
  console.error(`\n${failed} ink/sky pairs are under ${AA}:1.`);
  process.exit(1);
}
console.log(`\nAll inks meet ${AA}:1 on every sky.`);
