// Search over what you've saved: your cities, your places, and the creators whose videos they came
// from. All on the phone, over data already there, so it's instant, works offline and costs nothing.

import { getCity, getReel } from '@/data/api';
import type { City, Place, Platform } from '@/data/types';

export type Hit =
  | { kind: 'city'; city: City; places: number }
  | { kind: 'place'; place: Place; city: string; creator: string | null }
  | { kind: 'creator'; handle: string; platform: Platform; places: number };

// The words people use for a kind of place, so "cafe" finds the food spots and "hotel" the stays.
const KIND_WORDS: Record<Place['type'], string> = {
  food: 'food cafe cafes restaurant restaurants eat eats coffee',
  stay: 'stay stays hotel hotels homestay resort',
  sight: 'sight sights see view viewpoint',
  experience: 'experience experiences do activity activities',
};

/** Lower case, accents off, punctuation to spaces: "Café" and "cafe" are one word. */
export function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** How well one word of the query fits a text: its start 3, a word's start 2, anywhere 1, not at all 0. */
function fit(text: string, word: string) {
  if (text.startsWith(word)) return 3;
  if (text.includes(` ${word}`)) return 2;
  return text.includes(word) ? 1 : 0;
}

/**
 * Every query word has to fit somewhere; the name counts double, so a place called what you typed
 * comes before one that's only in that area.
 */
function score(name: string, rest: string, words: string[]) {
  let total = 0;
  for (const word of words) {
    const s = Math.max(fit(name, word) * 2, fit(rest, word));
    if (s === 0) return 0;
    total += s;
  }
  return total;
}

export function search(query: string, cities: { city: City; places: number }[], places: Place[]) {
  const words = fold(query).split(' ').filter(Boolean);
  if (words.length === 0) return { cities: [], places: [], creators: [] };

  const cityHits = cities
    .map((c) => ({ c, s: score(fold(c.city.name), fold(`${c.city.state} ${c.city.district}`), words) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.c.places - a.c.places)
    .map((x): Hit => ({ kind: 'city', city: x.c.city, places: x.c.places }));

  const creatorOf = (p: Place) => (p.source.kind === 'reel' ? (getReel(p.source.reelId) ?? null) : null);
  const placeHits = places
    .map((p) => {
      const city = getCity(p.cityId);
      const reel = creatorOf(p);
      const rest = fold(`${p.area} ${city?.name ?? ''} ${city?.state ?? ''} ${KIND_WORDS[p.type]} ${reel?.creator ?? ''}`);
      return { p, city: city?.name ?? '', creator: reel?.creator ?? null, s: score(fold(p.name), rest, words) };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
    .map((x): Hit => ({ kind: 'place', place: x.p, city: x.city, creator: x.creator }));

  // Creators, with how many of your places came from each.
  const byHandle = new Map<string, { platform: Platform; places: number }>();
  for (const p of places) {
    const reel = creatorOf(p);
    if (!reel?.creator) continue;
    const seen = byHandle.get(reel.creator);
    byHandle.set(reel.creator, { platform: reel.platform, places: (seen?.places ?? 0) + 1 });
  }
  const creatorHits = [...byHandle.entries()]
    .map(([handle, v]) => ({ handle, v, s: score(fold(handle), '', words) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.v.places - a.v.places)
    .map((x): Hit => ({ kind: 'creator', handle: x.handle, platform: x.v.platform, places: x.v.places }));

  return { cities: cityHits, places: placeHits, creators: creatorHits };
}
