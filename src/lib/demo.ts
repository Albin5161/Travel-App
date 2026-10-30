// Demo mode (Albin, 31 Oct 2026, for showing Xplore on stage): everything saved on this phone is
// set aside and the app starts again empty, as for someone new, but past the intro and still
// knowing home. Pasting a video then shows the whole read from the start. Switching it off puts
// the real copy back, and whatever was saved during the demo goes with the demo.
//
// While it's on, nothing goes to or comes from the account's backup (lib/live/account): the empty
// copy must never be merged into the real one, nor the real one into the demo.

import { reloadAppAsync } from 'expo';
import { Platform } from 'react-native';

import { deviceStorage } from '@/lib/live/storage';

/** Where the trips are saved on this phone (state/trips). */
const TRIPS_KEY = 'xplore.trips.v1';
const DEMO_KEY = 'xplore.demo';
/** The real copy, set aside while the demo runs. */
const KEPT_KEY = 'xplore.demo.kept';

const read = (key: string) => {
  try {
    return deviceStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const write = (key: string, value: string | null) => {
  if (value === null) deviceStorage?.removeItem(key);
  else deviceStorage?.setItem(key, value);
};

/** Read once at start: the app restarts whenever it changes. */
export const demoOn = read(DEMO_KEY) === '1';

/** An empty copy that keeps only what spares the demo the setup: the intro done, home, alerts. */
function emptyCopy(real: string | null): string {
  let kept: { homeDistrictId?: string | null; notifyOnArrival?: boolean } = {};
  try {
    kept = real ? JSON.parse(real) : {};
  } catch {
    // Unreadable: the demo just starts without a home.
  }
  return JSON.stringify({
    v: 1,
    pricesHonest: true,
    homeDistrictId: kept.homeDistrictId ?? null,
    spotStatus: {},
    recapped: {},
    notifyOnArrival: kept.notifyOnArrival ?? true,
    onboarded: true,
    collections: {},
    skipped: {},
    addedLocals: {},
    savedTrips: {},
    tripPlans: {},
    groups: {},
    remote: {},
    homeTab: 'cities',
    draft: null,
    inbox: [],
    live: { places: [], cities: [], reels: [], placedAt: {} },
  });
}

/**
 * Turns the demo on or off and starts the app again on Home. Saved and straight into the restart,
 * before the running app can save its own copy over the swap. Resolves false if it couldn't
 * restart by itself (the swap is done; closing and opening the app finishes it).
 */
export async function setDemo(on: boolean): Promise<boolean> {
  if (on === demoOn) return true;
  try {
    if (on) {
      const real = read(TRIPS_KEY);
      write(KEPT_KEY, real ?? '');
      write(TRIPS_KEY, emptyCopy(real));
      write(DEMO_KEY, '1');
    } else {
      const kept = read(KEPT_KEY);
      write(TRIPS_KEY, kept ? kept : null);
      write(KEPT_KEY, null);
      write(DEMO_KEY, null);
    }
  } catch {
    return false;
  }
  if (Platform.OS === 'web') {
    window.location.replace('/');
    return true;
  }
  try {
    await reloadAppAsync(on ? 'Demo mode on' : 'Demo mode off');
    return true;
  } catch {
    return false;
  }
}
