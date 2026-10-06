// Which places share a day. Several whole trips are put together in different ways (near places
// together, sectors out from where you're staying, sunsets or meals spread first), each is improved
// by moving and swapping places between days, and the one that scores best is kept. A saved place
// left out outweighs everything else; after that it's timing, meals, travel and waiting, as
// schedule.ts counts them. The same places, answers and seed always give the same trip.
import { formatClock, type LatLng } from '@/lib/geo';

import type { Pace, TripPrefs } from '../planner';
import type { Place } from '../types';
import {
  bestDays,
  ceilingMinutes,
  dayCtx,
  DINNER_WINDOW,
  isFood,
  LATEST_END,
  PACE_HOURS,
  roadLimit,
  sunFor,
  type DayCtx,
  type DayResult,
  type Trip,
} from './schedule';

/** A saved place not in the plan weighs more than anything a day could gain by leaving it out. */
const LEFT_OUT = 1000;
/** One part of town spread over two days, when a day there would have done. */
const AREA_SPLIT = 15;
// A day left empty while another is crammed: you asked for two days, not one long one and a blank.
// Counted per minute a day runs past this share of the pace's hours, for each empty day.
const ROOMY = 0.6;
const PER_CRAMMED_MINUTE = 0.6;
/** Places this far (minutes) from every other are on their own. */
const NEARBY_MINUTES = 45;
/** Another arrangement this close to the best is as good, for a reshuffle. */
const AS_GOOD = 60;

type State = { days: number[][]; left: number[] };

export interface Built {
  ctx: DayCtx;
  /** One per day of the trip, in order; indexes are into ctx.places. */
  days: DayResult[];
  /** Indexes of local picks the planner added. */
  suggested: Set<number>;
  left: number[];
  leftWhy: Record<string, string>;
}

export interface BuildInput {
  /** Saved places still wanted, then the local picks on offer. */
  pool: Place[];
  suggestions: Place[];
  prefs: TripPrefs;
  /** Place id → the day it's locked to. */
  pins: Map<string, number>;
  seed: number;
  /** A lighter search, for the "fits 8 of your 11" lines asked before there's a plan. */
  quick?: boolean;
  now?: Date;
}

const validAt = (c: LatLng | undefined) => !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng) && !(c.lat === 0 && c.lng === 0);

function hours(minutes: number) {
  const h = Math.round(minutes / 30) / 2;
  return h < 1 ? `${Math.round(minutes)} min` : `${h} h`;
}

