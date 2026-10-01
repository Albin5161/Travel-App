import { take, type Calls } from './calls';
import type { PlacePhoto } from './types';

// A free photo of a place from Wikimedia Commons, tried before Google's (capped) photos. Famous
// places nearly always have one: a photo taken there, or found by the place's name and taken near
// it. Freely licensed, so each carries its author and licence as a credit.
//
// The photo on the place's Wikipedia article used to be tried first, but it never came through: the
// article names its image with underscores, Commons answers with spaces, and the two were compared
// as written. Three calls for nothing, so that stage is gone. Done properly it would change the
// photo of most landmarks, which is a choice to make on purpose, not a side effect.
//
// What can go wrong, and what stops it:
// - A namesake elsewhere ("Jew Town" in another country): every file must be near the place's own
//   coordinates.
// - A photo that isn't of the place (a street sign, a shop, a floor plan near a café): a photo only
//   counts when its title names the place, by a word that isn't generic like "beach" or "cafe".
// - A file that isn't a photo (taken from space, a map, a logo, a seal): such file names and
//   categories are refused, and so are drawings (SVG) and small images.
// - Wikimedia slow or down: every call gives up after a few seconds, and the place simply goes on
//   to Google's photo or the video's own frame.
// - The host's limit on outgoing calls: two are made here, each bringing the files' details with
//   it, and only while the request has them to spend.

const HEADERS = { 'User-Agent': 'Xplore/0.1 (travel planner; 5161.albin@gmail.com)', Accept: 'application/json' };
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const TIMEOUT_MS = 4000;
/** A photo found by the place's name was taken within this of Google's point for it (lakes and valleys are big). */
const ARTICLE_KM = 20;
/** A photo taken at the place: close to Google's point. */
const NEARBY_M = 400;
const MIN_WIDTH = 600;
const WIDTH = 1000;

type LatLng = { lat: number; lng: number };

// Words that say what kind of place it is, not which one: never enough on their own for a match.
const GENERIC = new Set(
  (
    'the and of in at on by near new old city town village street road cafe café coffee restaurant hotel resort stay ' +
    'homestay beach lake river falls waterfall hill hills valley peak mountain fort palace temple church mosque ' +
    'masjid gurudwara gurdwara monastery museum park garden market bazaar mall shop point view viewpoint top trek ' +
    'trail island bridge gate tower square house home kitchen bar pub centre center station sanctuary ' +
    'reserve zoo art gallery'
  ).split(' '),
);
const NOT_A_PHOTO = /\b(map|locator|location|logo|flag|seal|emblem|coat[ _]of[ _]arms|diagram|floor[ _]?plan|plan of|chart|graph|signature|icon|satellite|landsat|sentinel|iss\d|sts-?\d|nasa|relief|topographic|svg)\b/i;

// A cover for a trip shouldn't be a grave: "Fort Kochi" came back as the Dutch Cemetery, which
// then became Kochi's cover on the city page, the trip card and the share ticket. Such photos are
// passed over unless the place itself is one ("Dutch Cemetery").
const SOMBRE = /\b(cemetery|cemeteries|graveyard|graves?|tombs?|tombstones?|burial|crematorium|funeral|mausoleum|memorial stones?)\b/i;

const NOT_A_PHOTO_CATEGORY =
  /(^|\|)\s*(maps? of|locator maps|location maps|satellite (images|pictures|photographs)|images from space|iss expedition|logos|flags of|coats of arms|diagrams|floor plans|drawings)/i;

/** The words that pick this place out, lower-cased and without accents or punctuation. */
function keywords(name: string): string[] {
  return words(name).filter((w) => w.length >= 3 && !GENERIC.has(w));
}
function words(s: string): string[] {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^file:/, '')
    .replace(/\.[a-z0-9]+$/, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
/** Whether a title names the place: it has one of the place's own words. */
function names(title: string, keys: string[]) {
  const t = new Set(words(title));
  return keys.some((k) => t.has(k));
}

function km(a: LatLng, b: LatLng) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

async function get<T>(base: string, params: Record<string, string>): Promise<T | null> {
  const url = new URL(base);
  for (const [k, v] of Object.entries({ format: 'json', formatversion: '2', ...params })) url.searchParams.set(k, v);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) return (await res.json()) as T;
    // An answer left unread keeps its connection open, and the hosting runtime allows only a few at
    // once: the calls after it (the photo cap's counter, Google) would be the ones to fail.
    await res.body?.cancel();
    return null;
  } catch {
    return null;
  }
}

