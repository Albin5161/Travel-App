// Where the sun is, worked out on the phone from a place and a time: no service, nothing sent.
// Accurate to well under a degree, which is far finer than the sky needs.

import type { LatLng } from '@/lib/geo';

export type SkyPhase = 'night' | 'dawn' | 'sunrise' | 'day' | 'sunset' | 'dusk';

const RAD = Math.PI / 180;

/** The sun's height above the horizon in degrees, and whether it is climbing (before local noon). */
export function sunAt(at: LatLng, date: Date): { elevation: number; rising: boolean } {
  // Days since noon on 1 Jan 2000, the usual starting point for these formulas.
  const d = date.getTime() / 86400000 - 10957.5;
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const lambda = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const tilt = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(tilt) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(tilt) * Math.sin(lambda));
  const siderealDeg = (280.46061837 + 360.98564736629 * d + at.lng) % 360;
  // Hour angle, wrapped to -180…180: negative before the sun crosses the meridian.
  let ha = (siderealDeg * RAD - ra) / RAD;
  ha = ((((ha + 180) % 360) + 360) % 360) - 180;
  const lat = at.lat * RAD;
  const elevation =
    Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha * RAD)) / RAD;
  return { elevation, rising: ha < 0 };
}

/**
 * The sky's mood from the sun's height: night below civil twilight (-6°), dawn and dusk through
 * twilight, the warm low-sun hour after sunrise and before sunset, and day above 12°.
 */
export function phaseAt(at: LatLng, date: Date): SkyPhase {
  const { elevation, rising } = sunAt(at, date);
  if (elevation < -6) return 'night';
  if (elevation < 3) return rising ? 'dawn' : 'dusk';
  if (elevation < 12) return rising ? 'sunrise' : 'sunset';
  return 'day';
}

/**
 * A stand-in position when we know no place: the phone's time zone gives the longitude (15° an
 * hour), and a tropical latitude suits where most people using the app are. Good enough to put
 * dusk at dusk; the clock never leaves the phone.
 */
export function guessFromClock(date: Date): LatLng {
  return { lat: 15, lng: -date.getTimezoneOffset() / 4 };
}
