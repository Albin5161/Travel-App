// The TTFs, even on the web: jsPDF embeds only TrueType, not the web's WOFF2 copies.
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import type { jsPDF as JsPDF } from 'jspdf';

import { costLabel } from '@/components/PlaceMeta';
import { isCustom } from '@/data/custom';
import { fromIso, partOf, type Party, type TripPlan } from '@/data/planner';
import type { City } from '@/data/types';
import { whyDay, whyStop } from '@/data/why';
import { formatClock, formatDuration, type Getting } from '@/lib/geo';
import { lookFor } from '@/lib/patterns';
import { QR_LINK, QR_QUIET, QR_RUNS, QR_SIZE } from '@/lib/qr';
import { colors, light } from '@/theme/tokens';

// The plan as a PDF to keep: a cover with the city's photo, what the plan is and how it was made,
// then each day with the planner's reasons and a timeline of its stops, and what didn't fit. Drawn
// on A4 in the app's own type (Plus Jakarta Sans headings, Geist text) and inks, light, so it
// prints. This file only draws: the website and the phone apps each bring jsPDF, the font files and
// the cover photo their own way, and take the finished file from there (planPdfSave).

export type PdfInput = { city: City; plan: TripPlan; issued: Date; creators: string[] };
/** A font as jsPDF embeds it: the TTF's bytes in base64. */
export type PdfFont = { family: string; file: string; data: string };
/**
 * The cover's photo: a JPEG already cut to the band's shape. The website shades it as it cuts it;
 * a phone can only cut, so the shade is laid over it here.
 */
export type PdfPhoto = { jpeg: string; shaded: boolean };

const W = 595.28;
const H = 841.89;
const M = 44;
/** The cover's photo band. */
const BAND = 318;
/** The size the cover photo is cut to: the band, at twice its points. */
export const COVER_PHOTO = { width: Math.round(W * 2), height: BAND * 2 };
/** Content stops here; the footer is below. */
const BOTTOM = H - 64;
const INK = light.ink;
const SOFT = light.inkSoft;
const FAINT = '#8C8C8C';
const EMBER = colors.ember;
const PAPER_TINT = '#F6F2EC';
const RULE = '#E6E1D9';

const PACE = { relaxed: 'Relaxed pace', balanced: 'Balanced pace', packed: 'Packed pace' } as const;
const GETTING: Record<Getting, string> = { local: 'Walking and autos', drive: 'Own vehicle', bus: 'By bus' };
const PARTY: Record<Party, string> = { solo: 'just you', partner: 'you and your partner', friends: 'you and your friends', family: 'the family' };
const PART_TITLE = { morning: 'MORNING', afternoon: 'AFTERNOON', evening: 'EVENING' } as const;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Draws the whole plan into a new jsPDF document. */
export function drawPlanPdf(
  jsPDF: typeof JsPDF,
  fonts: PdfFont[],
  photo: PdfPhoto | null,
  { city, plan, issued, creators }: PdfInput,
): JsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  for (const f of fonts) {
    doc.addFileToVFS(f.file, f.data);
    doc.addFont(f.file, f.family, 'normal');
  }
  const pdf = new Page(doc);

  cover(pdf, city, plan, photo);
  summary(pdf, plan, creators);
  plan.days.forEach((_, i) => day(pdf, plan, i));
  leftOut(pdf, plan);
  closing(pdf);
  footers(pdf, city, issued);
  return doc;
}

/** "xplore-delhi-plan.pdf" */
export const pdfName = (city: City) => `${`xplore-${city.name}-plan`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.pdf`;

// ── The pages ─────────────────────────────────────────────────────────────────────────────────

/**
 * The cover photo's shade, for a photo that arrives without it: black, darker at the top (the
 * wordmark) and from the middle down (the title), so white type reads on any photo. A see-through
 * PNG one pixel wide and 128 tall, stretched over the band, with the same four stops the website
 * paints into its photo (0.32 at the top, 0.04 at 22%, 0.08 at 45%, 0.62 at the foot).
 */
const SHADE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAACACAYAAADK+QP0AAAALUlEQVR42mNiYGAIYmJgYPgLJ/4RyaKdYkYQwQAnqMOlxBQmehGMdLVtEDgXAIYdHZ+Ywal/AAAAAElFTkSuQmCC';

