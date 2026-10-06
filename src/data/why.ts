import { distanceKm, formatClock, formatDuration } from '@/lib/geo';

import { isCustom } from './custom';
import { partOf, type TripPlan, type TripStop } from './planner';
import { DINNER_WINDOW, kindOf, LUNCH_WINDOW, sunFor } from './planner/schedule';

// Why a plan is the way it is, in words for the traveller: read off the plan itself (where its stops
// are, when each happens, how long is spent getting between them), so it stays true after any edit,
// and says only what is really so. The planner keeps places that are near each other on one day,
// puts each at a good time (lunch at lunchtime, a sunset place at sunset), and keeps travel and
// waiting down; these lines say which of those a day or a stop shows.

export type Reason = { lead: string; text: string };

/** Close enough to call a day compact. */
const COMPACT_KM = 5;
/** Little enough time on the road to say so. */
const LIGHT_ROAD_MIN = 60;
/** Enough time on the road that the day is as much a drive as a day out: worth saying plainly. */
const LONG_ROAD_MIN = 180;
/** A wait this long before a stop is called what it is: free time. */
const FREE_TIME_MIN = 120;

/** Sunset on a plan's day, where its stops are. */
const sunsetOn = (plan: TripPlan, day: number) => {
  const d = plan.days[day];
  return sunFor(plan.prefs.stay?.coords ?? d.stops[0]?.place.coords ?? null, d.date).sunset;
};
/** A stop the sun goes down during: a sunset place, there at sunset. */
const atSunset = (s: TripStop, sunset: number) =>
  kindOf(s.place) === 'sunset' && s.startMinutes <= sunset - 10 && s.startMinutes + s.place.minutes >= sunset - 5;
const within = (minutes: number, [from, to]: readonly [number, number] | number[]) => minutes >= from - 5 && minutes <= to + 5;

const RANK = { morning: 0, afternoon: 1, evening: 2 } as const;

const PACE_LEAD = { relaxed: 'A relaxed day', balanced: 'A comfortable day', packed: 'A full day' } as const;

/** Up to three reasons a day is arranged the way it is, most convincing first. */
export function whyDay(plan: TripPlan, day: number): Reason[] {
  const d = plan.days[day];
  const stops = d?.stops ?? [];
  if (stops.length === 0) {
    // Nothing to see, only the drive to where tonight is spent (or back from where last night was).
    return d?.home ? [{ lead: 'A travel day', text: `About ${formatDuration(d.home.minutes)} on the road, by our estimate: the drive is the day.` }] : [];
  }
  const out: Reason[] = [];

  // A journey, not a loop: the day starts or ends somewhere other than the base.
  const nights = plan.nights ?? [];
  const woke = day > 0 ? nights[day - 1] : null;
  if (d.sleep) {
    out.push({
      lead: `Tonight in ${d.sleep.name}`,
      text: `The day ends there instead of driving back${plan.prefs.stay ? ` to ${plan.prefs.stay.name}` : ''}, so tomorrow starts from ${d.sleep.name}.`,
    });
  } else if (woke) {
    out.push({ lead: `From ${woke.name}`, text: `The day starts where last night was spent${plan.prefs.stay ? ` and ends back in ${plan.prefs.stay.name}` : ''}.` });
  }

  // Where: close together, or at least never doubling back.
  const real = stops.filter((s) => !isCustom(s.place));
  const spread = maxSpreadKm(real);
  const here = areasOf(real);
  if (real.length >= 2 && spread <= COMPACT_KM) {
    out.push({
      lead: 'Close together',
      text: `All ${real.length} stops are within ${round(spread)} km of each other${here.length ? `, around ${list(here)}` : ''}, so there are no long rides.`,
    });
  }

  // When: the sunset place at sunset, lunch at lunchtime, or each place in its best part of the day.
  const sunset = sunsetOn(plan, day);
  const dusk = stops.find((s) => atSunset(s, sunset));
  const lunch = stops.find((s) => s.place.type === 'food' && within(s.startMinutes, LUNCH_WINDOW));
  const evening = stops.filter((s) => s.place.bestTime === 'evening' && partOf(s.startMinutes) === 'evening' && !s.suggested);
  const morning = stops.filter((s) => s.place.bestTime === 'morning' && partOf(s.startMinutes) === 'morning' && !s.suggested);
  if (dusk) {
    out.push({ lead: 'There for the sunset', text: `${dusk.place.name} is timed for the sunset, about ${formatClock(sunset)}.` });
  } else if (lunch && stops.length >= 3) {
    out.push({ lead: 'Lunch at lunchtime', text: `${lunch.place.name} at ${formatClock(lunch.startMinutes)}, between the morning’s stops and the afternoon’s.` });
  } else if (evening.length && morning.length) {
    out.push({
      lead: 'Timed right',
      text: `${morning[0].place.name} in the morning and ${names(evening)} in the evening, each at its best time.`,
    });
  } else if (evening.length) {
    out.push({ lead: 'Timed right', text: `${names(evening)} ${evening.length === 1 ? 'is' : 'are'} kept for the evening, ${evening.length === 1 ? 'its' : 'their'} best time.` });
  }

  // Getting around: the time spent on the road, all day.
  const road = stops.reduce((m, s) => m + (s.legBefore?.minutes ?? 0), 0) + (d.home?.minutes ?? 0);
  if (road >= LONG_ROAD_MIN) {
    out.push({ lead: 'A long day on the road', text: `About ${formatDuration(road)} of travel (${round(d.totalKm)} km), estimated from the distances, not from live traffic. A night nearer would shorten it.` });
  } else if (road > 0) {
    out.push({
      lead: road <= LIGHT_ROAD_MIN ? 'Little time on the road' : 'Travel kept down',
      text: `About ${formatDuration(road)} of travel all day (${round(d.totalKm)} km), in the order that wastes the least of it.`,
    });
  }

  // Several days: each keeps to its own part of the map.
  if (plan.days.length > 1 && here.length) {
    const elsewhere = new Set(plan.days.flatMap((o, i) => (i === day ? [] : areasOf(o.stops.filter((s) => !isCustom(s.place))))));
    if (elsewhere.size && here.every((a) => !elsewhere.has(a))) {
      out.push({ lead: 'One side of town', text: `This day keeps to ${list(here)}, so no day crosses back over another.` });
    }
  }

  // How long: out and back, at the chosen pace.
  const first = stops[0];
  const last = stops[stops.length - 1];
  const start = first.startMinutes - (first.legBefore?.minutes ?? 0);
  const end = last.startMinutes + last.place.minutes + (d.home?.minutes ?? 0);
  out.push({
    lead: PACE_LEAD[plan.prefs.pace],
    text: `Out from ${formatClock(start)} to ${formatClock(end)}${plan.prefs.pace === 'relaxed' ? ', with a slow start' : ''}.`,
  });

  return out.slice(0, 3);
}

