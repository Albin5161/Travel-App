// One day of a trip, walked through on the clock. Given the places for a day, this finds the order
// and the start times that make the best day: travel, then the visit, at each stop either starting
// straight away or waiting for a better moment (lunch at lunchtime, the sunset place at sunset),
// whichever costs less. Nothing here knows about other days; build.ts decides which places share one.
import { travelLegFor, type Getting, type LatLng, type Terrain, type TravelMode } from '@/lib/geo';
import { clockOffsetMinutes, sunTimes } from '@/lib/sun';

import type { Pace } from '../planner';
import type { Place } from '../types';

/** How many stops feel comfortable at each pace. A preference, never a limit: hours are the limit. */
export const PACE_STOPS: Record<Pace, number> = { relaxed: 3, balanced: 4, packed: 6 };
/** Hours of seeing and getting around in a day at each pace: what a day is measured against. */
export const PACE_HOURS: Record<Pace, number> = { relaxed: 6, balanced: 8, packed: 10 };
/** "About" eight hours: a day may run this much over before it counts as too much. */
const STRETCH = 1.1;
/** The earliest a day sets out, and the latest it may end (back where you're staying), by pace. */
export const EARLIEST: Record<Pace, number> = { relaxed: 9 * 60, balanced: 8 * 60, packed: 7 * 60 };
export const LATEST_END: Record<Pace, number> = { relaxed: 20 * 60 + 30, balanced: 21 * 60 + 30, packed: 22 * 60 + 30 };

export const ceilingMinutes = (pace: Pace) => PACE_HOURS[pace] * 60 * STRETCH;

export type Leg = { minutes: number; km: number; mode: TravelMode };
export type Trip = { getting: Getting; terrain: Terrain; base: LatLng | null };

// ── What a place needs from a day ───────────────────────────────────────────────────────────────
// Read off what's already known of it: its kind, its best part of the day, and its name and the
// line about why to go. No new data; a later step asks the model for these facts directly.

/** What a place is to a day's shape. */
export type Kind = 'sight' | 'sunset' | 'sunrise' | 'night' | 'restaurant' | 'cafe';

const CAFE = /caf[eé]|coffee|\btea\b|chai|bakery|bakes|patisserie|dessert|ice.?cream|gelato|juice|lassi|kulfi|falooda|jalebi|sweets?\b|shake/i;
const SUNSET = /sunset|golden hour|\bdusk\b/i;
const SUNRISE = /sunrise/i;
const NIGHT = /night (market|bazaar|life|view)|after dark|at night/i;

export function kindOf(p: Place): Kind {
  const f = p.facts;
  if (p.type === 'food') {
    // The model's word for the meal when it has one; else the name ("… Café", "… Bakery").
    if (f?.meal && f.meal !== 'unknown') return f.meal === 'cafe' || f.meal === 'snack' || f.meal === 'dessert' ? 'cafe' : 'restaurant';
    return CAFE.test(p.name) ? 'cafe' : 'restaurant';
  }
  // Told outright whether it's a sunset, sunrise or after-dark place: that's the answer, either way.
  if (f && (f.sunset !== undefined || f.window)) {
    // Its best time is what claims an hour: "sunset" as the best time is the one strong claim on
    // the sunset. "Also good at sunset" (a tick the model gives most beaches and sea walls) is a
    // weaker thing, handled as a second choice of time in windows() below: the place keeps its
    // own best time.
    // (There is no "sunrise" best time to answer with: an early-morning place ticked for sunrise
    // goes first thing, and the day isn't dragged to dawn for it.)
    if (f.window === 'sunset') return 'sunset';
    if (f.window === 'night') return 'night';
    return 'sight';
  }
  // Older places: read it off the name and the line about why to go.
  const text = `${p.name} ${p.why ?? ''}`;
  if (p.bestTime === 'evening' && SUNSET.test(text)) return 'sunset';
  if (p.bestTime === 'morning' && SUNRISE.test(text)) return 'sunrise';
  if (p.bestTime === 'evening' && NIGHT.test(text)) return 'night';
  return 'sight';
}

export const isFood = (k: Kind) => k === 'restaurant' || k === 'cafe';

