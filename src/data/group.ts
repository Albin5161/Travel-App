// Group vote: the people on the trip go through the plan stop by stop and keep, swap or drop each
// one. There's no backend, so they and their votes are scripted from the plan itself (the same plan
// always plays out the same way). Who they are depends on who's going: friends, family or a partner.
// Anyone can also vote on this phone as one of them ("pass the phone"); those votes replace that
// person's scripted ones.
import { getLocalPicks, getPlace } from './api';
import { places } from './catalog';
import type { Party, TripPlan } from './planner';
import type { Place } from './types';

export type VoteKind = 'keep' | 'swap' | 'drop';
export type Verdict = VoteKind | 'waiting';
/** A party that votes: everyone but solo. */
export type Group = Exclude<Party, 'solo'>;

export interface Member {
  id: string;
  name: string;
  /** Avatar fill. Pale, so the ink initial reads on it. */
  tint: string;
  /** Shown instead of the initial: Amma, Appa and Ammu would otherwise all be "A". */
  face?: string;
  /** Things only this person would say about a stop they're keeping. */
  lines?: string[];
}

export interface Vote {
  kind: VoteKind;
  emoji: string;
  note?: string;
}

export interface GroupState {
  /** The stops the vote is about. A plan edited since then starts a fresh vote. */
  planKey: string;
  party: Group;
  joined: string[];
  /** placeId → memberId → vote. */
  votes: Record<string, Record<string, Vote>>;
  /** People voting on this phone: the script leaves them alone. */
  manual: string[];
  /** placeId → the place a swap would bring in, fixed when the vote starts. */
  swapFor: Record<string, string>;
  /** The agreement has been celebrated (confetti plays once, whenever you first see it). */
  cheered: boolean;
  locked: boolean;
}

const PEOPLE: Record<Group, Member[]> = {
  friends: [
    { id: 'riya', name: 'Riya', tint: '#F4CDB0' },
    { id: 'kabir', name: 'Kabir', tint: '#C3DDD6' },
    { id: 'meera', name: 'Meera', tint: '#DAD1F3' },
  ],
  family: [
    { id: 'amma', name: 'Amma', tint: '#F6D3C4', face: '👩🏽', lines: ['Carry an umbrella', 'Eat something first', 'Not too late, okay?'] },
    { id: 'appa', name: 'Appa', tint: '#CFDCC4', face: '👨🏽‍🦳', lines: ['Is there parking?', 'How much is the ticket?', 'Leave early, beat the traffic'] },
    { id: 'ammu', name: 'Ammu', tint: '#D7D3F4', face: '👧🏽', lines: ['Photos here 📸', 'Finally!!', 'Reels spot, trust me'] },
  ],
  partner: [
    { id: 'arya', name: 'Arya', tint: '#F3D6DF', lines: ['Date spot ✨', 'Only if we get chai after', 'Sunset here, please', 'Comfy shoes for this one'] },
  ],
};

export const membersOf = (party: Party): Member[] => (party === 'solo' ? [] : PEOPLE[party]);
export const member = (id: string): Member =>
  Object.values(PEOPLE)
    .flat()
    .find((m) => m.id === id)!;

/** Words that change with who's voting. */
export const PARTY_COPY: Record<Party, { share: string; see: string; ask: string; agreed: string; vote: string; waiting: string }> = {
  solo: { share: 'Share', see: '', ask: '', agreed: '', vote: '', waiting: '' },
  partner: {
    share: 'Share with your partner',
    see: 'See what Arya thinks',
    ask: 'Do you two\nagree?',
    agreed: 'You’re both in',
    vote: 'your vote',
    waiting: 'Waiting for Arya…',
  },
  friends: {
    share: 'Share to group',
    see: 'See who’s voting',
    ask: 'Does the group\nagree?',
    agreed: 'Everyone’s in',
    vote: 'group vote',
    waiting: 'Waiting for friends…',
  },
  family: {
    share: 'Share with family',
    see: 'See who’s voting',
    ask: 'Does the family\nagree?',
    agreed: 'The family’s in',
    vote: 'family vote',
    waiting: 'Waiting for family…',
  },
};

