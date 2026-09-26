import type { ImageSourcePropType } from 'react-native';

import type { Stay } from '@/data/planner';
import { register } from '@/data/registry';
import type { City, DayPart, Extraction, Place, PlaceType, Reel } from '@/data/types';
import { ApiFailure, post } from '@/lib/api';
import type { LatLng, Terrain } from '@/lib/geo';
import { deviceStorage } from '@/lib/live/storage';
import { parseLink } from '@/server/links';
import type {
  AssistReason,
  ExtractResult,
  FoundPlace,
  MatchResult,
  MatchedPlace,
  SearchResult,
} from '@/server/types';

// A pasted link, read by the API and turned into the app's own places, city and video, so every
// screen after this one works as it does for the samples. Two kinds of call: one extract per link,
// then one match per place, all at once. Each link's result is kept on the phone, so pasting it
// again costs nothing.

export type LinkOutcome =
  | { kind: 'done'; extraction: Extraction }
  /** Read, but nothing in it could be placed on a map. */
  | { kind: 'empty'; reel: Reel | null }
  /** An Instagram reel we couldn't read for places; the person adds them by search instead. */
  | { kind: 'assist'; reason: AssistReason; reel: Reel };

/** Up to five places are matched at a time: fast, without a burst of requests from one phone. */
const MATCH_AT_ONCE = 5;
/** Reading a reel can take a while when its transcript is needed; one place is quick. */
const EXTRACT_MS = 100_000;
const MATCH_MS = 15_000;

/**
 * Reads a link. `onFound` fires as soon as the place names are known, before they're matched, so
 * the screen can start showing them. Throws an ApiFailure for anything worth an error screen.
 */
export async function readLink(url: string, onFound?: (reel: Reel, names: FoundPlace[]) => void): Promise<LinkOutcome> {
  const link = parseLink(url);
  if (!link) throw new ApiFailure('unsupported_link', 'That’s not a YouTube or Instagram link.', false);
  const key = link.platform === 'youtube' ? `yt:${link.videoId}` : `ig:${link.shortcode}`;

  const saved = cache.read(key);
  if (saved) {
    // The places' coordinates are as old as the saved result, not as old as this paste.
    register(saved.extraction, saved.at);
    return { kind: 'done', extraction: saved.extraction };
  }

  const res = await post<ExtractResult>('/api/extract', { url }, EXTRACT_MS);
  if (res.status === 'assist') {
    // What we know of the reel, for the add-them-yourself screen: its title and thumbnail if it
    // could be read at all, otherwise just that it's a reel.
    const reel: Reel = res.video
      ? toReel({ platform: 'instagram', video: res.video }, key, '')
      : { id: key, platform: 'instagram', creator: 'Instagram reel', title: '', duration: '', thumbnail: 0, cityId: '', placeIds: [] };
    return { kind: 'assist', reason: res.reason, reel };
  }

  const { city: where, state } = regionParts(res.region, res.places);
  const cityId = `live:${slug(`${where} ${state}`)}`;
  const reel = toReel(res, key, cityId);
  onFound?.(reel, res.places);

  const failures: ApiFailure[] = [];
  const matched = await eachAtOnce(res.places, MATCH_AT_ONCE, (p) =>
    post<MatchResult>('/api/match', { name: p.name, area: p.area, region: res.region, confidence: p.confidence }, MATCH_MS).catch(
      (e: unknown) => {
        failures.push(e instanceof ApiFailure ? e : new ApiFailure('upstream', 'Something went wrong on our side. Try again.', true));
        return null;
      },
    ),
  );
  const pairs = res.places.flatMap((found, i) => {
    const m = matched[i];
    return m?.status === 'matched' ? [{ found, match: m.place }] : [];
  });
  // Every match failing is our side or today's limit, not the video: say so rather than "no places".
  if (pairs.length === 0 && failures.length > 0 && failures.length === res.places.length) throw failures[0];
  if (pairs.length === 0) return { kind: 'empty', reel };

  const places = toPlaces(pairs, reel, cityId);
  reel.placeIds = places.map((p) => p.id);
  const city = toCity(cityId, where, state, places, reel, res.terrain ?? undefined);
  const extraction: Extraction = { reel, city, places };
  register({ places, city, reel });
  cache.write(key, extraction);
  return { kind: 'done', extraction };
}

