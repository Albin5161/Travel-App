// Trip planning: the answers a traveller gives, the plan they get back, and the edits they make to
// it. The plan is made by rules, on the phone, never by a model: planner/build.ts decides which
// places share a day and planner/schedule.ts when each happens. The Planner interface is the seam
// the screens call through.
import type { Getting, LatLng, Terrain, TravelMode } from '@/lib/geo';

import { build } from './planner/build';
import { dayCtx, PACE_HOURS, PACE_STOPS, sunFor, timeOrder, type Trip } from './planner/schedule';
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
const tripOf = (prefs: TripPrefs): Trip => ({
  getting: prefs.getting,
  terrain: prefs.terrain ?? 'flat',
  base: prefs.stay?.coords ?? null,
});

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

export { PACE_HOURS, PACE_STOPS };
// Where the list's "Morning / Afternoon / Evening" headers change. Only headers: nothing is timed by them.
const AFTERNOON = 12 * 60;
const EVENING = 17 * 60;
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
 * Put clock times on a day's stops, in the order given: the planner's, or the traveller's own after
 * an edit. The clock is walked stop by stop (planner/schedule.ts): travel, then the visit, waiting
 * only where waiting is better than being early (lunch, a sunset). Nothing is dropped here, however
 * long the day gets: an edit is the traveller's choice.
 */
export function timeDay(stops: Placed[], prefs: TripPrefs, date: string | null): TripDay {
  const t = tripOf(prefs);
  const ctx = dayCtx(stops.map((s) => s.place), t, prefs.pace, sunFor(t.base ?? stops[0]?.place.coords ?? null, date));
  const day = timeOrder(ctx, stops.map((_, i) => i));
  let totalKm = 0;
  const timed = stops.map((s, i) => {
    const legBefore = i > 0 || t.base ? ctx.leg(i - 1, i) : undefined;
    if (legBefore) totalKm += legBefore.km;
    return { ...s, startMinutes: day.starts[i], legBefore };
  });
  const home = t.base && stops.length ? ctx.leg(stops.length - 1, -1) : undefined;
  if (home) totalKm += home.km;
  return { date, stops: timed, totalKm, ...(home ? { home } : {}) };
}

function retime(plan: TripPlan): TripPlan {
  return { ...plan, days: plan.days.map((d) => timeDay(d.stops, plan.prefs, d.date)) };
}

// ── The rule-based engine ────────────────────────────────────────────────────────────────────────
// Which places share a day is decided in planner/build.ts; when each happens, in
// planner/schedule.ts. Both are plain rules: the same places, answers and seed give the same plan.

/**
 * Fits saved places into days by what a day asks of you (time at places plus getting between them),
 * not by a count of stops. Several whole trips are tried and the best kept: as many of the saved
 * places as the days can honestly hold, each at a sensible time, meals at mealtimes, the sunset
 * place at sunset, and as little time on the road and waiting as that allows. Places that don't get
 * a day wait in "not in this plan", each with the reason. Locked stops stay on their day.
 */
export const rulePlanner: Planner = {
  name: 'rules',
  async plan(input) {
    return planNow(input);
  },
};

// The screens ask for the same plan again on every redraw ("one more day would fit 3"), so the
// last few are kept. A plan depends on the day it's made (sunset moves), hence the date in the key.
const kept = new Map<string, unknown>();
function once<T>(key: string, make: () => T): T {
  if (kept.has(key)) return kept.get(key) as T;
  const made = make();
  kept.set(key, made);
  if (kept.size > 16) kept.delete(kept.keys().next().value as string);
  return made;
}
const facts = (ps: Place[]) => ps.map((p) => [p.id, p.name, p.type, p.bestTime, p.minutes, p.coords?.lat, p.coords?.lng]);

/**
 * How many of these places a trip of `days` at `pace` would fit, for the questions before a plan
 * ("fits 8 of your 11"). The same planner, searched more lightly, without dinner picks.
 */
export function placesThatFit(saved: Place[], prefs: TripPrefs): number {
  return once(JSON.stringify(['fit', facts(saved), prefs, isoDay(new Date())]), () => {
    const built = build({ pool: saved, suggestions: [], prefs, pins: new Map(), seed: 1, quick: true });
    return saved.length - built.left.length;
  });
}

/** How many days these places need at a pace: the fewest days they all fit into. */
export function daysNeeded(places: Place[], terrain: Terrain = 'flat', pace: Pace = 'balanced', getting: Getting = 'local') {
  if (places.length === 0) return 0;
  return once(JSON.stringify(['days', facts(places), terrain, pace, getting, isoDay(new Date())]), () => {
    const prefs: TripPrefs = { when: 'flexible', start: null, days: 1, pace, getting, terrain, stay: null };
    let fewestLeft = Infinity;
    let answer = 1;
    for (let days = 1; days <= Math.min(places.length, 10); days++) {
      const left = places.length - placesThatFit(places, { ...prefs, days });
      if (left < fewestLeft) {
        fewestLeft = left;
        answer = days;
      }
      if (left === 0) break;
    }
    return answer;
  });
}

/** The rule-based planner, run straight away: it does no waiting of its own. */
export function planNow({ cityId, saved, suggestions, prefs, pins, removed, seed }: PlannerInput): TripPlan {
  const pool = saved.filter((p) => !removed.includes(p.id));
  const offered = suggestions.filter((s) => !removed.includes(s.id));
  const n = Math.max(1, prefs.days);
  const pinnedTo = new Map(pins.map((p) => [p.placeId, p.day]));
  const isPinned = (p: Place) => (pinnedTo.get(p.id) ?? n) < n;
  return once(JSON.stringify(['plan', cityId, facts(pool), offered.map((p) => p.id), prefs, pins, removed, seed, isoDay(new Date())]), () => {
    const built = build({ pool, suggestions: offered, prefs, pins: pinnedTo, seed });
    const places = built.ctx.places;
    return {
      cityId,
      prefs,
      days: built.days.map((d, i) =>
        timeDay(
          d.order.map((k) => ({ place: places[k], pinned: isPinned(places[k]), suggested: built.suggested.has(k) })),
          prefs,
          prefs.start ? addDays(prefs.start, i) : null,
        ),
      ),
      left: built.left.map((k) => places[k]),
      leftWhy: built.leftWhy,
      removed,
      seed,
    };
  });
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