/** The city's photo across the top, darkened at the foot, with the plan's name over it. */
function cover(pdf: Page, city: City, plan: TripPlan, photo: PdfPhoto | null) {
  const { doc } = pdf;
  if (photo) {
    doc.addImage(photo.jpeg, 'JPEG', 0, 0, W, BAND);
    if (!photo.shaded) doc.addImage(SHADE, 'PNG', 0, 0, W, BAND);
  } else {
    doc.setFillColor(lookFor(city.state).ground);
    doc.rect(0, 0, W, BAND, 'F');
  }

  pdf.type('Jakarta', 17, '#FFFFFF');
  doc.text('Xplore', M, 40);

  const n = plan.days.length;
  pdf.type('GeistSemi', 8.5, '#FFFFFF', 1.6);
  doc.text(`${n === 1 ? 'DAY PLAN' : `${n}-DAY PLAN`} · ${city.state.toUpperCase()}`, M, BAND - 104);
  pdf.type('Jakarta', fitSize(pdf, city.name, 'Jakarta', 46, W - M * 2), '#FFFFFF');
  doc.text(city.name, M, BAND - 58);
  pdf.type('Geist', 11, '#FFFFFF');
  const first = plan.days[0]?.date;
  const last = plan.days[n - 1]?.date;
  const when = first ? (n > 1 && last ? `${longDay(first)} to ${longDay(last)}` : longDay(first)) : 'Dates to be decided';
  doc.text([when, PACE[plan.prefs.pace], GETTING[plan.prefs.getting]].join('   ·   '), M, BAND - 30);
  pdf.y = BAND + 34;
}

/** Three numbers, and a paragraph on how the plan was made. */
function summary(pdf: Page, plan: TripPlan, creators: string[]) {
  const { doc } = pdf;
  const places = plan.days.reduce((n, d) => n + d.stops.filter((s) => !s.suggested).length, 0);
  const km = plan.days.reduce((n, d) => n + d.totalKm, 0);
  const stats: [string, string][] = [
    ['PLACES', String(places)],
    ['DAYS', String(plan.days.length)],
    ['TRAVEL', km >= 0.1 ? `${km < 10 ? km.toFixed(1) : Math.round(km)} km` : '–'],
  ];
  const colW = (W - M * 2) / 3;
  stats.forEach(([label, value], i) => {
    const x = M + i * colW;
    pdf.type('GeistSemi', 7.5, FAINT, 1.4);
    doc.text(label, x, pdf.y);
    pdf.type('Jakarta', 24, INK);
    doc.text(value, x, pdf.y + 28);
  });
  pdf.y += 52;
  pdf.rule();
  pdf.y += 22;

  pdf.type('JakartaBold', 13, INK);
  doc.text('How this plan was made', M, pdf.y);
  pdf.y += 16;
  const from = creators.length ? ` from ${list(creators.slice(0, 3))}${creators.length > 3 ? ' and others' : ''}` : '';
  const party = plan.prefs.party ? ` It's planned for ${PARTY[plan.prefs.party]}.` : '';
  const text =
    `Built from the ${places} ${places === 1 ? 'place' : 'places'} you saved${from}. Xplore put places within easy reach of each other on the same day, ` +
    `ordered each day from morning to evening with the nearest stop next, and never starts a place before its best time of day.${party}`;
  pdf.type('Geist', 10, SOFT);
  const lines = doc.splitTextToSize(text, W - M * 2) as string[];
  doc.text(lines, M, pdf.y, { lineHeightFactor: 1.45 });
  pdf.y += lines.length * 14.5 + 22;

  // At a glance: a line a day, what it covers.
  pdf.type('JakartaBold', 13, INK);
  doc.text('At a glance', M, pdf.y);
  pdf.y += 10;
  plan.days.forEach((d, i) => {
    pdf.need(34);
    pdf.y += 24;
    const stops = d.stops.filter((s) => !s.suggested);
    pdf.type('GeistSemi', 10, INK);
    doc.text(`Day ${i + 1}`, M, pdf.y);
    pdf.type('Geist', 9, FAINT);
    if (d.date) doc.text(shortDay(d.date), M, pdf.y + 12);
    pdf.type('Geist', 10, SOFT);
    const names = stops.map((s) => s.place.name).join(' · ') || 'A free day';
    doc.text(ellipsize(pdf, names, W - M * 2 - 150), M + 74, pdf.y);
    pdf.type('GeistMedium', 9.5, FAINT);
    doc.text(`${d.stops.length} ${d.stops.length === 1 ? 'stop' : 'stops'}${d.totalKm > 0 ? ` · ${d.totalKm.toFixed(1)} km` : ''}`, W - M, pdf.y, { align: 'right' });
    pdf.y += 8;
    doc.setDrawColor(RULE);
    doc.setLineWidth(0.6);
    doc.line(M, pdf.y + 8, W - M, pdf.y + 8);
  });
}

