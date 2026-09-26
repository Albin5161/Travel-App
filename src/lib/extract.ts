import type { ImageSourcePropType } from 'react-native';

import { register } from '@/data/registry';
import type { City, DayPart, Extraction, Place, PlaceType, Reel } from '@/data/types';
import { ApiFailure, post } from '@/lib/api';
import { deviceStorage } from '@/lib/live/storage';
import { parseLink } from '@/server/links';
import type { AssistReason, ExtractResult, FoundPlace, MatchResult, MatchedPlace } from '@/server/types';

// A pasted link, read by the API and turned into the app's own places, city and video, so every
// screen after this one works as it does for the samples. Two kinds of call: one extract per link,
// then one match per place, all at once. Each link's result is kept on the phone, so pasting it
// again costs nothing.

export type LinkOutcome =
  | { kind: 'done'; extraction: Extraction }
  /** Read, but nothing in it could be placed on a map. */
  | { kind: 'empty'; reel: Reel | null }
  /** An Instagram reel we couldn't read for places; the person adds them by search instead. */
  | { kind: 'assist'; reason: AssistReason };

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
    register(saved);
    return { kind: 'done', extraction: saved };
  }

  const res = await post<ExtractResult>('/api/extract', { url }, EXTRACT_MS);
  if (res.status === 'assist') return { kind: 'assist', reason: res.reason };

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
  const city = toCity(cityId, where, state, places, reel);
  const extraction: Extraction = { reel, city, places };
  register({ places, city, reel });
  cache.write(key, extraction);
  return { kind: 'done', extraction };
}

/**
 * The review screen's answers for a real link, sent once when the checking is done: how we measure
 * whether extraction is getting places right. Best effort; a lost answer costs nothing.
 */
export function sendVerdicts(reel: Reel, verdicts: { place: Place; verdict: 'right' | 'wrong' }[]) {
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

// What the planner needs and a video never says, by kind of place: when it's best, a rough cost
// (0 free to 3 pricey) and how long people stay.
const DEFAULTS: Record<PlaceType, { bestTime: DayPart; cost: Place['cost']; minutes: number }> = {
  food: { bestTime: 'afternoon', cost: 1, minutes: 60 },
  stay: { bestTime: 'evening', cost: 2, minutes: 30 },
  sight: { bestTime: 'morning', cost: 0, minutes: 75 },
  experience: { bestTime: 'afternoon', cost: 1, minutes: 90 },
};

function toReel(res: Extract<ExtractResult, { status: 'done' }>, id: string, cityId: string): Reel {
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
        ...DEFAULTS[found.type],
        coords: match.location,
        map: points[i],
        order: i,
      },
    ];
  });
}

function toCity(id: string, name: string, state: string, places: Place[], reel: Reel): City {
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
const cache = {
  read(key: string): Extraction | null {
    try {
      const raw = deviceStorage?.getItem(`xplore.link.${key}`);
      if (!raw) return null;
      const { at, extraction } = JSON.parse(raw) as { at: number; extraction: Extraction };
      return Date.now() - at < CACHE_DAYS * 86400_000 ? extraction : null;
    } catch {
      return null;
    }
  },
  write(key: string, extraction: Extraction) {
    try {
      deviceStorage?.setItem(`xplore.link.${key}`, JSON.stringify({ at: Date.now(), extraction }));
    } catch {
      // Storage full or unavailable: the link is just read again next time.
    }
  },
};
