import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import { getPlace, getCity, isSampleLink } from '@/data/api';
import { live, refreshed, register, restore, snapshot, type LiveSnapshot } from '@/data/registry';
import { allDistricts, getDistrict } from '@/data/regions';
import type { Group, GroupState, Member, Vote } from '@/data/group';
import type { TripPlan, TripPrefs } from '@/data/planner';
import type { Extraction, Place, SpotStatus } from '@/data/types';
import { betterPhoto, framePhoto, refreshPlace } from '@/lib/extract';
import { distanceKm } from '@/lib/geo';
import { deviceStorage } from '@/lib/live/storage';
import { fromWire, toWire, type WirePlan } from '@/lib/live/wire';
import { clusterSpots, districtOf } from '@/lib/spots';

export interface CityCollection {
  cityId: string;
  placeIds: string[];
  reelIds: string[];
  addedAt: number;
}

/**
 * Something started and left part-way, so closing the app mid-way doesn't lose it. One at a time,
 * the latest, and it moves forward with each step: the video being read, its places being checked,
 * the questions part-answered, a plan built but not yet saved. Saving the places ends the first
 * part: a saved collection is finished, not abandoned, and planning it is a choice for later. Saving
 * the plan (or stopping on purpose) clears it.
 */
export type Draft =
  | { stage: 'reading'; url: string; at: number }
  /** The extraction is kept for real links only: a sample's catalog photos can't be stored, and a
   * sample reads again instantly from its link. */
  | { stage: 'checking'; url: string; extraction: Extraction | null; cityId?: string; reelId?: string; at: number }
  | {
      stage: 'questions';
      cityId: string;
      prefs: TripPrefs;
      answered: Record<string, boolean>;
      history: string[];
      stayInTown: boolean;
      at: number;
    }
  | { stage: 'plan'; cityId: string; at: number };

/** How far along a draft is, in the steps a person sees: reading 10, checking 20, questions 50 to 80, plan 90. */
export function draftProgress(d: Draft): number {
  switch (d.stage) {
    case 'reading':
      return 10;
    case 'checking':
      return 20;
    case 'questions':
      return 50 + Math.round((30 * Math.min(Object.keys(d.answered).length, 6)) / 6);
    case 'plan':
      return 90;
  }
}

