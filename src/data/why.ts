import { distanceKm, formatClock, formatDuration } from '@/lib/geo';

import { isCustom } from './custom';
import { partOf, type TripPlan, type TripStop } from './planner';

// Why a plan is the way it is, in words for the traveller: read off the plan itself (where its stops
// are, when each is at its best, how long is spent getting between them), so it stays true after
// any edit, and says only what the planner really did. It groups places within reach of each other
// on one day, orders each day morning → afternoon → evening, nearest next stop first, never starts a
// place before its best part of the day, and adds a dinner nearby when a day has none.

export type Reason = { lead: string; text: string };

/** Close enough to call a day compact. */
const COMPACT_KM = 5;
/** Little enough time on the road to say so. */
const LIGHT_ROAD_MIN = 60;

const RANK = { morning: 0, afternoon: 1, evening: 2 } as const;

const PACE_LEAD = { relaxed: 'A relaxed day', balanced: 'A comfortable day', packed: 'A full day' } as const;

/** Up to three reasons a day is arranged the way it is, most convincing first. */
export function whyDay(plan: TripPlan, day: number): Reason[] {
  const d = plan.days[day];
  const stops = d?.stops ?? [];
  if (stops.length === 0) return [];
  const out: Reason[] = [];

  // Where: close together, or at least never doubling back.
  const real = stops.filter((s) => !isCustom(s.place));
  const spread = maxSpreadKm(real);
  const here = areasOf(real);
  if (real.length >= 2 && spread <= COMPACT_KM) {
    out.push({
      lead: 'Close together',
      text: `All ${real.length} stops are within ${round(spread)} km of each other${here.length ? `, around ${list(here)}` : ''}, so there are no long rides.`,
    });
  } else if (stops.length >= 3) {
    out.push({ lead: 'No doubling back', text: 'Each stop leads to the nearest next one, so the route runs one way through the day.' });
  }

  // When: each place at its best part of the day.
  const evening = stops.filter((s) => s.place.bestTime === 'evening' && partOf(s.startMinutes) === 'evening' && !s.suggested);
  const morning = stops.filter((s) => s.place.bestTime === 'morning' && partOf(s.startMinutes) === 'morning' && !s.suggested);
  if (evening.length && morning.length) {
    out.push({
      lead: 'Timed right',
      text: `${morning[0].place.name} in the morning and ${names(evening)} in the evening, each at its best time.`,
    });
  } else if (evening.length) {
    out.push({ lead: 'Timed right', text: `${names(evening)} ${evening.length === 1 ? 'is' : 'are'} kept for the evening, ${evening.length === 1 ? 'its' : 'their'} best time.` });
  }

  // Getting around: the time spent on the road, all day.
  const road = stops.reduce((m, s) => m + (s.legBefore?.minutes ?? 0), 0) + (d.home?.minutes ?? 0);
  if (road > 0) {
    out.push({
      lead: road <= LIGHT_ROAD_MIN ? 'Little time on the road' : 'The shortest way round',
      text: `About ${formatDuration(road)} of travel all day (${round(d.totalKm)} km), in the shortest order we found.`,
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
  if (s.pinned) return 'You pinned it here, so it stays when you reshuffle.';
  // Earlier than its best time: the planner never does that, so it was moved by hand. Later: the
  // stops before it ran on, and this is the first slot after them.
  if (RANK[p.bestTime] > RANK[part]) return `Best in the ${p.bestTime}; moved earlier by you.`;
  if (RANK[p.bestTime] < RANK[part]) return `Best in the ${p.bestTime}; the first slot after the stops before it.`;
  if (index === 0) {
    if (plan.prefs.stay) return `First: the nearest stop to ${plan.prefs.stay.name}.`;
    return part === 'morning' ? 'First, so the day has the shortest route.' : `Starts the day: the ${part} is its best time.`;
  }
  if (p.bestTime === 'evening') return index === stops.length - 1 ? 'Ends the day: the evening is its best time.' : 'Saved for the evening, its best time.';
  if (p.bestTime === 'afternoon' && prev && prev.place.bestTime === 'morning') return 'After lunch: the afternoon is its best time.';
  return prev ? `The nearest next stop after ${prev.place.name}.` : null;
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
