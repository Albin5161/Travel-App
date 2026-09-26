import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { Party } from '@/data/planner';

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
