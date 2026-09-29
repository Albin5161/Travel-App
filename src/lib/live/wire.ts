import { getPlace } from '@/data/api';
import { customPlace, hasPin } from '@/data/custom';
import { live, restore, snapshot, type LiveSnapshot } from '@/data/registry';
import type { TripPlan, TripStop } from '@/data/planner';
import type { DayPart, Place } from '@/data/types';

// A plan as it travels between phones. Places can't go as they are: their photos are bundle asset
// ids, which differ between a phone build and the web build. So a place goes as its catalog id and
// is looked up again on arrival; a custom stop goes with everything needed to rebuild it. A place
// from a pasted link isn't in anyone else's catalog, so it travels whole, with its city and video,
// and is added to the other phone's records before the plan is rebuilt.

type WireCustom = {
  title: string;
  note?: string;
  by: string;
  bestTime: DayPart;
  minutes: number;
  /** The real stop it borrowed its pin from: for plans sent before `at` was. */
  near?: string;
  /** Its pin, exactly as placed. */
  at?: Pick<Place, 'coords' | 'map'>;
};

type WireStop = {
  id: string;
  start: number;
  leg?: TripStop['legBefore'];
  pinned: boolean;
  suggested: boolean;
  custom?: WireCustom;
};

export type WirePlan = {
  cityId: string;
  prefs: TripPlan['prefs'];
  days: { date: string | null; totalKm: number; stops: WireStop[]; home?: TripPlan['days'][number]['home'] }[];
  left: string[];
  leftWhy?: TripPlan['leftWhy'];
  removed: string[];
  seed: number;
  /** The real places, city and videos the plan uses, for phones that haven't seen them. */
  live?: LiveSnapshot;
};

export function toWire(plan: TripPlan): WirePlan {
  const places = [...plan.days.flatMap((d) => d.stops.map((s) => s.place)), ...plan.left];
  const real = places.filter((p) => live.places[p.id]);
  const reelIds = real.flatMap((p) => (p.source.kind === 'reel' ? [p.source.reelId] : []));
  return {
    cityId: plan.cityId,
    prefs: plan.prefs,
    days: plan.days.map((d) => ({
      date: d.date,
      totalKm: d.totalKm,
      ...(d.home ? { home: d.home } : {}),
      stops: d.stops.map((s, i) => ({
        id: s.place.id,
        start: s.startMinutes,
        leg: s.legBefore,
        pinned: s.pinned,
        suggested: s.suggested,
        custom:
          s.place.source.kind === 'custom'
            ? {
                title: s.place.name,
                note: s.place.source.note,
                by: s.place.source.by,
                bestTime: s.place.bestTime,
                minutes: s.place.minutes,
                near: realNeighbour(d.stops.map((t) => ({ id: t.place.id, custom: t.place.source.kind === 'custom' })), i),
                at: { coords: s.place.coords, map: s.place.map },
              }
            : undefined,
      })),
    })),
    left: plan.left.map((p) => p.id),
    ...(plan.leftWhy ? { leftWhy: plan.leftWhy } : {}),
    removed: plan.removed,
    seed: plan.seed,
    ...(real.length || live.cities[plan.cityId]
      ? { live: snapshot(real.map((p) => p.id), [plan.cityId], reelIds) }
      : {}),
  };
}

export function fromWire(wire: WirePlan): TripPlan {
  // A friend's real places first: everything below looks places up by id.
  if (wire.live) restore(wire.live);
  const placeOf = (s: WireStop, day: WireStop[], i: number): Place | undefined =>
    s.custom
      ? customPlace(
          {
            cityId: wire.cityId,
            title: s.custom.title,
            note: s.custom.note,
            by: s.custom.by,
            bestTime: s.custom.bestTime,
            minutes: s.custom.minutes,
            // Older plans named the stop before, which could be another typed-in stop with no
            // place of its own: the nearest real stop in the day stands in for it.
            near: getPlace(s.custom.near ?? '') ?? getPlace(realNeighbour(day.map((t) => ({ id: t.id, custom: !!t.custom })), i) ?? ''),
            at: s.custom.at && hasPin(s.custom.at) ? s.custom.at : undefined,
          },
          s.id,
        )
      : getPlace(s.id);

  return {
    cityId: wire.cityId,
    prefs: wire.prefs,
    days: wire.days.map((d) => ({
      date: d.date,
      totalKm: d.totalKm,
      ...(d.home ? { home: d.home } : {}),
      stops: d.stops.flatMap((s, i) => {
        const place = placeOf(s, d.stops, i);
        return place ? [{ place, startMinutes: s.start, legBefore: s.leg, pinned: s.pinned, suggested: s.suggested }] : [];
      }),
    })),
    left: wire.left.map((id) => getPlace(id)).filter((p): p is Place => !!p),
    ...(wire.leftWhy ? { leftWhy: wire.leftWhy } : {}),
    removed: wire.removed,
    seed: wire.seed,
  };
}

/** The closest stop to the i-th that is a real place (not typed in), looking before it first. */
function realNeighbour(stops: { id: string; custom: boolean }[], i: number): string | undefined {
  for (let step = 1; step < stops.length; step++) {
    for (const j of [i - step, i + step]) if (stops[j] && !stops[j].custom) return stops[j].id;
  }
  return undefined;
}
