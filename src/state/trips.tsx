import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import { getPlace, getCity } from '@/data/api';
import { live, refreshed, register, restore, snapshot, type LiveSnapshot } from '@/data/registry';
import { allDistricts } from '@/data/regions';
import type { Group, GroupState, Member, Vote } from '@/data/group';
import type { TripPlan } from '@/data/planner';
import type { Extraction, Place, SpotStatus } from '@/data/types';
import { betterPhoto, framePhoto, refreshPlace } from '@/lib/extract';
import { deviceStorage } from '@/lib/live/storage';
import { fromWire, toWire, type WirePlan } from '@/lib/live/wire';
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
  /** Onboarding runs once. */
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
  /** What friends see you as on a shared trip. Asked at the end of onboarding; kept on the device. */
  myName: string | null;
  /** Your photo, as a data URI, kept on the device. */
  myPhoto: string | null;
  /** Trips shared through the backend, by city: which trip, and who you are on it. */
  remote: Record<string, Remote>;
  /** City to fade in once on the home screen. */
  freshCityId: string | null;
  /** Which half of My Collections Home shows. Set after a save, so the new card is on screen. */
  homeTab: HomeTab;
  /** Bumped when saved places come back refreshed from Google, so screens and the saved copy update. */
  liveVersion: number;
}

export type HomeTab = 'near' | 'cities';

export interface Remote {
  tripId: string;
  code: string;
  /** Your user id on this trip. */
  me: string;
  /** Who made it, and what they're called. */
  owner: string;
  ownerName: string;
}

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
  | { type: 'groupStart'; cityId: string; planKey: string; party: Group; swapFor: Record<string, string>; live?: boolean }
  | { type: 'groupPeople'; cityId: string; people: Member[] }
  | { type: 'setMyName'; name: string }
  | { type: 'setMyPhoto'; photo: string | null }
  | { type: 'setRemote'; cityId: string; remote: Remote }
  | { type: 'groupJoin'; cityId: string; memberId: string }
  | { type: 'groupVote'; cityId: string; placeId: string; memberId: string; vote: Vote }
  | { type: 'groupManual'; cityId: string; memberId: string }
  | { type: 'groupCheer'; cityId: string }
  | { type: 'groupLock'; cityId: string }
  | { type: 'clearFresh' }
  | { type: 'setHomeDistrict'; districtId: string }
  | { type: 'setSpotStatus'; placeId: string; status: SpotStatus }
  | { type: 'setNotifyOnArrival'; on: boolean }
  | { type: 'arrived'; districtId: string }
  | { type: 'clearArrival' }
  | { type: 'finishOnboarding' }
  | { type: 'livePlacesRefreshed' };

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
  myName: null,
  myPhoto: null,
  remote: {},
  freshCityId: null,
  homeTab: 'cities',
  liveVersion: 0,
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
          [action.cityId]: {
            planKey: action.planKey,
            party: action.party,
            joined: [],
            votes: {},
            manual: [],
            swapFor: action.swapFor,
            cheered: false,
            locked: false,
            live: action.live,
            people: action.live ? [] : undefined,
          },
        },
      };
    case 'setMyName':
      return { ...state, myName: action.name.trim() || null };
    case 'setMyPhoto':
      return { ...state, myPhoto: action.photo };
    case 'setRemote':
      return { ...state, remote: { ...state.remote, [action.cityId]: action.remote } };
    case 'groupJoin':
    case 'groupPeople':
    case 'groupVote':
    case 'groupManual':
    case 'groupCheer':
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
    case 'livePlacesRefreshed':
      return { ...state, liveVersion: state.liveVersion + 1 };
  }
}

type GroupAction = Extract<Action, { type: 'groupJoin' | 'groupPeople' | 'groupVote' | 'groupManual' | 'groupCheer' | 'groupLock' }>;

function groupReducer(g: GroupState, action: GroupAction): GroupState {
  const join = (id: string) => (g.joined.includes(id) ? g.joined : [...g.joined, id]);
  switch (action.type) {
    case 'groupJoin':
      return { ...g, joined: join(action.memberId) };
    case 'groupPeople':
      return { ...g, people: action.people, joined: action.people.map((p) => p.id) };
    case 'groupVote':
      return {
        ...g,
        joined: join(action.memberId),
        votes: { ...g.votes, [action.placeId]: { ...g.votes[action.placeId], [action.memberId]: action.vote } },
      };
    case 'groupManual':
      return {
        ...g,
        joined: join(action.memberId),
        manual: g.manual.includes(action.memberId) ? g.manual : [...g.manual, action.memberId],
      };
    case 'groupCheer':
      return { ...g, cheered: true };
    case 'groupLock':
      return { ...g, locked: true };
  }
}

