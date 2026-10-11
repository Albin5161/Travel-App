import { useEffect, useRef, useSyncExternalStore } from 'react';

import type { Member } from '@/data/group';
import type { TripPlan } from '@/data/planner';
import { castVote, loadTrip, planFromRow, savePlan, voteFromRow, watchTrip, type MemberRow, type TripRow, type VoteRow } from '@/lib/live/api';

import { unsent } from '@/lib/live/unsent';

import { useTrips } from './trips';

type Vote = Parameters<typeof castVote>[2];
type State = ReturnType<typeof useTrips>['state'];

// A vote or a plan edit shows on this phone at once and is then saved for everyone. If that save
// fails (no signal in the hills is the usual reason), it used to be dropped without a word: the
// phone showed the vote, nobody else ever got it, and the next sync put the old one back. Now the
// change is noted as waiting before it's sent (lib/live/unsent), sent again when the connection
// returns, and never overwritten by an older copy from the server in the meantime.

/** The server answered and said no (a rule, a deleted trip): trying again won't change that. */
const refused = (e: unknown) => !!e && typeof e === 'object' && 'code' in e && !!(e as { code?: string }).code;

// Which send of a thing is the latest: an earlier one finishing late mustn't mark a later one done.
const turn = new Map<string, number>();
function latest(key: string) {
  const n = (turn.get(key) ?? 0) + 1;
  turn.set(key, n);
  return () => turn.get(key) === n;
}

/** True when it's saved, or was refused for good; false when it's still waiting. */
function sendVote(tripId: string, placeId: string, vote: Vote): Promise<boolean> {
  const isLatest = latest(`${tripId}:${placeId}`);
  unsent.addVote(tripId, placeId);
  return castVote(tripId, placeId, vote).then(
    () => {
      if (isLatest()) unsent.clearVote(tripId, placeId);
      return true;
    },
    (e: unknown) => {
      if (refused(e) && isLatest()) unsent.clearVote(tripId, placeId);
      return refused(e);
    },
  );
}

function sendPlan(tripId: string, plan: TripPlan, locked?: boolean): Promise<boolean> {
  const isLatest = latest(tripId);
  unsent.setPlan(tripId, true);
  return savePlan(tripId, plan, locked).then(
    () => {
      if (isLatest()) unsent.setPlan(tripId, false);
      return true;
    },
    (e: unknown) => {
      if (refused(e) && isLatest()) unsent.setPlan(tripId, false);
      return refused(e);
    },
  );
}

/** Sends whatever is waiting for a trip, as the phone holds it now. */
async function flush(cityId: string, state: State): Promise<void> {
  const remote = state.remote[cityId];
  if (!remote) return;
  const waiting = unsent.of(remote.tripId);
  const group = state.groups[cityId];
  const jobs: Promise<boolean>[] = [];
  for (const placeId of waiting.votes) {
    const vote = group?.votes[placeId]?.[remote.me];
    if (vote) jobs.push(sendVote(remote.tripId, placeId, vote));
    else unsent.clearVote(remote.tripId, placeId);
  }
  if (waiting.plan) {
    const plan = state.tripPlans[cityId];
    if (plan) jobs.push(sendPlan(remote.tripId, plan, group?.locked ? true : undefined));
    else unsent.setPlan(remote.tripId, false);
  }
  const sent = await Promise.all(jobs);
  if (sent.includes(false)) unsent.failed(remote.tripId);
}

/** While something is waiting, how often to try again without being asked. */
const RETRY_MS = 20_000;

/**
 * Keeps one shared trip in step with everyone else's phone. It loads the trip, then listens: a
 * join, a vote or a plan edit from anyone arrives here and becomes the same store action the
 * scripted demo dispatches, so every screen works the same either way. Mounted by GroupScripts,
 * one per shared trip, for as long as the app runs.
 */
