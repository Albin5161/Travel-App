// Instagram has no API for reading other people's reels, so this goes through Apify's Instagram Reel
// Scraper (apify/instagram-reel-scraper), which fetches public reels from Apify's own servers. Given
// a photo post's link it returns the post all the same, with its pictures, for the same price. It
// breaks now and then when Instagram changes, so every failure here means "couldn't read it", and
// the app falls back to adding places by search. Priced per event (Free plan, Sept 2026): about
// $0.0036 a reel including the run start, plus $0.048 per started minute when the transcript is on.

const API = 'https://api.apify.com/v2';
const ACTOR = 'apify~instagram-reel-scraper';

/**
 * How long one call to Apify waits for the run. A run with a transcript takes about 40 s, longer
 * than some runtimes let a single outgoing request stay open (Expo's dev server stops at 30 s), so
 * the run is started and then checked on in steps of this many seconds.
 */
const WAIT_SECONDS = 20;

/** Only short reels get a transcript: two started minutes at most, about $0.10. */
export const TRANSCRIPT_MAX_SECONDS = 120;

/** A photo post holds up to 20 pictures. Each is about 300 KB; one far larger isn't a slide worth reading. */
const SLIDES_MAX = 20;
const SLIDE_MAX_BYTES = 2_000_000;
/** Pictures are only ever fetched from Instagram's own image servers, whatever link the scraper hands back. */
const SLIDE_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/;

export type ReelDetails = {
  shortcode: string;
  caption: string;
  hashtags: string[];
  mentions: string[];
  /** Accounts tagged in the reel; cafés and stays often are. */
  tagged: { username: string; fullName: string | null }[];
  /** The place the creator attached to the reel, often just a city. */
  location: string | null;
  /** The latest few comments, where "where is this?" usually gets answered. */
  comments: string[];
  owner: string;
  ownerName: string | null;
  durationSeconds: number | null;
  /** An Instagram CDN link. It expires within days, so the app needs its fallback card for it. */
  thumbnail: string | null;
  transcript: string | null;
  /**
   * A photo post's pictures, in order: one for a single photo, up to 20 for a carousel, none for a
   * video. Itineraries are often written on them and nowhere else. Instagram CDN links, like the
   * thumbnail.
   */
  slides: string[];
};

/** One slide, ready to hand to the model. */
export type Picture = { mimeType: string; data: string };

/**
 * One public reel, or null when it can't be read: private or deleted, not a reel, Apify's monthly
 * credit used up, or the scraper failing. Never throws for those; the caller falls back.
 */
export async function getReel(
  url: string,
  token: string,
  opts: { transcript: boolean },
): Promise<ReelDetails | null> {
  // Seconds Apify lets the run take, and the most it may charge for it. The cap is Apify's hard
  // stop on cost; its floor for this actor is $0.0073.
  const limitSeconds = opts.transcript ? 100 : 45;
  const start = new URL(`${API}/acts/${ACTOR}/runs`);
  start.searchParams.set('timeout', String(limitSeconds));
  start.searchParams.set('maxTotalChargeUsd', opts.transcript ? '0.12' : '0.01');
  start.searchParams.set('waitForFinish', String(WAIT_SECONDS));
  const call = <T>(path: string | URL, init?: RequestInit) => apify<T>(path, token, init);
  // Logs name the reel by its ID (ig:shortcode), never by its link.
  const id = `ig:${url.match(/\/reel\/([^/?]+)/)?.[1] ?? '?'}`;

  let run: ApifyRun | null = null;
  try {
    run = await call<ApifyRun>(start, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: [url], resultsLimit: 1, includeTranscript: opts.transcript }),
    });
    const giveUpAt = Date.now() + (limitSeconds + 10) * 1000;
    while ((run.status === 'READY' || run.status === 'RUNNING') && Date.now() < giveUpAt) {
      run = await call<ApifyRun>(`${API}/actor-runs/${run.id}?waitForFinish=${WAIT_SECONDS}`);
    }
    if (run.status !== 'SUCCEEDED') throw new Error(`run ${run.id} ended ${run.status} for ${id}`);
    const items = await call<ApifyReel[]>(`${API}/datasets/${run.defaultDatasetId}/items?clean=true`);
    const item = Array.isArray(items) ? items.find((i) => i && !i.error) : undefined;
    if (!item) {
      console.warn(`[apify] ${id}: the run found no reel (private, deleted, or not a reel)`);
      return null;
    }
    return toReel(item);
  } catch (e) {
    console.error(`[apify] ${id}:`, e instanceof Error ? `${e.name}: ${e.message}` : e);
    // Stop a run we've stopped waiting for, so it doesn't go on charging for a result nobody reads.
    if (run && (run.status === 'READY' || run.status === 'RUNNING')) {
      await call(`${API}/actor-runs/${run.id}/abort`, { method: 'POST' }).catch(() => {});
    }
    return null;
  }
}