/** Why this stop is here, at this time: one short line, or null when there's nothing to add. */
export function whyStop(plan: TripPlan, day: number, index: number): string | null {
  const stops = plan.days[day]?.stops ?? [];
  const s = stops[index];
  if (!s) return null;
  const p = s.place;
  const part = partOf(s.startMinutes);
  const prev = stops[index - 1];

  if (s.suggested) {
    return p.type === 'food' && part === 'evening' ? 'Dinner nearby: the day had no evening meal.' : 'A local pick close to your stops.';
  }
  if (isCustom(p)) return `Your own stop, in the ${p.bestTime} as asked.`;
  if (s.pinned) return 'Locked by you: it stays on this day when you reshuffle.';
  // A long wait before it is said, not hidden: it's free time, because nothing saved fills it.
  const waited = prev ? s.startMinutes - (prev.startMinutes + prev.place.minutes) - (s.legBefore?.minutes ?? 0) : 0;
  const free = waited >= FREE_TIME_MIN ? ` The ${formatDuration(Math.round(waited / 15) * 15)} before it are free: nothing you saved fits there.` : '';
  // What the clock says first: a sunset caught, a meal at its hour.
  if (atSunset(s, sunsetOn(plan, day))) return `Timed for the sunset, about ${formatClock(sunsetOn(plan, day))}.${free}`;
  if (p.type === 'food') {
    if (within(s.startMinutes, LUNCH_WINDOW)) return index === 0 ? 'Lunch, to start the day.' : 'Lunch, between the morning and the afternoon.';
    if (within(s.startMinutes, DINNER_WINDOW)) return `Dinner, to end the day.${free}`;
    if (s.startMinutes < 10 * 60 && index === 0) return 'Breakfast, to start the day.';
    return kindOf(p) === 'cafe' ? 'A break between stops.' : null;
  }
  // Away from its best part of the day: it fitted the rest of the day better here, or was moved by hand.
  if (RANK[p.bestTime] !== RANK[part]) return `Best in the ${p.bestTime}; it’s here to keep the day’s route short and without long waits.`;
  if (index === 0) {
    if (plan.prefs.stay && (s.legBefore?.minutes ?? 99) <= 15) return `First: close to ${plan.prefs.stay.name}.`;
    return `Starts the day: the ${part} is its best time.`;
  }
  if (p.bestTime === 'evening') return index === stops.length - 1 ? 'Ends the day: the evening is its best time.' : 'Saved for the evening, its best time.';
  if (prev && (s.legBefore?.minutes ?? 99) <= 15) return `A short hop from ${prev.place.name}.`;
  return null;
}

function maxSpreadKm(stops: TripStop[]) {
  let max = 0;
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) max = Math.max(max, distanceKm(stops[i].place.coords, stops[j].place.coords));
  }
  return max;
}

/** The areas a day's stops are in, most stops first, at most two: "Kudle and Om Beach". */
function areasOf(stops: TripStop[]) {
  const count = new Map<string, number>();
  for (const s of stops) {
    const a = s.place.area.split(',')[0].trim();
    if (a) count.set(a, (count.get(a) ?? 0) + 1);
  }
  return [...count.entries()].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([a]) => a);
}

const round = (km: number) => (km < 10 ? Math.max(0.1, Math.round(km * 10) / 10) : Math.round(km));
const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const names = (ss: TripStop[]) => list(ss.map((s) => s.place.name));