/** A day: its title, the planner's reasons, then its stops on a timeline. */
function day(pdf: Page, plan: TripPlan, i: number) {
  const { doc } = pdf;
  const d = plan.days[i];
  const stops = d.stops;
  // A day to a page: it prints, folds and reads as one.
  pdf.page();
  pdf.type('Jakarta', 20, INK);
  doc.text(`Day ${i + 1}`, M, pdf.y);
  const titleW = doc.getTextWidth(`Day ${i + 1}`);
  if (d.date) {
    pdf.type('Geist', 11, SOFT);
    doc.text(longDay(d.date), M + titleW + 10, pdf.y);
  }
  pdf.type('GeistMedium', 9.5, FAINT);
  const meta = `${stops.length} ${stops.length === 1 ? 'stop' : 'stops'}${d.totalKm > 0 ? ` · ${d.totalKm.toFixed(1)} km` : ''}`;
  doc.text(meta, W - M, pdf.y, { align: 'right' });
  pdf.y += 16;

  // Why this day works, in a tinted box.
  const reasons = whyDay(plan, i);
  if (reasons.length) {
    const inner = W - M * 2 - 44;
    const blocks = reasons.map((r) => pdf.wrapLead(`${r.lead}. `, r.text, inner, 9.5));
    const h = 36 + blocks.reduce((n, b) => n + b.length * 13.5 + 7, 0);
    pdf.need(h + 20);
    doc.setFillColor(PAPER_TINT);
    doc.roundedRect(M, pdf.y, W - M * 2, h, 10, 10, 'F');
    pdf.type('GeistSemi', 7.5, EMBER, 1.3);
    doc.text('WHY THIS DAY WORKS', M + 16, pdf.y + 21);
    let y = pdf.y + 38;
    for (const lines of blocks) {
      tick(pdf, M + 18, y - 4);
      lines.forEach((line, k) => {
        let x = M + 32;
        if (k === 0) {
          pdf.type('GeistSemi', 9.5, INK);
          doc.text(line.lead, x, y);
          x += doc.getTextWidth(line.lead);
        }
        pdf.type('Geist', 9.5, SOFT);
        doc.text(line.text, x, y);
        y += 13.5;
      });
      y += 7;
    }
    pdf.y += h + 22;
  }

  // The stops, grouped by part of the day, on one line of numbered dots.
  const timeX = M;
  const dotX = M + 74;
  const textX = M + 94;
  const textW = W - M - textX;
  let lastPart = '';
  let lineFrom: number | null = null;
  stops.forEach((s, k) => {
    const part = partOf(s.startMinutes);
    const why = whyStop(plan, i, k);
    pdf.type('Geist', 9, SOFT);
    const whyLines = why ? (doc.splitTextToSize(`${s.suggested ? 'Suggested · ' : ''}${why}`, textW) as string[]).slice(0, 2) : [];
    const leg = s.legBefore ? legText(s.legBefore) : null;
    const rowH = 18 + 14 + whyLines.length * 12.5 + 16;
    const headH = part !== lastPart ? 26 : 0;
    const legH = leg && k > 0 ? 18 : 0;
    if (pdf.y + headH + legH + rowH > BOTTOM) {
      pdf.page();
      lineFrom = null;
      lastPart = '';
    }

    if (part !== lastPart) {
      pdf.type('GeistSemi', 7.5, FAINT, 1.4);
      doc.text(`${PART_TITLE[part]} · ${formatClock(s.startMinutes)}`, textX, pdf.y + 4);
      pdf.y += 22;
      lastPart = part;
    }
    if (leg && k > 0) {
      pdf.type('Geist', 8.5, FAINT);
      doc.text(leg, textX, pdf.y + 2);
      pdf.y += 18;
    }

    const top = pdf.y;
    // The line from the dot before, then this stop's dot.
    if (lineFrom !== null) {
      doc.setDrawColor(RULE);
      doc.setLineWidth(1.5);
      doc.line(dotX, lineFrom, dotX, top);
    }
    doc.setFillColor(s.suggested ? '#FFFFFF' : EMBER);
    doc.setDrawColor(EMBER);
    doc.setLineWidth(1.2);
    doc.circle(dotX, top + 6, 9, s.suggested ? 'FD' : 'F');
    pdf.type('GeistSemi', 8.5, s.suggested ? EMBER : '#FFFFFF');
    doc.text(String(k + 1), dotX, top + 9, { align: 'center' });

    pdf.type('GeistMedium', 10, INK);
    doc.text(formatClock(s.startMinutes), timeX, top + 10);

    pdf.type('JakartaBold', 12.5, INK);
    doc.text(ellipsize(pdf, s.place.name, textW), textX, top + 10);
    const area = isCustom(s.place) ? null : s.place.area.split(',')[0].trim();
    const facts = [area, formatDuration(s.place.minutes), costLabel(s.place.cost)].filter(Boolean).join(' · ');
    pdf.type('Geist', 9, SOFT);
    doc.text(facts, textX, top + 25);
    whyLines.forEach((line, j) => {
      const y = top + 39 + j * 12.5;
      if (j === 0 && s.suggested) {
        pdf.type('GeistSemi', 9, EMBER);
        doc.text('Suggested · ', textX, y);
        const x = textX + doc.getTextWidth('Suggested · ');
        pdf.type('Geist', 9, FAINT);
        doc.text(line.replace(/^Suggested · /, ''), x, y);
      } else {
        pdf.type('Geist', 9, FAINT);
        doc.text(line, textX, y);
      }
    });
    lineFrom = top + 15;
    pdf.y = top + rowH;
  });

  if (d.home && plan.prefs.stay) {
    pdf.need(20);
    pdf.type('Geist', 8.5, FAINT);
    doc.text(`Back to ${plan.prefs.stay.name}: ${legText(d.home)}`, textX, pdf.y);
    pdf.y += 18;
  }
  pdf.y += 18;
}

