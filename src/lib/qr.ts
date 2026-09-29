// The QR code on the share ticket: it opens xplore.expo.app. The link never changes, so the code is
// worked out once and kept here as its 25 × 25 grid (version 2, error correction M, mask 6), rather
// than bringing a QR library into the app. Checked with a QR reader to decode to the link.
//
// It's the app's address and nothing else, on purpose: a story is public, and a trip's join code
// in it would let anyone who saw it join the trip.

export const QR_LINK = 'https://xplore.expo.app';

const ROWS = [
  '1111111010011100001111111',
  '1000001010011110001000001',
  '1011101010010101101011101',
  '1011101000101101001011101',
  '1011101011110110101011101',
  '1000001001100110001000001',
  '1111111010101010101111111',
  '0000000001111100100000000',
  '1001111111111001110010111',
  '1001010110110111010111110',
  '1010111000111101011011001',
  '0001000101011001011011111',
  '0000101000111000101000001',
  '1100010010100111000010010',
  '1100111010111101010011111',
  '1000010011010000001101101',
  '1011111010100101111110110',
  '0000000011111010100010110',
  '1111111011110110101010001',
  '1000001010101111100010010',
  '1011101011001011111110011',
  '1011101011000000011000011',
  '1011101001101011010011111',
  '1000001000100001000110111',
  '1111111011001110100001001',
];

/** Modules along a side. */
export const QR_SIZE = ROWS.length;
/** The light margin a reader needs around the code, in modules (the standard asks 4; 2 reads fine on a white tile). */
export const QR_QUIET = 2;

/** The dark modules, as runs along each row: fewer shapes to draw than one per module. */
export const QR_RUNS: { x: number; y: number; w: number }[] = ROWS.flatMap((row, y) => {
  const runs: { x: number; y: number; w: number }[] = [];
  for (let x = 0; x < row.length; x++) {
    if (row[x] !== '1') continue;
    const start = x;
    while (row[x + 1] === '1') x++;
    runs.push({ x: start, y, w: x - start + 1 });
  }
  return runs;
});

/** The whole code as one SVG path, one module to a unit. */
export const QR_PATH = QR_RUNS.map((r) => `M${r.x} ${r.y}h${r.w}v1h-${r.w}z`).join('');
