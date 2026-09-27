import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { getDistrict } from '@/data/regions';
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
 * The sky for where you are, worked out on the phone: your home district's centre if you picked
 * one, otherwise a guess from the phone's clock. Never your position, which the privacy policy
 * promises stays unused for anything but the location chip, drive times and arrival alerts.
 * Checked every five minutes and whenever the app comes back to the front.
 */
export function useHomeSky(): SkyPhase {
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
  const at = getDistrict(state.homeDistrictId ?? undefined)?.centre ?? guessFromClock(date);
  return PINNED ?? phaseAt(at, date);
}