/** Saved places that aren't in the plan, and why. */
function leftOut(pdf: Page, plan: TripPlan) {
  if (plan.left.length === 0) return;
  const { doc } = pdf;
  pdf.need(80);
  pdf.rule();
  pdf.y += 24;
  pdf.type('JakartaBold', 13, INK);
  doc.text('Saved, but not in this plan', M, pdf.y);
  pdf.y += 18;
  for (const p of plan.left) {
    const reason = plan.leftWhy?.[p.id] ?? 'Taken out of the plan.';
    pdf.type('Geist', 9, FAINT);
    const lines = doc.splitTextToSize(reason, W - M * 2) as string[];
    pdf.need(18 + lines.length * 12.5);
    pdf.type('GeistSemi', 10, INK);
    doc.text(p.name, M, pdf.y);
    pdf.type('Geist', 9, FAINT);
    doc.text(lines, M, pdf.y + 14, { lineHeightFactor: 1.4 });
    pdf.y += 20 + lines.length * 12.5;
  }
}

/** The honest small print, and a way back to Xplore. */
function closing(pdf: Page) {
  const { doc } = pdf;
  const qr = 64;
  pdf.need(qr + 30);
  pdf.y += 10;
  pdf.rule();
  pdf.y += 20;
  const top = pdf.y;
  const m = qr / (QR_SIZE + QR_QUIET * 2);
  doc.setFillColor(INK);
  for (const r of QR_RUNS) doc.rect(W - M - qr + (r.x + QR_QUIET) * m, top + (r.y + QR_QUIET) * m, r.w * m + 0.05, m + 0.05, 'F');
  const room = W - M * 2 - qr - 24;
  pdf.type('JakartaBold', 11, INK);
  doc.text('Saw it in a video? Go there.', M, top + 14);
  pdf.type('Geist', 8.5, FAINT);
  const small =
    'Places were found by AI from travel videos; times, drives and prices are estimates. Opening hours change, so check before you go. ' +
    'Scan the code to plan your next trip.';
  doc.text(doc.splitTextToSize(small, room) as string[], M, top + 30, { lineHeightFactor: 1.45 });
  pdf.type('GeistMedium', 8.5, EMBER);
  doc.textWithLink('xplore.expo.app', M, top + 30 + 3 * 12.5, { url: QR_LINK });
  pdf.y = top + qr + 10;
}

