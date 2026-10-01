import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';

// Before jsPDF, which needs it to load.
import '@/lib/latin1';
import { jsPDF } from 'jspdf/dist/jspdf.es.min.js';

import { uriOf } from '@/lib/blur';
import { COVER_PHOTO, PDF_FONTS, drawPlanPdf, pdfName, type PdfFont, type PdfInput, type PdfPhoto } from '@/lib/planPdf';
import type { SaveResult } from '@/lib/share';

// The plan's PDF on a phone: the same pages the website draws (planPdf.ts), with the fonts read
// from the app's own files and the cover photo cut to shape by the phone. The file is written to
// the cache and handed to the share sheet (Save to Files, WhatsApp, Mail, Print).

export async function savePlanPdf(input: PdfInput): Promise<SaveResult> {
  const [fonts, photo] = await Promise.all([loadFontFiles(), photoFor(input.city)]);
  const doc = drawPlanPdf(jsPDF, fonts, photo, input);
  const file = new File(Paths.cache, pdfName(input.city));
  file.create({ overwrite: true });
  file.write(new Uint8Array(doc.output('arraybuffer')));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Save or share your plan',
  });
  return 'shared';
}

let fontFiles: Promise<PdfFont[]> | null = null;
/** The app's own fonts, as the PDF embeds them; read once. */
function loadFontFiles() {
  fontFiles ??= Promise.all(
    PDF_FONTS.map(async (f) => {
      // On a phone a bundled font is an asset, which has to be a file before it can be read.
      const { localUri } = await Asset.fromModule(f.source as number).downloadAsync();
      if (!localUri) throw new Error(`No font ${f.family}`);
      return { family: f.family, file: f.file, data: await new File(localUri).base64() };
    }),
  ).catch((e: unknown) => {
    fontFiles = null;
    throw e;
  });
  return fontFiles;
}

/**
 * The city's photo cut to the cover band, as a JPEG; null when it can't be read (the cover is then
 * a plain colour). The phone can crop and resize but not paint, so the shade is added by the PDF.
 */
async function photoFor(city: PdfInput['city']): Promise<PdfPhoto | null> {
  try {
    const uri =
      typeof city.hero === 'number' ? (await Asset.fromModule(city.hero).downloadAsync()).localUri : uriOf(city.hero);
    if (!uri) return null;
    const whole = await ImageManipulator.manipulate(uri).renderAsync();
    // The largest piece of the photo with the band's shape, from its middle.
    const { width: cw, height: ch } = COVER_PHOTO;
    const k = Math.min(whole.width / cw, whole.height / ch);
    const width = Math.floor(cw * k);
    const height = Math.floor(ch * k);
    const cut = await ImageManipulator.manipulate(whole)
      .crop({ originX: Math.floor((whole.width - width) / 2), originY: Math.floor((whole.height - height) / 2), width, height })
      // Never enlarged: a small photo stays its own size and the PDF stretches it.
      .resize({ width: Math.min(cw, width) })
      .renderAsync();
    const saved = await cut.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
    whole.release();
    cut.release();
    return saved.base64 ? { jpeg: `data:image/jpeg;base64,${saved.base64}`, shaded: false } : null;
  } catch {
    return null;
  }
}
