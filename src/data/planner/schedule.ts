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
  const text = `${p.name} ${p.why ?? ''}`;
  if (p.type === 'food') return CAFE.test(p.name) ? 'cafe' : 'restaurant';
  if (p.bestTime === 'evening' && SUNSET.test(text)) return 'sunset';
  if (p.bestTime === 'morning' && SUNRISE.test(text)) return 'sunrise';
  if (p.bestTime === 'evening' && NIGHT.test(text)) return 'night';
  return 'sight';
}

export const isFood = (k: Kind) => k === 'restaurant' || k === 'cafe';

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
const OFF: Record<Kind, { per: number; cap: number; free: number; wait: number }> = {
  sight: { per: 0.2, cap: 40, free: 20, wait: 70 },
  sunset: { per: 0.6, cap: 70, free: 45, wait: 70 },
  sunrise: { per: 0.5, cap: 40, free: 0, wait: 70 },
  night: { per: 0.3, cap: 30, free: 30, wait: 40 },
  restaurant: { per: 0.5, cap: 55, free: 45, wait: 40 },
  cafe: { per: 0.3, cap: 30, free: 30, wait: 40 },
};
/** Waiting for dinner is an evening off, the cheapest wait there is. */
const DINNER_WAIT = 40;
/** A café at mid-morning or teatime when it could have been the day's lunch. */
const CAFE_NOT_LUNCH = 25;
/** A meal that isn't the one the place is known for (a lunch place at dinner). */
const OTHER_MEAL = 12;
/** A food stop when the day's meals are already taken. */
const SPARE_FOOD = 60;
/** Food straight after food. */
const FOOD_AFTER_FOOD = 45;
const PER_TRAVEL_MINUTE = 0.4;
const PER_EXTRA_STOP = 8;
const PER_MINUTE_OVER = 0.1;
// A day out uses the day: setting out after mid-morning, or being done by mid-afternoon, is half a
// day, and two half days are worse than one whole one and a morning off.
const HALF_DAY = { startBy: 10 * 60 + 30, endFrom: 15 * 60 + 30, per: 0.15, cap: 40 };
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
  return wait <= free ? 0 : most * (1 - Math.exp(-(wait - free) / 120));
}

type Window = { from: number; to: number; extra: number; meal: number };

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

