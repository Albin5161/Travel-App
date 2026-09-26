// Trip planning: the answers a traveller gives, the plan they get back, and the edits they make to
// it. The Planner interface is the seam: the rule-based engine below drives it for now, and a
// Gemini engine (behind a server function, so no key ships in the app) replaces it without any
// screen changing. Whatever engine arranges the places, travel times are always computed here.
import { travelLegFor, type Getting, type LatLng, type Terrain, type TravelMode } from '@/lib/geo';

import type { DayPart, Place } from './types';

export type When = 'this-weekend' | 'next-weekend' | 'dates' | 'flexible';
export type Pace = 'relaxed' | 'balanced' | 'packed';
/** Who's going. Decides whether there's a vote, and who's in it. */
export type Party = 'solo' | 'partner' | 'friends' | 'family';

export interface TripPrefs {
  /** Absent on plans made before the question existed: those count as friends. */
  party?: Party;
  when: When;
  /** First day, as YYYY-MM-DD. Null when the dates aren't known yet. */
  start: string | null;
  days: number;
  pace: Pace;
  getting: Getting;
  /** Mountains, hills or flat, for travel times: the city's, or guessed from its places. */
  terrain?: Terrain;
  /** Where the traveller sleeps: each day starts and ends here. Absent or null when not known. */
  stay?: Stay | null;
}

/** A place to sleep, found with Google. Its coordinates may be kept 30 days (`at`), then looked up again. */
export interface Stay {
  name: string;
  coords: LatLng;
  at: number;
}

/** The travel side of a trip's answers: how to get around, over what land, from where. */
type Trip = { getting: Getting; terrain: Terrain; base: LatLng | null };
const tripOf = (prefs: TripPrefs): Trip => ({
  getting: prefs.getting,
  terrain: prefs.terrain ?? 'flat',
  base: prefs.stay?.coords ?? null,
});
const leg = (a: LatLng, b: LatLng, t: Trip) => travelLegFor(a, b, t.getting, t.terrain);

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
  /** Back to where you're staying after the last stop, when that's known. */
  home?: { minutes: number; km: number; mode: TravelMode };
}

