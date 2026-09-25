import { upstreamError } from './errors';
import type { MatchedPlace } from './types';

const BASE = 'https://places.googleapis.com/v1';

// Two calls, both kept in Google's cheapest tiers on purpose. Text Search asks for the place ID
// only (Text Search Essentials, IDs Only: no charge). Place Details asks only for fields in the
// Essentials tier (10,000 free a month). displayName would push it to Pro, and we already have
// the name from the video.
const SEARCH_FIELDS = 'places.id';
const DETAIL_FIELDS = 'id,location,types,formattedAddress,photos';

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

type Details = {
  id: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  formattedAddress?: string;
  photos?: { name: string; authorAttributions?: { displayName?: string; uri?: string }[] }[];
};

export async function getDetails(placeId: string, key: string): Promise<Details> {
  const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': DETAIL_FIELDS },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw await upstreamError('places:details', res);
  return (await res.json()) as Details;
}

/**
 * A usable image URL for a place's first photo. Google's photo names expire and mustn't be
 * stored, so this resolves one to a plain URL (skipHttpRedirect) at request time. A failure here
 * isn't worth failing the match for: the app has a fallback card.
 */
export async function getPhotoUri(photoName: string, key: string): Promise<string | null> {
  const url = `${BASE}/${photoName}/media?maxWidthPx=800&skipHttpRedirect=true`;
  try {
    const res = await fetch(url, { headers: { 'X-Goog-Api-Key': key }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.error(`[places:photo] ${res.status} ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    const body = (await res.json()) as { photoUri?: string };
    return body.photoUri ?? null;
  } catch (e) {
    console.error('[places:photo]', e);
    return null;
  }
}

export function toMatched(d: Details, photoUri: string | null): MatchedPlace | null {
  if (!d.location) return null;
  const first = d.photos?.[0];
  return {
    placeId: d.id,
    location: { lat: d.location.latitude, lng: d.location.longitude },
    address: d.formattedAddress ?? '',
    types: d.types ?? [],
    photo:
      photoUri && first
        ? {
            uri: photoUri,
            // Google requires showing these alongside the photo when present.
            attributions: (first.authorAttributions ?? []).map((a) => ({ name: a.displayName ?? '', uri: a.uri ?? '' })),
          }
        : null,
  };
}
