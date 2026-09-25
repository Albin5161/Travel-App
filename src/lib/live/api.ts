import type { Vote, VoteKind } from '@/data/group';
import type { Party, TripPlan } from '@/data/planner';

import { ensureUser, supabase } from './client';
import { fromWire, toWire, type WirePlan } from './wire';

// Every call the app makes to the shared backend. Screens never talk to Supabase directly; they
// go through the store, and LiveTrip (src/state/live.tsx) turns what arrives into the same actions
// the scripted demo dispatches.

export interface TripRow {
  id: string;
  code: string;
  city_id: string;
  owner: string;
  party: Party;
  plan: WirePlan;
  swap_for: Record<string, string>;
  locked: boolean;
}
export interface MemberRow {
  trip_id: string;
  user_id: string;
  name: string;
  tint: string;
}
export interface VoteRow {
  trip_id: string;
  place_id: string;
  user_id: string;
  kind: VoteKind;
  emoji: string;
  note: string | null;
}

// Tints handed out as people join, so each person keeps one colour on every phone.
export const TINTS = ['#F4CDB0', '#C3DDD6', '#DAD1F3', '#F3D6DF', '#CFDCC4', '#F6E3B4'];

function db() {
  if (!supabase) throw new Error('Live trips need the Supabase keys in .env.local');
  return supabase;
}

export async function createTrip(input: { plan: TripPlan; party: Party; swapFor: Record<string, string>; name: string }) {
  await ensureUser();
  const { data, error } = await db().rpc('create_trip', {
    p_city_id: input.plan.cityId,
    p_party: input.party,
    p_plan: toWire(input.plan),
    p_swap_for: input.swapFor,
    p_name: input.name,
    p_tint: '#E5E1DA',
  });
  if (error) throw error;
  return data as TripRow;
}

export async function joinTrip(code: string, name: string) {
  await ensureUser();
  // A tint by how many are already in, so people are easy to tell apart.
  const { data, error } = await db().rpc('join_trip', { p_code: code, p_name: name, p_tint: TINTS[Math.floor(Math.random() * TINTS.length)] });
  if (error) throw error;
  return data as TripRow;
}

export async function loadTrip(tripId: string) {
  const [trip, members, votes] = await Promise.all([
    db().from('trips').select('*').eq('id', tripId).single(),
    db().from('members').select('*').eq('trip_id', tripId).order('joined_at'),
    db().from('votes').select('*').eq('trip_id', tripId),
  ]);
  if (trip.error) throw trip.error;
  return { trip: trip.data as TripRow, members: (members.data ?? []) as MemberRow[], votes: (votes.data ?? []) as VoteRow[] };
}

export async function castVote(tripId: string, placeId: string, vote: Vote) {
  const user = await ensureUser();
  const { error } = await db()
    .from('votes')
    .upsert({ trip_id: tripId, place_id: placeId, user_id: user, kind: vote.kind, emoji: vote.emoji, note: vote.note ?? null });
  if (error) throw error;
}

export async function savePlan(tripId: string, plan: TripPlan, locked?: boolean) {
  const { error } = await db()
    .from('trips')
    .update({ plan: toWire(plan), ...(locked !== undefined ? { locked } : {}) })
    .eq('id', tripId);
  if (error) throw error;
}

type Handlers = {
  trip: (row: TripRow) => void;
  member: (row: MemberRow) => void;
  vote: (row: VoteRow) => void;
  /**
   * The database is now streaming changes. Supabase says "subscribed" a moment before it really is,
   * and anything saved in between isn't sent, so this is the cue to fetch once and close the gap.
   * It fires again after a reconnect, for the same reason.
   */
  ready: () => void;
};

/** Joins, votes and plan edits on one trip, as they happen. Returns a function that stops listening. */
export function watchTrip(tripId: string, on: Handlers) {
  const channel = db()
    .channel(`trip:${tripId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, (p) =>
      on.trip(p.new as TripRow),
    )
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'members', filter: `trip_id=eq.${tripId}` }, (p) =>
      on.member(p.new as MemberRow),
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `trip_id=eq.${tripId}` }, (p) => {
      if (p.eventType !== 'DELETE') on.vote(p.new as VoteRow);
    })
    .on('system', {}, (p: { extension?: string; status?: string }) => {
      if (p.extension === 'postgres_changes' && p.status === 'ok') on.ready();
    })
    .subscribe();
  return () => {
    db().removeChannel(channel);
  };
}

export const planFromRow = (row: TripRow) => fromWire(row.plan);
export const voteFromRow = (row: VoteRow): Vote => ({ kind: row.kind, emoji: row.emoji, note: row.note ?? undefined });
