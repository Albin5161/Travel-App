import type { City, Place, Reel } from './types';

// Places, cities and videos that came from the API rather than the catalog. The lookups in api.ts
// check the catalog first and then here, so every screen that takes an id works for both. The ones
// your trips point at are saved on the phone with the trips themselves (see state/trips.tsx).
export const live = {
  places: {} as Record<string, Place>,
  cities: {} as Record<string, City>,
  reels: {} as Record<string, Reel>,
  /** When each place's coordinates came from Google: kept at most 30 days, per Google's terms. */
  placedAt: {} as Record<string, number>,
};

export function register(items: { places?: Place[]; city?: City; reel?: Reel }, at = Date.now()) {
  items.places?.forEach((p) => {
    live.places[p.id] = p;
    live.placedAt[p.id] ??= at;
  });
  if (items.city) live.cities[items.city.id] = items.city;
  if (items.reel) live.reels[items.reel.id] = items.reel;
}

export type LiveSnapshot = {
  places: Place[];
  cities: City[];
  reels: Reel[];
  placedAt: Record<string, number>;
};

/** The live places, cities and videos these ids need: what's saved alongside the trips. */
export function snapshot(placeIds: Iterable<string>, cityIds: Iterable<string>, reelIds: Iterable<string>): LiveSnapshot {
  const places = [...new Set(placeIds)].map((id) => live.places[id]).filter((p): p is Place => !!p);
  return {
    places,
    cities: [...new Set(cityIds)].map((id) => live.cities[id]).filter((c): c is City => !!c),
    reels: [...new Set(reelIds)].map((id) => live.reels[id]).filter((r): r is Reel => !!r),
    placedAt: Object.fromEntries(places.map((p) => [p.id, live.placedAt[p.id] ?? Date.now()])),
  };
}

export function restore(s: LiveSnapshot) {
  s.places.forEach((p) => (live.places[p.id] = p));
  s.cities.forEach((c) => (live.cities[c.id] = c));
  s.reels.forEach((r) => (live.reels[r.id] = r));
  Object.assign(live.placedAt, s.placedAt);
}

/** A place whose coordinates came back fresh from Google: its 30 days start again. */
export function refreshed(place: Place) {
  live.places[place.id] = place;
  live.placedAt[place.id] = Date.now();
}
