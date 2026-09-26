import { getPlace } from '@/data/api';
import { customPlace } from '@/data/custom';
import { live, restore, snapshot, type LiveSnapshot } from '@/data/registry';
import type { TripPlan, TripStop } from '@/data/planner';
import type { DayPart, Place } from '@/data/types';

// A plan as it travels between phones. Places can't go as they are: their photos are bundle asset
// ids, which differ between a phone build and the web build. So a place goes as its catalog id and
// is looked up again on arrival; a custom stop goes with everything needed to rebuild it. A place
// from a pasted link isn't in anyone else's catalog, so it travels whole, with its city and video,
// and is added to the other phone's records before the plan is rebuilt.

type WireCustom = { title: string; note?: string; by: string; bestTime: DayPart; minutes: number; near?: string };

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
  days: { date: string | null; totalKm: number; stops: WireStop[] }[];
  left: string[];
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
                near: d.stops[i - 1]?.place.id ?? d.stops[i + 1]?.place.id,
              }
            : undefined,
      })),
    })),
    left: plan.left.map((p) => p.id),
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
  const placeOf = (s: WireStop): Place | undefined =>
    s.custom
      ? customPlace(
          {
            cityId: wire.cityId,
            title: s.custom.title,
            note: s.custom.note,
            by: s.custom.by,
            bestTime: s.custom.bestTime,
            minutes: s.custom.minutes,
            near: s.custom.near ? getPlace(s.custom.near) : undefined,
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
      stops: d.stops.flatMap((s) => {
        const place = placeOf(s);
        return place ? [{ place, startMinutes: s.start, legBefore: s.leg, pinned: s.pinned, suggested: s.suggested }] : [];
      }),
    })),
    left: wire.left.map((id) => getPlace(id)).filter((p): p is Place => !!p),
    removed: wire.removed,
    seed: wire.seed,
  };
}
