import { env } from './env';
import { ApiError } from './errors';
import { findPlaces } from './gemini';
import { parseLink } from './links';
import { getDetails, getPhotoUri, searchPlaceId, toMatched } from './places';
import type { ExtractResult, MatchedPlace, MatchRequest, MatchResult, Timings } from './types';
import { getVideo } from './youtube';

// The two jobs the API does, split so each request stays small: extract reads a link and lists
// its places (2 outside calls); match turns one name into a real place (up to 3). The app calls
// match once per place, in parallel. EAS Hosting's Free plan allows 10 outside calls a request.

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

/**
 * Remembers recent results for as long as this server process lives. Enough to make a repeated
 * link instant and to look a café up once; a database replaces it before launch.
 */
function memo<V>(limit: number) {
  const m = new Map<string, V>();
  return {
    get: (k: string) => m.get(k),
    set(k: string, v: V) {
      if (m.size >= limit) m.delete(m.keys().next().value as string);
      m.set(k, v);
    },
  };
}

const extractions = memo<Extract<ExtractResult, { status: 'done' }>>(200);
type StoredMatch = { status: 'matched'; place: MatchedPlace; needsCheck: boolean } | { status: 'unmatched'; needsCheck: true };
const matches = memo<StoredMatch>(2000);

export async function extract(input: unknown): Promise<ExtractResult> {
  const t = timer();
  if (typeof input !== 'string') throw new ApiError(400, 'bad_request', 'Send {"url": "<a YouTube or Instagram link>"}.');
  const link = parseLink(input);
  if (!link) throw new ApiError(400, 'unsupported_link', 'That’s not a YouTube or Instagram link.');
  if (link.platform === 'instagram') {
    return { status: 'assist', platform: 'instagram', url: link.url, timings: t.done() };
  }

  const hit = extractions.get(link.videoId);
  if (hit) return { ...hit, cached: true, timings: t.done() };

  const video = await t.step('youtube', () => getVideo(link.videoId, env.youtubeKey()));
  const found = await t.step('model', () => findPlaces(video, env.geminiKey(), env.geminiModel(), env.geminiFallback()));
  const result: ExtractResult = {
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
    timings: t.done(),
  };
  extractions.set(link.videoId, result);
  return result;
}

export async function match(req: Partial<MatchRequest>): Promise<MatchResult> {
  const t = timer();
  const name = typeof req.name === 'string' ? req.name.trim() : '';
  if (!name) throw new ApiError(400, 'bad_request', 'Send {"name": "...", "area": "...", "region": "..."}.');
  const area = typeof req.area === 'string' ? req.area.trim() : '';
  const region = typeof req.region === 'string' ? req.region.trim() : '';
  // "Om Beach, Gokarna, Karnataka, India": the name plus whatever tells Google where to look.
  const query = [name, area, region].filter(Boolean).join(', ');

  const hit = matches.get(query.toLowerCase());
  if (hit) return { ...hit, cached: true, timings: t.done() };

  const key = env.placesKey();
  const id = await t.step('search', () => searchPlaceId(query, key));
  if (!id) {
    const miss = { status: 'unmatched', needsCheck: true } as const;
    matches.set(query.toLowerCase(), miss);
    return { ...miss, cached: false, timings: t.done() };
  }
  const details = await t.step('details', () => getDetails(id, key));
  const photoName = env.placesPhotos() ? details.photos?.[0]?.name : undefined;
  const photoUri = photoName ? await t.step('photo', () => getPhotoUri(photoName, key)) : null;
  const place = toMatched(details, photoUri);
  if (!place) {
    const miss = { status: 'unmatched', needsCheck: true } as const;
    return { ...miss, cached: false, timings: t.done() };
  }

  const result = { status: 'matched', place, needsCheck: doubtful(req.confidence, place.address, area, region) } as const;
  // Photo URLs are short-lived, so a remembered match keeps its place but not its photo.
  matches.set(query.toLowerCase(), { ...result, place: { ...place, photo: null } });
  return { ...result, cached: false, timings: t.done() };
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
