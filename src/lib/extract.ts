import type { ImageSourcePropType } from 'react-native';

import { cityName, sameCityName } from '@/data/cityNames';
import type { Stay } from '@/data/planner';
import { live, register } from '@/data/registry';
import type { City, DayPart, Extraction, Place, PlaceFacts, PlaceType, Reel } from '@/data/types';
import { ApiFailure, post } from '@/lib/api';
import { distanceKm, type LatLng, type Terrain } from '@/lib/geo';
import { deviceStorage } from '@/lib/live/storage';
import { parseLink } from '@/server/links';
import type {
  AssistReason,
  ExtractResult,
  FoundPlace,
  MatchResult,
  MatchedPlace,
  SearchResult,
  SightsResult,
} from '@/server/types';

// A pasted link, read by the API and turned into the app's own places, city and video, so every
// screen after this one works as it does for the samples. Two kinds of call: one extract per link,
// then one match per place, all at once. Each link's result is kept on the phone, so pasting it
// again costs nothing.

export type LinkOutcome =
  | { kind: 'done'; extraction: Extraction }
  /** Read, but nothing in it could be placed on a map. `region` is the city it's about, if known. */
  | { kind: 'empty'; reel: Reel | null; region: string | null }
  /** An Instagram reel we couldn't read for places; the person adds them by search instead. */
  | { kind: 'assist'; reason: AssistReason; reel: Reel; region: string | null };

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
    const extraction = inKnownCity(saved.extraction);
    // The places' coordinates are as old as the saved result, not as old as this paste.
    register(extraction, saved.at);
    return { kind: 'done', extraction };
  }

  const res = await post<ExtractResult>('/api/extract', { url }, EXTRACT_MS);
  if (res.status === 'assist') {
    // What we know of the reel, for the add-them-yourself screen: its title and thumbnail if it
    // could be read at all, otherwise just that it's a reel.
    const reel: Reel = res.video
      ? toReel({ platform: 'instagram', video: res.video }, key, '')
      : { id: key, platform: 'instagram', creator: 'Instagram reel', title: '', duration: '', thumbnail: 0, cityId: '', placeIds: [] };
    return { kind: 'assist', reason: res.reason, reel, region: res.region ?? null };
  }

  const { city: where, state } = regionParts(res.region, res.places);
  const cityId = `live:${slug(`${where} ${state}`)}`;
  const reel = toReel(res, key, cityId);
  onFound?.(reel, res.places);

  const failures: ApiFailure[] = [];
  const matched = await eachAtOnce(res.places, MATCH_AT_ONCE, (p) =>
    matchFound(p, res.region).catch((e: unknown) => {
      failures.push(e instanceof ApiFailure ? e : new ApiFailure('upstream', 'Something went wrong on our side. Try again.', true));
      return null;
    }),
  );
  const pairs = res.places.flatMap((found, i) => {
    const m = matched[i];
    return m?.status === 'matched' ? [{ found, match: m.place }] : [];
  });
  // Every match failing is our side or today's limit, not the video: say so rather than "no places".
  if (pairs.length === 0 && failures.length > 0 && failures.length === res.places.length) throw failures[0];
  if (pairs.length === 0) return { kind: 'empty', reel, region: res.region };

  const places = toPlaces(pairs, reel, cityId);
  reel.placeIds = places.map((p) => p.id);
  const city = toCity(cityId, where, state, places, reel, res.terrain ?? undefined);
  const extraction = inKnownCity({ reel, city, places });
  register(extraction);
  cache.write(key, extraction);
  return { kind: 'done', extraction };
}

// ── One city, one collection ────────────────────────────────────────────────────────────────────
// A city's id is made from its name, and names vary from video to video ("Delhi, India", "New Delhi,
// Delhi, India"). So before a video's places are filed, the cities already on the phone are checked
// for the same one under another name or state.

/** Places further apart than this aren't one city, whatever they're called. */
const SAME_CITY_KM = 60;

const middle = (places: Place[]): LatLng | null =>
  places.length
    ? {
        lat: places.reduce((sum, p) => sum + p.coords.lat, 0) / places.length,
        lng: places.reduce((sum, p) => sum + p.coords.lng, 0) / places.length,
      }
    : null;

/** Whether two cities are one: names that match, and places in the same part of the map. */
export function sameCity(a: { name: string; places: Place[] }, b: { name: string; places: Place[] }): boolean {
  if (!sameCityName(a.name, b.name)) return false;
  const [here, there] = [middle(a.places), middle(b.places)];
  return !!here && !!there && distanceKm(here, there) <= SAME_CITY_KM;
}

/** The city already on the phone that this name and these places belong to, if there is one. */
function knownCity(name: string, places: Place[]): City | null {
  const all = Object.values(live.places);
  return (
    Object.values(live.cities).find((c) => sameCity({ name, places }, { name: c.name, places: all.filter((p) => p.cityId === c.id) })) ??
    null
  );
}

