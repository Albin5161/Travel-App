import { useEffect } from 'react';

import type { Member } from '@/data/group';
import type { TripPlan } from '@/data/planner';
import { castVote, loadTrip, planFromRow, savePlan, voteFromRow, watchTrip, type MemberRow, type TripRow, type VoteRow } from '@/lib/live/api';

import { useTrips } from './trips';

/**
 * Keeps one shared trip in step with everyone else's phone. It loads the trip, then listens: a
 * join, a vote or a plan edit from anyone arrives here and becomes the same store action the
 * scripted demo dispatches, so every screen works the same either way. Mounted by GroupScripts,
 * one per shared trip, for as long as the app runs.
 */
export function LiveTrip({ cityId }: { cityId: string }) {
  const { state, dispatch } = useTrips();
  const remote = state.remote[cityId];

  useEffect(() => {
    if (!remote) return;
    let alive = true;
    const people = new Map<string, Member>();

    const onTrip = (row: TripRow) => {
      if (!alive) return;
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
      dispatch({ type: 'groupVote', cityId, placeId: row.place_id, memberId: row.user_id, vote: voteFromRow(row) });
    };

    // Everything as it stands now. Run straight away, so the screen fills, and again once the live
    // stream is really flowing, to pick up anything saved in between.
    const sync = () =>
      loadTrip(remote.tripId)
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
    if (remote) savePlan(remote.tripId, plan, locked).catch(() => {});
  };
}

/** Casting your own vote on a shared trip: shown at once, then saved for everyone. */
export function useLiveVote(cityId: string) {
  const { state, dispatch } = useTrips();
  const remote = state.remote[cityId];
  if (!remote) return null;
  return {
    me: remote.me,
    cast: (placeId: string, vote: Parameters<typeof castVote>[2]) => {
      dispatch({ type: 'groupVote', cityId, placeId, memberId: remote.me, vote });
      castVote(remote.tripId, placeId, vote).catch(() => {});
    },
  };
}
