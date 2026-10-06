// Nights away from the base. A trip is a journey: where you sleep tonight decides what you can
// reach tomorrow. When some saved places are too far to visit and come back from in a day, this
// works out where a night nearer them could be spent, tries the trip with such nights on each
// evening it could fall, and, if the trip is meaningfully better for it, describes that as an
// offer. It never changes where the traveller is staying: build.ts plans with the nights it is
// given, and the offer is only taken up when they say so.
//
// Nothing here knows any particular place. A "night away" is a cluster of far places near each
// other, wherever in the world they are.
import type { LatLng } from '@/lib/geo';

import type { Place } from '../types';
import { build, type BuildInput, type Built } from './build';
import { bestDays, type Night } from './schedule';

/** Far places this close to each other (minutes) can share a night. */
const SAME_NIGHT_MINUTES = 75;
/** What a night somewhere else costs the trip: packing up, a second booking. Less than a saved place gained, far more than an hour saved on the road. */
const NIGHT_AWAY = 350;
/** And each further place to sleep, on top. */
const ANOTHER_BASE = 150;
/** How much better the trip has to be, after those costs, before a change of bed is worth suggesting. */
const WORTH_IT = 200;
/** At most this many different places to sleep away are tried. */
const MOST_BASES = 2;

export interface NightsOffer {
  /** Where each night would be spent: one entry per night, null for the base. */
  nights: (Night | null)[];
  /** Saved places the trip gains by it, by id. */
  gains: string[];
  title: string;
  reason: string;
}

type Cluster = { night: Night; members: number[]; each: number };

function hours(minutes: number) {
  const h = Math.round(minutes / 30) / 2;
  return h < 1 ? `${Math.round(minutes)} min` : `${h} h`;
}
const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** What to call a cluster: the wider area its places share, else their area, else the place itself. */
function nameOf(places: Place[]): string {
  const count = new Map<string, number>();
  const add = (name: string | null | undefined) => {
    const n = name?.split(',')[0].trim();
    if (n) count.set(n, (count.get(n) ?? 0) + 1);
  };
  // The area the places themselves are filed under says where to sleep better than the wider
  // region does ("Nubra Valley", not "Ladakh").
  places.forEach((p) => add(p.area));
  if (count.size === 0) places.forEach((p) => add(p.facts?.parentArea));
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ?? `near ${places[0].name}`;
}

const middle = (points: LatLng[]): LatLng => ({
  lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
  lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
});

/**
 * Where nights away could be spent: each group of saved places that can't be visited and come back
 * from in a day, with the places near them. Biggest group first.
 */
function clusters(plan: Built, pool: Place[], base: LatLng): Cluster[] {
  const ctx = plan.ctx;
  const saved = pool.map((_, i) => i);
  // Too far for a day out and back, though short enough to visit at all.
  const far = plan.left.filter((i) => i < pool.length && Number.isFinite(pool[i].coords?.lat) && bestDays(ctx, [i], true).length === 0 && bestDays(ctx, [i], false)[0].travel > 0);
  const group = new Map<number, number>();
  far.forEach((i) => group.set(i, i));
  const root = (i: number): number => (group.get(i) === i ? i : root(group.get(i) as number));
  far.forEach((i) => far.forEach((j) => i < j && ctx.leg(i, j).minutes <= SAME_NIGHT_MINUTES && group.set(root(j), root(i))));
  const out = new Map<number, number[]>();
  far.forEach((i) => out.set(root(i), [...(out.get(root(i)) ?? []), i]));
  return [...out.values()]
    .map((seeds) => {
      // Places near the far ones belong with them, whether or not they'd have made a day trip.
      const near = saved.filter((j) => !seeds.includes(j) && seeds.some((i) => ctx.leg(i, j).minutes <= SAME_NIGHT_MINUTES));
      const members = [...seeds, ...near];
      const at = middle(seeds.map((i) => pool[i].coords));
      const night = { name: nameOf(members.map((i) => pool[i])), coords: at };
      const each = Math.min(...seeds.map((i) => ctx.leg(-1, i).minutes));
      return { night, members, each };
    })
    .filter((c) => !(Math.abs(c.night.coords.lat - base.lat) < 1e-6 && Math.abs(c.night.coords.lng - base.lng) < 1e-6))
    .sort((a, b) => b.members.length - a.members.length || a.each - b.each);
}

