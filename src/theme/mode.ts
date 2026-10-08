import { DevSettings, Platform } from 'react-native';

import { deviceStorage } from '@/lib/live/storage';

// Which of the app's two looks is on. "sky" is the time-of-day sky with glass over it; "light" is
// the paper look: a pale canvas, white panels, ink type. The choice is read once, as the app
// starts, because every screen's styles are built from the semantic colours (theme/sky) as its
// file loads; changing it starts the app again, which takes a moment and happens rarely.
export type Mode = 'sky' | 'light';

const KEY = 'xplore.mode';

// For reviewing a look on the web without changing the saved choice: ?mode=light or ?mode=sky.
const asked = (() => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('mode');
})();

function read(): Mode {
  let saved: string | null = null;
  try {
    saved = deviceStorage?.getItem(KEY) ?? null;
  } catch {
    // No storage: the sky, as before there was a choice.
  }
  return (asked ?? saved) === 'light' ? 'light' : 'sky';
}

export const MODE: Mode = read();
export const isLight = MODE === 'light';

/**
 * Saves the look and starts the app again in it. Returns false when it couldn't restart by itself
 * (a phone build outside development), so the caller can say to close and reopen the app.
 */
export function setMode(next: Mode): boolean {
  try {
    deviceStorage?.setItem(KEY, next);
  } catch {
    return false;
  }
  if (Platform.OS === 'web') {
    // Without ?mode=, or the address would go on overriding what was just chosen.
    const url = new URL(window.location.href);
    url.searchParams.delete('mode');
    window.location.replace(url.toString());
    return true;
  }
  if (__DEV__) {
    DevSettings.reload();
    return true;
  }
  return false;
}
