import { useEffect } from 'react';

import { getLocalPicks } from '@/data/api';
import { places } from '@/data/catalog';
import { FRIENDS, planKeyOf, planStops, scriptFor, swapCandidates, verdictOf } from '@/data/group';
import { rulePlanner } from '@/data/planner';

import { useTrips } from './trips';

/**
 * The group vote for a city's plan. Makes sure there is a plan to vote on (a friend opening the
 * shared link starts with an empty store, so they get a one-day plan of the city), starts the vote,
 * and, with `live`, plays the scripted friends in: joins a beat apart, then votes one at a time.
 * Leaving and coming back picks up where the script was, without replaying what already landed.
 */
export function useGroupVote(cityId: string, { live }: { live: boolean }) {
  const { state, dispatch } = useTrips();
  const plan = state.tripPlans[cityId];
  const group = state.groups[cityId];
  const planKey = plan ? planKeyOf(plan) : null;

  // No plan: build the city's default day, the same way the planner would.
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
        prefs: { when: 'flexible', start: null, days: 1, pace: 'balanced', getting: 'local' },
        pins: [],
        removed: [],
        seed: 1,
      })
      .then((p) => !cancelled && dispatch({ type: 'setTripPlan', plan: p }));
    return () => {
      cancelled = true;
    };
  }, [cityId, plan, dispatch]);

  // A vote per plan: a plan edited since (not by locking the vote in) starts a fresh one.
  useEffect(() => {
    if (!plan || !planKey) return;
    if (group && (group.planKey === planKey || group.locked)) return;
    dispatch({ type: 'groupStart', cityId, planKey, swapFor: swapCandidates(plan) });
  }, [cityId, plan, planKey, group, dispatch]);

  // The script. Only what hasn't happened yet is scheduled, re-spaced from now.
  const ready = !!group && group.planKey === planKey && !group.locked;
  useEffect(() => {
    if (!live || !ready || !plan || !group) return;
    const pending = scriptFor(plan, group.swapFor).filter((e) =>
      e.type === 'join'
        ? !group.joined.includes(e.friendId)
        : !group.manual.includes(e.friendId) && !group.votes[e.placeId]?.[e.friendId],
    );
    if (pending.length === 0) return;
    const t0 = pending[0].at - 400;
    const timers = pending.map((e) =>
      setTimeout(
        () =>
          dispatch(
            e.type === 'join'
              ? { type: 'groupJoin', cityId, friendId: e.friendId }
              : { type: 'groupVote', cityId, placeId: e.placeId, friendId: e.friendId, vote: e.vote },
          ),
        e.at - t0,
      ),
    );
    return () => timers.forEach(clearTimeout);
    // Scheduled once per session; manual votes are skipped when the script reaches them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, ready, cityId, group?.manual.length]);

  const stops = plan ? planStops(plan) : [];
  const verdicts = Object.fromEntries(stops.map(({ stop }) => [stop.place.id, verdictOf(group?.votes[stop.place.id])]));
  const votesIn = stops.reduce((n, { stop }) => n + Object.keys(group?.votes[stop.place.id] ?? {}).length, 0);
  const total = stops.length * FRIENDS.length;
  const approved = stops.length > 0 && stops.every(({ stop }) => verdicts[stop.place.id] !== 'waiting');

  return { plan, group: group?.planKey === planKey || group?.locked ? group : undefined, stops, verdicts, votesIn, total, approved };
}
