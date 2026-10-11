import { deviceStorage } from '@/lib/live/storage';

// What this phone has changed on a shared trip and not yet managed to save for everyone: which
// stops' votes, and whether the plan itself. Only the names are kept; the vote or plan to send is
// whatever the phone holds when it's sent, so a second change before the first got through sends
// once, as the latest. Kept on the phone, so closing the app with no signal loses nothing.

type Unsent = { votes: string[]; plan: boolean };
type All = Record<string, Unsent>;

const KEY = 'xplore.unsent';
const NONE: Unsent = { votes: [], plan: false };

function read(): All {
  try {
    return JSON.parse(deviceStorage?.getItem(KEY) ?? '{}') as All;
  } catch {
    return {};
  }
}

let all: All = read();
// Trips where a save has actually failed, as against one that is on its way right now. Anything
// found waiting when the app opens was left by a failure.
const stuck = new Set(Object.keys(all));
const listeners = new Set<() => void>();

function write(tripId: string, next: Unsent) {
  const rest = { ...all };
  delete rest[tripId];
  all = next.votes.length || next.plan ? { ...rest, [tripId]: next } : rest;
  if (!all[tripId]) stuck.delete(tripId);
  try {
    deviceStorage?.setItem(KEY, JSON.stringify(all));
  } catch {
    // No storage: it still holds for as long as the app is open.
  }
  listeners.forEach((l) => l());
}

export const unsent = {
  of: (tripId: string): Unsent => all[tripId] ?? NONE,
  /** How many changes a failed save has left waiting: each vote, and the plan as one. */
  stuck: (tripId: string) => {
    const u = all[tripId];
    return u && stuck.has(tripId) ? u.votes.length + (u.plan ? 1 : 0) : 0;
  },
  /** A save didn't get through: what's waiting for this trip is now worth telling the person about. */
  failed: (tripId: string) => {
    if (!all[tripId] || stuck.has(tripId)) return;
    stuck.add(tripId);
    listeners.forEach((l) => l());
  },
  addVote: (tripId: string, placeId: string) => {
    const u = all[tripId] ?? NONE;
    if (!u.votes.includes(placeId)) write(tripId, { ...u, votes: [...u.votes, placeId] });
  },
  clearVote: (tripId: string, placeId: string) => {
    const u = all[tripId] ?? NONE;
    if (u.votes.includes(placeId)) write(tripId, { ...u, votes: u.votes.filter((id) => id !== placeId) });
  },
  setPlan: (tripId: string, waiting: boolean) => {
    const u = all[tripId] ?? NONE;
    if (u.plan !== waiting) write(tripId, { ...u, plan: waiting });
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