/** The part of the day a place is best in: the model's finer window when there is one, else the old three-way answer. */
function partFor(p: Place): 'early' | 'morning' | 'afternoon' | 'evening' {
  switch (p.facts?.window) {
    case 'early_morning':
      return 'early';
    case 'morning':
      return 'morning';
    case 'afternoon':
      return 'afternoon';
    case 'sunset':
    case 'evening':
    case 'night':
      return 'evening';
    default:
      return p.bestTime;
  }
}

// Meals a day can hold, one of each.
const BREAKFAST = 1;
const LUNCH = 2;
const DINNER = 4;
const MEAL_WINDOW: Record<number, [number, number]> = {
  [BREAKFAST]: [7 * 60 + 30, 9 * 60 + 45],
  [LUNCH]: [12 * 60, 14 * 60],
  [DINNER]: [19 * 60, 21 * 60],
};
/** Lunch and dinner are where the day's rhythm comes from; the rest of the windows below. */
export const LUNCH_WINDOW = MEAL_WINDOW[LUNCH];
export const DINNER_WINDOW = MEAL_WINDOW[DINNER];

// How much a minute off the good time costs, and where that stops counting, by kind. Sunset and
// meals are particular about the clock; "best in the morning" is a leaning.
// `free` is how long a wait before it is just a breather; `wait` is the most a long wait can count
// (an afternoon free before a sunset or a dinner is a rest; two idle hours between sights is a hole).
// `early` is the per-minute cost of starting before the good time when that's less than `per`:
// an afternoon place at eleven is nearly as good, a morning place at two is not.
const OFF: Record<Kind, { per: number; early?: number; cap: number; free: number; wait: number }> = {
  sight: { per: 0.3, early: 0.2, cap: 110, free: 20, wait: 70 },
  sunset: { per: 0.6, cap: 120, free: 45, wait: 70 },
  sunrise: { per: 0.5, cap: 40, free: 0, wait: 70 },
  night: { per: 0.3, cap: 30, free: 30, wait: 40 },
  restaurant: { per: 0.75, cap: 90, free: 45, wait: 40 },
  cafe: { per: 0.3, cap: 30, free: 30, wait: 40 },
};
/** Waiting for dinner is an evening off, the cheapest wait there is. */
const DINNER_WAIT = 50;
/** Past this, a wait is a hole in the day whatever comes after it, and every further minute counts. */
const LONG_WAIT = 180;
const PER_LONG_WAIT_MINUTE = 0.15;
/** A café at mid-morning or teatime when it could have been the day's lunch. */
const CAFE_NOT_LUNCH = 25;
/** "Also good at sunset / after dark": nearly as good as the place's own best time, not quite. */
const ALSO_GOOD = 6;
/** A light stop (café, snack, sweet) at a between-meals hour that isn't the one it's best at. */
const LIGHT_OTHER_HOUR = 15;
/**
 * How firmly a place is held to its good time, from how sure the model was of it: fully at 1, half
 * as firmly at 0. A place with no such answer (anything saved before it was asked) is held fully.
 */
export const firmness = (p: Place) => (p.facts && typeof p.facts.sure === 'number' ? 0.5 + 0.5 * Math.min(1, Math.max(0, p.facts.sure)) : 1);
/** A meal that isn't the one the place is known for (a lunch place at dinner). */
const OTHER_MEAL = 35;
/** A food stop when the day's meals are already taken. */
const SPARE_FOOD = 60;
/** Food straight after food. */
const FOOD_AFTER_FOOD = 45;
const PER_TRAVEL_MINUTE = 0.4;
const PER_EXTRA_STOP = 8;
const PER_MINUTE_OVER = 0.1;
// A day out uses the day: setting out after mid-morning, or being done by mid-afternoon, is half a
// day, and two half days are worse than one whole one and a morning off.
// "Mid-morning" is an hour and a half after the pace's own start: 9:30 on a balanced day. Before
// that, a later start still costs a little per minute, so a day sets out at the earliest time that
// makes sense rather than the latest that avoids a short wait.
const HALF_DAY = { startAfter: 90, endFrom: 15 * 60 + 30, per: 0.15, cap: 40, perEarly: 0.06 };
/** Coming back to a part of town already left that day. */
const BACK_AGAIN = 30;
/** Places within this many minutes of each other are one part of town. */
const SAME_AREA_MINUTES = 12;