export interface TripPlan {
  cityId: string;
  prefs: TripPrefs;
  days: TripDay[];
  /** Saved places that aren't in the plan: they didn't fit, or were taken out. */
  left: Place[];
  /** Why a place didn't fit, by place id, in words for the traveller. Absent for ones taken out. */
  leftWhy?: Record<string, string>;
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

export const partyOf = (prefs: TripPrefs): Party => prefs.party ?? 'friends';

/** Stops per day at each pace: an upper limit. The hours below are what actually fill a day. */
export const PACE_STOPS: Record<Pace, number> = { relaxed: 3, balanced: 4, packed: 6 };
/** Hours of seeing and getting around in a day at each pace, driving between stops included. */
export const PACE_HOURS: Record<Pace, number> = { relaxed: 6, balanced: 8, packed: 10 };
/** Places this close (the drive or walk between them) make one outing, kept on one day if they fit. */
const NEARBY_MINUTES = 45;
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
  const t = tripOf(prefs);
  // The day starts when you set out: from where you're staying when that's known.
  let cursor = DAY_START[prefs.pace];
  let totalKm = 0;
  const timed = stops.map((s, i) => {
    const from = i > 0 ? stops[i - 1].place.coords : t.base;
    const legBefore = from ? leg(from, s.place.coords, t) : undefined;
    if (legBefore) {
      cursor += legBefore.minutes;
      totalKm += legBefore.km;
    }
    const earliest = s.place.bestTime === 'evening' ? EVENING : s.place.bestTime === 'afternoon' ? AFTERNOON : 0;
    const start = Math.round(Math.max(cursor, earliest) / 5) * 5;
    cursor = start + s.place.minutes;
    return { ...s, startMinutes: start, legBefore };
  });
  const last = stops[stops.length - 1];
  const home = t.base && last ? leg(last.place.coords, t.base, t) : undefined;
  if (home) totalKm += home.km;
  return { date, stops: timed, totalKm, ...(home ? { home } : {}) };
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

const PARTS: DayPart[] = ['morning', 'afternoon', 'evening'];
const legMinutes = (a: LatLng, b: LatLng, t: Trip) => leg(a, b, t).minutes;

/**
 * The order to visit a day's stops: morning places first, then afternoon, then evening, and within
 * each part always the nearest next stop, so the route doesn't zigzag. The first stop is whichever
 * gives the shortest morning. `flip` walks each part the other way round, for a regenerate.
 */
export function routeOrder<T extends { place: Place }>(stops: T[], t: Trip, flip = false): T[] {
  const out: T[] = [];
  for (const part of PARTS) {
    const group = stops.filter((s) => s.place.bestTime === part);
    if (group.length === 0) continue;
    const chainFrom = (start: LatLng | null) => chain(null, start).path;
    const chain = (first: T | null, start: LatLng | null = null) => {
      const rest = [...group];
      const path: T[] = [];
      let at: LatLng | null = first?.place.coords ?? out[out.length - 1]?.place.coords ?? start;
      if (first) {
        rest.splice(rest.indexOf(first), 1);
        path.push(first);
      }
      let minutes = 0;
      while (rest.length) {
        let best = 0;
        if (at) {
          for (let i = 1; i < rest.length; i++) {
            if (legMinutes(at, rest[i].place.coords, t) < legMinutes(at, rest[best].place.coords, t)) best = i;
          }
          minutes += legMinutes(at, rest[best].place.coords, t);
        }
        const next = rest.splice(best, 1)[0];
        at = next.place.coords;
        path.push(next);
      }
      return { path, minutes };
    };
    // Carrying on from the last part's final stop; at the start of the day, the nearest stop to where
    // you're staying, or without one, whichever first stop gives the shortest morning.
    const path =
      out.length || t.base
        ? chainFrom(t.base)
        : group.map((g) => chain(g)).sort((a, b) => a.minutes - b.minutes)[0].path;
    out.push(...(flip && !out.length ? path.reverse() : path));
  }
  return out;
}

/**
 * Minutes a day of these stops takes: time at each place plus getting between them, in route order,
 * and out from and back to where you're staying when that's known.
 */
export function dayMinutes(places: Place[], t: Trip) {
  if (places.length === 0) return 0;
  const ordered = routeOrder(places.map((place) => ({ place })), t);
  const between = ordered.reduce(
    (sum, s, i) => sum + s.place.minutes + (i > 0 ? legMinutes(ordered[i - 1].place.coords, s.place.coords, t) : 0),
    0,
  );
  const outAndBack = t.base
    ? legMinutes(t.base, ordered[0].place.coords, t) + legMinutes(ordered[ordered.length - 1].place.coords, t.base, t)
    : 0;
  return between + outAndBack;
}

function hours(minutes: number) {
  const h = Math.round(minutes / 30) / 2;
  return h < 1 ? `${Math.round(minutes)} min` : `${h} h`;
}

type Group = { places: Place[]; day?: number };

/**
 * Joins groups of places, two at a time, picking the pair that makes the shortest day together,
 * while there are more groups than `days` and the joined day still fits. Groups tied to a day
 * (pinned stops) never join each other.
 */
function joinIntoDays(start: Group[], days: number, fits: (ps: Place[]) => boolean, length: (ps: Place[]) => number, rand: () => number) {
  let groups = start;
  while (groups.length > days) {
    let best: { i: number; j: number; cost: number } | null = null;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        if (groups[i].day !== undefined && groups[j].day !== undefined) continue;
        const joined = [...groups[i].places, ...groups[j].places];
        if (!fits(joined)) continue;
        // A hair of seeded noise, so a regenerate can pick between two equally good days.
        const cost = length(joined) + rand() * 5;
        if (!best || cost < best.cost) best = { i, j, cost };
      }
    }
    if (!best) break;
    const { i, j } = best;
    const joined = { places: [...groups[i].places, ...groups[j].places], day: groups[i].day ?? groups[j].day };
    groups = [...groups.filter((_, k) => k !== i && k !== j), joined];
  }
  return groups;
}

/** How many days these places need at a pace: the fewest days they all fit into. */
export function daysNeeded(places: Place[], terrain: Terrain = 'flat', pace: Pace = 'balanced', getting: Getting = 'local') {
  if (places.length === 0) return 0;
  const t: Trip = { getting, terrain, base: null };
  const fits = (ps: Place[]) => ps.length <= PACE_STOPS[pace] && dayMinutes(ps, t) <= PACE_HOURS[pace] * 60;
  const length = (ps: Place[]) => dayMinutes(ps, t);
  return joinIntoDays(places.map((p) => ({ places: [p] })), 1, fits, length, () => 0).length;
}

/**
 * Fits saved places into days by time, not by count. Each day has an hours budget for the pace
 * (time at places plus getting between them) and a stop limit.
 *
 * Every place starts as its own group. The two groups that make the shortest day together are
 * joined, again and again, while there are more groups than days and the joined day still fits. So
 * places near each other share a day, a trip's days are all used, and a place too far to share a
 * day keeps one to itself. Groups that still don't get a day wait in "not in this plan", each with
 * the reason. Pinned stops stay on their day, and other places can join them there.
 */
export const rulePlanner: Planner = {
  name: 'rules',
  async plan(input) {
    return planNow(input);
  },
};

/**
 * How many of these places a trip of `days` at `pace` would fit, for the questions before a plan
 * ("fits 8 of your 11"). The same planner, without dinner picks or where you're staying yet.
 */
export function placesThatFit(saved: Place[], prefs: TripPrefs): number {
  const plan = planNow({ cityId: '', saved, suggestions: [], prefs, pins: [], removed: [], seed: 1 });
  return plan.days.reduce((n, d) => n + d.stops.filter((s) => !s.suggested).length, 0);
}