/**
 * A post's slides, fetched and encoded for the model. One that can't be fetched (an expired link, a
 * server other than Instagram's, something too large) is left out; the rest are still read.
 */
export async function getSlides(urls: string[]): Promise<Picture[]> {
  const got = await Promise.all(
    urls.slice(0, SLIDES_MAX).map(async (link): Promise<Picture | null> => {
      try {
        const url = new URL(link);
        if (url.protocol !== 'https:' || !SLIDE_HOST.test(url.hostname)) return null;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const mimeType = (res.headers.get('content-type') ?? '').split(';')[0];
        if (!res.ok || !/^image\/(jpeg|png|webp)$/.test(mimeType)) return null;
        const bytes = await res.arrayBuffer();
        if (bytes.byteLength > SLIDE_MAX_BYTES) return null;
        return { mimeType, data: base64(bytes) };
      } catch {
        return null;
      }
    }),
  );
  return got.filter((p): p is Picture => !!p);
}

/** Bytes as base64, with the web's own `btoa`, in pieces small enough to spread into one call. */
function base64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** One Apify API call. Run objects come wrapped in `data`; dataset items come as a bare array. */
async function apify<T>(path: string | URL, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout((WAIT_SECONDS + 8) * 1000),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const body = (await res.json()) as { data?: T } | T;
  return Array.isArray(body) ? (body as T) : ((body as { data?: T }).data as T);
}

type ApifyRun = {
  id: string;
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMING-OUT' | 'TIMED-OUT' | 'ABORTING' | 'ABORTED';
  defaultDatasetId: string;
};

function toReel(r: ApifyReel): ReelDetails {
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const list = (v: unknown) => (Array.isArray(v) ? v.map(text).filter(Boolean) : []);
  // "Sidecar" is a carousel and "Image" a single photo; a video's own cover isn't a slide.
  const isVideo = text(r.type) === 'Video' || typeof r.videoDuration === 'number';
  const pictures = list(r.images);
  return {
    shortcode: text(r.shortCode),
    caption: text(r.caption),
    hashtags: list(r.hashtags),
    mentions: list(r.mentions),
    tagged: (Array.isArray(r.taggedUsers) ? r.taggedUsers : [])
      .map((u) => ({ username: text(u?.username), fullName: text(u?.full_name) || null }))
      .filter((u) => u.username),
    location: text(r.locationName) || null,
    comments: (Array.isArray(r.latestComments) ? r.latestComments : []).map((c) => text(c?.text)).filter(Boolean),
    owner: text(r.ownerUsername),
    ownerName: text(r.ownerFullName) || null,
    durationSeconds: typeof r.videoDuration === 'number' ? Math.round(r.videoDuration) : null,
    thumbnail: text(r.displayUrl) || null,
    transcript: text(r.transcript) || null,
    slides: isVideo ? [] : pictures.length ? pictures : list([r.displayUrl]),
  };
}

// The fields used, as the scraper writes them. It's third-party output, so every one is optional
// and checked before use.
type ApifyReel = {
  error?: unknown;
  type?: unknown;
  images?: unknown;
  shortCode?: unknown;
  caption?: unknown;
  hashtags?: unknown;
  mentions?: unknown;
  taggedUsers?: { username?: unknown; full_name?: unknown }[];
  locationName?: unknown;
  latestComments?: { text?: unknown }[];
  ownerUsername?: unknown;
  ownerFullName?: unknown;
  videoDuration?: unknown;
  displayUrl?: unknown;
  transcript?: unknown;
};