export function LiveTrip({ cityId }: { cityId: string }) {
  const { state, dispatch } = useTrips();
  const remote = state.remote[cityId];
  // The latest of everything, for sending what's waiting from inside the one long-lived effect.
  const now = useRef(state);
  useEffect(() => {
    now.current = state;
  }, [state]);

  // Something is waiting: keep trying, so it goes the moment there's signal again.
  const tripId = remote?.tripId;
  const stuck = useSyncExternalStore(unsent.subscribe, () => (tripId ? unsent.stuck(tripId) : 0), () => 0);
  useEffect(() => {
    if (!stuck) return;
    const t = setInterval(() => void flush(cityId, now.current), RETRY_MS);
    return () => clearInterval(t);
  }, [stuck, cityId]);

  useEffect(() => {
    if (!remote) return;
    let alive = true;
    const people = new Map<string, Member>();

    const onTrip = (row: TripRow) => {
      // An edit of ours that hasn't been saved yet is newer than what the server has.
      if (!alive || unsent.of(remote.tripId).plan) return;
      dispatch({ type: 'setTripPlan', plan: planFromRow(row) });
      if (row.locked) dispatch({ type: 'groupLock', cityId });
    };
    // The one who made the trip doesn't vote on it; everyone else does.
    const onMember = (row: MemberRow) => {
      if (!alive || row.user_id === remote.owner) return;
      people.set(row.user_id, { id: row.user_id, name: row.name, tint: row.tint });
      dispatch({ type: 'groupPeople', cityId, people: [...people.values()] });
    };
    const onVote = (row: VoteRow) => {
      if (!alive) return;
      // Likewise our own vote on a stop, while a newer one is still waiting to go.
      if (row.user_id === remote.me && unsent.of(remote.tripId).votes.includes(row.place_id)) return;
      dispatch({ type: 'groupVote', cityId, placeId: row.place_id, memberId: row.user_id, vote: voteFromRow(row) });
    };

    // Everything as it stands now. Run straight away, so the screen fills, and again once the live
    // stream is really flowing, to pick up anything saved in between.
    // What's waiting goes first, so what comes back already has it.
    const sync = () =>
      flush(cityId, now.current)
        .then(() => loadTrip(remote.tripId))
        .then(({ trip, members, votes }) => {
          onTrip(trip);
          members.forEach(onMember);
          votes.forEach(onVote);
        })
        .catch(() => {
          // Offline: the trip stays as it was, and the next ready signal tries again.
        });
    sync();
    const stop = watchTrip(remote.tripId, { trip: onTrip, member: onMember, vote: onVote, ready: sync });
    return () => {
      alive = false;
      stop();
    };
    // One subscription per trip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote?.tripId, cityId, dispatch]);

  return null;
}

/**
 * Saving a plan edit: always to this phone, and to everyone else's too when the trip is shared.
 * The change shows here straight away; theirs follows over the listener.
 */
export function usePlanWriter(cityId: string) {
  const { state, dispatch } = useTrips();
  const remote = state.remote[cityId];
  return (plan: TripPlan, locked?: boolean) => {
    dispatch({ type: 'setTripPlan', plan });
    if (remote) void sendPlan(remote.tripId, plan, locked).then((ok) => !ok && unsent.failed(remote.tripId));
  };
}

/** Casting your own vote on a shared trip: shown at once, then saved for everyone. */
export function useLiveVote(cityId: string) {
  const { state, dispatch } = useTrips();
  const remote = state.remote[cityId];
  if (!remote) return null;
  return {
    me: remote.me,
    cast: (placeId: string, vote: Vote) => {
      dispatch({ type: 'groupVote', cityId, placeId, memberId: remote.me, vote });
      void sendVote(remote.tripId, placeId, vote).then((ok) => !ok && unsent.failed(remote.tripId));
    },
  };
}

/**
 * How many of your changes to a shared trip a failed save has left waiting, and a way to try
 * them again now. Zero on a trip that isn't shared, and while a save is simply on its way.
 */
export function useUnsent(cityId: string) {
  const { state } = useTrips();
  const tripId = state.remote[cityId]?.tripId;
  const count = useSyncExternalStore(unsent.subscribe, () => (tripId ? unsent.stuck(tripId) : 0), () => 0);
  return { count, retry: () => flush(cityId, state) };
}