/** A video's places, filed under the city they're already saved as when it went by another name. */
function inKnownCity(e: Extraction): Extraction {
  if (live.cities[e.city.id]) return e;
  const known = knownCity(e.city.name, e.places);
  if (!known) return e;
  return {
    city: known,
    reel: { ...e.reel, cityId: known.id },
    places: e.places.map((p) => ({ ...p, cityId: known.id })),
  };
}

/**
 * One named place, looked up on the map. A failure on our side (not "no such place", not a limit)
 * gets a second try before the place is given up on: the server keeps what it found the first
 * time, so the second is quick, and a place that exists shouldn't be shown as not found.
 */
async function matchFound(p: FoundPlace, region: string | null): Promise<MatchResult> {
  const ask = () => post<MatchResult>('/api/match', { name: p.name, area: p.area, region, confidence: p.confidence }, MATCH_MS);
  try {
    return await ask();
  } catch (e) {
    if (e instanceof ApiFailure && !e.retryable) throw e;
    return ask();
  }
}

// ── A city's best-known spots, for a video of it that named none ────────────────────────────────

/**
 * The best-known spots in `region` ("Mumbai, Maharashtra, India"), matched to real places and
 * credited to `reel`, the video they're being added from. Places Google can't find are left out.
 */
export async function bestKnownSpots(region: string, reel: Reel): Promise<Place[]> {
  const res = await post<SightsResult>('/api/sights', { region }, 30_000);
  const matched = await eachAtOnce(res.places, MATCH_AT_ONCE, (p) => matchFound(p, res.region).catch(() => null));
  const pairs = res.places.flatMap((found, i) => {
    const m = matched[i];
    return m?.status === 'matched' ? [{ found, match: m.place }] : [];
  });
  const places = toPlaces(pairs, reel, townOf(region).id);
  register({ places });
  return places;
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
    photo: m.photo ? { uri: m.photo.uri } : framePhoto(ctx.reel, ctx.others.length),
    photoCredit: m.photo?.attributions.map((a) => a.name).join(', ') || undefined,
    ...(m.photo ? {} : { photoFromVideo: Date.now() }),
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
    return first ? await stayFromPick(first, session) : null;
  } catch {
    return null;
  }
}

/** A hotel or area picked from search, as where each day starts and ends. Null when Google can't place it. */
export async function stayFromPick(s: Suggestion, session: string): Promise<Stay | null> {
  const res = await post<MatchResult>('/api/match', { name: s.name, area: s.where, placeId: s.placeId, sessionToken: session }, MATCH_MS);
  if (res.status !== 'matched') return null;
  return { name: s.name, coords: res.place.location, at: Date.now() };
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
 * A saved place still showing a video's picture (a thumbnail from before frames, or a frame): a
 * real photo looked for again, from Wikimedia or Google; failing that, a frame of the video rather
 * than its thumbnail. Null when nothing changed, or the server couldn't be reached.
 */
export async function betterPhoto(place: Place, reel: Reel | undefined, turn: number): Promise<Place | null> {
  if (!place.id.startsWith('g:')) return null;
  const res = await post<MatchResult>('/api/match', { name: place.name, placeId: place.id.slice(2) }, MATCH_MS).catch(() => null);
  if (!res) return null;
  if (res.status === 'matched' && res.place.photo) {
    const { photoFromVideo: _, ...rest } = place;
    return {
      ...rest,
      coords: res.place.location,
      photo: { uri: res.place.photo.uri },
      photoCredit: res.place.photo.attributions.map((a) => a.name).join(', ') || undefined,
    };
  }
  if (!reel) return { ...place, photoFromVideo: Date.now() };
  if (!reel.frames && reel.id.startsWith('yt:')) {
    const got = await post<{ frames: string[] }>('/api/frames', { videoId: reel.id.slice(3) }, 8000).catch(() => null);
    if (got?.frames.length) register({ reel: { ...reel, frames: got.frames } });
  }
  const current = live.reels[reel.id] ?? reel;
  const stamp = place.source.kind === 'reel' ? place.source.timestamp : null;
  return { ...place, photo: framePhoto(current, turn, stamp), photoCredit: undefined, photoFromVideo: Date.now() };
}

/**
 * The town and state in a search result's "where": "Baker Street, Kottayam, Kerala, India" is
 * Kottayam, Kerala. The last part is the country, the one before it the state, and the one before
 * that the town. `id` is the city those places are saved under.
 */
export function townOf(where: string): { id: string; name: string; state: string } {
  const parts = where.split(',').map((p) => p.trim()).filter(Boolean);
  const name = cityName(parts.length >= 3 ? parts[parts.length - 3] : (parts[0] ?? 'Somewhere new'));
  const state = parts.length >= 2 ? parts[parts.length - 2] : '';
  return { id: `live:${slug(`${name} ${state}`)}`, name, state };
}

/** The city for places someone added by hand, named after where the first one is. */
export function cityFromWhere(where: string, reel: Reel, places: Place[]): City {
  const town = townOf(where);
  const known = live.cities[town.id] ? null : knownCity(town.name, places);
  return known ?? toCity(town.id, town.name, town.state, places, reel);
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

/** From this many places, checking them one card at a time is a chore: they're a ticked list instead. */
export const CHECK_AS_LIST_FROM = 6;

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
    ...(v.frames?.length ? { frames: v.frames } : {}),
    ...(v.slides !== undefined ? { slides: v.slides } : {}),
    cityId,
    placeIds: [],
  };
}