/**
 * What waiting costs. A short wait is a breather and free (longer before a meal or a sunset, where
 * arriving early is no hardship); past that it climbs, levelling off, so a four-hour hole in a day
 * always counts against it but never more than leaving a place out would.
 */
function waitCost(wait: number, free: number, most: number) {
  return wait <= free ? 0 : most * (1 - Math.exp(-(wait - free) / 120)) + Math.max(0, wait - LONG_WAIT) * PER_LONG_WAIT_MINUTE;
}

type Window = {
  from: number;
  to: number;
  extra: number;
  meal: number;
  /** Counts only if you arrive inside it: not worth waiting for, and no excuse for being late. */
  passing?: boolean;
};

/**
 * When a sunset place may start so the sun goes down while you're there: no later than twenty
 * minutes before it, and early enough only that you're still there ten minutes after.
 */
export const sunsetWindow = (minutes: number, sunset: number): [number, number] => [
  Math.max(sunset + 10 - minutes, sunset - 150),
  sunset - 20,
];
/** The share of a pace's hours that may be spent on the road: past it, the day is a drive, not a day out. */
const ROAD_SHARE = 0.6;
export const roadLimit = (pace: Pace) => PACE_HOURS[pace] * 60 * ROAD_SHARE;

// ── A day's setting ─────────────────────────────────────────────────────────────────────────────

/** Somewhere a night is spent that isn't the trip's base: a name to show and a point to measure from. Not necessarily a hotel. */
export type Night = { name: string; coords: LatLng };
/** Where a day starts and where it ends: last night's bed and tonight's. Null when not known. */
export type Ends = { from: LatLng | null; to: LatLng | null };

export interface DayCtx {
  places: Place[];
  kinds: Kind[];
  /** Travel between two places by index. As the first, -1 is where the day starts; as the second, where it ends. */
  leg(a: number, b: number): Leg;
  /** The day sets out from a known place, and returns to (or arrives at) one. */
  hasBase: boolean;
  hasEnd: boolean;
  /** It ends somewhere other than where it began: a day that moves on, not one that goes out and back. */
  moving: boolean;
  /** Which part of town each place is in: places a short hop apart share a number. */
  areas: number[];
  pace: Pace;
  sunrise: number;
  sunset: number;
}

/** Sunrise and sunset for a day somewhere, on that place's clock. A plain guess only where the sun can't be worked out. */
export function sunFor(at: LatLng | null, date: string | null, now: Date = new Date()): { sunrise: number; sunset: number } {
  const fallback = { sunrise: 6 * 60 + 15, sunset: 18 * 60 + 30 };
  if (!at) return fallback;
  const [y, m, d] = date ? date.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  return sunTimes(at, { y, m, d }, clockOffsetMinutes(at, now)) ?? fallback;
}

/** The setting for scheduling these places: travel between every two of them, worked out once. */
export function dayCtx(places: Place[], trip: Trip, pace: Pace, sun: { sunrise: number; sunset: number }, ends: Ends = { from: trip.base, to: trip.base }): DayCtx {
  const n = places.length;
  const table: (Leg | undefined)[] = new Array((n + 1) * (n + 1));
  const same = (a: LatLng, b: LatLng) => Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
  const ctx: DayCtx = {
    places,
    kinds: places.map(kindOf),
    hasBase: !!ends.from,
    hasEnd: !!ends.to,
    moving: !!ends.from && !!ends.to && !same(ends.from, ends.to),
    areas: [],
    pace,
    ...sun,
    leg(a, b) {
      const key = (a + 1) * (n + 1) + (b + 1);
      let l = table[key];
      if (!l) {
        const from = a < 0 ? ends.from : places[a].coords;
        const to = b < 0 ? ends.to : places[b].coords;
        l = from && to ? travelLegFor(from, to, trip.getting, trip.terrain) : { minutes: 0, km: 0, mode: 'walk' };
        table[key] = l;
      }
      return l;
    },
  };
  // Parts of town: any two places a short hop apart are joined, and so on down the chain.
  const area = places.map((_, i) => i);
  const root = (i: number): number => (area[i] === i ? i : (area[i] = root(area[i])));
  // Two places the model put in the same named area are one part of town too, a little further apart.
  const named = (p: Place) => (p.area ?? '').split(',')[0].trim().toLowerCase();
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const hop = ctx.leg(i, j).minutes;
      const sameName = !!places[i].facts && !!places[j].facts && !!named(places[i]) && named(places[i]) === named(places[j]);
      if (hop <= SAME_AREA_MINUTES || (sameName && hop <= SAME_AREA_MINUTES * 2)) area[root(i)] = root(j);
    }
  }
  ctx.areas = places.map((_, i) => root(i));
  return ctx;
}

