import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { getPlace, getCity } from '@/data/api';
import { allDistricts } from '@/data/regions';
import type { GroupState, Vote } from '@/data/group';
import type { TripPlan } from '@/data/planner';
import type { Extraction, Place, SpotStatus } from '@/data/types';
import { clusterSpots, districtOf } from '@/lib/spots';

export interface CityCollection {
  cityId: string;
  placeIds: string[];
  reelIds: string[];
  addedAt: number;
}

interface State {
  pendingLink: string | null;
  /**
   * The district you live in. Everything near-home hangs off this: the weekend view, and which
   * districts are worth an arrival notification. A real app asks once at onboarding; the demo
   * starts in Kottayam and the Profile tab can change it.
   */
  homeDistrictId: string | null;
  /** Want to go, or already been. Absent means want. */
  spotStatus: Record<string, SpotStatus>;
  /** Whether arrival notifications are switched on, independent of the OS permission. */
  notifyOnArrival: boolean;
  /** A district just arrived in, for the in-app banner. Cleared when dismissed or acted on. */
  arrivedDistrictId: string | null;
  /** Onboarding runs once. In memory for now, so it replays on every restart in the demo. */
  onboarded: boolean;
  lastExtraction: Extraction | null;
  collections: Record<string, CityCollection>;
  skipped: Record<string, boolean>;
  addedLocals: Record<string, string[]>;
  savedTrips: Record<string, boolean>;
  /** The current plan for each city, as built by the planner and then edited. */
  tripPlans: Record<string, TripPlan>;
  /** The group vote on each city's plan, if one has started. */
  groups: Record<string, GroupState>;
  /** City to fade in once on the home screen. */
  freshCityId: string | null;
  /** Which half of My Collections Home shows. Set after a save, so the new card is on screen. */
  homeTab: HomeTab;
}

export type HomeTab = 'near' | 'cities';

type Action =
  | { type: 'setPendingLink'; url: string | null }
  /** What the link turned into, held until the user has checked it. Nothing is saved yet. */
  | { type: 'stageExtraction'; extraction: Extraction }
  /** Save the places the user confirmed. Omitting placeIds saves every place found. */
  | { type: 'commitExtraction'; extraction: Extraction; placeIds?: string[] }
  | { type: 'setHomeTab'; tab: HomeTab }
  | { type: 'decide'; placeId: string; keep: boolean }
  | { type: 'keepAll'; placeIds: string[] }
  | { type: 'addLocal'; cityId: string; placeId: string }
  | { type: 'saveTrip'; cityId: string }
  | { type: 'setTripPlan'; plan: TripPlan }
  | { type: 'groupStart'; cityId: string; planKey: string; swapFor: Record<string, string> }
  | { type: 'groupJoin'; cityId: string; friendId: string }
  | { type: 'groupVote'; cityId: string; placeId: string; friendId: string; vote: Vote }
  | { type: 'groupManual'; cityId: string; friendId: string }
  | { type: 'groupLock'; cityId: string }
  | { type: 'clearFresh' }
  | { type: 'setHomeDistrict'; districtId: string }
  | { type: 'setSpotStatus'; placeId: string; status: SpotStatus }
  | { type: 'setNotifyOnArrival'; on: boolean }
  | { type: 'arrived'; districtId: string }
  | { type: 'clearArrival' }
  | { type: 'finishOnboarding' };

const initial: State = {
  pendingLink: null,
  homeDistrictId: 'kottayam',
  spotStatus: {},
  notifyOnArrival: true,
  arrivedDistrictId: null,
  onboarded: false,
  lastExtraction: null,
  collections: {},
  skipped: {},
  addedLocals: {},
  savedTrips: {},
  tripPlans: {},
  groups: {},
  freshCityId: null,
  homeTab: 'cities',
};

/** Home-district places live under Near Home; everywhere else is a City. */
export function isNearHome(cityId: string, homeDistrictId: string | null) {
  const city = getCity(cityId);
  const home = allDistricts.find((d) => d.id === homeDistrictId);
  return !!city && !!home && city.district === home.name;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setPendingLink':
      return { ...state, pendingLink: action.url };
    case 'stageExtraction':
      return { ...state, lastExtraction: action.extraction, pendingLink: null };
    case 'setHomeTab':
      return { ...state, homeTab: action.tab };
    case 'commitExtraction': {
      const { city, reel, places } = action.extraction;
      const confirmed = action.placeIds ?? places.map((p) => p.id);
      if (confirmed.length === 0) return { ...state, lastExtraction: null, pendingLink: null };
      const existing = state.collections[city.id];
      const placeIds = [...new Set([...(existing?.placeIds ?? []), ...confirmed])];
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
        homeTab: isNearHome(city.id, state.homeDistrictId) ? 'near' : 'cities',
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
    case 'setTripPlan':
      return { ...state, tripPlans: { ...state.tripPlans, [action.plan.cityId]: action.plan } };
    case 'groupStart':
      return {
        ...state,
        groups: {
          ...state.groups,
          [action.cityId]: { planKey: action.planKey, joined: [], votes: {}, manual: [], swapFor: action.swapFor, locked: false },
        },
      };
    case 'groupJoin':
    case 'groupVote':
    case 'groupManual':
    case 'groupLock': {
      const g = state.groups[action.cityId];
      if (!g) return state;
      return { ...state, groups: { ...state.groups, [action.cityId]: groupReducer(g, action) } };
    }
    case 'saveTrip':
      return { ...state, savedTrips: { ...state.savedTrips, [action.cityId]: true } };
    case 'clearFresh':
      return { ...state, freshCityId: null };
    case 'setHomeDistrict':
      return { ...state, homeDistrictId: action.districtId };
    case 'setSpotStatus':
      return { ...state, spotStatus: { ...state.spotStatus, [action.placeId]: action.status } };
    case 'setNotifyOnArrival':
      return { ...state, notifyOnArrival: action.on };
    case 'arrived':
      return { ...state, arrivedDistrictId: action.districtId };
    case 'clearArrival':
      return { ...state, arrivedDistrictId: null };
    case 'finishOnboarding':
      return { ...state, onboarded: true };
  }
}

