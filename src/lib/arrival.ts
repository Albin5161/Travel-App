// Arrival notifications: one notification when you enter a district you have spots saved in.
//
// Deliberately NOT per-spot proximity. A "café 500 m away" ping fires while you are doing 60 on the
// bypass, needs one geofence per spot (iOS monitors 20 regions, full stop), and one badly-timed ping
// gets notifications switched off forever. A district arrival lands when plans are still soft, costs
// one region per district, and can say something useful: "6 spots you saved are here."
//
// The task is defined at module scope, as expo-location requires, and this module is imported by the
// root layout so the definition exists before any event can arrive.

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

export const ARRIVAL_TASK = 'xplore-district-arrival';
const CHANNEL_ID = 'arrivals';

/** Don't say the same thing twice in a day if you cross a district edge a few times. */
const REPEAT_GAP_MS = 6 * 60 * 60 * 1000;

export interface ArrivalTarget {
  districtId: string;
  name: string;
  centre: { lat: number; lng: number };
  radiusKm: number;
  spots: number;
  /** The cluster with the most spots in it, for the second line. */
  topArea: string | null;
  topAreaSpots: number;
}

/**
 * What the background task is allowed to know. A geofence event can wake the app when no React tree
 * exists, so the plan lives in module scope and the store pushes into it whenever spots change.
 */
let targets: Record<string, ArrivalTarget> = {};
let lastNotified: Record<string, number> = {};
let onArrive: ((districtId: string) => void) | null = null;

export function setArrivalTargets(next: ArrivalTarget[]) {
  targets = Object.fromEntries(next.map((t) => [t.districtId, t]));
}

/** Let the app react to an arrival while it is open (banner in the UI), not just via a notification. */
export function setArrivalListener(fn: ((districtId: string) => void) | null) {
  onArrive = fn;
}

export function clearArrivalHistory() {
  lastNotified = {};
}

function copy(t: ArrivalTarget) {
  const title = `You're in ${t.name}`;
  const spots = `${t.spots} ${t.spots === 1 ? 'spot' : 'spots'} you saved ${t.spots === 1 ? 'is' : 'are'} here`;
  const where = t.topArea && t.topAreaSpots > 1 ? `, ${t.topAreaSpots} of them around ${t.topArea}.` : '.';
  return { title, body: `${spots}${where}` };
}

/** Send the arrival notification for a district, unless we just did. Returns whether it went out. */
export async function notifyArrival(districtId: string, { force = false } = {}): Promise<boolean> {
  const target = targets[districtId];
  if (!target || target.spots === 0) return false;

  const now = Date.now();
  if (!force && now - (lastNotified[districtId] ?? 0) < REPEAT_GAP_MS) return false;
  lastNotified[districtId] = now;

  const { title, body } = copy(target);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { districtId },
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null),
    },
    // null fires it now rather than scheduling it.
    trigger: null,
  });
  onArrive?.(districtId);
  return true;
}

// Defined at module scope, and guarded so Fast Refresh can't register it twice.
if (!TaskManager.isTaskDefined(ARRIVAL_TASK)) {
  TaskManager.defineTask(ARRIVAL_TASK, async ({ data, error }) => {
    if (error) return;
    const { eventType, region } = (data ?? {}) as {
      eventType?: Location.LocationGeofencingEventType;
      region?: Location.LocationRegion;
    };
    // Only arrivals. Leaving a district is not news.
    if (eventType !== Location.LocationGeofencingEventType.Enter) return;
    if (!region?.identifier) return;
    await notifyArrival(region.identifier);
  });
}

export async function setUpNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Nearby saved spots',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
}

export type PermissionState = 'unknown' | 'granted' | 'denied';

export async function notificationPermission(ask: boolean): Promise<PermissionState> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!ask) return current.canAskAgain ? 'unknown' : 'denied';
  const next = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return next.granted ? 'granted' : 'denied';
}

/**
 * Foreground location, for "how far is this from me" on the map. Cheap, asked when it pays for itself.
 */
export async function foregroundPermission(ask: boolean): Promise<PermissionState> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return 'granted';
  if (!ask) return current.canAskAgain ? 'unknown' : 'denied';
  const next = await Location.requestForegroundPermissionsAsync();
  return next.granted ? 'granted' : 'denied';
}

/**
 * Always-on location, the only way arrivals can fire while the app is closed. The most expensive
 * permission in the app, so it is never asked at launch — only once a spot exists somewhere you
 * aren't, when the reason can be stated plainly.
 */
export async function backgroundPermission(ask: boolean): Promise<PermissionState> {
  const current = await Location.getBackgroundPermissionsAsync();
  if (current.granted) return 'granted';
  if (!ask) return current.canAskAgain ? 'unknown' : 'denied';
  // iOS will not show the Always prompt unless When In Use was granted first.
  const fg = await foregroundPermission(true);
  if (fg !== 'granted') return fg;
  const next = await Location.requestBackgroundPermissionsAsync();
  return next.granted ? 'granted' : 'denied';
}

/**
 * Start watching the districts that hold saved spots. Home is skipped — you are always in it — and
 * the list is capped below iOS's hard limit of 20 simultaneously monitored regions.
 */
export async function startArrivalWatch(all: ArrivalTarget[], homeDistrictId: string | null) {
  const watch = all
    .filter((t) => t.districtId !== homeDistrictId && t.spots > 0)
    .sort((a, b) => b.spots - a.spots)
    .slice(0, 18);

  setArrivalTargets(all);
  if (watch.length === 0) {
    await stopArrivalWatch();
    return 0;
  }

  await Location.startGeofencingAsync(
    ARRIVAL_TASK,
    watch.map((t) => ({
      identifier: t.districtId,
      latitude: t.centre.lat,
      longitude: t.centre.lng,
      radius: t.radiusKm * 1000,
      notifyOnEnter: true,
      notifyOnExit: false,
    })),
  );
  return watch.length;
}

export async function stopArrivalWatch() {
  if (await Location.hasStartedGeofencingAsync(ARRIVAL_TASK)) {
    await Location.stopGeofencingAsync(ARRIVAL_TASK);
  }
}

export const isWatching = () => Location.hasStartedGeofencingAsync(ARRIVAL_TASK);
