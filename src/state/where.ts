// Where to measure drive times from. Your real position when you've allowed it, the centre of your
// home district otherwise — so every distance on the map is honest about what it is measuring from.

import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { getDistrict } from '@/data/regions';
import { nearestTown } from '@/data/towns';
import { track } from '@/lib/analytics';
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

export type Here =
  | { status: 'unknown' }
  | { status: 'finding' }
  | { status: 'found'; town: string | null }
  | { status: 'off' };

/**
 * The town you're in, for the home screen's location chip. Asks for location only when `find` is
 * called (a tap), never on its own: an unasked-for prompt on launch mostly gets "Don't allow". If
 * it was allowed before, it looks straight away. The position is turned into a town name on the
 * phone (data/towns) and goes nowhere else.
 */
export function useHere(): { here: Here; find: () => void } {
  const [here, setHere] = useState<Here>({ status: 'unknown' });

  const locate = async () => {
    setHere({ status: 'finding' });
    const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 }).catch(() => null);
    const fix = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }).catch(() => null));
    const town = fix ? nearestTown({ lat: fix.coords.latitude, lng: fix.coords.longitude }) : null;
    setHere(fix ? { status: 'found', town } : { status: 'off' });
    return fix ? (town ? 'town' : 'no town') : 'no fix';
  };

  useEffect(() => {
    let alive = true;
    Location.getForegroundPermissionsAsync()
      .then((p) => {
        if (alive && p.granted) void locate();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const find = async () => {
    if (here.status === 'finding') return;
    const asked = await Location.requestForegroundPermissionsAsync().catch(() => null);
    if (!asked?.granted) {
      setHere({ status: 'off' });
      track('location asked', { result: 'denied' });
      return;
    }
    track('location asked', { result: await locate() });
  };

  return { here, find: () => void find() };
}
