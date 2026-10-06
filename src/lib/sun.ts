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

/** The sun's height when its top edge touches the horizon, with the air's bending allowed for. */
const HORIZON = -0.833;

/**
 * The hours a place's clocks run ahead of UTC, in minutes, without a time-zone table. Planning a
 * trip in your own country (nearly every trip here), the phone's own zone is the answer, so a zone
 * that isn't a whole number of hours (India's +5:30) comes out right. Somewhere far from the
 * phone's zone, the longitude gives the nearest whole hour: within an hour of the truth.
 */
export function clockOffsetMinutes(at: LatLng, date: Date = new Date()): number {
  const phone = -date.getTimezoneOffset();
  const here = (at.lng / 15) * 60;
  return Math.abs(here - phone) <= 120 ? phone : Math.round(at.lng / 15) * 60;
}

/**
 * Sunrise and sunset at a place on a calendar day, as minutes after midnight on that place's clocks.
 * The same sun as the sky behind the app (sunAt), searched for the moment it crosses the horizon.
 * `offset` is the place's clock offset from UTC in minutes. Null near the poles, where it may not rise or set.
 */
export function sunTimes(at: LatLng, day: { y: number; m: number; d: number }, offset = clockOffsetMinutes(at)): { sunrise: number; sunset: number } | null {
  const midnight = Date.UTC(day.y, day.m - 1, day.d) - offset * 60000;
  const height = (minutes: number) => sunAt(at, new Date(midnight + minutes * 60000)).elevation - HORIZON;
  // The sun is highest at solar noon: 12:00 where the clock matches the longitude, shifted by how far it doesn't.
  const noon = 720 + offset - (at.lng / 15) * 60;
  if (height(noon) <= 0 || height(noon - 720) >= 0 || height(noon + 720) >= 0) return null;
  const cross = (lo: number, hi: number) => {
    // height(lo) and height(hi) differ in sign; close in on the minute between them.
    const rising = height(lo) < 0;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (height(mid) < 0 === rising) lo = mid;
      else hi = mid;
    }
    return Math.round((lo + hi) / 2);
  };
  return { sunrise: cross(noon - 720, noon), sunset: cross(noon, noon + 720) };
}