// ── "Missed one?": searching for a place and adding it ─────────────────────────────────────────

export type Suggestion = SearchResult['suggestions'][number];

/**
 * A fresh id for one search: from the first letter typed to the place picked. Google bills a
 * search's typing as one session when the pick carries the same id. Not a secret, so plain
 * Math.random is enough.
 */
export function newSearchSession(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/** Places matching what's typed, leaning toward `near` when there is one. */
export async function searchPlaces(input: string, session: string, near: { lat: number; lng: number } | null) {
  return (await post<SearchResult>('/api/search', { input, sessionToken: session, near }, 8000)).suggestions;
}

/**
 * A picked suggestion as one of the app's places, in `cityId`, credited to `reel`. `others` are the
 * city's places so far, for its spot on the stylised map. Null when Google can't place it.
 */
export async function placeFromPick(
  s: Suggestion,
  session: string,
  ctx: { cityId: string; reel: Reel; others: Place[] },
): Promise<Place | null> {
  const res = await post<MatchResult>(
    '/api/match',
    { name: s.name, area: s.where, placeId: s.placeId, sessionToken: session },
    MATCH_MS,
  );
  if (res.status !== 'matched') return null;
  const m = res.place;
  const type = kindOf(m.types, s.name);
  const points = project([...ctx.others.map((p) => p.coords), m.location]);
  const place: Place = {
    id: `g:${m.placeId}`,
    cityId: ctx.cityId,
    name: s.name,
    type,
    // The town, like the places read from a video ("Kottayam", not "College road").
    area: townOf(s.where).name,
    photo: m.photo ? { uri: m.photo.uri } : ctx.reel.thumbnail,
    photoCredit: m.photo?.attributions.map((a) => a.name).join(', ') || undefined,
    why: '',
    source: { kind: 'reel', reelId: ctx.reel.id, timestamp: '' },
    ...DEFAULTS[type],
    coords: m.location,
    map: points[points.length - 1],
    order: ctx.others.length,
  };
  register({ places: [place] });
  return place;
}

/**
 * Where someone's staying, as a point to start and end each day from: the town looked up with
 * Google, the same search as "Missed one?" and one lookup for its position. Null when it can't be
 * found; the plan then starts each day at its first place, as before.
 */
export async function findStay(town: string, near: LatLng | null): Promise<Stay | null> {
  try {
    const session = newSearchSession();
    const [first] = await searchPlaces(town, session, near);
    if (!first) return null;
    const res = await post<MatchResult>('/api/match', { name: first.name, area: first.where, placeId: first.placeId, sessionToken: session }, MATCH_MS);
    if (res.status !== 'matched') return null;
    return { name: first.name, coords: res.place.location, at: Date.now() };
  } catch {
    return null;
  }
}

/**
 * A saved place from a link, asked of Google again: its coordinates may only be kept 30 days, and
 * its photo link may have run out. Null when Google can't place it any more (it stays as it was).
 */
export async function refreshPlace(place: Place): Promise<Place | null> {
  if (!place.id.startsWith('g:')) return null;
  const res = await post<MatchResult>('/api/match', { name: place.name, placeId: place.id.slice(2) }, MATCH_MS);
  if (res.status !== 'matched') return null;
  const m = res.place;
  return {
    ...place,
    coords: m.location,
    ...(m.photo
      ? { photo: { uri: m.photo.uri }, photoCredit: m.photo.attributions.map((a) => a.name).join(', ') || undefined }
      : {}),
  };
}

/**
 * The town and state in a search result's "where": "Baker Street, Kottayam, Kerala, India" is
 * Kottayam, Kerala. The last part is the country, the one before it the state, and the one before
 * that the town. `id` is the city those places are saved under.
 */
export function townOf(where: string): { id: string; name: string; state: string } {
  const parts = where.split(',').map((p) => p.trim()).filter(Boolean);
  const name = parts.length >= 3 ? parts[parts.length - 3] : (parts[0] ?? 'Somewhere new');
  const state = parts.length >= 2 ? parts[parts.length - 2] : '';
  return { id: `live:${slug(`${name} ${state}`)}`, name, state };
}

/** The city for places someone added by hand, named after where the first one is. */
export function cityFromWhere(where: string, reel: Reel, places: Place[]): City {
  const town = townOf(where);
  return toCity(town.id, town.name, town.state, places, reel);
}

/**
 * Google's place types, reduced to the four kinds the app plans with. Google only sends types on a
 * fresh lookup (they can't be stored), so a place we've matched before is judged by its name.
 */
function kindOf(types: string[], name: string): PlaceType {
  const has = (...t: string[]) => t.some((x) => types.includes(x));
  if (has('restaurant', 'cafe', 'bakery', 'bar', 'food', 'meal_takeaway', 'ice_cream_shop', 'coffee_shop')) return 'food';
  if (has('lodging', 'hotel', 'hostel', 'resort_hotel', 'guest_house', 'campground')) return 'stay';
  if (has('amusement_park', 'spa', 'water_park', 'zoo', 'aquarium', 'hiking_area', 'marina')) return 'experience';
  if (types.length > 0) return 'sight';
  const n = name.toLowerCase();
  if (/caf[eé]|coffee|restaurant|bakery|patisserie|dessert|kitchen|dhaba|biryani|pizza|\bbar\b|brew|\btea\b|\bmess\b|eatery|food/.test(n)) return 'food';
  if (/hotel|resort|homestay|home stay|hostel|lodge|\binn\b|guest ?house|villa|\bcamp/.test(n)) return 'stay';
  if (/trek|trail|boat|cruise|safari|kayak|rafting|\bspa\b|zipline|paraglid/.test(n)) return 'experience';
  return 'sight';
}

/**
 * The review screen's answers for a real link, sent once when the checking is done: how we measure
 * whether extraction is getting places right. Best effort; a lost answer costs nothing.
 */
export function sendVerdicts(reel: Reel, verdicts: { place: Place; verdict: 'right' | 'wrong' | 'added' }[]) {
  if (!isLiveReel(reel)) return;
  verdicts.forEach(({ place, verdict }) =>
    post('/api/feedback', {
      videoId: reel.id,
      placeName: place.name,
      placeId: place.id.startsWith('g:') ? place.id.slice(2) : null,
      verdict,
    }, 8000).catch(() => {}),
  );
}

/** Whether a video came from a pasted link (not the samples). */
export const isLiveReel = (reel: Reel) => reel.id.startsWith('yt:') || reel.id.startsWith('ig:');

// ── From the API's shapes to the app's ───────────────────────────────────────────────────────────

// What the planner needs when nothing better is known, by kind of place: when it's best and how long
// people stay. The price is left unknown: a guess from the kind of place would be shown as fact.
const DEFAULTS: Record<PlaceType, { bestTime: DayPart; cost: Place['cost']; minutes: number }> = {
  food: { bestTime: 'afternoon', cost: null, minutes: 60 },
  stay: { bestTime: 'evening', cost: null, minutes: 30 },
  sight: { bestTime: 'morning', cost: null, minutes: 75 },
  experience: { bestTime: 'afternoon', cost: null, minutes: 90 },
};

/** The model's knowledge of the place where it had some, the kind-of-place defaults where not. */
function planningDetails(found: FoundPlace) {
  const d = DEFAULTS[found.type];
  return {
    bestTime: found.bestTime ?? d.bestTime,
    cost: found.price ?? d.cost,
    minutes: found.visitMinutes ?? d.minutes,
  };
}

function toReel(res: Pick<Extract<ExtractResult, { status: 'done' }>, 'platform' | 'video'>, id: string, cityId: string): Reel {
  const v = res.video;
  return {
    id,
    platform: res.platform,
    creator: v.channel,
    title: v.title,
    duration: v.durationSeconds ? clock(v.durationSeconds) : '',
    thumbnail: v.thumbnail ? { uri: v.thumbnail } : 0,
    cityId,
    placeIds: [],
  };
}

function toPlaces(pairs: { found: FoundPlace; match: MatchedPlace }[], reel: Reel, cityId: string): Place[] {
  const points = project(pairs.map((p) => p.match.location));
  const seen = new Set<string>();
  return pairs.flatMap(({ found, match }, i) => {
    // Two names in one video can be the same real place ("Om Beach", "Om beach Gokarna").
    const id = `g:${match.placeId}`;
    if (seen.has(id)) return [];
    seen.add(id);
    const photo: ImageSourcePropType = match.photo ? { uri: match.photo.uri } : reel.thumbnail;
    return [
      {
        id,
        cityId,
        name: found.name,
        type: found.type,
        area: found.area ?? '',
        photo,
        photoCredit: match.photo?.attributions.map((a) => a.name).join(', ') || undefined,
        why: found.why,
        source: { kind: 'reel', reelId: reel.id, timestamp: found.timestamp ?? '' },
        ...planningDetails(found),
        coords: match.location,
        map: points[i],
        order: i,
      },
    ];
  });
}

function toCity(id: string, name: string, state: string, places: Place[], reel: Reel, terrain?: Terrain): City {
  // The first place with its own photo makes the cover; the video's thumbnail if none has one.
  const covered = places.find((p) => p.photoCredit);
  return {
    id,
    name,
    state,
    // Our districts are only mapped for the sample regions; the city stands in for its own.
    district: name,
    hero: covered?.photo ?? reel.thumbnail,
    heroCredit: covered?.photoCredit,
    map: { roads: [], hills: [], labels: [] },
    terrain,
  };
}

/** "Munsiyari, Uttarakhand, India" → Munsiyari, Uttarakhand. Without a region, the commonest area. */
function regionParts(region: string | null, places: FoundPlace[]): { city: string; state: string } {
  const parts = (region ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length > 0) return { city: parts[0], state: parts[1] ?? '' };
  const counts = new Map<string, number>();
  places.forEach((p) => p.area && counts.set(p.area, (counts.get(p.area) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { city: top ?? 'Somewhere new', state: '' };
}

/**
 * Coordinates onto the stylised city map's world (CityMap's WORLD), keeping their shape. A stopgap:
 * places from Google go on a Google map before anyone outside the team sees them.
 */
function project(points: { lat: number; lng: number }[]): [number, number][] {
  if (points.length === 0) return [];
  const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = points.map((p) => p.lng * k);
  const ys = points.map((p) => -p.lat);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const size = 900;
  return points.map((_, i) => [
    Math.round(525 + ((xs[i] - (minX + maxX) / 2) / span) * size),
    Math.round(700 + ((ys[i] - (minY + maxY) / 2) / span) * size),
  ]);
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');

/** Runs `fn` over `items` with at most `n` in flight, keeping the results in order. */
async function eachAtOnce<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

// ── Kept on the phone: each link's result, for 30 days ──────────────────────────────────────────
// Google allows keeping coordinates for up to 30 days, so that's as long as a result is reused.

const CACHE_DAYS = 30;
// Bumped whenever what's kept changes shape, so an older copy is read afresh instead of shown
// without its new parts (v2: photo credits on the city cover).
const CACHE_PREFIX = 'xplore.link.v2.';
const cache = {
  read(key: string): { at: number; extraction: Extraction } | null {
    try {
      const raw = deviceStorage?.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;
      const kept = JSON.parse(raw) as { at: number; extraction: Extraction };
      return Date.now() - kept.at < CACHE_DAYS * 86400_000 ? kept : null;
    } catch {
      return null;
    }
  },
  write(key: string, extraction: Extraction) {
    try {
      deviceStorage?.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ at: Date.now(), extraction }));
    } catch {
      // Storage full or unavailable: the link is just read again next time.
    }
  },
};
