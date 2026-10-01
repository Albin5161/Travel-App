import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { PixelRatio, Platform, Share, type View } from 'react-native';
import { captureRef } from '@/lib/capture';

import type { Party } from '@/data/planner';
import { drawCardImage, type CardData } from '@/lib/cardImage';
import type { PdfInput } from '@/lib/planPdf';

/**
 * Where a shared plan opens: the group vote on the public web build (EAS Hosting). There's no
 * backend, so a friend opening it gets the city's plan with the scripted group, and can vote.
 */
export const PLAN_LINK_BASE = 'https://xplore.expo.app';

/** The words that go with the card. A solo plan is shown off; everyone else is asked to vote. */
export function planMessage(cityName: string, cityId: string, stops: number, days: number, party: Party, code?: string) {
  // A shared trip goes as a join link, plus the code for anyone who'd rather type it into the app.
  // Without the backend, the link opens the demo vote.
  const link = code
    ? `\n${PLAN_LINK_BASE}/join/${code}\nOr in Xplore: Trips, Join, code ${code}`
    : `\n${PLAN_LINK_BASE}/group/${cityId}`;
  const span = days === 1 ? 'one day' : `${days} days`;
  switch (party) {
    case 'solo':
      return `My ${cityName} plan: ${stops} stops, ${span}. Made with Xplore.`;
    case 'partner':
      return `Our ${cityName} plan ❤️ ${stops} stops, ${span}. Keep, swap or drop anything before we lock it in 👇${link}`;
    case 'family':
      return `Family trip to ${cityName}! ${stops} stops, ${span}. Everyone vote before we book anything 👇${link}`;
    default:
      return `${cityName}, sorted. ${stops} stops, ${span}. Have a look and vote before we lock it in 👇${link}`;
  }
}

export type ShareResult = 'shared' | 'dismissed' | 'copied';
export type SaveResult = 'shared' | 'downloaded' | 'dismissed';

/** The two pictures: a 4:5 post (the tallest Instagram shows whole) and a 9:16 story. */
export type ImageKind = 'card' | 'story';
export const IMAGE_SIZE: Record<ImageKind, { width: number; height: number }> = {
  card: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

/**
 * How a phone pictures the card: a JPEG at the sizes above, like the web's. The capture takes its
 * size in points and saves at the screen's density, so on a 3× iPhone "1080 wide" came out 3240
 * wide, and as a PNG that was 15 MB. Dividing by the density gives the 1080 meant.
 */
const phoneShot = (kind: ImageKind) =>
  ({
    format: 'jpg',
    quality: 0.92,
    result: 'tmpfile',
    width: IMAGE_SIZE[kind].width / PixelRatio.get(),
    height: IMAGE_SIZE[kind].height / PixelRatio.get(),
  }) as const;

type WebNav = Navigator & { canShare?: (data: ShareData) => boolean };

/**
 * The web's picture of the card, drawn on a canvas (src/lib/cardImage.ts). Made ahead of the tap
 * (see the Share screen): an iPhone only opens the share sheet straight after a tap.
 */
export const webImageFile = drawCardImage;

/**
 * Saves the picture: into the share sheet where there is one (iPhone: Save Image, Instagram,
 * WhatsApp), else as a download. On a phone app, the system share sheet with the picture.
 */
export async function saveImage(
  view: RefObject<View | null>,
  kind: ImageKind,
  name: string,
  data: CardData,
  ready?: File | null,
): Promise<SaveResult> {
  if (Platform.OS === 'web') return deliver(ready ?? (await webImageFile(kind, data, name)));
  const uri = await captureRef(view, phoneShot(kind));
  await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'Save or share your plan' });
  return 'shared';
}

/**
 * The plan as a PDF: into the share sheet where there is one (iPhone: Save to Files, WhatsApp,
 * Mail), else as a download. The PDF code loads on the first ask; the website and the phone apps
 * each have their own way of making the file (planPdfSave).
 */
export async function savePlanPdf(input: PdfInput): Promise<SaveResult> {
  const { savePlanPdf: save } = await import('@/lib/planPdfSave');
  return save(input);
}

/**
 * Shares the card as an image with the message alongside.
 * - iOS: the system sheet takes the image and the text together.
 * - Android: its share intent through React Native carries text only, so the image goes through
 *   expo-sharing (without the text).
 * - Web: the picture and the text together where the browser can share files (iPhone, Android),
 *   the text alone where it can't, or the clipboard where there's no sharing at all.
 */
export async function sharePlanCard(card: RefObject<View | null>, message: string, file?: File | null): Promise<ShareResult> {
  if (Platform.OS === 'web') {
    const nav = navigator as WebNav;
    try {
      if (file && nav.canShare?.({ files: [file], text: message })) {
        await nav.share({ files: [file], text: message });
        return 'shared';
      }
      const res = await Share.share({ message });
      return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'dismissed';
      await Clipboard.setStringAsync(message);
      return 'copied';
    }
  }

  const uri = await captureRef(card, phoneShot('card'));
  if (Platform.OS === 'ios') {
    const res = await Share.share({ url: uri, message });
    return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
  }
  await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share your plan' });
  return 'shared';
}

/** A made file, on the web: the share sheet where the browser has one, else a download. */
export async function deliver(file: File): Promise<SaveResult> {
  const nav = navigator as WebNav;
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'dismissed';
      // Not allowed this time (the tap's moment passed): fall through to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
