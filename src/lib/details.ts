import { useEffect, useState } from 'react';

import type { City, Place } from '@/data/types';
import { post } from '@/lib/api';
import { deviceStorage } from '@/lib/live/storage';
import type { CityNotes, PlaceInfo } from '@/server/types';

// What a real place's page and a real city's page show beyond what the video said: Google's rating,
// hours and reviews for a place, and notes from Wikipedia and Wikivoyage for a city. Samples have
// their own hand-written notes and never ask.

type Info = Extract<PlaceInfo, { status: 'ok' }>;

// Google doesn't allow keeping reviews or ratings, so they're remembered only while the app is
// open: going back and forth between places doesn't ask again.
const placeInfos = new Map<string, Info | null>();

/** Google's info for a place from a pasted link; null while loading, or when there's none today. */
export function usePlaceInfo(place: Place | undefined): { info: Info | null; loading: boolean } {
  const placeId = place?.id.startsWith('g:') ? place.id.slice(2) : null;
  const [info, setInfo] = useState<Info | null>(() => (placeId ? (placeInfos.get(placeId) ?? null) : null));
  const [loading, setLoading] = useState(!!placeId && !placeInfos.has(placeId));

  useEffect(() => {
    if (!placeId || placeInfos.has(placeId)) return;
    let stale = false;
    post<PlaceInfo>('/api/place', { placeId }, 10_000)
      .then((r) => {
        const ok = r.status === 'ok' ? r : null;
        placeInfos.set(placeId, ok);
        if (!stale) setInfo(ok);
      })
      // Not worth an error on a place's page: it just shows what the video said.
      .catch(() => {})
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [placeId]);

  return { info, loading };
}

// City notes are free and allowed to keep, so they're kept on the phone for 30 days like links.
const NOTES_PREFIX = 'xplore.city.v1.';
const NOTES_DAYS = 30;

/** Notes for a real city: null while loading or when the sources don't cover it. */
export function useCityNotes(city: City | undefined, places: Place[]): { notes: CityNotes | null; loading: boolean } {
  const live = !!city && city.id.startsWith('live:');
  const key = city ? `${NOTES_PREFIX}${city.id}` : '';
  const [notes, setNotes] = useState<CityNotes | null>(() => (live ? readNotes(key) : null));
  const [loading, setLoading] = useState(live && !notes);
  // Where the city's places are, so the server can check an article is about this town.
  const near =
    places.length > 0
      ? {
          lat: places.reduce((s, p) => s + p.coords.lat, 0) / places.length,
          lng: places.reduce((s, p) => s + p.coords.lng, 0) / places.length,
        }
      : null;
  const nearKey = near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : '';

  useEffect(() => {
    if (!live || !city || readNotes(key)) return;
    let stale = false;
    post<{ notes: CityNotes | null }>('/api/city', { name: city.name, state: city.state, near }, 20_000)
      .then(({ notes: n }) => {
        if (n) writeNotes(key, n);
        if (!stale) setNotes(n);
      })
      .catch(() => {})
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
    // `near` is only a check on the server; it changes with every place saved, and needn't re-ask.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, key, nearKey]);

  return { notes, loading };
}

function readNotes(key: string): CityNotes | null {
  try {
    const raw = deviceStorage?.getItem(key);
    if (!raw) return null;
    const { at, notes } = JSON.parse(raw) as { at: number; notes: CityNotes };
    return Date.now() - at < NOTES_DAYS * 86400_000 ? notes : null;
  } catch {
    return null;
  }
}

function writeNotes(key: string, notes: CityNotes) {
  try {
    deviceStorage?.setItem(key, JSON.stringify({ at: Date.now(), notes }));
  } catch {
    // Storage full or unavailable: the notes are just asked for again next time.
  }
}