/** On every page: what it is, and where you are in it. */
function footers(pdf: Page, city: City, issued: Date) {
  const { doc } = pdf;
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    pdf.type('Geist', 7.5, FAINT);
    doc.text(`Xplore · ${city.name} plan · made ${issued.getDate()} ${MONTHS[issued.getMonth()]} ${issued.getFullYear()}`, M, H - 30);
    doc.text(`${i} / ${n}`, W - M, H - 30, { align: 'right' });
  }
}

// ── Drawing helpers ───────────────────────────────────────────────────────────────────────────

class Page {
  y = M;
  constructor(readonly doc: JsPDF) {}

  /** A font, size, colour and letter spacing in one call. */
  type(family: string, size: number, color: string, spacing = 0) {
    this.doc.setFont(family, 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(color);
    this.doc.setCharSpace(spacing);
  }

  /** Room for `h` more points on this page, or a new page. */
  need(h: number) {
    if (this.y + h > BOTTOM) this.page();
  }

  page() {
    this.doc.addPage();
    this.y = M + 6;
  }

  rule() {
    this.doc.setDrawColor(RULE);
    this.doc.setLineWidth(0.8);
    this.doc.line(M, this.y, W - M, this.y);
  }

  /** A bold lead and its text as lines within `width`, the lead on the first. */
  wrapLead(lead: string, text: string, width: number, size: number): { lead: string; text: string }[] {
    this.type('GeistSemi', size, INK);
    const leadW = this.doc.getTextWidth(lead);
    this.type('Geist', size, SOFT);
    const words = text.split(' ');
    const out: { lead: string; text: string }[] = [];
    let line = '';
    let room = width - leadW;
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (this.doc.getTextWidth(next) > room && line) {
        out.push({ lead: out.length ? '' : lead, text: line });
        line = w;
        room = width;
      } else line = next;
    }
    out.push({ lead: out.length ? '' : lead, text: line });
    return out;
  }
}

/** A small drawn tick: the fonts have no ✓. */
function tick(pdf: Page, x: number, y: number) {
  const { doc } = pdf;
  doc.setDrawColor(EMBER);
  doc.setLineWidth(1.4);
  doc.setLineCap('round');
  doc.setLineJoin('round');
  doc.lines(
    [
      [2.6, 2.6],
      [5.2, -6],
    ],
    x - 3.4,
    y,
  );
}

function fitSize(pdf: Page, text: string, family: string, max: number, room: number) {
  pdf.type(family, max, INK);
  const w = pdf.doc.getTextWidth(text);
  return w > room ? Math.floor((max * room) / w) : max;
}

function ellipsize(pdf: Page, text: string, room: number) {
  if (pdf.doc.getTextWidth(text) <= room) return text;
  let t = text;
  while (t.length > 1 && pdf.doc.getTextWidth(`${t}…`) > room) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** "10 min walk · 0.8 km", "12 min by car · 3.6 km": as the plan screen says it. */
function legText(leg: { minutes: number; km: number; mode: string }) {
  const how = leg.mode === 'walk' ? `${formatDuration(leg.minutes)} walk` : `${formatDuration(leg.minutes)} by ${leg.mode}`;
  return `${how} · ${leg.km.toFixed(1)} km`;
}

function shortDay(iso: string) {
  const d = fromIso(iso);
  return `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

function longDay(iso: string) {
  const d = fromIso(iso);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** The app's own fonts, by the names the pages above ask for them. */
export const PDF_FONTS = [
  { family: 'Geist', file: 'Geist-Regular.ttf', source: Geist_400Regular },
  { family: 'GeistMedium', file: 'Geist-Medium.ttf', source: Geist_500Medium },
  { family: 'GeistSemi', file: 'Geist-SemiBold.ttf', source: Geist_600SemiBold },
  { family: 'JakartaBold', file: 'PlusJakartaSans-Bold.ttf', source: PlusJakartaSans_700Bold },
  { family: 'Jakarta', file: 'PlusJakartaSans-ExtraBold.ttf', source: PlusJakartaSans_800ExtraBold },
];