interface State {
  pendingLink: string | null;
  /** Planning in progress, kept across closing the app. */
  draft: Draft | null;
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
  | { type: 'setDraft'; draft: Draft | null }
  /** What the link turned into, held until the user has checked it. Nothing is saved yet. */
  | { type: 'stageExtraction'; extraction: Extraction }
  /** A link read after its screen was left: it waits on Home, to be checked. */
  | { type: 'readInBackground'; url: string; extraction: Extraction }
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
  draft: null,
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

/**
 * How far from home still counts as Near Home: about 45 km in a straight line, an hour and a half
 * on Kerala roads, the reach of a free Saturday. From Kottayam that takes in Kumarakom, Vagamon and
 * Alappuzha, and leaves Kochi and Munnar as Cities.
 */
export const NEAR_HOME_KM = 45;

/**
 * Near Home or a City, decided by where a collection's places actually are, measured from home:
 * Near Home when most of them are within reach. Never by what the video called the place: one reel
 * says "Kottayam", another "Kumarakom", a third just "Kerala", and all three are the same Saturday
 * drive. Most, not their middle, so one café near home can't pull a whole city in with it.
 */
export function isNearHome(placeIds: string[], homeDistrictId: string | null) {
  const home = getDistrict(homeDistrictId ?? undefined);
  const points = placeIds.flatMap((id) => getPlace(id)?.coords ?? []);
  if (!home || points.length === 0) return false;
  const near = points.filter((p) => distanceKm(home.centre, p) <= NEAR_HOME_KM).length;
  return near * 2 > points.length;
}

/** The collection a place is already saved in, other than `cityId`'s own. A place lives in one. */
export function savedElsewhere(collections: State['collections'], placeId: string, cityId: string) {
  return Object.values(collections).find((c) => c.cityId !== cityId && c.placeIds.includes(placeId)) ?? null;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setPendingLink':
      return {
        ...state,
        pendingLink: action.url,
        draft: action.url ? { stage: 'reading', url: action.url, at: Date.now() } : state.draft,
      };
    case 'setDraft':
      return { ...state, draft: action.draft };
    case 'stageExtraction': {
      // The link it came from: the one being read, or (resuming a check) the one kept before.
      const url = state.pendingLink ?? (state.draft && 'url' in state.draft ? state.draft.url : '');
      const keep = !isSampleLink(url);
      return {
        ...state,
        lastExtraction: action.extraction,
        pendingLink: null,
        // The city and video by id too, so a sample's card can still show its name and picture.
        draft: {
          stage: 'checking',
          url,
          extraction: keep ? action.extraction : null,
          cityId: action.extraction.city.id,
          reelId: action.extraction.reel.id,
          at: Date.now(),
        },
      };
    }
    case 'readInBackground': {
      // Only if it's still the link being read: a newer paste, or stopping, has taken its place.
      const d = state.draft;
      if (d?.stage !== 'reading' || d.url !== action.url) return state;
      const { extraction, url } = action;
      return {
        ...state,
        lastExtraction: extraction,
        pendingLink: state.pendingLink === url ? null : state.pendingLink,
        draft: {
          stage: 'checking',
          url,
          extraction: isSampleLink(url) ? null : extraction,
          cityId: extraction.city.id,
          reelId: extraction.reel.id,
          at: Date.now(),
        },
      };
    }
    case 'setHomeTab':
      return { ...state, homeTab: action.tab };
    case 'commitExtraction': {
      const { city, reel, places } = action.extraction;
      // A place already saved from another video stays where it is: one place, one collection, so
      // it can never show under Near Home and Cities at once.
      const confirmed = (action.placeIds ?? places.map((p) => p.id)).filter(
        (id) => !savedElsewhere(state.collections, id, city.id),
      );
      if (confirmed.length === 0) return { ...state, lastExtraction: null, pendingLink: null, draft: null };
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
        // Saving is the end of collecting, not a planning left half-done: nothing to continue.
        draft: null,
        freshCityId: existing ? state.freshCityId : city.id,
        homeTab: isNearHome(placeIds, state.homeDistrictId) ? 'near' : 'cities',
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
    case 'setTripPlan': {
      const id = action.plan.cityId;
      // A plan built from the questions moves the draft on; edits to a saved plan leave it alone.
      const building =
        state.draft && state.draft.stage !== 'checking' && 'cityId' in state.draft && state.draft.cityId === id && !state.savedTrips[id];
      return {
        ...state,
        tripPlans: { ...state.tripPlans, [id]: action.plan },
        draft: building ? { stage: 'plan', cityId: id, at: Date.now() } : state.draft,
      };
    }
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
    case 'saveTrip': {
      const done = state.draft && 'cityId' in state.draft && state.draft.cityId === action.cityId;
      return { ...state, savedTrips: { ...state.savedTrips, [action.cityId]: true }, draft: done ? null : state.draft };
    }
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
  /** Planning in progress. A real link's extraction goes whole: its places aren't saved anywhere else yet. */
  draft?: Draft | null;
  /**
   * Set once real places' prices stopped being guessed. Copies saved before that have every real
   * place priced from its kind ("Free" for any sight), so those guesses are cleared on load.
   */
  pricesHonest?: true;
};

function loadTrips(): Partial<State> {
  const raw = read(TRIPS_KEY);
  if (!raw) return {};
  let s: SavedTrips;
  try {
    s = JSON.parse(raw) as SavedTrips;
  } catch {
    keepAside(raw);
    return {};
  }
  if (s?.v !== 1) {
    keepAside(raw);
    return {};
  }
  try {
    const unguess = (places: LiveSnapshot['places'] = []) => places.forEach((p) => (p.cost = null));
    // Where someone's staying came from Google, whose coordinates may be kept 30 days: an older
    // one is dropped with the drives out and back, and the next plan looks it up again.
    const STAY_KEEP_MS = 30 * 24 * 60 * 60 * 1000;
    const staleStay = (w: WirePlan) => !!w.prefs.stay && Date.now() - w.prefs.stay.at >= STAY_KEEP_MS;
    // Each plan is brought up to date on its own: one that can't be read is dropped, not everything.
    const wires = Object.entries(s.tripPlans ?? {}).flatMap(([cityId, w]) =>
      attempt<[string, WirePlan][]>(() => {
        if (!s.pricesHonest) unguess(w.live?.places);
        if (staleStay(w)) {
          w.prefs = { ...w.prefs, stay: null };
          w.days = w.days.map((d) => ({ ...d, home: undefined, stops: d.stops.map((st, i) => (i === 0 ? { ...st, leg: undefined } : st)) }));
        }
        return [[cityId, w]];
      }, []),
    );
    if (!s.pricesHonest) unguess(s.live.places);
    // Real places first: the plans below are rebuilt from their ids.
    restore(s.live);
    const collections = onePerPlace(s.collections, Object.fromEntries(wires));
    const draft = attempt(() => restoreDraft(s.draft ?? null, collections), null);
    const tripPlans = Object.fromEntries(wires.flatMap(([cityId, w]) => attempt<[string, TripPlan][]>(() => [[cityId, fromWire(w)]], [])));
    return {
      homeDistrictId: s.homeDistrictId,
      spotStatus: s.spotStatus,
      notifyOnArrival: s.notifyOnArrival,
      onboarded: s.onboarded,
      collections,
      skipped: s.skipped,
      addedLocals: s.addedLocals,
      savedTrips: s.savedTrips,
      tripPlans,
      groups: s.groups,
      remote: s.remote,
      homeTab: s.homeTab,
      draft,
    };
  } catch {
    // Damaged past reading: start fresh rather than crash, but keep the copy aside (the next save
    // would write over it) and keep that onboarding is done, so it isn't asked again.
    keepAside(raw);
    return { onboarded: !!s.onboarded, homeDistrictId: s.homeDistrictId ?? initial.homeDistrictId };
  }
}

const attempt = <T,>(run: () => T, fallback: T): T => {
  try {
    return run();
  } catch {
    return fallback;
  }
};

/**
 * A saved copy that couldn't be read goes to a second key before anything is saved over it, so the
 * trips in it can still be recovered by hand. The first one kept stays: it's the one worth having.
 */
const ASIDE_KEY = 'xplore.trips.unread';
function keepAside(raw: string) {
  if (!read(ASIDE_KEY)) write(ASIDE_KEY, raw);
}

/**
 * Copies saved before a place could live in only one collection can hold it twice (a café from two
 * videos, filed under two names). The first collection keeps it; one left empty, with no plan made
 * from it, goes.
 */
function onePerPlace(collections: State['collections'], plans: Record<string, unknown>): State['collections'] {
  const seen = new Set<string>();
  const kept = Object.values(collections)
    .sort((a, b) => a.addedAt - b.addedAt)
    .map((c) => {
      const placeIds = c.placeIds.filter((id) => !seen.has(id));
      placeIds.forEach((id) => seen.add(id));
      return { ...c, placeIds };
    })
    .filter((c) => c.placeIds.length > 0 || !!plans[c.cityId]);
  return Object.fromEntries(kept.map((c) => [c.cityId, c]));
}

/** A draft back from storage: its real places re-registered, and dropped if what it points at is gone. */
function restoreDraft(d: Draft | null, collections: State['collections']): Draft | null {
  if (!d) return null;
  // Older copies kept "places saved" as planning to continue; saving is finished, not left part-way.
  if ((d.stage as string) === 'saved') return null;
  if (d.stage === 'checking' && d.extraction) {
    const { city, reel, places } = d.extraction;
    register({ city, reel, places });
  }
  // A check in progress points at places not saved yet; later stages need their saved city.
  if (d.stage !== 'checking' && d.stage !== 'reading' && !collections[d.cityId]) return null;
  return d;
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
    draft: state.draft,
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
    // Only what's kept; a pending link or a fresh extraction changing needn't write anything (the
    // draft carries what of them is worth keeping).
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
      state.draft,
    ],
  );

