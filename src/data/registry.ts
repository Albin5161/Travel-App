import type { City, Place, Reel } from './types';

// Places, cities and videos that came from the API rather than the catalog. The lookups in api.ts
// check the catalog first and then here, so every screen that takes an id works for both. Kept in
// memory, like the collections that point at them.
export const live = {
  places: {} as Record<string, Place>,
  cities: {} as Record<string, City>,
  reels: {} as Record<string, Reel>,
};

export function register(items: { places?: Place[]; city?: City; reel?: Reel }) {
  items.places?.forEach((p) => (live.places[p.id] = p));
  if (items.city) live.cities[items.city.id] = items.city;
  if (items.reel) live.reels[items.reel.id] = items.reel;
}
