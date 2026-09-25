import { upstreamError } from './errors';
import type { PlacePhoto } from './types';

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

async function details(placeId: string, fields: string, key: string): Promise<Details> {
  const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fields },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw await upstreamError('places:details', res);
  return (await res.json()) as Details;
}

/** Coordinates, address, categories and photo references: Place Details Essentials. */
export const getDetails = (placeId: string, key: string) => details(placeId, DETAIL_FIELDS, key);

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
