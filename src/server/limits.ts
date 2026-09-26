import type { Caller } from './auth';
import { limit } from './env';
import { ApiError } from './errors';
import { memoryMatch, type StoredMatch } from './store';
import { db } from './supabase';

const HOUR = 3600;
const DAY = 86400;

// Two kinds of limit. Per person and per network, so one install (or one script minting anonymous
// sign-ins from one address) can't hog the service. And global daily caps, set under Google's free
// monthly allowances, so the API stops before it spends money: 300 place lookups a day is about
// 9,000 a month (free up to 10,000), 30 photos a day is about 900 (free up to 1,000). The
// Instagram caps spread Apify's $5 of free monthly credit over the month: 20 reels a day is about
// $2.20, one transcript a day at most about $3. 300 searches a day (one per typed pause) is about
// 9,000 a month, under Autocomplete's 10,000 free. 30 place pages a day with Google's reviews is
// about 900 a month, under Place Details Enterprise + Atmosphere's 1,000 free.
// Each can be changed from the environment.
const L = {
  extractPerUser: () => limit('LIMIT_EXTRACT_PER_HOUR', 20),
  extractPerIp: () => limit('LIMIT_EXTRACT_PER_IP_HOUR', 60),
  extractPerDay: () => limit('LIMIT_EXTRACT_PER_DAY', 1000),
  matchPerUser: () => limit('LIMIT_MATCH_PER_HOUR', 300),
  matchPerIp: () => limit('LIMIT_MATCH_PER_IP_HOUR', 900),
  feedbackPerUser: () => limit('LIMIT_FEEDBACK_PER_HOUR', 500),
  detailsPerDay: () => limit('LIMIT_PLACE_DETAILS_PER_DAY', 300),
  photosPerDay: () => limit('LIMIT_PHOTOS_PER_DAY', 30),
  searchPerUser: () => limit('LIMIT_SEARCH_PER_HOUR', 150),
  searchPerIp: () => limit('LIMIT_SEARCH_PER_IP_HOUR', 450),
  searchPerDay: () => limit('LIMIT_SEARCH_PER_DAY', 300),
  placeInfoPerUser: () => limit('LIMIT_PLACE_INFO_PER_HOUR', 60),
  placeInfoPerDay: () => limit('LIMIT_PLACE_INFO_PER_DAY', 30),
  cityNotesPerUser: () => limit('LIMIT_CITY_NOTES_PER_HOUR', 30),
  cityNotesPerDay: () => limit('LIMIT_CITY_NOTES_PER_DAY', 100),
  reelsPerDay: () => limit('LIMIT_INSTAGRAM_REELS_PER_DAY', 20),
  transcriptsPerDay: () => limit('LIMIT_INSTAGRAM_TRANSCRIPTS_PER_DAY', 1),
};

type Bucket = { key: string; seconds: number; max: number };

// A database error mustn't turn into "no limits": that would also mean no cap on spend.
function unavailable(where: string, message: string): never {
  console.error(`[limits] ${where}: ${message}`);
  throw new ApiError(503, 'upstream', 'Something went wrong on our side. Try again.');
}

function refuse(over: string): never {
  if (over.startsWith('global:')) {
    throw new ApiError(503, 'quota', 'We’ve reached today’s limit. Try again tomorrow.');
  }
  throw new ApiError(429, 'rate_limited', 'You’ve added a lot in the last hour. Try again a little later.');
}

/** Counts one use against each bucket; returns the key of the first one over its limit, or null. */
async function consume(buckets: Bucket[], cleanup = false): Promise<string | null> {
  const supabase = db();
  if (!supabase) return consumeInMemory(buckets);
  const { data, error } = await supabase.rpc('api_consume', {
    p_buckets: buckets.map((b) => b.key),
    p_seconds: buckets.map((b) => b.seconds),
    p_limits: buckets.map((b) => b.max),
    p_cleanup: cleanup,
  });
  if (error) unavailable('consume', error.message);
  return (data as string | null) ?? null;
}

// Development only, and weak even there: Expo's dev server starts each request fresh, so these
// counts don't carry over. Real limits need Supabase, and production refuses to run without it.
const counts = new Map<string, number>();
function consumeInMemory(buckets: Bucket[]): string | null {
  if (counts.size > 10000) counts.clear();
  let over: string | null = null;
  for (const b of buckets) {
    const k = `${b.key}@${Math.floor(Date.now() / 1000 / b.seconds)}`;
    const n = (counts.get(k) ?? 0) + 1;
    counts.set(k, n);
    if (n > b.max && !over) over = b.key;
  }
  return over;
}

/** Once per link: the limits, and the storage housekeeping. */
export async function allowExtract(c: Caller) {
  const over = await consume(
    [
      { key: `user:${c.userId}:extract`, seconds: HOUR, max: L.extractPerUser() },
      { key: `ip:${c.ip}:extract`, seconds: HOUR, max: L.extractPerIp() },
      { key: 'global:extract', seconds: DAY, max: L.extractPerDay() },
    ],
    true,
  );
  if (over) refuse(over);
}

