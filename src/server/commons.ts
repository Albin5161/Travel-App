import type { PlacePhoto } from './types';

// A free photo of a place from Wikimedia, tried before Google's (capped) photos. Famous places
// nearly always have one: the photo on the place's Wikipedia article, or a photo on Wikimedia
// Commons taken there. Freely licensed, so each carries its author and licence as a credit.
//
// What can go wrong, and what stops it:
// - A namesake elsewhere ("Jew Town" in another country): every article or file must be near the
//   place's own coordinates.
// - A photo that isn't of the place (a street sign, a shop, a floor plan near a café): a photo only
//   counts when its title names the place, by a word that isn't generic like "beach" or "cafe".
// - An article image that isn't a photo (Pangong Tso's is taken from space, others are maps,
//   logos or seals): such file names are refused, and so are drawings (SVG) and small images.
// - Wikimedia slow or down: every call gives up after a few seconds, and the place simply goes on
//   to Google's photo or the video's own frame.

const HEADERS = { 'User-Agent': 'Xplore/0.1 (travel planner; 5161.albin@gmail.com)', Accept: 'application/json' };
const WIKIPEDIA = 'https://en.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const TIMEOUT_MS = 4000;
/** An article about the place sits within this of Google's point for it (lakes and valleys are big). */
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
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

type Page = { title: string; pageimage?: string; coordinates?: { lat: number; lon: number }[]; missing?: boolean };

/** The photo on the place's Wikipedia article: found by position, or by name if the article is near. */
async function fromWikipedia(name: string, at: LatLng, keys: string[]): Promise<string | null> {
  const props = { prop: 'pageimages|coordinates', piprop: 'name', coprimary: 'primary' };
  const [nearby, byName] = await Promise.all([
    get<{ query?: { pages?: Page[] } }>(WIKIPEDIA, {
      action: 'query',
      generator: 'geosearch',
      ggscoord: `${at.lat}|${at.lng}`,
      ggsradius: '1500',
      ggslimit: '15',
      ...props,
    }),
    get<{ query?: { pages?: Page[] } }>(WIKIPEDIA, { action: 'query', titles: name, redirects: '1', ...props }),
  ]);
  const near = (p: Page) => {
    const c = p.coordinates?.[0];
    return !!c && km(at, { lat: c.lat, lng: c.lon }) <= ARTICLE_KM;
  };
  const candidates = [
    ...(byName?.query?.pages ?? []).filter((p) => !p.missing && near(p)),
    ...(nearby?.query?.pages ?? []).filter((p) => names(p.title, keys)),
  ];
  const good = candidates.find((p) => p.pageimage && !NOT_A_PHOTO.test(p.pageimage));
  return good?.pageimage ? `File:${good.pageimage}` : null;
}

type GeoHit = { title: string };
type FilePage = { title: string; coordinates?: { lat: number; lon: number }[] };

/** A photo on Commons taken at the place, or found by the place's name and taken near it. */
async function fromCommons(name: string, at: LatLng, keys: string[]): Promise<string[]> {
  const [nearby, byName] = await Promise.all([
    get<{ query?: { geosearch?: GeoHit[] } }>(COMMONS, {
      action: 'query',
      list: 'geosearch',
      gscoord: `${at.lat}|${at.lng}`,
      gsradius: String(NEARBY_M),
      gsnamespace: '6',
      gslimit: '30',
    }),
    get<{ query?: { pages?: FilePage[] } }>(COMMONS, {
      action: 'query',
      generator: 'search',
      gsrsearch: `${name} filetype:bitmap`,
      gsrnamespace: '6',
      gsrlimit: '15',
      prop: 'coordinates',
    }),
  ]);
  const close = (nearby?.query?.geosearch ?? []).map((g) => g.title).filter((t) => names(t, keys));
  const named = (byName?.query?.pages ?? [])
    .filter((p) => {
      const c = p.coordinates?.[0];
      return names(p.title, keys) && !!c && km(at, { lat: c.lat, lng: c.lon }) <= ARTICLE_KM;
    })
    .map((p) => p.title);
  return [...close, ...named].filter((t) => !NOT_A_PHOTO.test(t));
}

type ImageInfo = {
  title: string;
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
async function pick(files: string[]): Promise<PlacePhoto | null> {
  const unique = [...new Set(files)].slice(0, 12);
  if (unique.length === 0) return null;
  const res = await get<{ query?: { pages?: ImageInfo[] } }>(COMMONS, {
    action: 'query',
    titles: unique.join('|'),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(WIDTH),
    iiextmetadatafilter: 'Artist|LicenseShortName|Categories',
  });
  const pages = new Map((res?.query?.pages ?? []).map((p) => [p.title, p]));
  for (const title of unique) {
    const info = pages.get(title)?.imageinfo?.[0];
    if (!info?.thumburl || !/^image\/(jpeg|png|webp)$/.test(info.mime ?? '') || (info.width ?? 0) < MIN_WIDTH) continue;
    const license = plain(info.extmetadata?.LicenseShortName?.value);
    if (!license) continue;
    // Categories say what the file is when its name doesn't ("Maps of Kochi", "Satellite pictures"),
    // among tracking ones that mean nothing here ("Files with coordinates missing SDC location").
    if (NOT_A_PHOTO_CATEGORY.test(plain(info.extmetadata?.Categories?.value))) continue;
    const artist = plain(info.extmetadata?.Artist?.value) || 'Unknown author';
    return {
      uri: info.thumburl,
      attributions: [{ name: `${artist.slice(0, 80)} (${license}, Wikimedia Commons)`, uri: info.descriptionurl ?? '' }],
      googleMapsUri: null,
    };
  }
  return null;
}

/** A free, credited photo of the place, or null when Wikimedia has none it can vouch for. */
export async function wikimediaPhoto(name: string, at: LatLng): Promise<PlacePhoto | null> {
  const keys = keywords(name);
  // A name that's all generic words ("The Beach Cafe") can't be matched safely.
  if (keys.length === 0) return null;
  const article = await fromWikipedia(name, at, keys);
  const fromArticle = article ? await pick([article]) : null;
  if (fromArticle) return fromArticle;
  return pick(await fromCommons(name, at, keys));
}
