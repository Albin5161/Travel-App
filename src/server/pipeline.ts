import type { Caller } from './auth';
import { env } from './env';
import { ApiError } from './errors';
import { findPlaces } from './gemini';
import { getReel, TRANSCRIPT_MAX_SECONDS, type ReelDetails } from './instagram';
import { wikimediaPhoto } from './commons';
import { allowCityNotes, allowExtract, allowFeedback, allowPhoto, allowPlaceInfo, allowReel, allowSearch, beginMatch } from './limits';
import { parseLink, type ParsedLink } from './links';
import { readCityNotes } from './citynotes';
import { getDetails, getPhoto, getPhotoRefs, getPlaceInfo, searchPlaceId, searchPlaces, type PhotoRef } from './places';
import { addFeedback, getCityNotes, getExtraction, putCityNotes, putExtraction, putMatch, type DoneExtraction } from './store';
import type {
  AssistReason,
  CityNotes,
  CityNotesRequest,
  ExtractResult,
  FeedbackRequest,
  MatchRequest,
  MatchResult,
  PlaceInfo,
  PlacePhoto,
  ReelSignals,
  SearchRequest,
  SearchResult,
  Timings,
} from './types';
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

type Timer = ReturnType<typeof timer>;

export async function extract(input: unknown, who: Caller): Promise<ExtractResult> {
  const t = timer();
  if (typeof input !== 'string') throw new ApiError(400, 'bad_request', 'Send {"url": "<a YouTube or Instagram link>"}.');
  const link = parseLink(input);
  if (!link) throw new ApiError(400, 'unsupported_link', 'That’s not a YouTube or Instagram link.');
  if (link.platform === 'instagram') return extractReel(link, who, t);

  await t.step('limits', () => allowExtract(who));
  const saved = await t.step('store', () => getExtraction(link.videoId));
  if (saved) {
    // Readings stored before frames were added get them now; the check is one small request.
    const frames = saved.video.frames ?? (await t.step('frames', () => videoFrames(link.videoId)));
    return { ...saved, video: { ...saved.video, frames }, cached: true, timings: t.done() };
  }

  const video = await t.step('youtube', () => getVideo(link.videoId, env.youtubeKey()));
  const [found, frames] = await Promise.all([
    t.step('model', () => findPlaces({ kind: 'youtube', video }, env.geminiKey(), env.geminiModel(), env.geminiFallback())),
    videoFrames(link.videoId),
  ]);
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
      frames,
    },
    region: found.region,
    terrain: found.terrain,
    places: found.places,
    usage: found.usage,
    timings: {},
  };
  await t.step('save', () => putExtraction(link.videoId, result));
  return { ...result, timings: t.done() };
}

/**
 * An Instagram reel, read through Apify: first its text (caption, location tag, tagged accounts,
 * comments), then, only when that names nothing and the reel is short, what's said in it. Whatever
 * doesn't work out falls back to the user adding places by search, with the reason.
 */
async function extractReel(
  link: Extract<ParsedLink, { platform: 'instagram' }>,
  who: Caller,
  t: Timer,
): Promise<ExtractResult> {
  const assist = (reason: AssistReason, video?: DoneExtraction['video']): ExtractResult => ({
    status: 'assist',
    platform: 'instagram',
    url: link.url,
    reason,
    ...(video ? { video } : {}),
    timings: t.done(),
  });
  const token = env.apifyToken();
  if (!token) return assist('not_configured');

  await t.step('limits', () => allowExtract(who));
  // Stored under its own prefix: a shortcode and a YouTube ID can't be told apart otherwise.
  const key = `ig:${link.shortcode}`;
  const saved = await t.step('store', () => getExtraction(key));
  if (saved) return saved.places.length ? { ...saved, cached: true, timings: t.done() } : assist('no_places', saved.video);

  if (!(await t.step('cap', () => allowReel('reel')))) return assist('daily_limit');
  let reel = await t.step('apify', () => getReel(link.url, token, { transcript: false }));
  if (!reel) return assist('unreadable');
  const read = (r: ReelDetails, step: string) =>
    t.step(step, () =>
      findPlaces({ kind: 'instagram', reel: r }, env.geminiKey(), env.geminiModel(), env.geminiFallback()),
    );
  let found = hasText(reel) ? await read(reel, 'model') : null;

  // Nothing in the text: try what's said in the reel. A miss is only remembered once that's been
  // tried (or can't be), so a reel turned away by today's cap gets another chance tomorrow.
  let settled = true;
  const canHear =
    env.instagramTranscripts() && reel.durationSeconds !== null && reel.durationSeconds <= TRANSCRIPT_MAX_SECONDS;
  if (!found?.places.length && canHear) {
    if (await t.step('cap-transcript', () => allowReel('transcript'))) {
      const heard = await t.step('apify-transcript', () => getReel(link.url, token, { transcript: true }));
      if (heard?.transcript) {
        reel = heard;
        found = await read(heard, 'model-transcript');
      } else {
        settled = !!heard;
        if (heard) console.warn(`[instagram] ${link.shortcode}: asked for a transcript, none came back`);
      }
    } else {
      settled = false;
    }
  }

  const signals: ReelSignals = {
    caption: !!reel.caption,
    locationTag: !!reel.location,
    taggedAccounts: reel.tagged.length > 0 || reel.mentions.length > 0,
    comments: reel.comments.length > 0,
    transcript: !!reel.transcript,
  };
  const result: DoneExtraction = {
    status: 'done',
    platform: 'instagram',
    cached: false,
    video: {
      id: link.shortcode,
      title: reel.caption.split('\n')[0].slice(0, 120) || `Reel by @${reel.owner}`,
      channel: `@${reel.owner}`,
      durationSeconds: reel.durationSeconds,
      thumbnail: reel.thumbnail,
    },
    region: found?.region ?? null,
    terrain: found?.terrain ?? null,
    places: found?.places ?? [],
    usage: found?.usage ?? { model: 'none', inputTokens: 0, outputTokens: 0 },
    signals,
    timings: {},
  };
  const had = Object.entries(signals).filter(([, on]) => on).map(([name]) => name);
  console.log(`[instagram] ${link.shortcode}: ${result.places.length} places from ${had.join(', ') || 'no text'}`);
  if (result.places.length || settled) await t.step('save', () => putExtraction(key, result));
  return result.places.length ? { ...result, timings: t.done() } : assist('no_places', result.video);
}