const TripsContext = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

// Kept on the phone, so a reload or a restart doesn't lose anything: your name and photo on their
// own, and your trips in one saved copy. Still per phone (or browser); nothing here needs an account.
const NAME_KEY = 'xplore.name';
const PHOTO_KEY = 'xplore.photo';
const TRIPS_KEY = 'xplore.trips.v1';
/** Google allows keeping a place's coordinates for 30 days; older ones are asked for again. */
const COORDS_DAYS = 30;

// The saved copy. Plans go as place ids (their catalog photos are build-specific asset ids that
// can't be stored), and the real places the trips point at go alongside, since they aren't in the
// catalog. What's only on screen for a moment (a pending link, a fresh extraction) isn't kept.
type SavedTrips = {
  v: 1;
  homeDistrictId: string | null;
  spotStatus: State['spotStatus'];
  notifyOnArrival: boolean;
  onboarded: boolean;
  collections: State['collections'];
  skipped: State['skipped'];
  addedLocals: State['addedLocals'];
  savedTrips: State['savedTrips'];
  tripPlans: Record<string, WirePlan>;
  groups: State['groups'];
  remote: State['remote'];
  homeTab: HomeTab;
  live: LiveSnapshot;
  /**
   * Set once real places' prices stopped being guessed. Copies saved before that have every real
   * place priced from its kind ("Free" for any sight), so those guesses are cleared on load.
   */
  pricesHonest?: true;
};

function loadTrips(): Partial<State> {
  const raw = read(TRIPS_KEY);
  if (!raw) return {};
  try {
    const s = JSON.parse(raw) as SavedTrips;
    if (s.v !== 1) return {};
    if (!s.pricesHonest) {
      const unguess = (places: LiveSnapshot['places'] = []) => places.forEach((p) => (p.cost = null));
      unguess(s.live.places);
      Object.values(s.tripPlans).forEach((w) => unguess(w.live?.places));
    }
    // Where someone's staying came from Google, whose coordinates may be kept 30 days: an older
    // one is dropped with the drives out and back, and the next plan looks it up again.
    const STAY_KEEP_MS = 30 * 24 * 60 * 60 * 1000;
    const staleStay = (w: WirePlan) => !!w.prefs.stay && Date.now() - w.prefs.stay.at >= STAY_KEEP_MS;
    Object.values(s.tripPlans).forEach((w) => {
      if (!staleStay(w)) return;
      w.prefs = { ...w.prefs, stay: null };
      w.days = w.days.map((d) => ({ ...d, home: undefined, stops: d.stops.map((st, i) => (i === 0 ? { ...st, leg: undefined } : st)) }));
    });
    // Real places first: the plans below are rebuilt from their ids.
    restore(s.live);
    const tripPlans = Object.fromEntries(Object.entries(s.tripPlans).map(([cityId, w]) => [cityId, fromWire(w)]));
    return {
      homeDistrictId: s.homeDistrictId,
      spotStatus: s.spotStatus,
      notifyOnArrival: s.notifyOnArrival,
      onboarded: s.onboarded,
      collections: s.collections,
      skipped: s.skipped,
      addedLocals: s.addedLocals,
      savedTrips: s.savedTrips,
      tripPlans,
      groups: s.groups,
      remote: s.remote,
      homeTab: s.homeTab,
    };
  } catch {
    // A copy from an older version, or damaged: start fresh rather than crash.
    return {};
  }
}

function saveTrips(state: State) {
  const plans = Object.values(state.tripPlans);
  const collections = Object.values(state.collections);
  const saved: SavedTrips = {
    v: 1,
    pricesHonest: true,
    homeDistrictId: state.homeDistrictId,
    spotStatus: state.spotStatus,
    notifyOnArrival: state.notifyOnArrival,
    onboarded: state.onboarded,
    collections: state.collections,
    skipped: state.skipped,
    addedLocals: state.addedLocals,
    savedTrips: state.savedTrips,
    tripPlans: Object.fromEntries(plans.map((p) => [p.cityId, toWire(p)])),
    groups: state.groups,
    remote: state.remote,
    homeTab: state.homeTab,
    live: snapshot(
      [
        ...collections.flatMap((c) => c.placeIds),
        ...Object.values(state.addedLocals).flat(),
        ...plans.flatMap((p) => [...p.days.flatMap((d) => d.stops.map((st) => st.place.id)), ...p.left.map((l) => l.id)]),
      ],
      [...collections.map((c) => c.cityId), ...plans.map((p) => p.cityId)],
      collections.flatMap((c) => c.reelIds),
    ),
  };
  write(TRIPS_KEY, JSON.stringify(saved));
}

