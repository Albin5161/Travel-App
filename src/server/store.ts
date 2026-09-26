import type { CityNotes, ExtractResult } from './types';
import { db } from './supabase';

// What the API remembers, in Supabase. Without Supabase it falls back to this process's memory,
// which only lasts as long as the runtime keeps the module: Expo's dev server starts each request
// fresh, so locally that fallback remembers nothing. Storage follows the platforms' rules:
// - extractions: kept 30 days, the YouTube developer policies' limit for API data;
// - matches: the Google place ID forever, coordinates for 30 days (Maps Service Specific Terms
//   14.3), nothing else from Places.

const DAYS = 86400_000;
const LOCATION_TTL = 30 * DAYS;
const EXTRACTION_TTL = 30 * DAYS;
/** A name Google couldn't match is asked again after a week; Google's data changes. */
const MISS_TTL = 7 * DAYS;

export type DoneExtraction = Extract<ExtractResult, { status: 'done' }>;

export type StoredMatch = {
  placeId: string | null;
  location: { lat: number; lng: number } | null;
  needsCheck: boolean;
};

const memory = {
  extractions: new Map<string, { result: unknown; at: number }>(),
  matches: new Map<string, { m: StoredMatch; at: number; locationAt: number | null }>(),
};

export const getExtraction = (videoId: string) => getKept<DoneExtraction>(videoId);

export async function putExtraction(videoId: string, result: DoneExtraction): Promise<void> {
  await putKept(videoId, result, result.usage.model);
}

/**
 * Anything read from outside and kept 30 days: a video's places (keyed by its ID, or ig:shortcode)
 * and a city's notes (city:slug). One table, since the rule is the same for all of them.
 */
export async function getKept<T>(key: string): Promise<T | null> {
  const supabase = db();
  if (!supabase) {
    const hit = memory.extractions.get(key);
    return hit && Date.now() - hit.at < EXTRACTION_TTL ? (hit.result as T) : null;
  }
  const { data, error } = await supabase
    .from('api_extractions')
    .select('result')
    .eq('video_id', key)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) console.error('[store] extraction read', error.message);
  return (data?.result as T | undefined) ?? null;
}

async function putKept(key: string, result: unknown, model: string | null): Promise<void> {
  const supabase = db();
  if (!supabase) {
    memory.extractions.set(key, { result, at: Date.now() });
    return;
  }
  const { error } = await supabase.from('api_extractions').upsert({
    video_id: key,
    result,
    model,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + EXTRACTION_TTL).toISOString(),
  });
  // Not saving only means the next person waits a few seconds longer; don't fail the request.
  if (error) console.error('[store] extraction write', error.message);
}

/** A city's notes, kept like a video's places. */
export const getCityNotes = (key: string) => getKept<CityNotes | { none: true }>(key);
export const putCityNotes = (key: string, notes: CityNotes | { none: true }, model: string | null) =>
  putKept(key, notes, model);

/**
 * The development fallback's stored match. With Supabase, reading the match is folded into the
 * same round trip as the rate limits (api_match_begin, see limits.ts).
 */
export function memoryMatch(query: string): StoredMatch | null {
  const hit = memory.matches.get(query);
  if (!hit) return null;
  const now = Date.now();
  if (!hit.m.placeId) return now - hit.at < MISS_TTL ? hit.m : null;
  const fresh = hit.locationAt !== null && now - hit.locationAt < LOCATION_TTL;
  return { ...hit.m, location: fresh ? hit.m.location : null };
}

export async function putMatch(query: string, m: StoredMatch): Promise<void> {
  const supabase = db();
  const now = Date.now();
  if (!supabase) {
    memory.matches.set(query, { m, at: now, locationAt: m.location ? now : null });
    if (memory.matches.size > 5000) memory.matches.delete(memory.matches.keys().next().value as string);
    return;
  }
  const { error } = await supabase.from('api_matches').upsert({
    query,
    place_id: m.placeId,
    lat: m.location?.lat ?? null,
    lng: m.location?.lng ?? null,
    location_fetched_at: m.location ? new Date(now).toISOString() : null,
    needs_check: m.needsCheck,
    updated_at: new Date(now).toISOString(),
  });
  if (error) console.error('[store] match write', error.message);
}

export async function addFeedback(
  userId: string,
  f: { videoId: string | null; placeName: string; placeId: string | null; verdict: string },
): Promise<void> {
  const supabase = db();
  if (!supabase) {
    console.log('[feedback]', userId, f);
    return;
  }
  const { error } = await supabase.from('api_feedback').insert({
    user_id: userId,
    video_id: f.videoId,
    place_name: f.placeName,
    place_id: f.placeId,
    verdict: f.verdict,
  });
  if (error) {
    console.error('[store] feedback write', error.message);
    throw new Error('feedback not saved');
  }
}