function hasText(r: ReelDetails): boolean {
  return !!(r.caption || r.location || r.tagged.length || r.mentions.length || r.comments.length || r.transcript);
}

export async function match(req: Partial<MatchRequest>, who: Caller): Promise<MatchResult> {
  const t = timer();
  const name = clean(req.name, 200);
  if (!name) throw new ApiError(400, 'bad_request', 'Send {"name": "...", "area": "...", "region": "..."}.');
  const area = clean(req.area, 200);
  const region = clean(req.region, 200);
  // "Om Beach, Gokarna, Karnataka, India": the name plus whatever tells Google where to look.
  const query = [name, area, region].filter(Boolean).join(', ');
  // A place picked from search is already known: it's stored under its ID, not a name.
  const pickedId = typeof req.placeId === 'string' && PLACE_ID.test(req.placeId) ? req.placeId : null;
  const sessionToken = typeof req.sessionToken === 'string' && TOKEN.test(req.sessionToken) ? req.sessionToken : undefined;
  const key = pickedId ? `id:${pickedId}` : query.toLowerCase();

  const placesKey = env.placesKey();
  // Photos aren't counted here: a free one is looked for first, and Google's only when there's none.
  const begin = await t.step('begin', () => beginMatch(who, key, false));
  const saved = begin.stored;
  // Wikimedia's photo of the place when it has one it can vouch for; else one from Google's daily
  // free cap; else none, and the app shows a frame of the video instead.
  const photoOf = async (placeId: string, at: { lat: number; lng: number }, refs?: Parameters<typeof photoFor>[1]) =>
    (await wikimediaPhoto(name, at)) ??
    (env.placesPhotos() && (await allowPhoto()) ? await photoFor(placeId, refs, placesKey) : null);

  if (saved && !saved.placeId) {
    return { status: 'unmatched', needsCheck: true, cached: true, timings: t.done() };
  }
  // A place we've seen within 30 days: its ID and coordinates are stored; only the photo is fetched.
  if (saved?.placeId && saved.location) {
    const placeId = saved.placeId;
    const location = saved.location;
    const photo = await t.step('photo', () => photoOf(placeId, location));
    return {
      status: 'matched',
      place: { placeId, location: saved.location, address: null, types: [], photo },
      needsCheck: saved.needsCheck,
      cached: true,
      timings: t.done(),
    };
  }

  // New, or its coordinates are past 30 days. The place ID is kept forever, so no new search then.
  const placeId = pickedId ?? saved?.placeId ?? (await t.step('search', () => searchPlaceId(query, placesKey)));
  if (!placeId) {
    await putMatch(key, { placeId: null, location: null, needsCheck: true });
    return { status: 'unmatched', needsCheck: true, cached: false, timings: t.done() };
  }
  if (!begin.detailsOk) throw new ApiError(503, 'quota', 'We’ve reached today’s limit. Try again tomorrow.');
  const d = await t.step('details', () => getDetails(placeId, placesKey, sessionToken));
  if (!d.location) return { status: 'unmatched', needsCheck: true, cached: false, timings: t.done() };

  const location = { lat: d.location.latitude, lng: d.location.longitude };
  const needsCheck = doubtful(req.confidence, d.formattedAddress ?? '', area, region);
  // Saving and fetching the photo don't depend on each other, so they run side by side.
  const [photo] = await t.step('photo+save', () =>
    Promise.all([
      photoOf(placeId, location, d.photos),
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

/** Place IDs and session tokens as Google and the app write them; anything else isn't sent on. */
const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/** "Missed one?": places matching what someone is typing, for them to pick from. */
export async function search(req: Partial<SearchRequest>, who: Caller): Promise<SearchResult> {
  const input = clean(req.input, 100);
  const sessionToken = typeof req.sessionToken === 'string' && TOKEN.test(req.sessionToken) ? req.sessionToken : null;
  if (input.length < 3 || !sessionToken) {
    throw new ApiError(400, 'bad_request', 'Send {"input": "at least 3 letters", "sessionToken": "..."}.');
  }
  const n = req.near;
  const near =
    n && Number.isFinite(n.lat) && Number.isFinite(n.lng) && Math.abs(n.lat) <= 90 && Math.abs(n.lng) <= 180
      ? { lat: n.lat, lng: n.lng }
      : null;
  await allowSearch(who);
  const key = env.placesKey();
  let suggestions = await searchPlaces(input, sessionToken, key, near);
  // Autocomplete matches names more than towns: "XOXO Kottayam" can find nothing while "XOXO" finds
  // "XOXO - Coffee & Magic, Kottayam". So once, try without the last word (usually the town), and
  // put the results that are in it first.
  const words = input.split(/\s+/);
  const town = words.length > 1 ? words[words.length - 1].toLowerCase() : '';
  const shorter = words.slice(0, -1).join(' ');
  if (suggestions.length === 0 && town && shorter.length >= 3) {
    await allowSearch(who);
    const inTown = (s: { where: string }) => s.where.toLowerCase().includes(town);
    suggestions = (await searchPlaces(shorter, sessionToken, key, near)).sort(
      (a, b) => Number(inTown(b)) - Number(inTown(a)),
    );
  }
  return { suggestions: suggestions.slice(0, 6) };
}

/** A place's page: Google's rating, hours and reviews, fetched fresh and never stored. */
export async function placeInfo(req: { placeId?: unknown }, who: Caller): Promise<PlaceInfo> {
  const placeId = typeof req.placeId === 'string' && PLACE_ID.test(req.placeId) ? req.placeId : null;
  if (!placeId) throw new ApiError(400, 'bad_request', 'Send {"placeId": "..."}.');
  if (!(await allowPlaceInfo(who))) return { status: 'limited' };
  return getPlaceInfo(placeId, env.placesKey());
}

/** A real city's notes, from Wikipedia and Wikivoyage, kept 30 days for everyone. */
export async function cityNotes(req: Partial<CityNotesRequest>, who: Caller): Promise<{ notes: CityNotes | null }> {
  const name = clean(req.name, 80);
  const state = clean(req.state, 80);
  if (!name) throw new ApiError(400, 'bad_request', 'Send {"name": "...", "state": "...", "near": {"lat", "lng"}}.');
  const n = req.near;
  const near = n && Number.isFinite(n.lat) && Number.isFinite(n.lng) ? { lat: n.lat, lng: n.lng } : null;
  const key = `city:${[name, state].join(' ').toLowerCase().replace(/\s+/g, '-')}`;
  const saved = await getCityNotes(key);
  if (saved) return { notes: 'none' in saved ? null : saved };
  await allowCityNotes(who);
  const notes = await readCityNotes(name, state, near, {
    key: env.geminiKey(),
    model: env.geminiModel(),
    fallback: env.geminiFallback(),
  });
  // A town the sources don't cover is remembered too, so it isn't looked up on every visit.
  await putCityNotes(key, notes ?? { none: true }, notes ? env.geminiModel() : null);
  return { notes };
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
/** The video's frames on their own, for readings saved before frames came with them. */
export async function frames(req: { videoId?: unknown }): Promise<{ frames: string[] }> {
  const id = typeof req.videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(req.videoId) ? req.videoId : null;
  if (!id) throw new ApiError(400, 'bad_request', 'Send {"videoId": "..."}.');
  return { frames: await videoFrames(id) };
}

/**
 * Three frames YouTube captures from every video (about a quarter, half and three quarters in), for
 * places with no photo of their own: real footage, unlike the designed thumbnail with its title
 * text. HD videos have them at 1280×720; older or low-quality ones only as small letterboxed images,
 * which are used then. Public image links; nothing is stored.
 */
async function videoFrames(videoId: string): Promise<string[]> {
  const url = (size: string, n: number) => `https://i.ytimg.com/vi/${videoId}/${size}${n}.jpg`;
  let hd = false;
  try {
    const res = await fetch(url('maxres', 1), { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    hd = res.ok;
  } catch {
    hd = false;
  }
  return [1, 2, 3].map((n) => url(hd ? 'maxres' : 'hq', n));
}

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