export function build({ pool, suggestions, prefs, pins, seed, quick = false, now }: BuildInput): Built {
  const trip: Trip = { getting: prefs.getting, terrain: prefs.terrain ?? 'flat', base: prefs.stay?.coords ?? null };
  const pace: Pace = prefs.pace;
  const n = Math.max(1, prefs.days);
  const places = [...pool, ...suggestions];
  const centre = middle(pool.map((p) => p.coords).filter(validAt));
  const ctx = dayCtx(places, trip, pace, sunFor(trip.base ?? centre, prefs.start, now));

  const saved = pool.map((_, i) => i);
  const usable = saved.filter((i) => validAt(places[i].coords));
  const lockedTo = (i: number) => {
    const d = pins.get(places[i].id);
    return d !== undefined && d < n ? d : -1;
  };
  const locked = (i: number) => lockedTo(i) >= 0;
  const fixed: number[][] = Array.from({ length: n }, (_, d) => usable.filter((i) => lockedTo(i) === d));
  const free = usable.filter((i) => !locked(i));

  // ── Scoring a day, remembered by which places are in it ───────────────────────────────────────
  const seen = new Map<string, DayResult[] | null>();
  let tried = 0;
  const key = (set: number[]) => [...set].sort((a, b) => a - b).join(',');
  const ways = (set: number[]): DayResult[] | null => {
    const k = key(set);
    let got = seen.get(k);
    if (got === undefined) {
      tried++;
      const fits = bestDays(ctx, set, true);
      // A day of nothing but locked stops is the traveller's own choice, however long: it stands.
      got = fits.length ? fits : set.every(locked) ? bestDays(ctx, set, false).map((d) => ({ ...d, ok: true })) : null;
      seen.set(k, got);
    }
    return got;
  };
  const dayOf = (set: number[]) => ways(set)?.[0] ?? null;

  const total = (s: State) => {
    let sum = s.left.length * LEFT_OUT;
    const daysIn = new Map<number, number>();
    let empty = 0;
    let crammed = 0;
    for (const d of s.days) {
      const day = dayOf(d);
      if (!day) return Infinity;
      sum += day.cost;
      if (d.length === 0) empty++;
      crammed += Math.max(0, day.workload - PACE_HOURS[pace] * 60 * ROOMY);
      new Set(d.map((i) => ctx.areas[i])).forEach((a) => daysIn.set(a, (daysIn.get(a) ?? 0) + 1));
    }
    daysIn.forEach((count) => (sum += (count - 1) * AREA_SPLIT));
    return sum + empty * crammed * PER_CRAMMED_MINUTE;
  };

  // A quick stand-in for a day's length while groups are being formed: visits, and travel taking
  // the nearest next place each time.
  const rough = (set: number[]) => {
    let at = ctx.hasBase ? -1 : set[0];
    const rest = ctx.hasBase ? [...set] : set.slice(1);
    let minutes = set.reduce((sum, i) => sum + (isFood(ctx.kinds[i]) ? places[i].minutes / 2 : places[i].minutes), 0);
    while (rest.length) {
      let best = 0;
      for (let k = 1; k < rest.length; k++) if (ctx.leg(at, rest[k]).minutes < ctx.leg(at, rest[best]).minutes) best = k;
      minutes += ctx.leg(at, rest[best]).minutes;
      at = rest.splice(best, 1)[0];
    }
    return minutes + (ctx.hasBase && set.length ? ctx.leg(at, -1).minutes : 0);
  };

  const startState = (): State => ({ days: fixed.map((d) => [...d]), left: [] });

  /** Puts each place, in turn, on the day it costs least to add to; a place no day can take waits. */
  const place = (s: State, order: number[]): State => {
    const out: State = { days: s.days.map((d) => [...d]), left: [...s.left] };
    for (const i of order) {
      let best = -1;
      let bestCost = Infinity;
      const before = total(out);
      for (let d = 0; d < n; d++) {
        if (!dayOf([...out.days[d], i])) continue;
        out.days[d].push(i);
        const c = total(out) - before;
        out.days[d].pop();
        if (c < bestCost) {
          bestCost = c;
          best = d;
        }
      }
      if (best >= 0) out.days[best].push(i);
      else out.left.push(i);
    }
    return out;
  };

  /** A day too long to stand gives up places, biggest and furthest first, until it fits. */
  const repair = (days: number[][]): State => {
    const pending: number[] = [];
    const out = days.map((d) => [...d]);
    out.forEach((d) => {
      while (d.length && !dayOf(d)) {
        const loose = d.filter((i) => !locked(i));
        if (!loose.length) break;
        const weight = (i: number) => places[i].minutes + d.reduce((sum, j) => sum + (j === i ? 0 : ctx.leg(i, j).minutes), 0) / Math.max(1, d.length - 1);
        const out1 = loose.reduce((a, b) => (weight(b) > weight(a) ? b : a));
        d.splice(d.indexOf(out1), 1);
        pending.push(out1);
      }
    });
    return place({ days: out, left: [] }, pending);
  };

  // ── Ways of putting a trip together ───────────────────────────────────────────────────────────
  const flat = (i: number) => {
    const c = places[i].coords;
    return [c.lat, c.lng * Math.cos(((centre?.lat ?? c.lat) * Math.PI) / 180)] as const;
  };
  const apart = (a: readonly [number, number], b: readonly [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const origin = (): readonly [number, number] => {
    const o = trip.base ?? centre ?? { lat: 0, lng: 0 };
    return [o.lat, o.lng * Math.cos(((centre?.lat ?? o.lat) * Math.PI) / 180)];
  };

  const strategies: Record<string, () => State> = {
    // Today's way: the two groups that make the shortest day together are joined, again and again.
    pairs() {
      let groups: { set: number[]; day: number }[] = [
        ...fixed.map((set, day) => ({ set: [...set], day })).filter((g) => g.set.length),
        ...free.map((i) => ({ set: [i], day: -1 })),
      ];
      while (groups.length > n) {
        let best: { a: number; b: number; cost: number } | null = null;
        for (let a = 0; a < groups.length; a++) {
          for (let b = a + 1; b < groups.length; b++) {
            if (groups[a].day >= 0 && groups[b].day >= 0) continue;
            const cost = rough([...groups[a].set, ...groups[b].set]);
            if (cost <= ceilingMinutes(pace) && (!best || cost < best.cost)) best = { a, b, cost };
          }
        }
        if (!best) break;
        const { a, b } = best;
        const joined = { set: [...groups[a].set, ...groups[b].set], day: Math.max(groups[a].day, groups[b].day) };
        groups = [...groups.filter((_, k) => k !== a && k !== b), joined];
      }
      const days: number[][] = Array.from({ length: n }, () => []);
      groups.filter((g) => g.day >= 0).forEach((g) => (days[g.day] = g.set));
      const loose = groups.filter((g) => g.day < 0).sort((x, y) => y.set.length - x.set.length || rough(x.set) - rough(y.set));
      const open = days.map((d, i) => (d.length ? -1 : i)).filter((i) => i >= 0);
      loose.slice(0, open.length).forEach((g, k) => (days[open[k]] = g.set));
      const s = repair(days);
      return place(s, loose.slice(open.length).flatMap((g) => g.set));
    },
    // Near places together: as many centres as days, each place to its nearest, centres moved to
    // the middle of what they got, a few times over.
    cluster() {
      const centres: (readonly [number, number])[] = [];
      for (let d = 0; d < n; d++) {
        if (fixed[d].length) {
          const pts = fixed[d].map(flat);
          centres[d] = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
        }
      }
      for (let d = 0; d < n; d++) {
        if (centres[d] || !free.length) continue;
        const from = centres.filter(Boolean).length ? centres.filter(Boolean) : [origin()];
        const far = free.reduce((a, b) => (Math.min(...from.map((c) => apart(flat(b), c))) > Math.min(...from.map((c) => apart(flat(a), c))) ? b : a));
        centres[d] = flat(far);
      }
      let days: number[][] = [];
      for (let round = 0; round < 6; round++) {
        days = fixed.map((d) => [...d]);
        for (const i of free) {
          let best = 0;
          for (let d = 1; d < n; d++) if (centres[d] && (!centres[best] || apart(flat(i), centres[d]) < apart(flat(i), centres[best]))) best = d;
          days[best].push(i);
        }
        days.forEach((set, d) => {
          if (!set.length) return;
          const pts = set.map(flat);
          centres[d] = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
        });
      }
      return repair(days);
    },
    // Out from where you're staying, one direction a day: places are taken round the compass and
    // dealt into days of about equal length.
    sweep() {
      const o = origin();
      const angle = (i: number) => Math.atan2(flat(i)[0] - o[0], flat(i)[1] - o[1]);
      const round = [...free].sort((a, b) => angle(a) - angle(b));
      if (round.length > 1) {
        // Start after the widest empty stretch, so no day straddles it.
        let widest = 0;
        let gap = -1;
        round.forEach((i, k) => {
          const next = round[(k + 1) % round.length];
          const g = (angle(next) - angle(i) + 2 * Math.PI) % (2 * Math.PI);
          if (g > gap) {
            gap = g;
            widest = (k + 1) % round.length;
          }
        });
        round.push(...round.splice(0, widest));
      }
      const share = round.reduce((sum, i) => sum + places[i].minutes, 0) / n;
      const days = fixed.map((d) => [...d]);
      let d = 0;
      let filled = 0;
      for (const i of round) {
        if (filled >= share && d < n - 1) {
          d++;
          filled = 0;
        }
        days[d].push(i);
        filled += places[i].minutes;
      }
      return repair(days);
    },
    // A part of town to a day: whole neighbourhoods are dealt out, biggest first, each to the day
    // with the most room, so nowhere is visited twice.
    areas() {
      const groups = new Map<number, number[]>();
      free.forEach((i) => groups.set(ctx.areas[i], [...(groups.get(ctx.areas[i]) ?? []), i]));
      const days = fixed.map((d) => [...d]);
      const pending: number[] = [];
      [...groups.values()]
        .sort((a, b) => rough(b) - rough(a))
        .forEach((g) => {
          // Next to locked stops in the same part of town if there are any; else the emptiest day.
          const home = days.findIndex((d) => d.some((i) => ctx.areas[i] === ctx.areas[g[0]]));
          let best = home;
          if (best < 0) {
            best = 0;
            for (let d = 1; d < n; d++) if (rough(days[d]) < rough(days[best])) best = d;
          }
          if (rough([...days[best], ...g]) <= ceilingMinutes(pace)) days[best].push(...g);
          else pending.push(...g);
        });
      return place(repair(days), pending);
    },
    // Sunsets first: one to a day while they last, then everything else goes where it fits best.
    sunsets: () => seeded((i) => ctx.kinds[i] === 'sunset' || ctx.kinds[i] === 'sunrise'),
    // Meals first: the places to eat are spread over the days before anything else is placed.
    meals: () => seeded((i) => ctx.kinds[i] === 'restaurant'),
    // Longest visits first, each to the day it costs least.
    greedy: () => place(startState(), [...free].sort((a, b) => places[b].minutes - places[a].minutes)),
  };

  function seeded(first: (i: number) => boolean): State {
    const days = fixed.map((d) => [...d]);
    const seeds = free.filter(first);
    seeds.forEach((i) => {
      // The day with the fewest of its kind, the nearer one on a tie.
      const count = (d: number) => days[d].filter(first).length;
      let best = 0;
      for (let d = 1; d < n; d++) if (count(d) < count(best)) best = d;
      days[best].push(i);
    });
    const rest = free.filter((i) => !first(i)).sort((a, b) => places[b].minutes - places[a].minutes);
    return place(repair(days), rest);
  }

  // ── Making a trip better, one change at a time ────────────────────────────────────────────────
  const improve = (state: State, budget: number): State => {
    let s: State = { days: state.days.map((d) => [...d]), left: [...state.left] };
    let cost = total(s);
    const until = tried + budget;
    const swaps = free.length <= 24;
    for (let round = 0; round < 60 && tried < until; round++) {
      let best: State | null = null;
      let bestCost = cost;
      const consider = (next: State) => {
        // Out of tries: what's been found so far stands.
        if (tried >= until) return;
        const c = total(next);
        if (c < bestCost - 1e-6) {
          bestCost = c;
          best = next;
        }
      };
      const withDay = (d: number, set: number[], d2?: number, set2?: number[], left = s.left): State => ({
        days: s.days.map((x, k) => (k === d ? set : k === d2 && set2 ? set2 : x)),
        left,
      });
      for (let a = 0; a < n; a++) {
        for (const i of s.days[a]) {
          if (locked(i)) continue;
          const without = s.days[a].filter((x) => x !== i);
          // Move one place to another day.
          for (let b = 0; b < n; b++) if (b !== a) consider(withDay(a, without, b, [...s.days[b], i]));
          // Swap it with one on a later day.
          if (swaps) {
            for (let b = a + 1; b < n; b++) {
              for (const j of s.days[b]) {
                if (!locked(j)) consider(withDay(a, [...without, j], b, [...s.days[b].filter((x) => x !== j), i]));
              }
            }
          }
          // Give its place to one that was left out, if the trip is better for it.
          for (const l of s.left) consider(withDay(a, [...without, l], undefined, undefined, [...s.left.filter((x) => x !== l), i]));
        }
        // Move a whole part of town to another day at once: one place at a time, each step along
        // the way looks worse, and the better trip is never reached.
        for (const area of new Set(s.days[a].map((i) => ctx.areas[i]))) {
          const group = s.days[a].filter((i) => ctx.areas[i] === area && !locked(i));
          if (group.length < 2) continue;
          const rest = s.days[a].filter((i) => !group.includes(i));
          for (let b = 0; b < n; b++) if (b !== a) consider(withDay(a, rest, b, [...s.days[b], ...group]));
        }
        // Try each left-out place on this day.
        for (const l of s.left) consider(withDay(a, [...s.days[a], l], undefined, undefined, s.left.filter((x) => x !== l)));
      }
      if (!best) break;
      s = best;
      cost = bestCost;
      // A place pushed out by a swap may fit somewhere else now.
      if (s.left.length) {
        const again = place({ days: s.days, left: [] }, s.left);
        if (total(again) < cost - 1e-6) {
          s = again;
          cost = total(again);
        }
      }
    }
    return s;
  };

  /** Days nobody locked are put fullest first, so Day 1 isn't the thin one. */
  const arrange = (s: State): State => {
    const open = s.days.map((_, d) => d).filter((d) => !fixed[d].length);
    const sets = open.map((d) => s.days[d]).sort((a, b) => (dayOf(b)?.workload ?? 0) - (dayOf(a)?.workload ?? 0) || key(a).localeCompare(key(b)));
    const days = s.days.map((d) => d);
    open.forEach((d, k) => (days[d] = sets[k]));
    return { days, left: [...s.left].sort((a, b) => a - b) };
  };
  const signature = (s: State) => s.days.map(key).join('|');

  // A long list gets the three ways that do most of the work; a short one can afford them all.
  const names = quick ? ['pairs', 'cluster'] : free.length > 24 ? ['pairs', 'cluster', 'areas'] : Object.keys(strategies);
  // Fewer tries each for a long list: a day of a dozen places takes far longer to score than one of four.
  const budget = quick ? 400 : free.length <= 16 ? 1800 : free.length <= 30 ? 800 : 300;
  const found = new Map<string, { state: State; cost: number }>();
  for (const name of names) {
    const s = arrange(improve(strategies[name](), budget));
    const sig = signature(s);
    if (!found.has(sig)) found.set(sig, { state: s, cost: total(s) });
  }
  const ranked = [...found.values()].sort((a, b) => a.cost - b.cost || signature(a.state).localeCompare(signature(b.state)));
  const best = ranked[0];

  // ── Reshuffle: other trips as good as the best ────────────────────────────────────────────────
  // The best first; then other groupings that leave out no more and score close; then the best
  // with its free days the other way round, and with a day walked in its second-best order.
  type Choice = { state: State; orders?: Map<number, DayResult> };
  const choices: Choice[] = [{ state: best.state }];
  if (!quick && seed !== 1) {
    ranked.slice(1).forEach((r) => {
      if (r.state.left.length <= best.state.left.length && r.cost <= best.cost + AS_GOOD) choices.push({ state: r.state });
    });
    const open = best.state.days.map((_, d) => d).filter((d) => !fixed[d].length && best.state.days[d].length);
    if (open.length > 1) {
      const days = best.state.days.map((d) => d);
      open.forEach((d, k) => (days[d] = best.state.days[open[open.length - 1 - k]]));
      choices.push({ state: { days, left: best.state.left } });
    }
    best.state.days.forEach((set, d) => {
      const all = ways(set) ?? [];
      const second = all[1];
      if (second && second.cost <= all[0].cost + AS_GOOD / 2) choices.push({ state: best.state, orders: new Map([[d, second]]) });
    });
  }
  const chosen = choices[(((seed - 1) % choices.length) + choices.length) % choices.length];
  const state = chosen.state;

  // ── A dinner nearby for a day without one, from the local picks ───────────────────────────────
  const suggested = new Set<number>();
  const offered = suggestions.map((_, k) => pool.length + k).filter((i) => validAt(places[i].coords) && !pool.some((p) => p.id === places[i].id));
  const days: DayResult[] = state.days.map((set, d) => {
    const day = chosen.orders?.get(d) ?? (dayOf(set) as DayResult);
    const dines = day.order.some((i, k) => isFood(ctx.kinds[i]) && (places[i].bestTime === 'evening' || day.starts[k] >= DINNER_WINDOW[0] - 30));
    // A day with nothing in it stays empty: a dinner alone isn't a day.
    if (dines || set.length === 0) return day;
    for (const pick of offered) {
      if (suggested.has(pick)) continue;
      const withPick = dayOf([...set, pick]);
      if (!withPick || !withPick.ok) continue;
      // Only as dinner: a pick the day could only take mid-afternoon isn't the dinner it's for.
      const at = withPick.starts[withPick.order.indexOf(pick)];
      if (at < DINNER_WINDOW[0] - 45) continue;
      suggested.add(pick);
      return withPick;
    }
    return day;
  });

  // ── Why each left-out place is left out, from what adding it would really do ──────────────────
  const left = [...state.left, ...saved.filter((i) => !usable.includes(i))];
  const leftWhy: Record<string, string> = {};
  const stayName = prefs.stay?.name ?? 'where you’re staying';
  const ceiling = ceilingMinutes(pace);
  for (const i of left) {
    const p = places[i];
    if (!validAt(p.coords)) {
      leftWhy[p.id] = 'We don’t have its spot on the map, so it can’t be given a time. Search for it again to add it.';
      continue;
    }
    const alone = bestDays(ctx, [i], false)[0];
    if (p.minutes > ceiling) {
      leftWhy[p.id] = 'Takes longer than a whole day at this pace.';
      continue;
    }
    if (ctx.hasBase && !alone.ok) {
      // On its own it's already too much for a day from where you're staying: say how far, and
      // whether a fuller pace would take it or only a night closer would.
      const each = ctx.leg(-1, i).minutes;
      const packed = pace !== 'packed' && alone.workload <= ceilingMinutes('packed') && alone.end <= LATEST_END.packed && alone.travel <= roadLimit('packed');
      const near = left.filter((j) => j !== i && validAt(places[j].coords) && ctx.leg(i, j).minutes <= NEARBY_MINUTES).map((j) => places[j].name);
      const together = near.length ? ` ${near.length === 1 ? `${near[0]} is` : `${near.slice(0, 2).join(' and ')} are`} close by: one night there covers them.` : '';
      leftWhy[p.id] = packed
        ? `About ${hours(each)} each way from ${stayName}: more time on the road than a ${pace} day allows. It fits at a packed pace.`
        : `About ${hours(each)} each way from ${stayName}, too far to go and come back in a day. It needs a night nearby.${together}`;
      continue;
    }
    // The day it would sit best on, with nothing held back: what breaks there is the reason.
    let probe: { d: number; day: DayResult; extra: number } | null = null;
    state.days.forEach((set, d) => {
      const now1 = dayOf(set);
      const then = bestDays(ctx, [...set, i], false)[0];
      if (!now1 || !then) return;
      const beyond = (day: DayResult) => Math.max(0, day.workload - ceiling) + Math.max(0, day.end - LATEST_END[pace]) + Math.max(0, day.travel - roadLimit(pace));
      const over = beyond(then);
      const was = probe ? beyond(probe.day) : Infinity;
      if (over < was) probe = { d, day: then, extra: then.travel - now1.travel };
    });
    const others = usable.filter((j) => j !== i);
    const nearest = others.length ? Math.min(...others.map((j) => ctx.leg(j, i).minutes)) : 0;
    const got = probe as { d: number; day: DayResult; extra: number } | null;
    if (nearest > NEARBY_MINUTES && (!got || got.extra >= 60)) {
      leftWhy[p.id] = `About ${hours(nearest)} from your other places, so it needs a day of its own. Add a day to fit it.`;
    } else if (got && got.day.workload > ceiling) {
      const travel = got.extra >= 45 ? `, ${hours(got.extra)} of it extra travel` : '';
      leftWhy[p.id] = `With it, Day ${got.d + 1} would be about ${hours(got.day.workload)} of seeing and getting around${travel}; a ${pace} day is about ${PACE_HOURS[pace]} h. Add a day${pace === 'packed' ? '' : ', or choose a fuller pace'}.`;
    } else if (got && got.day.travel > roadLimit(pace)) {
      leftWhy[p.id] = `With it, Day ${got.d + 1} would have about ${hours(got.day.travel)} on the road, more than a ${pace} day allows. Add a day to fit it.`;
    } else if (got && got.day.end > LATEST_END[pace]) {
      leftWhy[p.id] = `With it, Day ${got.d + 1} would run to about ${formatClock(Math.round(got.day.end / 5) * 5)}, later than a ${pace} day ends. Add a day to fit it.`;
    } else {
      leftWhy[p.id] = 'Your days are full at this pace. Add a day to fit it.';
    }
  }

  return { ctx, days, suggested, left, leftWhy };
}

function middle(points: LatLng[]): LatLng | null {
  if (!points.length) return null;
  return { lat: points.reduce((s, p) => s + p.lat, 0) / points.length, lng: points.reduce((s, p) => s + p.lng, 0) / points.length };
}
