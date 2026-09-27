import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { getDistrict } from '@/data/regions';
import type { LatLng } from '@/lib/geo';
import { guessFromClock, phaseAt, type SkyPhase } from '@/lib/sun';

import { useTrips } from './trips';

const EVERY = 5 * 60 * 1000;

const now = () => new Date();

const PHASES: SkyPhase[] = ['night', 'dawn', 'sunrise', 'day', 'sunset', 'dusk'];

// For reviewing the look: on the web, ?sky=dusk (or night, dawn, sunrise, day, sunset) holds that
// sky whatever the time. Read once, on load.
const PINNED = (() => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const asked = new URLSearchParams(window.location.search).get('sky');
  return PHASES.find((p) => p === asked) ?? null;
})();

/**
 * The sky's time of day, worked out on the phone. For a screen about one place, pass that place and
 * the sky is the one over it right now. Otherwise it's the sky at home: your home district's centre
 * if you picked one, else a guess from the phone's clock. Never your position, which the privacy
 * policy keeps for the location chip, drive times and arrival alerts only. Checked every five
 * minutes and whenever the app comes back to the front.
 */
export function useSkyPhase(place?: LatLng | null): SkyPhase {
  const { state } = useTrips();
  const [date, setDate] = useState(now);
  useEffect(() => {
    const tick = setInterval(() => setDate(now()), EVERY);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setDate(now()));
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, []);
  const at = place ?? getDistrict(state.homeDistrictId ?? undefined)?.centre ?? guessFromClock(date);
  return PINNED ?? phaseAt(at, date);
}

/** The sky over home. */
export const useHomeSky = () => useSkyPhase();
