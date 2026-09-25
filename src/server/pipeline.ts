import type { Caller } from './auth';
import { env } from './env';
import { ApiError } from './errors';
import { findPlaces } from './gemini';
import { allowExtract, allowFeedback, beginMatch } from './limits';
import { parseLink } from './links';
import { getDetails, getPhoto, getPhotoRefs, searchPlaceId, type PhotoRef } from './places';
import { addFeedback, getExtraction, putExtraction, putMatch, type DoneExtraction } from './store';
import type { ExtractResult, FeedbackRequest, MatchRequest, MatchResult, PlacePhoto, Timings } from './types';
import { getVideo } from './youtube';

// The jobs the API does, split so each request stays small: extract reads a link and lists its
// places; match turns one name into a real place. The app calls match once per place, in parallel.
// Every request is counted against its limits first, and answered from storage when it can be.

/** Wall-clock time per named step, in ms, returned with every response so we can see what's slow. */
function timer() {
  const t0 = performance.now();
  const timings: Timings = {};
  return {
    async step<T>(name: string, run: () => Promise<T>): Promise<T> {
      const s = performance.now();
      try {
        return await run();
      } finally {
        timings[name] = Math.round(performance.now() - s);
      }
    },
    done(): Timings {
      return { ...timings, total: Math.round(performance.now() - t0) };
    },
  };
}

export async function extract(input: unknown, who: Caller): Promise<ExtractResult> {
  const t = timer();
  if (typeof input !== 'string') throw new ApiError(400, 'bad_request', 'Send {"url": "<a YouTube or Instagram link>"}.');
  const link = parseLink(input);
  if (!link) throw new ApiError(400, 'unsupported_link', 'That’s not a YouTube or Instagram link.');
  if (link.platform === 'instagram') {
    return { status: 'assist', platform: 'instagram', url: link.url, timings: t.done() };
  }

  await t.step('limits', () => allowExtract(who));
  const saved = await t.step('store', () => getExtraction(link.videoId));
  if (saved) return { ...saved, cached: true, timings: t.done() };

  const video = await t.step('youtube', () => getVideo(link.videoId, env.youtubeKey()));
  const found = await t.step('model', () =>
    findPlaces(video, env.geminiKey(), env.geminiModel(), env.geminiFallback()),
  );
  const result: DoneExtraction = {
    status: 'done',
    platform: 'youtube',
    cached: false,
    video: {
      id: video.id,
      title: video.title,
      channel: video.channel,
      durationSeconds: video.durationSeconds,
      thumbnail: video.thumbnail,
    },
    region: found.region,
    places: found.places,
    usage: found.usage,
    timings: {},
  };
  await t.step('save', () => putExtraction(link.videoId, result));
  return { ...result, timings: t.done() };
}

export async function match(req: Partial<MatchRequest>, who: Caller): Promise<MatchResult> {
  const t = timer();
  const name = clean(req.name, 200);
  if (!name) throw new ApiError(400, 'bad_request', 'Send {"name": "...", "area": "...", "region": "..."}.');
  const area = clean(req.area, 200);
  const region = clean(req.region, 200);
  // "Om Beach, Gokarna, Karnataka, India": the name plus whatever tells Google where to look.
  const query = [name, area, region].filter(Boolean).join(', ');
  const key = query.toLowerCase();

  const placesKey = env.placesKey();
  const begin = await t.step('begin', () => beginMatch(who, key, env.placesPhotos()));
  const saved = begin.stored;

  if (saved && !saved.placeId) {
    return { status: 'unmatched', needsCheck: true, cached: true, timings: t.done() };
  }
  // A place we've seen within 30 days: its ID and coordinates are stored; only the photo is fetched.
  if (saved?.placeId && saved.location) {
    const placeId = saved.placeId;
    const photo = begin.photoOk ? await t.step('photo', () => photoFor(placeId, undefined, placesKey)) : null;
    return {
      status: 'matched',
      place: { placeId, location: saved.location, address: null, types: [], photo },
      needsCheck: saved.needsCheck,
      cached: true,
      timings: t.done(),
    };
  }

  // New, or its coordinates are past 30 days. The place ID is kept forever, so no new search then.
  const placeId = saved?.placeId ?? (await t.step('search', () => searchPlaceId(query, placesKey)));
  if (!placeId) {
    await putMatch(key, { placeId: null, location: null, needsCheck: true });
    return { status: 'unmatched', needsCheck: true, cached: false, timings: t.done() };
  }
  if (!begin.detailsOk) throw new ApiError(503, 'quota', 'We’ve reached today’s limit. Try again tomorrow.');
  const d = await t.step('details', () => getDetails(placeId, placesKey));
  if (!d.location) return { status: 'unmatched', needsCheck: true, cached: false, timings: t.done() };

  const location = { lat: d.location.latitude, lng: d.location.longitude };
  const needsCheck = doubtful(req.confidence, d.formattedAddress ?? '', area, region);
  // Saving and fetching the photo don't depend on each other, so they run side by side.
  const [photo] = await t.step('photo+save', () =>
    Promise.all([
      begin.photoOk ? photoFor(placeId, d.photos, placesKey) : Promise.resolve(null),
      putMatch(key, { placeId, location, needsCheck }),
    ]),
  );
  return {
    status: 'matched',
    place: { placeId, location, address: d.formattedAddress ?? null, types: d.types ?? [], photo },
    needsCheck,
    cached: false,
    timings: t.done(),
  };
}

/** The Right / Wrong answers from the review screen: the accuracy measure, and what we learn from. */
export async function feedback(req: Partial<FeedbackRequest>, who: Caller): Promise<{ ok: true }> {
  const placeName = clean(req.placeName, 200);
  if (!placeName || !['right', 'wrong', 'added'].includes(req.verdict as string)) {
    throw new ApiError(400, 'bad_request', 'Send {"placeName": "...", "verdict": "right" | "wrong" | "added"}.');
  }
  await allowFeedback(who);
  try {
    await addFeedback(who.userId, {
      videoId: clean(req.videoId, 20) || null,
      placeName,
      placeId: clean(req.placeId, 300) || null,
      verdict: req.verdict as string,
    });
  } catch {
    throw new ApiError(502, 'upstream', 'Something went wrong on our side. Try again.');
  }
  return { ok: true };
}

/**
 * A Google photo for a place, once the daily cap has allowed it. References come with a fresh
 * lookup or from a free photos-only one. Past the cap, or with photos off, the app shows its
 * fallback card.
 */
async function photoFor(placeId: string, refs: PhotoRef[] | undefined, key: string): Promise<PlacePhoto | null> {
  const first = (refs ?? (await getPhotoRefs(placeId, key)))[0];
  return first ? getPhoto(first, key) : null;
}

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * Text Search's top hit is usually right, but not always: "Om Beach" has namesakes. Ask the user to
 * check when the model wasn't sure, or when the address mentions neither the area nor any part of
 * the video's region.
 */
function doubtful(confidence: unknown, address: string, area: string, region: string): boolean {
  if (typeof confidence === 'number' && confidence < 0.6) return true;
  const hints = [area, ...region.split(',').slice(0, 2)]
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 2);
  if (hints.length === 0) return true;
  const where = address.toLowerCase();
  return !hints.some((h) => where.includes(h));
}