/** A photo post, not a video: an Instagram link whose pictures were what got read. */
export const isPhotoPost = (reel: Reel) => !!reel.slides;

/** How long a video is, or how many photos a post has: the small print beside who made it. */
export const lengthLabel = (reel: Reel) =>
  reel.slides ? `${reel.slides} ${reel.slides === 1 ? 'photo' : 'photos'}` : reel.duration;

/**
 * The picture for a place with no photo of its own: the video frame nearest the place's moment in
 * it when the description has chapters, otherwise the three frames in turn so neighbours differ.
 * An Instagram reel has no frames; its cover is all there is.
 */
export function framePhoto(reel: Reel, turn: number, stamp?: string | null): ImageSourcePropType {
  const frames = reel.frames;
  if (!frames?.length) return reel.thumbnail;
  const at = stamp ? seconds(stamp) : 0;
  const length = seconds(reel.duration);
  const k = at && length ? Math.min(frames.length - 1, Math.max(0, Math.round((at / length) * 4) - 1)) : turn % frames.length;
  return { uri: frames[k] };
}

/** "1:02:03" or "4:05" in seconds; 0 when it isn't a time. */
function seconds(clockText: string): number {
  const parts = clockText.split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  return parts.reduce((sum, n) => sum * 60 + n, 0);
}

/**
 * The model's finer facts for timing a day, as the app keeps them on a place. Nothing at all when
 * the result is from before they were asked for (an older read kept on the server or the phone):
 * the planner then goes by the place's kind, best part of the day and name, as it always has.
 */
function factsOf(found: FoundPlace): { facts?: PlaceFacts } {
  if (found.window === undefined && found.mealType === undefined && found.sunsetRelevant === undefined) return {};
  return {
    facts: {
      meal: found.mealType ?? null,
      window: found.window ?? null,
      sunset: !!found.sunsetRelevant,
      sunrise: !!found.sunriseRelevant,
      night: !!found.nightRelevant,
      parentArea: found.parentArea ?? null,
    },
  };
}

function toPlaces(pairs: { found: FoundPlace; match: MatchedPlace }[], reel: Reel, cityId: string): Place[] {
  const points = project(pairs.map((p) => p.match.location));
  const seen = new Set<string>();
  let turn = 0;
  return pairs.flatMap(({ found, match }, i) => {
    // Two names in one video can be the same real place ("Om Beach", "Om beach Gokarna").
    const id = `g:${match.placeId}`;
    if (seen.has(id)) return [];
    seen.add(id);
    const photo: ImageSourcePropType = match.photo ? { uri: match.photo.uri } : framePhoto(reel, turn++, found.timestamp);
    return [
      {
        id,
        cityId,
        name: found.name,
        type: found.type,
        area: found.area ?? '',
        photo,
        photoCredit: match.photo?.attributions.map((a) => a.name).join(', ') || undefined,
        ...(match.photo ? {} : { photoFromVideo: Date.now() }),
        ...factsOf(found),
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
  // The cover: a sight or an experience with its own photo (a fort says "Mumbai" better than a
  // hotel lobby), then any place with one, then a frame from the video.
  const covered =
    places.find((p) => p.photoCredit && (p.type === 'sight' || p.type === 'experience')) ?? places.find((p) => p.photoCredit);
  return {
    id,
    name,
    state,
    // Our districts are only mapped for the sample regions; the city stands in for its own.
    district: name,
    hero: covered?.photo ?? framePhoto(reel, 1),
    heroCredit: covered?.photoCredit,
    map: { roads: [], hills: [], labels: [] },
    terrain,
  };
}

/** "Munsiyari, Uttarakhand, India" → Munsiyari, Uttarakhand. Without a region, the commonest area. */
function regionParts(region: string | null, places: FoundPlace[]): { city: string; state: string } {
  const parts = (region ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length > 0) return { city: cityName(parts[0]), state: parts[1] ?? '' };
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
      // A photo post kept before its pictures were read (no length, no count) has only its caption's places.
      const r = kept.extraction.reel;
      if (r.platform === 'instagram' && !r.duration && r.slides === undefined) return null;
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