/** The rule-based planner, run straight away: it does no waiting of its own. */
export function planNow({ cityId, saved, suggestions, prefs, pins, removed, seed }: PlannerInput): TripPlan {
  const rand = random(seed);
  const cap = PACE_STOPS[prefs.pace];
  const budget = PACE_HOURS[prefs.pace] * 60;
  const t = tripOf(prefs);
  const n = Math.max(1, prefs.days);
  const pinnedTo = new Map(pins.map((p) => [p.placeId, p.day]));
  const pool = saved.filter((p) => !removed.includes(p.id));
  const isPinned = (p: Place) => (pinnedTo.get(p.id) ?? n) < n;

  const length = (ps: Place[]) => dayMinutes(ps, t);
  const fitsDay = (ps: Place[]) => ps.length <= cap && length(ps) <= budget;

  const startGroups: Group[] = [];
  for (let d = 0; d < n; d++) {
    const pinned = pool.filter((p) => pinnedTo.get(p.id) === d);
    if (pinned.length) startGroups.push({ places: pinned, day: d });
  }
  startGroups.push(...pool.filter((p) => !isPinned(p)).map((p) => ({ places: [p] })));
  const groups = joinIntoDays(startGroups, n, fitsDay, length, rand);

  const days: Place[][] = Array.from({ length: n }, () => []);
  for (const g of groups) if (g.day !== undefined) days[g.day] = g.places;
  // The fullest groups get the free days, Day 1 first; a regenerate shuffles which day is which.
  const free = groups
    .filter((g) => g.day === undefined)
    .sort((a, b) => b.places.length - a.places.length || length(a.places) - length(b.places));
  const freeDays = days.map((d, i) => (d.length ? -1 : i)).filter((i) => i >= 0);
  if (seed !== 1) freeDays.sort(() => rand() - 0.5);
  free.slice(0, freeDays.length).forEach((g, k) => (days[freeDays[k]] = g.places));

  // Groups without a day: each place tries every day it could still fit into, cheapest first.
  const left: Place[] = [];
  const leftWhy: Record<string, string> = {};
  for (const g of free.slice(freeDays.length)) {
    for (const place of g.places) {
      const target = days
        .map((d, i) => ({ i, extra: length([...d, place]) - length(d) }))
        .filter(({ i }) => fitsDay([...days[i], place]))
        .sort((a, b) => a.extra - b.extra)[0];
      if (target) {
        days[target.i] = [...days[target.i], place];
        continue;
      }
      left.push(place);
      const others = pool.filter((p) => p.id !== place.id);
      const nearest = others.length ? Math.min(...others.map((o) => legMinutes(o.coords, place.coords, t))) : 0;
      const each = t.base ? legMinutes(t.base, place.coords, t) : 0;
      const stayName = prefs.stay?.name ?? 'where you’re staying';
      // Only a reason particular to this place; "the days are full" is said once, above the list.
      const why =
        place.minutes > budget
          ? 'Takes longer than a whole day at this pace.'
          : t.base && length([place]) > budget
            ? length([place]) <= PACE_HOURS.packed * 60
              ? `About ${hours(each)} each way from ${stayName}: a long day there and back. It fits at a packed pace.`
              : `About ${hours(each)} each way from ${stayName}, too far to get there and back in a day. It’s worth a night nearby.`
            : nearest > NEARBY_MINUTES
              ? `About ${hours(nearest)} from your other places, so it needs a day of its own.`
              : null;
      if (why) leftWhy[place.id] = why;
    }
  }

  const placed: Placed[][] = days.map((d) => d.map((place) => ({ place, pinned: isPinned(place), suggested: false })));

  // One local pick per day that has room and time and no dinner, never the same pick twice.
  const offered = suggestions.filter((s) => !removed.includes(s.id) && !pool.some((p) => p.id === s.id));
  placed.forEach((d) => {
    const noDinner = !d.some((s) => s.place.type === 'food' && s.place.bestTime === 'evening');
    const pick = offered.find((o) => fitsDay([...d.map((s) => s.place), o]));
    if (noDinner && pick) {
      offered.splice(offered.indexOf(pick), 1);
      d.push({ place: pick, pinned: false, suggested: true });
    }
  });

  // Walking a day the other way round is as good, unless it starts from where you're staying.
  const flip = !t.base && rand() < 0.5;
  const plan: TripPlan = {
    cityId,
    prefs,
    days: placed.map((d, i) => timeDay(routeOrder(d, t, flip), prefs, prefs.start ? addDays(prefs.start, i) : null)),
    left,
    leftWhy,
    removed,
    seed,
  };
  return plan;
}

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

/**
 * Adds a stop someone typed in. It goes after the last stop in its part of the day rather than at
 * the end, so a morning errand isn't timed for the evening.
 */
export function addCustomStop(plan: TripPlan, day: number, place: Place): TripPlan {
  const current = plan.days[day].stops;
  const rank = PART_RANK[place.bestTime];
  let at = current.length;
  for (let i = current.length - 1; i >= 0; i--) {
    if (PART_RANK[current[i].place.bestTime] <= rank) {
      at = i + 1;
      break;
    }
    at = i;
  }
  const stops = [...current.slice(0, at), { place, startMinutes: 0, pinned: true, suggested: false }, ...current.slice(at)];
  return retime({ ...plan, days: plan.days.map((d, k) => (k === day ? { ...d, stops } : d)) });
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