function read(key: string) {
  try {
    return deviceStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value) deviceStorage?.setItem(key, value);
    else deviceStorage?.removeItem(key);
  } catch {
    // Storage full or unavailable: it just won't be remembered next time.
  }
}

export function TripsProvider({ children }: { children: ReactNode }) {
  // Read before the first render, not after: the tabs decide at once whether onboarding is due.
  const [state, dispatch] = useReducer(reducer, initial, (s) => ({
    ...s,
    ...loadTrips(),
    myName: read(NAME_KEY),
    myPhoto: read(PHOTO_KEY),
  }));
  useEffect(() => write(NAME_KEY, state.myName), [state.myName]);
  useEffect(() => write(PHOTO_KEY, state.myPhoto), [state.myPhoto]);
  useEffect(
    () => saveTrips(state),
    // Only what's kept; a pending link or a fresh extraction changing needn't write anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state.homeDistrictId,
      state.spotStatus,
      state.notifyOnArrival,
      state.onboarded,
      state.collections,
      state.skipped,
      state.addedLocals,
      state.savedTrips,
      state.tripPlans,
      state.groups,
      state.remote,
      state.homeTab,
      state.liveVersion,
    ],
  );

  // Saved real places whose coordinates are more than 30 days old are asked of Google again, a few
  // at a time, once per launch. One that can't be refreshed (offline, today's cap) stays as it was.
  useEffect(() => {
    const cutoff = Date.now() - COORDS_DAYS * 86400_000;
    const stale = Object.values(live.places)
      .filter((p) => (live.placedAt[p.id] ?? 0) < cutoff)
      .slice(0, 10);
    if (stale.length === 0) return;
    let stopped = false;
    (async () => {
      for (const place of stale) {
        const fresh = await refreshPlace(place).catch(() => null);
        if (stopped) return;
        if (fresh) {
          refreshed(fresh);
          dispatch({ type: 'livePlacesRefreshed' });
        }
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  // Saved real places still showing a video's picture get a real photo looked for (Wikimedia, then
  // Google), or at least a frame of the video instead of its thumbnail. Places saved before frames
  // existed are fixed on the first launch; a frame is looked past again after 30 days. The cities'
  // covers follow. A few at a time, once per launch; offline or capped, they stay as they were.
  useEffect(() => {
    const uriOf = (img: unknown) => (img && typeof img === 'object' && 'uri' in img ? String((img as { uri: string }).uri) : null);
    const thumbOf = (p: Place) => (p.source.kind === 'reel' ? uriOf(live.reels[p.source.reelId]?.thumbnail) : null);
    const due = (p: Place) =>
      p.id.startsWith('g:') &&
      p.source.kind === 'reel' &&
      (uriOf(p.photo) === thumbOf(p) || (!!p.photoFromVideo && Date.now() - p.photoFromVideo > COORDS_DAYS * 86400_000));
    const todo = Object.values(live.places).filter(due).slice(0, 15);
    if (todo.length === 0) return;
    let stopped = false;
    (async () => {
      const turns = new Map<string, number>();
      for (const place of todo) {
        const reelId = place.source.kind === 'reel' ? place.source.reelId : '';
        const turn = turns.get(reelId) ?? 0;
        turns.set(reelId, turn + 1);
        const better = await betterPhoto(place, live.reels[reelId], turn);
        if (stopped) return;
        if (!better) continue;
        if (better.photoCredit) refreshed(better);
        else register({ places: [better] });
      }
      // A cover that is a video's thumbnail: the first place in the city with a real photo, else a frame.
      for (const city of Object.values(live.cities)) {
        const reel = Object.values(live.reels).find((r) => r.cityId === city.id && uriOf(r.thumbnail) === uriOf(city.hero));
        if (!reel) continue;
        const withPhoto = Object.values(live.places).find((p) => p.cityId === city.id && p.photoCredit);
        register({ city: { ...city, hero: withPhoto?.photo ?? framePhoto(reel, 1), heroCredit: withPhoto?.photoCredit } });
      }
      if (!stopped) dispatch({ type: 'livePlacesRefreshed' });
    })();
    return () => {
      stopped = true;
    };
  }, []);

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
            topArea: biggest?.label || null,
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
