// Where to measure drive times from. Your real position when you've allowed it, the centre of your
// home district otherwise — so every distance on the map is honest about what it is measuring from.

import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { getDistrict } from '@/data/regions';
import type { LatLng } from '@/lib/geo';

import { useTrips } from './trips';

export interface Where {
  at: LatLng;
  /** Whether `at` is the device's position or a stand-in. Shown in the UI, never hidden. */
  source: 'device' | 'home';
  label: string;
}

export function useWhereIAm(): Where {
  const { state } = useTrips();
  const home = getDistrict(state.homeDistrictId ?? undefined);
  const [device, setDevice] = useState<LatLng | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const granted = (await Location.getForegroundPermissionsAsync().catch(() => null))?.granted;
      if (!granted) {
        if (alive) setDevice(null);
        return;
      }
      // Last known first: it answers instantly and is plenty for a drive-time estimate.
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      const fix = last ?? (await Location.getCurrentPositionAsync().catch(() => null));
      if (alive && fix) setDevice({ lat: fix.coords.latitude, lng: fix.coords.longitude });
    })();
    return () => {
      alive = false;
    };
  }, [state.homeDistrictId]);

  if (device) return { at: device, source: 'device', label: 'from where you are' };
  const fallback = home?.centre ?? { lat: 9.62, lng: 76.55 };
  return { at: fallback, source: 'home', label: `from ${home?.name ?? 'home'}` };
}