/** The good moments to start place `i`, given the meals already had and what else is in the day. */
function windows(ctx: DayCtx, i: number, meals: number, restaurantInDay: boolean, earliest: number): Window[] {
  const p = ctx.places[i];
  switch (ctx.kinds[i]) {
    case 'sunset': {
      const [from, to] = sunsetWindow(p.minutes, ctx.sunset);
      return [{ from, to, extra: 0, meal: 0 }];
    }
    case 'sunrise':
      return [{ from: ctx.sunrise - 20, to: ctx.sunrise + 40, extra: 0, meal: 0 }];
    case 'night':
      return [{ from: ctx.sunset + 15, to: 21 * 60 + 30, extra: 0, meal: 0 }];
    case 'restaurant': {
      // What it is (the meal it's known for) and when it's best are two facts; either can make a
      // meal its own. A lunch place that's best in the evening is at home at lunch and at dinner.
      const meal = p.facts?.meal;
      const part = partFor(p);
      const byMeal = meal === 'breakfast' ? BREAKFAST : meal === 'dinner' ? DINNER : meal === 'lunch' ? LUNCH : 0;
      const byTime = part === 'early' || part === 'morning' ? BREAKFAST : part === 'evening' ? DINNER : LUNCH;
      const own = byMeal ? (p.facts?.window ? byMeal | byTime : byMeal) : byTime;
      const open = [LUNCH, DINNER, ...(own & BREAKFAST ? [BREAKFAST] : [])].filter((m) => !(meals & m));
      return open.map((m) => ({ from: MEAL_WINDOW[m][0], to: MEAL_WINDOW[m][1], extra: own & m ? 0 : OTHER_MEAL, meal: m }));
    }
    case 'cafe': {
      if (p.facts) {
        // A light stop (café, snack, something sweet). What it is doesn't set the hour: its best
        // time does, and the other between-meals hours are nearly as good, so a sweet shop best
        // in the morning is a morning stop and one answer of the model's moving doesn't upend a day.
        const part = partFor(p);
        const hours: [number, number][] = [
          [Math.max(earliest, 8 * 60), 11 * 60 + 30],
          [14 * 60 + 30, 18 * 60],
          [16 * 60 + 30, 21 * 60 + 30],
        ];
        const best = part === 'early' || part === 'morning' ? 0 : part === 'afternoon' ? 1 : 2;
        const out: Window[] = hours.map(([from, to], k) => ({ from, to, extra: k === best ? 0 : LIGHT_OTHER_HOUR, meal: 0 }));
        // A café (not a snack or a sweet) with no restaurant in the day is where lunch can happen.
        if (p.facts.meal === 'cafe' && !restaurantInDay && !(meals & LUNCH) && part !== 'evening') {
          out.push({ from: LUNCH_WINDOW[0], to: LUNCH_WINDOW[1], extra: part === 'afternoon' ? 0 : LIGHT_OTHER_HOUR, meal: LUNCH });
        }
        return out;
      }
      // Places saved before the model was asked: as it has always been.
      // With no restaurant in the day, a café known for the afternoon is where lunch happens; it can
      // still be the mid-morning or teatime stop, a little less well.
      const lunch = !restaurantInDay && !(meals & LUNCH) && p.bestTime !== 'evening';
      const snack = lunch && p.bestTime === 'afternoon' ? CAFE_NOT_LUNCH : 0;
      const out: Window[] = [
        { from: 9 * 60 + 30, to: 11 * 60 + 30, extra: snack, meal: 0 },
        { from: 15 * 60, to: 18 * 60, extra: snack, meal: 0 },
      ];
      if (lunch) out.push({ from: LUNCH_WINDOW[0], to: LUNCH_WINDOW[1], extra: 0, meal: LUNCH });
      if (p.bestTime === 'morning' && !(meals & BREAKFAST)) out.push({ from: MEAL_WINDOW[BREAKFAST][0], to: MEAL_WINDOW[BREAKFAST][1], extra: 0, meal: BREAKFAST });
      return out;
    }
    default: {
      const part = partFor(p);
      // First thing: before the heat and the crowds.
      const own: Window =
        part === 'early'
          ? { from: earliest, to: 9 * 60, extra: 0, meal: 0 }
          : part === 'morning'
            ? { from: earliest, to: 11 * 60 + 30, extra: 0, meal: 0 }
            : part === 'afternoon'
              ? { from: 11 * 60, to: 16 * 60 + 30, extra: 0, meal: 0 }
              : { from: 16 * 60, to: ctx.sunset + 60, extra: 0, meal: 0 };
      // "Also good at sunset" or "after dark": a second hour it would be nearly as happy at. Its
      // own best time stays first, and it never waits around for the sunset the way a sunset place does.
      const also: Window[] = [];
      if (p.facts?.sunset) {
        const [from, to] = sunsetWindow(p.minutes, ctx.sunset);
        also.push({ from, to, extra: ALSO_GOOD, meal: 0, passing: true });
      }
      if (p.facts?.night) also.push({ from: ctx.sunset + 15, to: 21 * 60 + 30, extra: ALSO_GOOD, meal: 0, passing: true });
      return [own, ...also];
    }
  }
}

