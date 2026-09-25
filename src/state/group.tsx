import { useEffect } from 'react';

import { getLocalPicks } from '@/data/api';
import { places } from '@/data/catalog';
import {
  membersOf,
  planKeyOf,
  planStops,
  scriptFor,
  swapCandidates,
  verdictOf,
  type GroupState,
} from '@/data/group';
import { partyOf, rulePlanner, type TripPlan } from '@/data/planner';

import { useTrips } from './trips';

type Dispatch = ReturnType<typeof useTrips>['dispatch'];

/** Starts the vote on a plan, unless it's a solo trip. Called when the plan is shared. */
export function startGroup(dispatch: Dispatch, plan: TripPlan) {
  const party = partyOf(plan.prefs);
  if (party === 'solo') return;
  dispatch({ type: 'groupStart', cityId: plan.cityId, planKey: planKeyOf(plan), party, swapFor: swapCandidates(plan) });
}

/** The group's vote on a plan, read without side effects. Used by the vote screens and Trips. */
export function summarize(plan: TripPlan | undefined, stored: GroupState | undefined) {
  const planKey = plan ? planKeyOf(plan) : null;
  const party = plan ? partyOf(plan.prefs) : null;
  // A plan edited since the vote started (other stops, or other people going) has moved on; a
  // locked vote is kept as it ended.
  const group = stored && ((stored.planKey === planKey && stored.party === party) || stored.locked) ? stored : undefined;
  const members = group ? membersOf(group.party) : [];
  const stops = plan ? planStops(plan) : [];
  const verdicts = Object.fromEntries(
    stops.map(({ stop }) => [stop.place.id, verdictOf(group?.votes[stop.place.id], members.length)]),
  );
  const votesIn = stops.reduce((n, { stop }) => n + Object.keys(group?.votes[stop.place.id] ?? {}).length, 0);
  const total = stops.length * members.length;
  const approved = !!group && stops.length > 0 && stops.every(({ stop }) => verdicts[stop.place.id] !== 'waiting');
  return { plan, group, members, stops, verdicts, votesIn, total, approved };
}

/**
 * The vote on a city's plan, for the vote screens. Makes sure there is something to vote on: a
 * friend opening the shared link starts with an empty store, so they get the city's one-day plan,
 * and a vote that hasn't started (a link, or a plan edited since) starts here.
 */
export function useGroupVote(cityId: string) {
  const { state, dispatch } = useTrips();
  const plan = state.tripPlans[cityId];
  const stored = state.groups[cityId];

  useEffect(() => {
    if (plan) return;
    let cancelled = false;
    const picks = getLocalPicks(cityId);
    const saved = Object.values(places).filter((p) => p.cityId === cityId && !picks.some((l) => l.id === p.id));
    if (saved.length === 0) return;
    rulePlanner
      .plan({
        cityId,
        saved,
        suggestions: picks,
        prefs: { party: 'friends', when: 'flexible', start: null, days: 1, pace: 'balanced', getting: 'local' },
        pins: [],
        removed: [],
        seed: 1,
      })
      .then((p) => !cancelled && dispatch({ type: 'setTripPlan', plan: p }));
    return () => {
      cancelled = true;
    };
  }, [cityId, plan, dispatch]);

  const summary = summarize(plan, stored);
  const needsStart = !!plan && !summary.group && partyOf(plan.prefs) !== 'solo';
  useEffect(() => {
    if (needsStart && plan) startGroup(dispatch, plan);
  }, [needsStart, plan, dispatch]);

  return summary;
}

/**
 * Plays every running vote's script, wherever you are in the app, so the Trips tab and the vote
 * screen both watch it happen. Mounted once, at the root.
 */
export function GroupScripts() {
  const { state } = useTrips();
  const active = Object.keys(state.groups).filter((id) => !state.groups[id].locked && state.tripPlans[id]);
  return (
    <>
      {active.map((id) => (
        <GroupScript key={id} cityId={id} />
      ))}
    </>
  );
}

// Only what hasn't happened yet is scheduled, re-spaced from now: coming back to a vote, or taking
// the phone to vote as someone, picks up where the script was without replaying anything.
function GroupScript({ cityId }: { cityId: string }) {
  const { state, dispatch } = useTrips();
  const { plan, group, members } = summarize(state.tripPlans[cityId], state.groups[cityId]);
  const live = !!plan && !!group && !group.locked;
  const planKey = plan ? planKeyOf(plan) : '';

  useEffect(() => {
    if (!live || !plan || !group) return;
    const pending = scriptFor(plan, group.swapFor, members).filter((e) =>
      e.type === 'join'
        ? !group.joined.includes(e.memberId)
        : !group.manual.includes(e.memberId) && !group.votes[e.placeId]?.[e.memberId],
    );
    if (pending.length === 0) return;
    const t0 = pending[0].at - (group.joined.length ? 500 : pending[0].at);
    const timers = pending.map((e) =>
      setTimeout(
        () =>
          dispatch(
            e.type === 'join'
              ? { type: 'groupJoin', cityId, memberId: e.memberId }
              : { type: 'groupVote', cityId, placeId: e.placeId, memberId: e.memberId, vote: e.vote },
          ),
        e.at - t0,
      ),
    );
    return () => timers.forEach(clearTimeout);
    // Scheduled once per vote; rescheduled when someone takes over on this phone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, planKey, cityId, group?.manual.length]);

  return null;
}
