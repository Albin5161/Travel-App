// Trip planning: the answers a traveller gives, the plan they get back, and the edits they make to
// it. The Planner interface is the seam: the rule-based engine below drives it for now, and a
// Gemini engine (behind a server function, so no key ships in the app) replaces it without any
// screen changing. Whatever engine arranges the places, travel times are always computed here.
import { travelLegFor, type Getting, type TravelMode } from '@/lib/geo';

import type { DayPart, Place } from './types';

export type When = 'this-weekend' | 'next-weekend' | 'dates' | 'flexible';
export type Pace = 'relaxed' | 'balanced' | 'packed';

export interface TripPrefs {
  when: When;
  /** First day, as YYYY-MM-DD. Null when the dates aren't known yet. */
  start: string | null;
  days: number;
  pace: Pace;
  getting: Getting;
}

export interface TripStop {
  place: Place;
  startMinutes: number;
  legBefore?: { minutes: number; km: number; mode: TravelMode };
  /** Kept where it is when the plan is regenerated. */
  pinned: boolean;
  /** Not one the traveller saved: a local pick filling a gap. */
  suggested: boolean;
}

export interface TripDay {
  date: string | null;
  stops: TripStop[];
  totalKm: number;
}

export interface TripPlan {
  cityId: string;
  prefs: TripPrefs;
  days: TripDay[];
  /** Saved places that aren't in the plan: they didn't fit, or were taken out. */
  left: Place[];
  /** Places the traveller took out. Regenerating keeps them out until they're added back. */
  removed: string[];
  seed: number;
}

export interface PlannerInput {
  cityId: string;
  saved: Place[];
  /** Local picks the planner may use to fill gaps, always marked as suggested. */
  suggestions: Place[];
  prefs: TripPrefs;
  /** Pinned stops and the day each is pinned to. */
  pins: { placeId: string; day: number }[];
  removed: string[];
  seed: number;
}

export interface Planner {
  name: string;
  plan(input: PlannerInput): Promise<TripPlan>;
}

/** Stops per day at each pace. */
export const PACE_STOPS: Record<Pace, number> = { relaxed: 3, balanced: 4, packed: 6 };
// A relaxed day starts later; a packed one earlier.
const DAY_START: Record<Pace, number> = { relaxed: 9 * 60, balanced: 8 * 60, packed: 7 * 60 };
const AFTERNOON = 12 * 60 + 30;
const EVENING = 16 * 60 + 30;
const PART_RANK: Record<DayPart, number> = { morning: 0, afternoon: 1, evening: 2 };

/** Which part of the day a start time falls in. Used for the list's section headers. */
export function partOf(minutes: number): DayPart {
  if (minutes < AFTERNOON) return 'morning';
  if (minutes < EVENING) return 'afternoon';
  return 'evening';
}

// ── Dates ────────────────────────────────────────────────────────────────────────────────────────