// ── Walking a day ───────────────────────────────────────────────────────────────────────────────

interface Walk {
  order: number[];
  starts: number[];
  /** When the last stop ends. */
  t: number;
  cost: number;
  /** The part of the cost that is stops away from their good time (not waiting, not travel). */
  mistimed: number;
  travel: number;
  /** Time at places, a meal counting half: sitting down to eat is rest as much as doing. */
  doing: number;
  meals: number;
  /** When the day set out. */
  depart: number;
  /** Parts of town been to and left. */
  leftAreas: number[];
}

export interface DayResult {
  order: number[];
  starts: number[];
  cost: number;
  /** Minutes getting around, out and back included. */
  travel: number;
  /** What the day asks of you: time at places (meals half) plus travel. */
  workload: number;
  /** When you're back where you're staying, or done with the last stop. */
  end: number;
  /** How far its stops are from their good times, as counted in the cost. */
  mistimed: number;
  /** Within the pace's hours and its latest end. */
  ok: boolean;
}

function step(ctx: DayCtx, w: Walk, i: number, restaurantInDay: boolean, earliest: number, limits: boolean): Walk | null {
  const first = w.order.length === 0;
  const prev = first ? -1 : w.order[w.order.length - 1];
  const leg = first && !ctx.hasBase ? 0 : ctx.leg(prev, i).minutes;
  const arrive = (first ? w.depart : w.t) + leg;
  const kind = ctx.kinds[i];
  const off = OFF[kind];
  const open = windows(ctx, i, w.meals, restaurantInDay, earliest);
  // The less sure the model was of this place's timing, the less being off it counts.
  const firm = firmness(ctx.places[i]);

  let start = arrive;
  let cost = isFood(kind) ? SPARE_FOOD : 0;
  let wrong = cost;
  let meal = 0;
  let found = false;
  for (const win of open) {
    if (win.passing && (arrive < win.from || arrive > win.to)) continue;
    let s = arrive;
    let c = win.extra;
    let m = win.extra;
    if (arrive < win.from) {
      const wait = win.from - arrive;
      // Before the first stop there's nothing to wait through: the day simply starts later.
      const waiting = first ? 0 : waitCost(wait, off.free, win.meal === DINNER ? DINNER_WAIT : off.wait);
      const early = Math.min(off.cap, wait * (off.early ?? off.per)) * firm;
      if (waiting <= early) {
        s = win.from;
        c += waiting;
      } else {
        c += early;
        m += early;
      }
    } else if (arrive > win.to) {
      // Late for a sunset is a little less of it, until the sun is down: then it's missed outright.
      const missed = kind === 'sunset' && arrive >= ctx.sunset;
      const late = (missed ? off.cap : Math.min(off.cap, (arrive - win.to) * off.per)) * firm;
      c += late;
      m += late;
    }
    if (!found || c < cost - 1e-9) {
      found = true;
      start = s;
      cost = c;
      wrong = m;
      meal = win.meal;
    }
  }
  start = Math.round(start / 5) * 5;
  if (start < arrive) start += 5;
  const place = ctx.places[i];
  const prevFood = !first && isFood(ctx.kinds[prev]);
  const moved = !first && ctx.areas[prev] !== ctx.areas[i];
  const back = moved && w.leftAreas.includes(ctx.areas[i]) ? BACK_AGAIN : 0;
  const next: Walk = {
    order: [...w.order, i],
    starts: [...w.starts, start],
    t: start + place.minutes,
    // Food straight after food; lunch and, hours later, dinner are just a day's meals.
    cost: w.cost + cost + back + (prevFood && isFood(kind) && start - w.t < 90 ? FOOD_AFTER_FOOD : 0),
    mistimed: w.mistimed + wrong,
    travel: w.travel + leg,
    doing: w.doing + (isFood(kind) ? place.minutes / 2 : place.minutes),
    meals: w.meals | meal,
    depart: first ? start - leg : w.depart,
    leftAreas: moved ? [...w.leftAreas, ctx.areas[prev]] : w.leftAreas,
  };
  if (limits && (next.t > LATEST_END[ctx.pace] || next.doing + next.travel > ceilingMinutes(ctx.pace) || (!ctx.moving && next.travel > roadLimit(ctx.pace)))) return null;
  return next;
}