/**
 * Whether today's cap allows one more paid Instagram read. Unlike the other limits, being over
 * isn't an error: the app just falls back to adding places by search.
 */
export async function allowReel(kind: 'reel' | 'transcript'): Promise<boolean> {
  const max = kind === 'reel' ? L.reelsPerDay() : L.transcriptsPerDay();
  return !(await consume([{ key: `global:instagram-${kind}`, seconds: DAY, max }]));
}

/** One search request: typing in "Missed one?", counted per person, per network and per day. */
export async function allowSearch(c: Caller) {
  const over = await consume([
    { key: `user:${c.userId}:search`, seconds: HOUR, max: L.searchPerUser() },
    { key: `ip:${c.ip}:search`, seconds: HOUR, max: L.searchPerIp() },
    { key: 'global:search', seconds: DAY, max: L.searchPerDay() },
  ]);
  if (over) refuse(over);
}

/**
 * Whether today's cap allows one more place page with Google's reviews. Past it, the page shows
 * without them rather than failing. A person over their hourly limit is refused as usual.
 */
export async function allowPlaceInfo(c: Caller): Promise<boolean> {
  const over = await consume([
    { key: `user:${c.userId}:place-info`, seconds: HOUR, max: L.placeInfoPerUser() },
    { key: 'global:place-info', seconds: DAY, max: L.placeInfoPerDay() },
  ]);
  if (over && !over.startsWith('global:')) refuse(over);
  return !over;
}

/** One city's notes read afresh (they're kept 30 days, so this is rare). */
export async function allowCityNotes(c: Caller) {
  const over = await consume([
    { key: `user:${c.userId}:city-notes`, seconds: HOUR, max: L.cityNotesPerUser() },
    { key: 'global:city-notes', seconds: DAY, max: L.cityNotesPerDay() },
  ]);
  if (over) refuse(over);
}

export async function allowFeedback(c: Caller) {
  const over = await consume([{ key: `user:${c.userId}:feedback`, seconds: HOUR, max: L.feedbackPerUser() }]);
  if (over) refuse(over);
}

export type MatchStart = {
  /** What we have for this name; `location` is set only while it's within Google's 30 days. */
  stored: StoredMatch | null;
  /** Whether today's free cap allows a Place Details lookup. Only counted when nothing fresh is stored. */
  detailsOk: boolean;
  /** Whether today's free cap allows a photo. */
  photoOk: boolean;
};

/**
 * Everything a place match needs before it calls Google, in one database round trip: the caller's
 * rate limits, the stored match, and today's caps. Throws when the caller is over a limit.
 */
export async function beginMatch(c: Caller, query: string, wantPhoto: boolean): Promise<MatchStart> {
  const supabase = db();
  if (!supabase) {
    const over = consumeInMemory([
      { key: `user:${c.userId}:match`, seconds: HOUR, max: L.matchPerUser() },
      { key: `ip:${c.ip}:match`, seconds: HOUR, max: L.matchPerIp() },
    ]);
    if (over) refuse(over);
    const stored = memoryMatch(query);
    const fresh = !!stored && (!stored.placeId || !!stored.location);
    return {
      stored,
      detailsOk: fresh || !consumeInMemory([{ key: 'global:place-details', seconds: DAY, max: L.detailsPerDay() }]),
      photoOk: wantPhoto && !consumeInMemory([{ key: 'global:photos', seconds: DAY, max: L.photosPerDay() }]),
    };
  }

  const { data, error } = await supabase.rpc('api_match_begin', {
    p_query: query,
    p_user_bucket: `user:${c.userId}:match`,
    p_user_limit: L.matchPerUser(),
    p_ip_bucket: `ip:${c.ip}:match`,
    p_ip_limit: L.matchPerIp(),
    p_details_limit: L.detailsPerDay(),
    p_want_photo: wantPhoto,
    p_photo_limit: L.photosPerDay(),
  });
  if (error) unavailable('match', error.message);
  const r = data as {
    over: string | null;
    stored?: { place_id: string | null; fresh: boolean; lat: number | null; lng: number | null; needs_check: boolean } | null;
    details_ok?: boolean;
    photo_ok?: boolean;
  };
  if (r.over) refuse(r.over);
  const s = r.stored;
  // A stored miss older than a week counts as nothing stored: ask Google again.
  const stored: StoredMatch | null =
    !s || (!s.place_id && !s.fresh)
      ? null
      : {
          placeId: s.place_id,
          location: s.place_id && s.fresh && s.lat !== null && s.lng !== null ? { lat: s.lat, lng: s.lng } : null,
          needsCheck: s.needs_check,
        };
  return { stored, detailsOk: r.details_ok ?? false, photoOk: r.photo_ok ?? false };
}
