// Group vote: friends go through the plan stop by stop and keep, swap or drop each one. There's no
// backend, so the friends and their votes are scripted from the plan itself (the same plan always
// plays out the same way). Anyone can also vote on this phone as one of the friends ("pass the
// phone"); their votes replace that friend's scripted ones.
import { getLocalPicks, getPlace } from './api';
import { places } from './catalog';
import type { TripPlan } from './planner';
import type { Place } from './types';

export type VoteKind = 'keep' | 'swap' | 'drop';
export type Verdict = VoteKind | 'waiting';

export interface Friend {
  id: string;
  name: string;
  /** Avatar fill. Pale, so the ink initial reads on it. */
  tint: string;
}

export interface Vote {
  kind: VoteKind;
  emoji: string;
  note?: string;
}

export interface GroupState {
  /** The stops the vote is about. A plan edited since then starts a fresh vote. */
  planKey: string;
  joined: string[];
  /** placeId → friendId → vote. */
  votes: Record<string, Record<string, Vote>>;
  /** Friends voting on this phone: the script leaves them alone. */
  manual: string[];
  /** placeId → the place a swap would bring in, fixed when the vote starts. */
  swapFor: Record<string, string>;
  locked: boolean;
}

export const FRIENDS: Friend[] = [
  { id: 'riya', name: 'Riya', tint: '#F4CDB0' },
  { id: 'kabir', name: 'Kabir', tint: '#C3DDD6' },
  { id: 'meera', name: 'Meera', tint: '#DAD1F3' },
];
export const friend = (id: string) => FRIENDS.find((f) => f.id === id)!;

export const VOTE_EMOJI: Record<VoteKind, string[]> = {
  keep: ['😍', '🔥', '🙌', '👌', '✨'],
  swap: ['🤔', '🔁', '👀'],
  drop: ['😴', '🙅', '💤'],
};
export const QUICK_NOTES = ['Obsessed', 'Been there', 'Too early for me', 'Only if there’s food', 'Say less'];

/** Identifies which stops a vote was about. */
export const planKeyOf = (plan: TripPlan) => planStops(plan).map(({ stop }) => stop.place.id).join('|');

/** Every stop across every day, in plan order. */
export function planStops(plan: TripPlan) {
  return plan.days.flatMap((d, day) => d.stops.map((stop) => ({ stop, day })));
}

/**
 * What a swap would bring in for each stop: places the plan left out first, then local picks, then
 * the city's other places. Each candidate is offered once, so two stops never swap to the same place.
 */
export function swapCandidates(plan: TripPlan): Record<string, string> {
  const inPlan = new Set(planStops(plan).map(({ stop }) => stop.place.id));
  const pool: Place[] = [];
  const add = (p?: Place) => {
    if (p && !inPlan.has(p.id) && !plan.removed.includes(p.id) && !pool.some((q) => q.id === p.id)) pool.push(p);
  };
  plan.left.forEach(add);
  getLocalPicks(plan.cityId).forEach(add);
  Object.values(places)
    .filter((p) => p.cityId === plan.cityId)
    .forEach(add);

  const out: Record<string, string> = {};
  const stops = planStops(plan);
  // Later stops first: an evening swap reads more naturally than swapping the day's opener.
  for (let i = stops.length - 1; i >= 0 && pool.length; i--) {
    const { stop } = stops[i];
    // Like for like only: a meal for a meal, a stay for a stay, something to see for something to see.
    const j = pool.findIndex((p) => kindOf(p) === kindOf(stop.place));
    if (j >= 0) out[stop.place.id] = pool.splice(j, 1)[0].id;
  }
  return out;
}

const kindOf = (p: Place) => (p.type === 'food' || p.type === 'stay' ? p.type : 'see');

export type ScriptEvent =
  | { at: number; type: 'join'; friendId: string }
  | { at: number; type: 'vote'; friendId: string; placeId: string; vote: Vote };

// Pacing: friends drop in a beat apart, then votes land one at a time, stop by stop.
const JOIN_AT = [500, 1300, 2100];
const FIRST_VOTE = 2700;
const VOTE_GAP = 380;

/**
 * The scripted session. One stop is overruled: two friends want its swap (or, with nothing to swap
 * in, one friend would drop it and is outvoted). Everything else is kept, with the odd comment.
 */
export function scriptFor(plan: TripPlan, swapFor: Record<string, string>): ScriptEvent[] {
  const stops = planStops(plan).map(({ stop }) => stop.place);
  const rand = seeded(plan.seed + stops.length * 31);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

  // The overruled stop: the latest one that has a swap.
  const contested = [...stops].reverse().find((p) => swapFor[p.id]);
  // With no swap anywhere, someone grumbles about the earliest stop instead.
  const grumble = contested ? undefined : stops[0];

  const events: ScriptEvent[] = FRIENDS.map((f, i) => ({ at: JOIN_AT[i], type: 'join', friendId: f.id }));
  let at = FIRST_VOTE;
  stops.forEach((place) => {
    FRIENDS.forEach((f, fi) => {
      let vote: Vote;
      if (place.id === contested?.id && fi < 2) {
        const swapName = getPlace(swapFor[place.id])?.name ?? 'something else';
        vote =
          fi === 0
            ? { kind: 'swap', emoji: '🤔', note: `What about ${swapName}?` }
            : { kind: 'swap', emoji: '🔁', note: 'Riya’s right' };
      } else if (place.id === grumble?.id && fi === 2) {
        vote = { kind: 'drop', emoji: '😴', note: 'Too early for me' };
      } else {
        vote = { kind: 'keep', emoji: pick(VOTE_EMOJI.keep), note: rand() < 0.3 ? keepNote(place, pick) : undefined };
      }
      events.push({ at, type: 'vote', friendId: f.id, placeId: place.id, vote });
      at += VOTE_GAP;
    });
  });
  return events;
}

function keepNote(place: Place, pick: <T>(xs: T[]) => T) {
  if (place.type === 'food') return pick(['Say less', 'Saving room for this', 'Only if there’s dessert']);
  if (place.bestTime === 'evening') return pick(['Sunset, yes', 'Golden hour ✨']);
  return pick(['Obsessed', 'Been wanting to go', 'I’m in']);
}

/** A stop is decided once every friend has voted: two of a kind wins; a three-way split keeps it. */
export function verdictOf(votes: Record<string, Vote> | undefined): Verdict {
  const all = Object.values(votes ?? {});
  if (all.length < FRIENDS.length) return 'waiting';
  const count = (k: VoteKind) => all.filter((v) => v.kind === k).length;
  if (count('swap') >= 2) return 'swap';
  if (count('drop') >= 2) return 'drop';
  return 'keep';
}

export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