function finish(ctx: DayCtx, w: Walk): DayResult {
  const last = w.order[w.order.length - 1];
  const home = ctx.hasEnd && last !== undefined ? ctx.leg(last, -1).minutes : 0;
  const travel = w.travel + home;
  const workload = w.doing + travel;
  const end = w.t + home;
  const cost =
    w.cost +
    travel * PER_TRAVEL_MINUTE +
    Math.max(0, w.order.length - PACE_STOPS[ctx.pace]) * PER_EXTRA_STOP +
    Math.max(0, workload - PACE_HOURS[ctx.pace] * 60) * PER_MINUTE_OVER +
    Math.min(HALF_DAY.startAfter, Math.max(0, w.depart - EARLIEST[ctx.pace])) * HALF_DAY.perEarly +
    Math.min(HALF_DAY.cap, Math.max(0, w.starts[0] - (EARLIEST[ctx.pace] + HALF_DAY.startAfter)) * HALF_DAY.per) +
    Math.min(HALF_DAY.cap, Math.max(0, HALF_DAY.endFrom - w.t) * HALF_DAY.per);
  return { order: w.order, starts: w.starts, cost, travel, workload, end, mistimed: w.mistimed, ok: withinDay(ctx, end, workload, travel) };
}

/**
 * The limits no day may break: its latest end, the pace's hours, and, for a day that goes out and
 * comes back, the share of those hours spent on the road. A day that moves on to sleep somewhere
 * else is allowed to be mostly a drive: getting there is what the day is for.
 */
function withinDay(ctx: DayCtx, end: number, workload: number, travel: number) {
  return end <= LATEST_END[ctx.pace] && workload <= ceilingMinutes(ctx.pace) && (ctx.moving || travel <= roadLimit(ctx.pace));
}

/** A day with nothing to see: nothing at all, or just the drive to where tonight is spent. */
function emptyDay(ctx: DayCtx): DayResult {
  const travel = ctx.moving ? ctx.leg(-1, -1).minutes : 0;
  const end = travel ? EARLIEST[ctx.pace] + 60 + travel : 0;
  return { order: [], starts: [], cost: travel * PER_TRAVEL_MINUTE, travel, workload: travel, end, mistimed: 0, ok: withinDay(ctx, end, travel, travel) };
}

const start = (depart: number): Walk => ({ order: [], starts: [], t: depart, cost: 0, mistimed: 0, travel: 0, doing: 0, meals: 0, depart, leftAreas: [] });