/** Every way to spend nights at these clusters: one of them on any night, or two on two nights in either order. */
function patterns(found: Cluster[], nightCount: number): (Cluster | null)[][] {
  const out: (Cluster | null)[][] = [];
  const blank = () => Array.from({ length: nightCount }, () => null as Cluster | null);
  const some = found.slice(0, MOST_BASES);
  for (const c of some) {
    for (let k = 0; k < nightCount; k++) {
      const p = blank();
      p[k] = c;
      out.push(p);
    }
  }
  for (const a of some) {
    for (const b of some) {
      if (a === b) continue;
      for (let k = 0; k < nightCount; k++) {
        for (let l = k + 1; l < nightCount; l++) {
          const p = blank();
          p[k] = a;
          p[l] = b;
          out.push(p);
        }
      }
    }
  }
  return out;
}

/**
 * The best trip with nights away, if it's meaningfully better than the trip from the base alone;
 * null when it isn't, when there's no base, or when nothing saved is out of a day's reach.
 * `plan` is the trip as planned from the base.
 */
export function overnightOffer(input: BuildInput, plan: Built): NightsOffer | null {
  const base = input.prefs.stay;
  const nightCount = Math.max(1, input.prefs.days) - 1;
  if (!base || nightCount < 1) return null;
  const found = clusters(plan, input.pool, base.coords);
  if (found.length === 0) return null;

  let best: { pattern: (Cluster | null)[]; built: Built; score: number } | null = null;
  for (const pattern of patterns(found, nightCount)) {
    const built = build({ ...input, nights: pattern.map((c) => c?.night ?? null), quick: true });
    // A drive between two of these beds that no day can hold: not a trip.
    if (!Number.isFinite(built.cost)) continue;
    const bases = new Set(pattern.filter(Boolean)).size;
    const score = built.cost + pattern.filter(Boolean).length * NIGHT_AWAY + Math.max(0, bases - 1) * ANOTHER_BASE;
    // On a tie the earlier pattern stands, so the same trip always gets the same offer.
    if (!best || score < best.score - 1e-6) best = { pattern, built, score };
  }
  if (!best || plan.cost - best.score < WORTH_IT) return null;

  const names = input.pool.map((p) => p.name);
  const gained = plan.left.filter((i) => i < input.pool.length && !best.built.left.includes(i));
  const stays = best.pattern.flatMap((c, k) => (c ? [{ c, night: k + 1 }] : []));
  const title =
    stays.length === 1
      ? `Stay in ${stays[0].c.night.name} on night ${stays[0].night}?`
      : `Stay in ${list(stays.map((s) => `${s.c.night.name} on night ${s.night}`))}?`;
  const reason = stays
    .map(({ c }) => {
      const here = c.members.filter((i) => !best.built.left.includes(i)).map((i) => names[i]);
      const what = here.length ? list(here.slice(0, 3)) : c.night.name;
      return `${what} ${here.length === 1 ? 'is' : 'are'} about ${hours(c.each)} from ${base.name}, by our estimate. A night in ${c.night.name} lets you see ${here.length === 1 ? 'it' : 'them'} without driving there and back in a day.`;
    })
    .join(' ');
  return {
    nights: best.pattern.map((c) => c?.night ?? null),
    gains: gained.map((i) => input.pool[i].id),
    title,
    reason: `${reason}${gained.length ? ` It adds ${gained.length === 1 ? names[gained[0]] : `${gained.length} of your places`} to the plan.` : ''}`,
  };
}