export interface DayCtx {
  places: Place[];
  kinds: Kind[];
  /** Travel between two places by index; -1 is where you're staying. */
  leg(a: number, b: number): Leg;
  hasBase: boolean;
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
export function dayCtx(places: Place[], trip: Trip, pace: Pace, sun: { sunrise: number; sunset: number }): DayCtx {
  const n = places.length;
  const table: (Leg | undefined)[] = new Array((n + 1) * (n + 1));
  const at = (i: number) => (i < 0 ? trip.base : places[i].coords);
  const ctx: DayCtx = {
    places,
    kinds: places.map(kindOf),
    hasBase: !!trip.base,
    areas: [],
    pace,
    ...sun,
    leg(a, b) {
      const key = (a + 1) * (n + 1) + (b + 1);
      let l = table[key];
      if (!l) {
        const from = at(a);
        const to = at(b);
        l = from && to ? travelLegFor(from, to, trip.getting, trip.terrain) : { minutes: 0, km: 0, mode: 'walk' };
        table[key] = l;
      }
      return l;
    },
  };
  // Parts of town: any two places a short hop apart are joined, and so on down the chain.
  const area = places.map((_, i) => i);
  const root = (i: number): number => (area[i] === i ? i : (area[i] = root(area[i])));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) if (ctx.leg(i, j).minutes <= SAME_AREA_MINUTES) area[root(i)] = root(j);
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
      const known = p.bestTime === 'morning' ? BREAKFAST : p.bestTime === 'evening' ? DINNER : LUNCH;
      const open = [LUNCH, DINNER, ...(known === BREAKFAST ? [BREAKFAST] : [])].filter((m) => !(meals & m));
      return open.map((m) => ({ from: MEAL_WINDOW[m][0], to: MEAL_WINDOW[m][1], extra: m === known ? 0 : OTHER_MEAL, meal: m }));
    }
    case 'cafe': {
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
      if (p.bestTime === 'morning') return [{ from: earliest, to: 11 * 60 + 30, extra: 0, meal: 0 }];
      if (p.bestTime === 'afternoon') return [{ from: 11 * 60, to: 16 * 60 + 30, extra: 0, meal: 0 }];
      return [{ from: 16 * 60, to: ctx.sunset + 60, extra: 0, meal: 0 }];
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

  let start = arrive;
  let cost = isFood(kind) ? SPARE_FOOD : 0;
  let meal = 0;
  let found = false;
  for (const win of open) {
    let s = arrive;
    let c = win.extra;
    if (arrive < win.from) {
      const wait = win.from - arrive;
      // Before the first stop there's nothing to wait through: the day simply starts later.
      const waiting = first ? 0 : waitCost(wait, off.free, win.meal === DINNER ? DINNER_WAIT : off.wait);
      const early = Math.min(off.cap, wait * off.per);
      if (waiting <= early) {
        s = win.from;
        c += waiting;
      } else c += early;
    } else if (arrive > win.to) c += Math.min(off.cap, (arrive - win.to) * off.per);
    if (!found || c < cost - 1e-9) {
      found = true;
      start = s;
      cost = c;
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
    travel: w.travel + leg,
    doing: w.doing + (isFood(kind) ? place.minutes / 2 : place.minutes),
    meals: w.meals | meal,
    depart: first ? start - leg : w.depart,
    leftAreas: moved ? [...w.leftAreas, ctx.areas[prev]] : w.leftAreas,
  };
  if (limits && (next.t > LATEST_END[ctx.pace] || next.doing + next.travel > ceilingMinutes(ctx.pace) || next.travel > roadLimit(ctx.pace))) return null;
  return next;
}

function finish(ctx: DayCtx, w: Walk): DayResult {
  const last = w.order[w.order.length - 1];
  const home = ctx.hasBase && last !== undefined ? ctx.leg(last, -1).minutes : 0;
  const travel = w.travel + home;
  const workload = w.doing + travel;
  const end = w.t + home;
  const cost =
    w.cost +
    travel * PER_TRAVEL_MINUTE +
    Math.max(0, w.order.length - PACE_STOPS[ctx.pace]) * PER_EXTRA_STOP +
    Math.max(0, workload - PACE_HOURS[ctx.pace] * 60) * PER_MINUTE_OVER +
    Math.min(HALF_DAY.cap, Math.max(0, w.starts[0] - HALF_DAY.startBy) * HALF_DAY.per) +
    Math.min(HALF_DAY.cap, Math.max(0, HALF_DAY.endFrom - w.t) * HALF_DAY.per);
  return { order: w.order, starts: w.starts, cost, travel, workload, end, ok: end <= LATEST_END[ctx.pace] && workload <= ceilingMinutes(ctx.pace) && travel <= roadLimit(ctx.pace) };
}

const start = (depart: number): Walk => ({ order: [], starts: [], t: depart, cost: 0, travel: 0, doing: 0, meals: 0, depart, leftAreas: [] });

/** When a day of these places may set out: the pace's hour, or before sunrise for a place that's about it. */
function earliestFor(ctx: DayCtx, set: number[]) {
  const pace = EARLIEST[ctx.pace];
  return set.some((i) => ctx.kinds[i] === 'sunrise') ? Math.min(pace, ctx.sunrise - 45) : pace;
}

/** The day in exactly this order, setting out at `depart` (the pace's hour when not given). */
export function walkOrder(ctx: DayCtx, order: number[], depart?: number): DayResult {
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
  if (set.length === 0) return [{ order: [], starts: [], cost: 0, travel: 0, workload: 0, end: 0, ok: true }];
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
 * morning, where it's a lie-in instead of a hole in the day. Tried in half-hour steps.
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
    if ((!limits || alt.ok) && alt.cost < best.cost - 1e-9) best = alt;
  }
  return best;
}

/** Clock times for a day in the order given (the traveller's own, after an edit), nothing held to the pace's limits. */
export function timeOrder(ctx: DayCtx, order: number[]): DayResult {
  return settle(ctx, walkOrder(ctx, order), false);
}