type GroupAction = Extract<Action, { type: 'groupJoin' | 'groupVote' | 'groupManual' | 'groupLock' }>;

function groupReducer(g: GroupState, action: GroupAction): GroupState {
  const join = (id: string) => (g.joined.includes(id) ? g.joined : [...g.joined, id]);
  switch (action.type) {
    case 'groupJoin':
      return { ...g, joined: join(action.friendId) };
    case 'groupVote':
      return {
        ...g,
        joined: join(action.friendId),
        votes: { ...g.votes, [action.placeId]: { ...g.votes[action.placeId], [action.friendId]: action.vote } },
      };
    case 'groupManual':
      return {
        ...g,
        joined: join(action.friendId),
        manual: g.manual.includes(action.friendId) ? g.manual : [...g.manual, action.friendId],
      };
    case 'groupLock':
      return { ...g, locked: true };
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


// ---------------------------------------------------------------------------
// Saved spots, read across every city at once
// ---------------------------------------------------------------------------

/** Every spot you have kept, from every city, in one list. The Map tab's whole input. */
export function useSavedSpots(): Place[] {
  const { state } = useTrips();
  const { collections, skipped, addedLocals } = state;
  return useMemo(() => {
    const ids = new Set<string>();
    Object.values(collections).forEach((c) => c.placeIds.forEach((id) => !skipped[id] && ids.add(id)));
    Object.values(addedLocals).forEach((list) => list.forEach((id) => ids.add(id)));
    return [...ids].map((id) => getPlace(id)).filter(Boolean) as Place[];
  }, [collections, skipped, addedLocals]);
}

export interface DistrictSpots {
  districtId: string | null;
  name: string;
  state: string;
  spots: Place[];
  isHome: boolean;
}

/** Saved spots grouped by district, home first, then by how many spots each holds. */
export function useSpotsByDistrict(): DistrictSpots[] {
  const spots = useSavedSpots();
  const { state } = useTrips();
  const home = state.homeDistrictId;
  return useMemo(() => {
    const homeName = allDistricts.find((d) => d.id === home)?.name ?? null;
    const byName = new Map<string, Place[]>();
    spots.forEach((p) => {
      const name = districtOf(p);
      const list = byName.get(name);
      if (list) list.push(p);
      else byName.set(name, [p]);
    });
    return [...byName.entries()]
      .map(([name, spots]) => ({
        districtId: allDistricts.find((d) => d.name === name)?.id ?? null,
        name,
        state: getCity(spots[0].cityId)?.state ?? '',
        spots,
        isHome: name === homeName,
      }))
      .sort((a, b) => Number(b.isHome) - Number(a.isHome) || b.spots.length - a.spots.length);
  }, [spots, home]);
}

/**
 * The districts worth a geofence, with the copy each notification needs. Only districts that both
 * hold saved spots and have known coordinates can be watched.
 */
export function useArrivalTargets() {
  const groups = useSpotsByDistrict();
  return useMemo(
    () =>
      groups.flatMap((g) => {
        const district = allDistricts.find((d) => d.id === g.districtId);
        if (!district) return [];
        const biggest = clusterSpots(g.spots)[0];
        return [
          {
            districtId: district.id,
            name: district.name,
            centre: district.centre,
            radiusKm: district.radiusKm,
            spots: g.spots.length,
            topArea: biggest?.label ?? null,
            topAreaSpots: biggest?.spots.length ?? 0,
          },
        ];
      }),
    [groups],
  );
}

export function useSpotStatus() {
  const { state, dispatch } = useTrips();
  return {
    statusOf: (placeId: string): SpotStatus => state.spotStatus[placeId] ?? 'want',
    toggle: (placeId: string) =>
      dispatch({
        type: 'setSpotStatus',
        placeId,
        status: (state.spotStatus[placeId] ?? 'want') === 'want' ? 'been' : 'want',
      }),
  };
}