  // A saved real place points at the collection it lives in. Reading another video that shows it
  // again registers it under that video's city; the collection it was saved in wins.
  useEffect(() => {
    let moved = false;
    Object.values(state.collections).forEach((c) =>
      c.placeIds.forEach((id) => {
        const p = live.places[id];
        if (p && p.cityId !== c.cityId) {
          live.places[id] = { ...p, cityId: c.cityId };
          moved = true;
        }
      }),
    );
    if (moved) dispatch({ type: 'livePlacesRefreshed' });
  }, [state.collections]);

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
    // A cover that is a video's thumbnail, or a café's or a hotel's photo while the city has a
    // sight with one: a sight's real photo, then any place's, else a frame. Set directly: register
    // keeps a known city's cover on purpose. Says whether any cover changed.
    const fixCovers = () => {
      let changed = false;
      const landmark = (p: Place) => p.type === 'sight' || p.type === 'experience';
      for (const city of Object.values(live.cities)) {
        const inCity = Object.values(live.places).filter((p) => p.cityId === city.id && p.photoCredit);
        const best = inCity.find(landmark);
        const reel = Object.values(live.reels).find((r) => r.cityId === city.id && uriOf(r.thumbnail) === uriOf(city.hero));
        const coverOf = inCity.find((p) => uriOf(p.photo) === uriOf(city.hero));
        if (reel) {
          const withPhoto = best ?? inCity[0];
          live.cities[city.id] = { ...city, hero: withPhoto?.photo ?? framePhoto(reel, 1), heroCredit: withPhoto?.photoCredit };
          changed = true;
        } else if (best && coverOf && !landmark(coverOf)) {
          live.cities[city.id] = { ...city, hero: best.photo, heroCredit: best.photoCredit };
          changed = true;
        }
      }
      return changed;
    };
    const todo = Object.values(live.places).filter(due).slice(0, 30);
    if (todo.length === 0) {
      if (fixCovers()) dispatch({ type: 'livePlacesRefreshed' });
      return;
    }
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
      fixCovers();
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