export function isoDay(d: Date) {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromIso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number) {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

/** The coming Saturday (today, if it is one), or the one after. Sunday counts as this weekend. */
export function weekend(today: Date, which: 'this' | 'next') {
  const dow = today.getDay();
  const base = new Date(today);
  if (dow === 0) base.setDate(base.getDate() - 1);
  else base.setDate(base.getDate() + ((6 - dow + 7) % 7));
  if (which === 'next') base.setDate(base.getDate() + 7);
  const start = isoDay(base);
  // A weekend already half gone starts today.
  if (dow === 0 && which === 'this') return { start: isoDay(today), days: 1 };
  return { start, days: 2 };
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sat 27 Sep". */
export function formatDay(iso: string) {
  const d = fromIso(iso);
  return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

/** "Sat 27 – Sun 28 Sep", or a single day. */
export function formatRange(start: string, days: number) {
  if (days <= 1) return formatDay(start);
  const a = fromIso(start);
  const b = fromIso(addDays(start, days - 1));
  const tail = `${WEEKDAY[b.getDay()]} ${b.getDate()} ${MONTH[b.getMonth()]}`;
  return a.getMonth() === b.getMonth()
    ? `${WEEKDAY[a.getDay()]} ${a.getDate()} – ${tail}`
    : `${formatDay(start)} – ${tail}`;
}

// ── Timing ───────────────────────────────────────────────────────────────────────────────────────

type Placed = { place: Place; pinned: boolean; suggested: boolean };

/**
 * Put clock times on a day's stops, in the order given. A stop never starts before its best part
 * of the day, so an evening place moved to the front waits for the evening: honest, if not ideal.
 */
export function timeDay(stops: Placed[], prefs: TripPrefs, date: string | null): TripDay {
  let cursor = DAY_START[prefs.pace];
  let totalKm = 0;
  const timed = stops.map((s, i) => {
    const prev = stops[i - 1];
    const legBefore = prev ? travelLegFor(prev.place.coords, s.place.coords, prefs.getting) : undefined;
    if (legBefore) {
      cursor += legBefore.minutes;
      totalKm += legBefore.km;
    }
    const earliest = s.place.bestTime === 'evening' ? EVENING : s.place.bestTime === 'afternoon' ? AFTERNOON : 0;
    const start = Math.round(Math.max(cursor, earliest) / 5) * 5;
    cursor = start + s.place.minutes;
    return { ...s, startMinutes: start, legBefore };
  });
  return { date, stops: timed, totalKm };
}

function retime(plan: TripPlan): TripPlan {
  return { ...plan, days: plan.days.map((d) => timeDay(d.stops, plan.prefs, d.date)) };
}

// ── The rule-based engine ────────────────────────────────────────────────────────────────────────

// A small seeded generator, so a regenerate is a different arrangement but the same seed always
// gives the same plan (useful when comparing engines later).
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function byBestTime(rand: () => number) {
  // Same part of the day: shuffled by the seed, so regenerating can reorder a morning.
  const jitter = new Map<string, number>();
  const key = (p: Place) => {
    if (!jitter.has(p.id)) jitter.set(p.id, rand());
    return jitter.get(p.id)!;
  };
  return (a: Place, b: Place) => PART_RANK[a.bestTime] - PART_RANK[b.bestTime] || key(a) - key(b);
}

/**
 * Groups saved places by area so each day stays in one part of the map, fills days up to the
 * pace, keeps pinned stops on their day, and offers one local pick where a day has no dinner.
 */
export const rulePlanner: Planner = {
  name: 'rules',
  async plan({ cityId, saved, suggestions, prefs, pins, removed, seed }) {
    const rand = random(seed);
    const cap = PACE_STOPS[prefs.pace];
    const n = Math.max(1, prefs.days);
    const days: Placed[][] = Array.from({ length: n }, () => []);
    const pinnedTo = new Map(pins.map((p) => [p.placeId, p.day]));
    const pool = saved.filter((p) => !removed.includes(p.id));

    for (const p of pool) {
      const d = pinnedTo.get(p.id);
      if (d !== undefined && d < n) days[d].push({ place: p, pinned: true, suggested: false });
    }
    const rest = pool.filter((p) => !(pinnedTo.has(p.id) && pinnedTo.get(p.id)! < n));

    // Areas, biggest first; equal sizes in seeded order. Days are tried in seeded order too.
    const byArea = new Map<string, Place[]>();
    for (const p of rest) byArea.set(p.area, [...(byArea.get(p.area) ?? []), p]);
    const areas = [...byArea.values()]
      .map((g) => ({ g, r: rand() }))
      .sort((a, b) => b.g.length - a.g.length || a.r - b.r)
      .map((x) => x.g);
    const dayOrder = Array.from({ length: n }, (_, i) => ({ i, r: rand() })).sort((a, b) => a.r - b.r).map((x) => x.i);
    const left: Place[] = [];
    const sort = byBestTime(rand);

    for (const group of areas) {
      for (const place of [...group].sort(sort)) {
        const room = (d: number) => cap - days[d].length;
        const sameArea = dayOrder.find((d) => room(d) > 0 && days[d].some((s) => s.place.area === place.area));
        const target = sameArea ?? [...dayOrder].sort((a, b) => room(b) - room(a))[0];
        if (target === undefined || room(target) <= 0) left.push(place);
        else days[target].push({ place, pinned: false, suggested: false });
      }
    }

    // One local pick per day that has room and no dinner, never the same pick twice.
    const offered = suggestions.filter((s) => !removed.includes(s.id) && !pool.some((p) => p.id === s.id));
    for (const d of days) {
      const noDinner = !d.some((s) => s.place.type === 'food' && s.place.bestTime === 'evening');
      if (d.length < cap && noDinner && offered.length) d.push({ place: offered.shift()!, pinned: false, suggested: true });
    }

    const plan: TripPlan = {
      cityId,
      prefs,
      days: days.map((d, i) => timeDay([...d].sort((a, b) => sort(a.place, b.place)), prefs, prefs.start ? addDays(prefs.start, i) : null)),
      left,
      removed,
      seed,
    };
    return plan;
  },
};

// ── Edits ────────────────────────────────────────────────────────────────────────────────────────
// Each returns a new, retimed plan. Taking out a place you saved puts it in `left` and remembers
// the decision, so a regenerate doesn't quietly bring it back.

function withoutStop(plan: TripPlan, day: number, placeId: string) {
  const stop = plan.days[day].stops.find((s) => s.place.id === placeId);
  const days = plan.days.map((d, i) => (i === day ? { ...d, stops: d.stops.filter((s) => s.place.id !== placeId) } : d));
  return { stop, days };
}

export function removeStop(plan: TripPlan, day: number, placeId: string): TripPlan {
  const { stop, days } = withoutStop(plan, day, placeId);
  if (!stop) return plan;
  return retime({
    ...plan,
    days,
    left: stop.suggested ? plan.left : [...plan.left, stop.place],
    removed: [...plan.removed, placeId],
  });
}

export function moveToDay(plan: TripPlan, from: number, placeId: string, to: number): TripPlan {
  const { stop, days } = withoutStop(plan, from, placeId);
  if (!stop || from === to) return plan;
  days[to] = { ...days[to], stops: [...days[to].stops, stop] };
  return retime({ ...plan, days });
}

export function reorder(plan: TripPlan, day: number, placeId: string, by: -1 | 1): TripPlan {
  const stops = [...plan.days[day].stops];
  const i = stops.findIndex((s) => s.place.id === placeId);
  const j = i + by;
  if (i < 0 || j < 0 || j >= stops.length) return plan;
  [stops[i], stops[j]] = [stops[j], stops[i]];
  return retime({ ...plan, days: plan.days.map((d, k) => (k === day ? { ...d, stops } : d)) });
}

export function swapStop(plan: TripPlan, day: number, placeId: string, next: Place, suggested: boolean): TripPlan {
  const old = plan.days[day].stops.find((s) => s.place.id === placeId);
  if (!old) return plan;
  const stops = plan.days[day].stops.map((s) => (s.place.id === placeId ? { ...s, place: next, pinned: false, suggested } : s));
  return retime({
    ...plan,
    days: plan.days.map((d, k) => (k === day ? { ...d, stops } : d)),
    left: [...plan.left.filter((p) => p.id !== next.id), ...(old.suggested ? [] : [old.place])],
    removed: [...plan.removed.filter((id) => id !== next.id), placeId],
  });
}

export function addStop(plan: TripPlan, day: number, place: Place, suggested: boolean): TripPlan {
  const stops = [...plan.days[day].stops, { place, startMinutes: 0, pinned: false, suggested }];
  return retime({
    ...plan,
    days: plan.days.map((d, k) => (k === day ? { ...d, stops } : d)),
    left: plan.left.filter((p) => p.id !== place.id),
    removed: plan.removed.filter((id) => id !== place.id),
  });
}

export function togglePin(plan: TripPlan, day: number, placeId: string): TripPlan {
  return {
    ...plan,
    days: plan.days.map((d, k) =>
      k === day ? { ...d, stops: d.stops.map((s) => (s.place.id === placeId ? { ...s, pinned: !s.pinned } : s)) } : d,
    ),
  };
}

export function pinsOf(plan: TripPlan) {
  return plan.days.flatMap((d, day) => d.stops.filter((s) => s.pinned && !s.suggested).map((s) => ({ placeId: s.place.id, day })));
}

/** Stops that are new, or moved to another day or position, between two plans. */
export function changedStops(before: TripPlan, after: TripPlan) {
  const where = (p: TripPlan) =>
    new Map(p.days.flatMap((d, day) => d.stops.map((s, i) => [s.place.id, `${day}:${i}`] as const)));
  const a = where(before);
  return new Set([...where(after)].filter(([id, at]) => a.get(id) !== at).map(([id]) => id));
}