// What's asked about every file, so choosing one needs no further call.
const FILE_INFO = {
  prop: 'imageinfo|coordinates',
  // Every file's position, not the first ten's: the default would leave the rest looking placeless.
  colimit: 'max',
  iiprop: 'url|size|mime|extmetadata',
  iiurlwidth: String(WIDTH),
  iiextmetadatafilter: 'Artist|LicenseShortName|Categories',
};

/** A photo on Commons taken at the place, or found by the place's name and taken near it. */
async function fromCommons(name: string, at: LatLng, keys: string[], sombreOk: boolean): Promise<PlacePhoto | null> {
  const [nearby, byName] = await Promise.all([
    get<{ query?: { pages?: ImageInfo[] } }>(COMMONS, {
      action: 'query',
      generator: 'geosearch',
      ggscoord: `${at.lat}|${at.lng}`,
      ggsradius: String(NEARBY_M),
      ggsnamespace: '6',
      ggslimit: '30',
      codistancefrompoint: `${at.lat}|${at.lng}`,
      ...FILE_INFO,
    }),
    get<{ query?: { pages?: ImageInfo[] } }>(COMMONS, {
      action: 'query',
      generator: 'search',
      gsrsearch: `${name} filetype:bitmap`,
      gsrnamespace: '6',
      gsrlimit: '15',
      ...FILE_INFO,
    }),
  ]);
  const far = (p: ImageInfo) => {
    const c = p.coordinates?.[0];
    return c ? km(at, { lat: c.lat, lng: c.lon }) : Infinity;
  };
  // Metres from the place, as Commons measures it: the nearest file first, as its own list gives them.
  const metres = (p: ImageInfo) => p.coordinates?.[0]?.dist ?? far(p) * 1000;
  const close = (nearby?.query?.pages ?? []).filter((p) => names(p.title, keys)).sort((a, b) => metres(a) - metres(b));
  const named = (byName?.query?.pages ?? []).filter((p) => names(p.title, keys) && far(p) <= ARTICLE_KM);
  return choose([...close, ...named].filter((p) => !NOT_A_PHOTO.test(p.title)), sombreOk);
}

type ImageInfo = {
  title: string;
  coordinates?: { lat: number; lon: number; dist?: number }[];
  imageinfo?: {
    thumburl?: string;
    width?: number;
    mime?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }[];
};

const plain = (html: string | undefined) =>
  (html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** The first of these files that's a real photo, big enough, with a free licence, as the app's photo. */
function choose(files: ImageInfo[], sombreOk: boolean): PlacePhoto | null {
  const seen = new Set<string>();
  for (const { title, imageinfo } of files) {
    if (seen.has(title)) continue;
    if (seen.size >= 12) break;
    seen.add(title);
    const info = imageinfo?.[0];
    if (!info?.thumburl || !/^image\/(jpeg|png|webp)$/.test(info.mime ?? '') || (info.width ?? 0) < MIN_WIDTH) continue;
    const license = plain(info.extmetadata?.LicenseShortName?.value);
    if (!license) continue;
    // Categories say what the file is when its name doesn't ("Maps of Kochi", "Satellite pictures"),
    // among tracking ones that mean nothing here ("Files with coordinates missing SDC location").
    if (NOT_A_PHOTO_CATEGORY.test(plain(info.extmetadata?.Categories?.value))) continue;
    if (!sombreOk && (SOMBRE.test(title) || SOMBRE.test(plain(info.extmetadata?.Categories?.value)))) continue;
    const artist = plain(info.extmetadata?.Artist?.value) || 'Unknown author';
    return {
      uri: info.thumburl,
      attributions: [{ name: `${artist.slice(0, 80)} (${license}, Wikimedia Commons)`, uri: info.descriptionurl ?? '' }],
      googleMapsUri: null,
    };
  }
  return null;
}

/**
 * A free, credited photo of the place, or null when Wikimedia has none it can vouch for. Two calls,
 * made only if the request has them to spend (`calls`).
 */
export async function wikimediaPhoto(name: string, at: LatLng, calls: Calls): Promise<PlacePhoto | null> {
  const keys = keywords(name);
  // A name that's all generic words ("The Beach Cafe") can't be matched safely.
  if (keys.length === 0) return null;
  return take(calls, 2) ? fromCommons(name, at, keys, SOMBRE.test(name)) : null;
}
