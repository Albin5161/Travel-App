import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * Where a shared plan opens. The POC has no backend, so this is the public web build; null until
 * that link is settled, and the message simply goes without one.
 */
export const PLAN_LINK_BASE: string | null = null;

export function planMessage(cityName: string, stops: number, days: number) {
  const link = PLAN_LINK_BASE ? `\n${PLAN_LINK_BASE}/plan/${cityName.toLowerCase()}` : '';
  const span = days === 1 ? 'one day' : `${days} days`;
  return `${cityName}, sorted. ${stops} stops, ${span}. Have a look and vote before we lock it in 👇${link}`;
}

export type ShareResult = 'shared' | 'dismissed' | 'copied';

/**
 * Shares the card as an image with the message alongside.
 * - iOS: the system sheet takes the image and the text together.
 * - Android: its share intent through React Native carries text only, so the image goes through
 *   expo-sharing (without the text).
 * - Web: no local files; the text goes to the Web Share API, or the clipboard where there isn't one.
 */
export async function sharePlanCard(card: RefObject<View | null>, message: string): Promise<ShareResult> {
  if (Platform.OS === 'web') {
    try {
      const res = await Share.share({ message });
      return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
    } catch {
      await Clipboard.setStringAsync(message);
      return 'copied';
    }
  }

  const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
  if (Platform.OS === 'ios') {
    const res = await Share.share({ url: uri, message });
    return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
  }
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your plan' });
  return 'shared';
}