/** When a day of these places may set out: the pace's hour, or before sunrise for a place that's about it. */
function earliestFor(ctx: DayCtx, set: number[]) {
  const pace = EARLIEST[ctx.pace];
  return set.some((i) => ctx.kinds[i] === 'sunrise') ? Math.min(pace, ctx.sunrise - 45) : pace;
}

/** The day in exactly this order, setting out at `depart` (the pace's hour when not given). */
export function walkOrder(ctx: DayCtx, order: number[], depart?: number): DayResult {
  if (order.length === 0) return emptyDay(ctx);
  const earliest = earliestFor(ctx, order);
  const restaurant = order.some((i) => ctx.kinds[i] === 'restaurant');
  let w = start(depart ?? earliest);
  for (const i of order) w = step(ctx, w, i, restaurant, earliest, false) as Walk;
  return finish(ctx, w);
}

/** Up to this many places, every order is tried; beyond, the most promising part-days are kept at each step. */
const TRY_ALL = 5;
const KEEP = 60;
/** A long day's part-days are many; fewer are kept. */
const KEEP_LONG = 40;
/** A day with this much waiting in it is tried again setting out later, in half-hour steps. */
const TRY_LATER_FROM = 60;

/**
 * The best ways to spend a day at these places, best first (up to three, each a different order).
 * With `limits`, only days inside the pace's hours and latest end; none may fit, and then it's empty.
 */
export function bestDays(ctx: DayCtx, set: number[], limits: boolean): DayResult[] {
  if (set.length === 0) {
    const empty = emptyDay(ctx);
    return !limits || empty.ok ? [empty] : [];
  }
  const earliest = earliestFor(ctx, set);
  const restaurant = set.some((i) => ctx.kinds[i] === 'restaurant');
  const keep = set.length <= TRY_ALL ? Infinity : set.length <= 10 ? KEEP : KEEP_LONG;
  let level: Walk[] = [start(earliest)];
  for (let k = 0; k < set.length; k++) {
    const next: Walk[] = [];
    for (const w of level) {
      for (const i of set) {
        if (w.order.includes(i)) continue;
        const s = step(ctx, w, i, restaurant, earliest, limits);
        if (s) next.push(s);
      }
    }
    if (next.length > keep) {
      next.sort((a, b) => a.cost + a.travel * PER_TRAVEL_MINUTE - (b.cost + b.travel * PER_TRAVEL_MINUTE));
      next.length = keep;
    }
    level = next;
    if (level.length === 0) return [];
  }
  const days = level.map((w) => finish(ctx, w)).filter((d) => !limits || d.ok);
  days.sort((a, b) => a.cost - b.cost || a.end - b.end);
  return days
    .slice(0, 3)
    .map((d) => settle(ctx, d, limits))
    .sort((a, b) => a.cost - b.cost || a.end - b.end);
}

/**
 * A day that waits a long while somewhere may be better started later: the waiting moves to the
 * morning, where it's a lie-in instead of a hole in the day. Tried in half-hour steps, and only
 * taken when no stop ends up further from its good time for it: a later start may close a gap, but
 * never by pushing lunch to mid-afternoon or a morning place past midday.
 */
function settle(ctx: DayCtx, d: DayResult, limits: boolean): DayResult {
  if (d.order.length === 0) return d;
  const busy = d.order.reduce((sum, i) => sum + ctx.places[i].minutes, 0) + d.travel;
  const depart = d.starts[0] - (ctx.hasBase ? ctx.leg(-1, d.order[0]).minutes : 0);
  // What's left of the day's length once the visits and the travel are taken out is waiting.
  if (d.end - depart - busy < TRY_LATER_FROM) return d;
  let best = d;
  for (let later = depart + 30; later <= 17 * 60; later += 30) {
    const alt = walkOrder(ctx, d.order, later);
    if ((!limits || alt.ok) && alt.mistimed <= d.mistimed + 1e-9 && alt.cost < best.cost - 1e-9) best = alt;
  }
  return best;
}

/** Clock times for a day in the order given (the traveller's own, after an edit), nothing held to the pace's limits. */
export function timeOrder(ctx: DayCtx, order: number[]): DayResult {
  return settle(ctx, walkOrder(ctx, order), false);
}