/** "You + 3 friends", "You + Amma, Appa & Ammu", "You + Arya". `short` fits a card: "You + family". */
export function whoLine(party: Group, joined: string[], short = false) {
  if (short && party === 'family') return 'You + family';
  if (party === 'friends') return `You + ${joined.length} ${joined.length === 1 ? 'friend' : 'friends'}`;
  const names = joined.map((id) => member(id).name);
  return `You + ${names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names[0]}`;
}

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
  | { at: number; type: 'join'; memberId: string }
  | { at: number; type: 'vote'; memberId: string; placeId: string; vote: Vote };

// Pacing: a moment after sharing, people drop in a beat apart, then votes land one at a time.
const FIRST_JOIN = 1200;
const JOIN_GAP = 800;
const VOTE_GAP = 420;

/**
 * The scripted session. One stop is overruled: the majority wants its swap (or, with nothing to swap
 * in, one person would drop it and is outvoted). Everything else is kept, with the odd comment.
 */
export function scriptFor(plan: TripPlan, swapFor: Record<string, string>, members: Member[]): ScriptEvent[] {
  const stops = planStops(plan).map(({ stop }) => stop.place);
  const rand = seeded(plan.seed + stops.length * 31);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  // How many it takes to overrule: two of three, or the one partner.
  const majority = Math.floor(members.length / 2) + 1;

  // The overruled stop: the latest one that has a swap.
  const contested = [...stops].reverse().find((p) => swapFor[p.id]);
  // With no swap anywhere, someone grumbles about the earliest stop instead (never the partner:
  // one drop from them would carry it).
  const grumble = contested || members.length < 2 ? undefined : stops[0];

  // Nobody says the same thing twice: each person's lines are used up before any repeats.
  const said = new Map<string, Set<string>>();
  const fresh = (id: string, options: string[]) => {
    const used = said.get(id) ?? new Set<string>();
    const left = options.filter((o) => !used.has(o));
    if (!left.length) return undefined;
    const line = pick(left);
    said.set(id, used.add(line));
    return line;
  };

  const events: ScriptEvent[] = members.map((m, i) => ({ at: FIRST_JOIN + i * JOIN_GAP, type: 'join', memberId: m.id }));
  let at = FIRST_JOIN + members.length * JOIN_GAP + 400;
  stops.forEach((place) => {
    members.forEach((m, mi) => {
      let vote: Vote;
      if (place.id === contested?.id && mi < majority) {
        const swapName = getPlace(swapFor[place.id])?.name ?? 'something else';
        vote =
          mi === 0
            ? { kind: 'swap', emoji: '🤔', note: `What about ${swapName}?` }
            : { kind: 'swap', emoji: '🔁', note: `${members[0].name}’s right` };
      } else if (place.id === grumble?.id && mi === members.length - 1) {
        vote = { kind: 'drop', emoji: '😴', note: 'Too early for me' };
      } else {
        const note = rand() < 0.35 ? fresh(m.id, m.lines ?? keepNotes(place)) : undefined;
        vote = { kind: 'keep', emoji: pick(VOTE_EMOJI.keep), note };
      }
      events.push({ at, type: 'vote', memberId: m.id, placeId: place.id, vote });
      at += VOTE_GAP;
    });
  });
  return events;
}

function keepNotes(place: Place) {
  if (place.type === 'food') return ['Say less', 'Saving room for this', 'Only if there’s dessert'];
  if (place.bestTime === 'evening') return ['Sunset, yes', 'Golden hour ✨'];
  return ['Obsessed', 'Been wanting to go', 'I’m in'];
}

/**
 * A stop is decided once everyone has voted. A majority wins; with no majority (a three-way split),
 * the stop stays.
 */
export function verdictOf(votes: Record<string, Vote> | undefined, voters: number): Verdict {
  const all = Object.values(votes ?? {});
  if (voters === 0 || all.length < voters) return 'waiting';
  const majority = Math.floor(voters / 2) + 1;
  const count = (k: VoteKind) => all.filter((v) => v.kind === k).length;
  if (count('swap') >= majority) return 'swap';
  if (count('drop') >= majority) return 'drop';
  return 'keep';
}

export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
