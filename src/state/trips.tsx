import { createContext, useContext, useReducer, type ReactNode } from 'react';

import { getPlace } from '@/data/api';
import type { Extraction, Place } from '@/data/types';

export interface CityCollection {
  cityId: string;
  placeIds: string[];
  reelIds: string[];
  addedAt: number;
}

interface State {
  pendingLink: string | null;
  lastExtraction: Extraction | null;
  collections: Record<string, CityCollection>;
  skipped: Record<string, boolean>;
  addedLocals: Record<string, string[]>;
  savedTrips: Record<string, boolean>;
  /** City to fade in once on the home screen. */
  freshCityId: string | null;
}

type Action =
  | { type: 'setPendingLink'; url: string | null }
  | { type: 'commitExtraction'; extraction: Extraction }
  | { type: 'decide'; placeId: string; keep: boolean }
  | { type: 'keepAll'; placeIds: string[] }
  | { type: 'addLocal'; cityId: string; placeId: string }
  | { type: 'saveTrip'; cityId: string }
  | { type: 'clearFresh' };

const initial: State = {
  pendingLink: null,
  lastExtraction: null,
  collections: {},
  skipped: {},
  addedLocals: {},
  savedTrips: {},
  freshCityId: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setPendingLink':
      return { ...state, pendingLink: action.url };
    case 'commitExtraction': {
      const { city, reel, places } = action.extraction;
      const existing = state.collections[city.id];
      const placeIds = [...new Set([...(existing?.placeIds ?? []), ...places.map((p) => p.id)])];
      const reelIds = [...new Set([...(existing?.reelIds ?? []), reel.id])];
      return {
        ...state,
        lastExtraction: action.extraction,
        pendingLink: null,
        collections: {
          ...state.collections,
          [city.id]: { cityId: city.id, placeIds, reelIds, addedAt: existing?.addedAt ?? Date.now() },
        },
        freshCityId: existing ? state.freshCityId : city.id,
      };
    }
    case 'decide':
      return { ...state, skipped: { ...state.skipped, [action.placeId]: !action.keep } };
    case 'keepAll': {
      const skipped = { ...state.skipped };
      action.placeIds.forEach((id) => (skipped[id] = false));
      return { ...state, skipped };
    }
    case 'addLocal': {
      const list = state.addedLocals[action.cityId] ?? [];
      if (list.includes(action.placeId)) return state;
      return { ...state, addedLocals: { ...state.addedLocals, [action.cityId]: [...list, action.placeId] } };
    }
    case 'saveTrip':
      return { ...state, savedTrips: { ...state.savedTrips, [action.cityId]: true } };
    case 'clearFresh':
      return { ...state, freshCityId: null };
  }
}

const TripsContext = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

export function TripsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  return <TripsContext.Provider value={{ state, dispatch }}>{children}</TripsContext.Provider>;
}

export function useTrips() {
  const ctx = useContext(TripsContext);
  if (!ctx) throw new Error('useTrips must be used inside TripsProvider');
  return ctx;
}

export function useCityPlaces(cityId: string) {
  const { state } = useTrips();
  const collected = (state.collections[cityId]?.placeIds ?? []).map((id) => getPlace(id)).filter(Boolean) as Place[];
  const kept = collected.filter((p) => !state.skipped[p.id]);
  const locals = (state.addedLocals[cityId] ?? []).map((id) => getPlace(id)).filter(Boolean) as Place[];
  return { collected, kept, locals };
}
