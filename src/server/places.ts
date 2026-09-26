import { upstreamError } from './errors';
import type { PlaceInfo, PlacePhoto } from './types';

const BASE = 'https://places.googleapis.com/v1';

// Every call is kept in Google's cheapest tiers on purpose:
// - Text Search asks for the place ID only (Text Search Essentials, IDs Only: no charge).
// - Place Details asks only for Essentials fields (10,000 free a month). displayName would push it
//   to Pro, and we already have the name from the video.
// - A photos-only Place Details is IDs Only too: no charge. Only the photo itself counts.
const SEARCH_FIELDS = 'places.id';
const DETAIL_FIELDS = 'id,location,types,formattedAddress,photos';
const PHOTO_FIELDS = 'photos';

/** The best-matching place ID for a text query, or null. */
export async function searchPlaceId(query: string, key: string): Promise<string | null> {
  const res = await fetch(`${BASE}/places:searchText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': SEARCH_FIELDS },
    body: JSON.stringify({ textQuery: query, pageSize: 1 }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw await upstreamError('places:search', res);
  const body = (await res.json()) as { places?: { id?: string }[] };
  return body.places?.[0]?.id ?? null;
}

export type Suggestion = {
  placeId: string;
  /** The place's name, e.g. "XOXO". */
  name: string;
  /** Where it is, e.g. "Kottayam, Kerala, India". */
  where: string;
};

/**
 * Places matching what someone is typing: Autocomplete (New), 10,000 free a month. The requests in
 * one session (one search, ended by picking a result) are billed for at most 12, however long the
 * typing. `near` leans results toward the city being reviewed without excluding the rest.
 */
export async function searchPlaces(
  input: string,
  sessionToken: string,
  key: string,
  near?: { lat: number; lng: number } | null,
): Promise<Suggestion[]> {
  const res = await fetch(`${BASE}/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify({
      input,
      sessionToken,
      ...(near
        ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 50000 } } }
        : {}),
    }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw await upstreamError('places:autocomplete', res);
  const body = (await res.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      };
    }[];
  };
  return (body.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    const name = p?.structuredFormat?.mainText?.text;
    return p?.placeId && name ? [{ placeId: p.placeId, name, where: p.structuredFormat?.secondaryText?.text ?? '' }] : [];
  });
}

export type PhotoRef = {
  name: string;
  authorAttributions?: { displayName?: string; uri?: string }[];
  googleMapsUri?: string;
};

export type Details = {
  id: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  formattedAddress?: string;
  photos?: PhotoRef[];
};

async function details(placeId: string, fields: string, key: string, sessionToken?: string): Promise<Details> {
  const url = new URL(`${BASE}/places/${encodeURIComponent(placeId)}`);
  if (sessionToken) url.searchParams.set('sessionToken', sessionToken);
  const res = await fetch(url, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fields },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw await upstreamError('places:details', res);
  return (await res.json()) as Details;
}

/**
 * Coordinates, address, categories and photo references: Place Details Essentials. After a search,
 * its session token ends the search session, which caps what the typing costs (see searchPlaces).
 */
export const getDetails = (placeId: string, key: string, sessionToken?: string) =>
  details(placeId, DETAIL_FIELDS, key, sessionToken);

/** Photo references only: no charge. Photo names expire, so they're fetched fresh, never stored. */
export async function getPhotoRefs(placeId: string, key: string): Promise<PhotoRef[]> {
  return (await details(placeId, PHOTO_FIELDS, key)).photos ?? [];
}

/**
 * A usable image URL for a photo reference, resolved at request time (skipHttpRedirect). A failure
 * here isn't worth failing the match for: the app has a fallback card.
 */
export async function getPhoto(ref: PhotoRef, key: string): Promise<PlacePhoto | null> {
  const url = `${BASE}/${ref.name}/media?maxWidthPx=800&skipHttpRedirect=true`;
  try {
    const res = await fetch(url, { headers: { 'X-Goog-Api-Key': key }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.error(`[places:photo] ${res.status} ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    const body = (await res.json()) as { photoUri?: string };
    if (!body.photoUri) return null;
    return {
      uri: body.photoUri,
      attributions: (ref.authorAttributions ?? []).map((a) => ({ name: a.displayName ?? '', uri: a.uri ?? '' })),
      googleMapsUri: ref.googleMapsUri ?? null,
    };
  } catch (e) {
    console.error('[places:photo]', e);
    return null;
  }
}

// Everything a place's page shows, in one request. Reviews and the editorial summary put it in
// Place Details Enterprise + Atmosphere (1,000 free a month), so it's fetched only when someone opens
// a place, capped per day, and never stored: Google's terms don't allow keeping these.
const INFO_FIELDS = 'rating,userRatingCount,priceLevel,currentOpeningHours,editorialSummary,reviews,googleMapsUri';

const PRICE: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export async function getPlaceInfo(placeId: string, key: string): Promise<Extract<PlaceInfo, { status: 'ok' }>> {
  const url = new URL(`${BASE}/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set('languageCode', 'en');
  const res = await fetch(url, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': INFO_FIELDS },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw await upstreamError('places:info', res);
  const d = (await res.json()) as {
    rating?: number;
    userRatingCount?: number;
    priceLevel?: string;
    currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
    editorialSummary?: { text?: string };
    reviews?: {
      rating?: number;
      text?: { text?: string };
      relativePublishTimeDescription?: string;
      authorAttribution?: { displayName?: string; uri?: string };
    }[];
    googleMapsUri?: string;
  };
  return {
    status: 'ok',
    rating: typeof d.rating === 'number' ? d.rating : null,
    ratingCount: typeof d.userRatingCount === 'number' ? d.userRatingCount : null,
    priceLevel: d.priceLevel && d.priceLevel in PRICE ? PRICE[d.priceLevel] : null,
    openNow: typeof d.currentOpeningHours?.openNow === 'boolean' ? d.currentOpeningHours.openNow : null,
    hours: d.currentOpeningHours?.weekdayDescriptions ?? [],
    summary: d.editorialSummary?.text?.trim() || null,
    // Google returns up to five, most relevant first; three is plenty for a phone screen.
    reviews: (d.reviews ?? [])
      .filter((r) => r.text?.text?.trim())
      .slice(0, 3)
      .map((r) => ({
        author: r.authorAttribution?.displayName ?? 'A Google user',
        authorUri: r.authorAttribution?.uri ?? null,
        rating: typeof r.rating === 'number' ? r.rating : null,
        text: (r.text?.text ?? '').trim().slice(0, 600),
        when: r.relativePublishTimeDescription ?? '',
      })),
    googleMapsUri: d.googleMapsUri ?? null,
  };
}
