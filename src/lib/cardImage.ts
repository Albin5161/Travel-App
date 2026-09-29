import { CARD_INSET, CARD_RATIO, cardFacts, QR_UNITS } from '@/components/share/ShareCard';
import type { TripPlan } from '@/data/planner';
import type { City } from '@/data/types';
import { uriOf } from '@/lib/blur';
import { HEM, HEM_GOLD, lookFor, shapeColour, type Pattern } from '@/lib/patterns';
import { QR_QUIET, QR_RUNS, QR_SIZE } from '@/lib/qr';
import { skyAccent, type SkyLook } from '@/theme/sky';
import { fonts, light } from '@/theme/tokens';

import type { ImageKind } from './share';

// The web's pictures of the share card, drawn straight onto a canvas from the same facts and
// measurements as the card on screen (ShareCard.tsx). Copying the page into a picture instead
// (html2canvas) cloned the whole app and redrew it on the main thread: seconds of frozen screen
// on a phone, and sometimes no picture at all. Drawing it takes a fraction of a second.

export type CardData = { city: City; plan: TripPlan; issued: Date; look: SkyLook };

const SIZE: Record<ImageKind, { w: number; h: number }> = {
  card: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

/** The picture as a JPEG file, ready for the share sheet or a download. */
export async function drawCardImage(kind: ImageKind, data: CardData, name: string): Promise<File> {
  const { w, h } = SIZE[kind];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');

  const [photo] = await Promise.all([loadImage(data.city.hero), loadFonts()]);
  if (kind === 'card') {
    paintCard(ctx, 0, 0, w, data, photo, true);
  } else {
    paintStory(ctx, w / 360, data, photo);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('No picture');
  // Letters, digits and dashes only: a colon ("live:kochi") trips up the iPhone's Files app.
  const safe = name.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return new File([blob], `${safe}.jpg`, { type: 'image/jpeg' });
}

// ---------------------------------------------------------------------------------------------
// The card, at any width (card units are a card 340 wide, as on screen)
// ---------------------------------------------------------------------------------------------

function paintCard(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  width: number,
  { city, plan, issued }: CardData,
  photo: HTMLImageElement | null,
  square: boolean,
) {
  const s = width / 340;
  const height = Math.round(width * CARD_RATIO);
  const f = cardFacts(city, plan, issued);
  const paneH = Math.round(s * f.paneUnits);
  const inset = CARD_INSET * s;
  const paneTop = height - inset - paneH;

  ctx.save();
  ctx.translate(x0, y0);
  roundRect(ctx, 0, 0, width, height, square ? 0 : 28 * s);
  ctx.clip();

  // The photo, full bleed, then the shade that keeps the white type readable on it.
  ctx.fillStyle = '#1B2A4E';
  ctx.fillRect(0, 0, width, height);
  if (photo) drawCover(ctx, photo, 0, 0, width, height);
  const shade = ctx.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, 'rgba(0,0,0,0.38)');
  shade.addColorStop(0.28, 'rgba(0,0,0,0)');
  shade.addColorStop(0.4, 'rgba(0,0,0,0)');
  shade.addColorStop(0.62, 'rgba(0,0,0,0.45)');
  shade.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);

  // Brand and the chip.
  const rowMid = 16 * s + 11.5 * s;
  setFont(ctx, fonts.display, 18 * s);
  ctx.fillStyle = '#FFFFFF';
  text(ctx, 'Xplore', 18 * s, rowMid, { spacing: -0.7 * s, baseline: 'middle' });
  setFont(ctx, fonts.sansSemi, 10 * s);
  const chipTextW = measure(ctx, f.chip, 1.6 * s);
  const chipW = chipTextW + 20 * s;
  const chipH = 12 * s + 10 * s + 2;
  const chipX = width - 16 * s - chipW;
  roundRect(ctx, chipX, rowMid - chipH / 2, chipW, chipH, chipH / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.9);
  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  text(ctx, f.chip, chipX + 10 * s, rowMid, { spacing: 1.6 * s, baseline: 'middle' });

  // The place and when, just above the pane.
  const titleBottom = paneTop - 14 * s;
  const nameSize = fitSize(ctx, city.name, fonts.display, 44 * s, width - 40 * s, -1.6 * s);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 12 * s;
  setFont(ctx, fonts.display, nameSize);
  ctx.fillStyle = '#FFFFFF';
  text(ctx, city.name, 20 * s, titleBottom - 50 * s / 2, { spacing: (-1.6 * s * nameSize) / (44 * s), baseline: 'middle' });
  ctx.restore();
  setFont(ctx, fonts.sansSemi, 11 * s);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  text(ctx, ellipsize(ctx, f.kicker, width - 40 * s, 1.8 * s), 20 * s, titleBottom - 50 * s - 2 * s - 7 * s, {
    spacing: 1.8 * s,
    baseline: 'middle',
  });

  // The pane: its shadow, the photo blurred, white over that, a highlight and a light rim.
  const px = inset;
  const pw = width - inset * 2;
  const pr = 22 * s;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 32 * s;
  ctx.shadowOffsetY = 12 * s;
  roundRect(ctx, px, paneTop, pw, paneH, pr);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, px, paneTop, pw, paneH, pr);
  ctx.clip();
  if (photo) {
    drawBlurred(ctx, photo, 0, 0, width, height);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(px, paneTop, pw, paneH);
  }
  const shine = ctx.createLinearGradient(0, paneTop, 0, paneTop + paneH);
  shine.addColorStop(0, 'rgba(255,255,255,0.5)');
  shine.addColorStop(0.35, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(px, paneTop, pw, paneH);
  ctx.restore();
  roundRect(ctx, px + 0.5, paneTop + 0.5, pw - 1, paneH - 1, pr);
  ctx.lineWidth = Math.max(1, s);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();

  // Inside the pane.
  const left = px + 16 * s;
  const right = px + pw - 16 * s;
  let y = paneTop + 16 * s;

  // From and to, with the day's stops as dots between them.
  setFont(ctx, fonts.sansSemi, 10 * s);
  ctx.fillStyle = light.inkFaint;
  text(ctx, f.byDate ? 'FROM' : 'START', left, y + 6.5 * s, { spacing: 1.2 * s, baseline: 'middle' });
  text(ctx, f.byDate ? 'TO' : 'WRAP UP', right, y + 6.5 * s, { spacing: 1.2 * s, baseline: 'middle', align: 'right' });
  setFont(ctx, fonts.displayBold, 20 * s);
  ctx.fillStyle = light.ink;
  const timeMid = y + 13 * s + 13 * s;
  const startW = measure(ctx, f.start, -0.4 * s);
  const endW = measure(ctx, f.end, -0.4 * s);
  text(ctx, f.start, left, timeMid, { spacing: -0.4 * s, baseline: 'middle' });
  text(ctx, f.end, right, timeMid, { spacing: -0.4 * s, baseline: 'middle', align: 'right' });
  const trackL = left + startW + 12 * s;
  const trackR = right - endW - 12 * s;
  if (trackR > trackL) {
    ctx.fillStyle = 'rgba(17,17,17,0.12)';
    roundRect(ctx, trackL, timeMid - 1 * s, trackR - trackL, 2 * s, s);
    ctx.fill();
    ctx.fillStyle = light.accent;
    const r = 3 * s;
    for (let i = 0; i < f.dots; i++) {
      const cx = f.dots === 1 ? trackL + r : trackL + r + ((trackR - trackL - 2 * r) * i) / (f.dots - 1);
      ctx.beginPath();
      ctx.arc(cx, timeMid, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  y += 39 * s + 12 * s;

  // The first stops, numbered: rows 20 tall, 6 apart.
  let end = y;
  f.rows.forEach((row, i) => {
    const top = y + i * 26 * s;
    const mid = top + 10 * s;
    ctx.fillStyle = light.ink;
    ctx.beginPath();
    ctx.arc(left + 9 * s, mid, 9 * s, 0, Math.PI * 2);
    ctx.fill();
    setFont(ctx, fonts.sansSemi, 10 * s);
    ctx.fillStyle = '#FFFFFF';
    text(ctx, String(i + 1), left + 9 * s, mid, { baseline: 'middle', align: 'center' });
    setFont(ctx, fonts.sansMedium, 12 * s);
    ctx.fillStyle = light.inkSoft;
    const timeW = measure(ctx, row.time);
    text(ctx, row.time, right, mid, { baseline: 'middle', align: 'right' });
    setFont(ctx, fonts.sansMedium, 14 * s);
    ctx.fillStyle = light.ink;
    const nameX = left + 28 * s;
    text(ctx, ellipsize(ctx, row.name, right - timeW - 10 * s - nameX), nameX, mid, { baseline: 'middle' });
    end = top + 20 * s;
  });
  if (f.more) {
    const top = end + 6 * s;
    setFont(ctx, fonts.sansMedium, 12 * s);
    ctx.fillStyle = light.inkSoft;
    text(ctx, f.more, left + 28 * s, top + 8 * s, { baseline: 'middle' });
    end = top + 16 * s;
  }

  // The tear line.
  const tear = end + 14 * s;
  ctx.fillStyle = 'rgba(17,17,17,0.22)';
  for (let x = left; x + 5 * s <= right; x += 9 * s) {
    roundRect(ctx, x, tear, 5 * s, 1.5 * s, s * 0.75);
    ctx.fill();
  }

  // The QR tile (QR_UNITS square) on the right; issued and the facts (29 tall) level with its middle.
  const foot = tear + 1.5 * s + 12 * s;
  const mid = foot + ((QR_UNITS - 29) / 2) * s;
  setFont(ctx, fonts.sansSemi, 10 * s);
  ctx.fillStyle = light.inkFaint;
  text(ctx, f.issued, left, mid + 6.5 * s, { spacing: 1.2 * s, baseline: 'middle' });
  setFont(ctx, fonts.sansMedium, 12 * s);
  ctx.fillStyle = light.ink;
  text(ctx, f.facts, left, mid + 21 * s, { baseline: 'middle' });
  const side = QR_UNITS * s;
  const codeX = right - side;
  // Ink straight on the frost, as on screen: no white tile.
  const m = side / (QR_SIZE + QR_QUIET * 2);
  ctx.fillStyle = light.ink;
  // Each module a whole pixel or more, snapped, so the saved code stays sharp enough to read.
  for (const r of QR_RUNS) {
    const x = Math.round(codeX + (r.x + QR_QUIET) * m);
    const y = Math.round(foot + (r.y + QR_QUIET) * m);
    ctx.fillRect(x, y, Math.round(codeX + (r.x + r.w + QR_QUIET) * m) - x, Math.round(foot + (r.y + 1 + QR_QUIET) * m) - y);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// The story: the sky, a line, the card, and where to make one (laid out 360 × 640)
// ---------------------------------------------------------------------------------------------

function paintStory(ctx: CanvasRenderingContext2D, k: number, data: CardData, photo: HTMLImageElement | null) {
  const W = 360 * k;
  const H = 640 * k;
  // The state's colour and its pattern, tone on tone like printed cloth, deeper at top and foot.
  const look = lookFor(data.city.state);
  ctx.fillStyle = look.ground;
  ctx.fillRect(0, 0, W, H);
  paintPattern(ctx, look.pattern, W, H, k);
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(0,0,0,0.28)');
  shade.addColorStop(0.25, 'rgba(0,0,0,0)');
  shade.addColorStop(0.7, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  if (look.hem) {
    ctx.fillStyle = HEM_GOLD;
    for (const b of HEM.bands) ctx.fillRect(0, H - HEM.height * k + b.y * k, W, b.h * k);
  }

  const n = data.plan.days.length;
  const left = 40 * k;
  setFont(ctx, fonts.sansSemi, 11 * k);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  text(ctx, n === 1 ? 'MY NEXT DAY OUT' : 'MY NEXT TRIP', left, 52 * k + 7 * k, { spacing: 2 * k, baseline: 'middle' });

  // "Kochi, sorted." with "sorted." in the warm accent, wrapped to the head's width.
  setFont(ctx, fonts.display, 34 * k);
  const lines = wrap(ctx, `${data.city.name}, sorted.`, W - left * 2, -1.1 * k).slice(0, 2);
  let y = 52 * k + 14 * k + 8 * k;
  for (const line of lines) {
    const mid = y + 19 * k;
    const at = line.lastIndexOf('sorted.');
    if (at < 0) {
      ctx.fillStyle = '#FFFFFF';
      text(ctx, line, left, mid, { spacing: -1.1 * k, baseline: 'middle' });
    } else {
      const head = line.slice(0, at);
      ctx.fillStyle = '#FFFFFF';
      text(ctx, head, left, mid, { spacing: -1.1 * k, baseline: 'middle' });
      ctx.fillStyle = skyAccent;
      text(ctx, 'sorted.', left + measure(ctx, head, -1.1 * k), mid, { spacing: -1.1 * k, baseline: 'middle' });
    }
    y += 38 * k;
  }

  // The card, with its shadow.
  const cardW = 280 * k;
  const cardH = Math.round(cardW * CARD_RATIO);
  const cardX = (W - cardW) / 2;
  const cardY = y + 22 * k;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 50 * k;
  ctx.shadowOffsetY = 20 * k;
  roundRect(ctx, cardX, cardY, cardW, cardH, 28 * (cardW / 340));
  ctx.fillStyle = '#1B2A4E';
  ctx.fill();
  ctx.restore();
  paintCard(ctx, cardX, cardY, cardW, data, photo, false);

  // The foot, anchored to the bottom.
  setFont(ctx, fonts.displayBold, 16 * k);
  ctx.fillStyle = '#FFFFFF';
  text(ctx, 'Xplore · xplore.expo.app', W / 2, H - 40 * k - 10.5 * k, { baseline: 'middle', align: 'center' });
  setFont(ctx, fonts.sansMedium, 14 * k);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  text(ctx, 'Turned from a travel reel, stop by stop.', W / 2, H - 40 * k - 21 * k - 6 * k - 9.5 * k, {
    baseline: 'middle',
    align: 'center',
  });
}

/** One tile of the pattern drawn at the story's scale, then repeated across the whole picture. */
function paintPattern(ctx: CanvasRenderingContext2D, pattern: Pattern, W: number, H: number, k: number) {
  const tile = document.createElement('canvas');
  tile.width = Math.round(pattern.w * k);
  tile.height = Math.round(pattern.h * k);
  const t = tile.getContext('2d');
  if (!t) return;
  t.scale(tile.width / pattern.w, tile.height / pattern.h);
  t.lineCap = 'round';
  t.lineJoin = 'round';
  for (const shape of pattern.shapes) {
    const path = new Path2D(shape.d);
    if (shape.stroke) {
      t.strokeStyle = shapeColour(shape);
      t.lineWidth = shape.stroke;
      t.stroke(path);
    } else {
      t.fillStyle = shapeColour(shape);
      t.fill(path);
    }
  }
  const fill = ctx.createPattern(tile, 'repeat');
  if (!fill) return;
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------------------------

type TextOpts = { spacing?: number; baseline?: CanvasTextBaseline; align?: 'left' | 'right' | 'center' };
type Spacing = CanvasRenderingContext2D & { letterSpacing?: string };

function setFont(ctx: CanvasRenderingContext2D, family: string, size: number) {
  ctx.font = `${size}px "${family}"`;
}

/** Width of a line with its tracking. Canvases that can't track get it letter by letter. */
function measure(ctx: CanvasRenderingContext2D, value: string, spacing = 0) {
  const c = ctx as Spacing;
  if (!spacing) return ctx.measureText(value).width;
  if ('letterSpacing' in c) {
    c.letterSpacing = `${spacing}px`;
    const w = ctx.measureText(value).width;
    c.letterSpacing = '0px';
    return w;
  }
  return [...value].reduce((w, ch) => w + ctx.measureText(ch).width + spacing, 0);
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, opts: TextOpts = {}) {
  const { spacing = 0, baseline = 'alphabetic', align = 'left' } = opts;
  const c = ctx as Spacing;
  ctx.textBaseline = baseline;
  const w = measure(ctx, value, spacing);
  const start = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  ctx.textAlign = 'left';
  if (!spacing) {
    ctx.fillText(value, start, y);
  } else if ('letterSpacing' in c) {
    c.letterSpacing = `${spacing}px`;
    ctx.fillText(value, start, y);
    c.letterSpacing = '0px';
  } else {
    let at = start;
    for (const ch of value) {
      ctx.fillText(ch, at, y);
      at += ctx.measureText(ch).width + spacing;
    }
  }
}

/** The largest size up to `max` at which the line fits, as the card's name shrinks to fit. */
function fitSize(ctx: CanvasRenderingContext2D, value: string, family: string, max: number, room: number, spacing: number) {
  setFont(ctx, family, max);
  const w = measure(ctx, value, spacing);
  return w <= room ? max : Math.max(max * 0.5, (max * room) / w);
}

function ellipsize(ctx: CanvasRenderingContext2D, value: string, room: number, spacing = 0) {
  if (measure(ctx, value, spacing) <= room) return value;
  let cut = value;
  while (cut.length > 1 && measure(ctx, `${cut}…`, spacing) > room) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function wrap(ctx: CanvasRenderingContext2D, value: string, room: number, spacing: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of value.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(ctx, next, spacing) > room) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** The photo covering the box, centred, as resizeMode="cover" draws it. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

/** The photo, softened: drawn a few dozen pixels wide and scaled back up, as on screen. */
function drawBlurred(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const small = document.createElement('canvas');
  small.width = 28;
  small.height = Math.max(1, Math.round((28 * h) / w));
  const sc = small.getContext('2d');
  if (!sc) return;
  sc.imageSmoothingQuality = 'high';
  drawCover(sc, img, 0, 0, small.width, small.height);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, x, y, w, h);
  ctx.restore();
}

/** The city's photo, readable back from a canvas; none when its host won't allow that. */
export async function loadImage(source: City['hero']): Promise<HTMLImageElement | null> {
  const uri = source ? uriOf(source) : null;
  if (!uri) return null;
  try {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = uri;
    await img.decode();
    // A photo that would taint the canvas makes the whole picture unsaveable: check before using it.
    const probe = document.createElement('canvas').getContext('2d');
    probe?.drawImage(img, 0, 0, 1, 1);
    probe?.getImageData(0, 0, 1, 1);
    return img;
  } catch {
    return null;
  }
}

let fontsReady: Promise<unknown> | null = null;
function loadFonts() {
  fontsReady ??= Promise.all(
    [fonts.display, fonts.displayBold, fonts.sansMedium, fonts.sansSemi].map((family) =>
      document.fonts.load(`20px "${family}"`).catch(() => null),
    ),
  );
  return fontsReady;
}
