import { uriOf } from '@/lib/blur';
import { loadImage } from '@/lib/cardImage';
import { COVER_PHOTO, PDF_FONTS, drawPlanPdf, pdfName, type PdfFont, type PdfInput, type PdfPhoto } from '@/lib/planPdf';
import { deliver, type SaveResult } from '@/lib/share';

// The plan's PDF on the website: jsPDF is fetched when someone asks for a PDF, never with the app;
// the fonts are fetched as files, the cover photo is cut and shaded on a canvas, and the result
// goes to the browser's share sheet or downloads. The phone apps' way is planPdfSave.native.ts.

export async function savePlanPdf(input: PdfInput): Promise<SaveResult> {
  const [{ jsPDF }, fonts, photo] = await Promise.all([
    import('jspdf/dist/jspdf.es.min.js'),
    loadFontFiles(),
    photoFor(input.city),
  ]);
  const blob = drawPlanPdf(jsPDF, fonts, photo, input).output('blob');
  return deliver(new File([blob], pdfName(input.city), { type: 'application/pdf' }));
}

let fontFiles: Promise<PdfFont[]> | null = null;
/** The app's own fonts, as the PDF embeds them; fetched once. */
function loadFontFiles() {
  fontFiles ??= Promise.all(
    PDF_FONTS.map(async (f) => {
      // On the web a bundled font is a plain URL.
      const uri = typeof f.source === 'string' ? f.source : uriOf(f.source as number);
      if (!uri) throw new Error(`No font ${f.family}`);
      const bytes = new Uint8Array(await (await fetch(uri)).arrayBuffer());
      return { family: f.family, file: f.file, data: base64(bytes) };
    }),
  ).catch((e: unknown) => {
    fontFiles = null;
    throw e;
  });
  return fontFiles;
}

function base64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** The city's photo cropped to the cover band, as a JPEG; null when it can't be read back. */
async function photoFor(city: PdfInput['city']): Promise<PdfPhoto | null> {
  const img = await loadImage(city.hero);
  if (!img) return null;
  const { width: cw, height: ch } = COVER_PHOTO;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const k = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  // Darker at the top (the wordmark) and from the middle down (the title), so white type reads on
  // any photo. Painted into the photo: one smooth gradient, no seams.
  const shade = ctx.createLinearGradient(0, 0, 0, ch);
  shade.addColorStop(0, 'rgba(0,0,0,0.32)');
  shade.addColorStop(0.22, 'rgba(0,0,0,0.04)');
  shade.addColorStop(0.45, 'rgba(0,0,0,0.08)');
  shade.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, cw, ch);
  return { jpeg: canvas.toDataURL('image/jpeg', 0.85), shaded: true };
}
