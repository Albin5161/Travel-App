// Wires the arrival machinery to the store: keeps the background task's view of your spots current,
// starts and stops the geofences, and turns a tapped notification into a screen.

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  backgroundPermission,
  foregroundPermission,
  isWatching,
  notificationPermission,
  notifyArrival,
  setArrivalListener,
  setArrivalTargets,
  setUpNotifications,
  startArrivalWatch,
  stopArrivalWatch,
  type PermissionState,
} from '@/lib/arrival';

import { useArrivalTargets, useTrips } from './trips';

export interface Permissions {
  notifications: PermissionState;
  foreground: PermissionState;
  background: PermissionState;
}

const openDistrict = (districtId: string) =>
  router.push({ pathname: '/map', params: { district: districtId } });

/**
 * Held by the tab layout, so it is alive for as long as the app is. Returns everything the Profile
 * tab needs to explain and control what is happening.
 */
export function useArrivalWatch() {
  const { state, dispatch } = useTrips();
  const targets = useArrivalTargets();
  const { homeDistrictId, notifyOnArrival } = state;

  const [permissions, setPermissions] = useState<Permissions>({
    notifications: 'unknown',
    foreground: 'unknown',
    background: 'unknown',
  });
  const [watching, setWatching] = useState(0);

  const refresh = useCallback(async () => {
    const [notifications, foreground, background] = await Promise.all([
      notificationPermission(false),
      foregroundPermission(false),
      backgroundPermission(false),
    ]);
    setPermissions({ notifications, foreground, background });
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await setUpNotifications().catch(() => {});
      const [notifications, foreground, background] = await Promise.all([
        notificationPermission(false),
        foregroundPermission(false),
        backgroundPermission(false),
      ]);
      if (alive) setPermissions({ notifications, foreground, background });
    })();
    return () => {
      alive = false;
    };
  }, []);

  // The background task can't reach React state, so push the plan into module scope on every change.
  // This happens whatever the permissions are, so Simulate arrival works before anything is granted.
  useEffect(() => {
    setArrivalTargets(targets);
  }, [targets]);

  // An arrival while the app is open shows a banner rather than relying on the notification alone.
  useEffect(() => {
    setArrivalListener((districtId) => dispatch({ type: 'arrived', districtId }));
    return () => setArrivalListener(null);
  }, [dispatch]);

  // Tapping the notification opens that district on the map.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((event) => {
      const districtId = event.notification.request.content.data?.districtId;
      if (typeof districtId === 'string') openDistrict(districtId);
    });
    return () => sub.remove();
  }, []);

  // Register or tear down the geofences whenever the reason to watch changes.
  const canWatch = permissions.background === 'granted' && notifyOnArrival;
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!canWatch) {
        await stopArrivalWatch().catch(() => {});
        if (alive) setWatching(0);
        return;
      }
      const n = await startArrivalWatch(targets, homeDistrictId).catch(() => 0);
      if (alive) setWatching(n);
    })();
    return () => {
      alive = false;
    };
  }, [canWatch, targets, homeDistrictId]);

  const ask = useCallback(
    async (which: keyof Permissions) => {
      const fn =
        which === 'notifications'
          ? notificationPermission
          : which === 'foreground'
            ? foregroundPermission
            : backgroundPermission;
      const result = await fn(true).catch<PermissionState>(() => 'denied');
      await refresh();
      return result;
    },
    [refresh],
  );

  /**
   * Run the real arrival path for a district without going there. Background geofencing needs a
   * development build, so this is how the flow is shown on a phone running Expo Go.
   *
   * Unlike a real arrival, this also opens the map: it is triggered deliberately from Profile, and
   * showing the notification alone would leave the person looking at the screen they pressed.
   */
  const simulate = useCallback(
    async (districtId: string) => {
      const sent = await notifyArrival(districtId, { force: true }).catch(() => false);
      // notifyArrival's listener sets this when it fires; set it anyway so a blocked
      // notification permission still produces the banner rather than nothing at all.
      dispatch({ type: 'arrived', districtId });
      openDistrict(districtId);
      return sent;
    },
    [dispatch],
  );

  return { permissions, ask, refresh, watching, simulate, isWatching, targets };
}
