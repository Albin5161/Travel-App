// Joining this phone's saved copy with the one backed up to a Google account (lib/live/account).
// Kept apart from the sign-in so it can be tested on its own (tests/backup).

// The saved copy's shape is state/trips' business; here only the parts that merge are named.
export type SavedTrips = {
  collections?: Record<string, { cityId: string; placeIds: string[]; reelIds: string[]; addedAt: number }>;
  live?: { places?: { id: string }[]; cities?: { id: string }[]; reels?: { id: string }[]; placedAt?: Record<string, number> };
  [key: string]: unknown;
};

export const parse = (raw: string | null) => {
  try {
    return raw ? (JSON.parse(raw) as SavedTrips) : null;
  } catch {
    return null;
  }
};

const unique = <T,>(list: T[]) => [...new Set(list)];
const byId = <T extends { id: string }>(mine: T[] = [], theirs: T[] = []) => {
  const seen = new Set(mine.map((x) => x.id));
  return [...mine, ...theirs.filter((x) => !seen.has(x.id))];
};
/** Keys in order, all the way down, so two copies holding the same things compare equal. */
export const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v;

/**
 * This phone's copy and the account's, as one. Nothing is lost from either: every saved city keeps
 * the places and videos of both, and every plan, trip and vote of both is kept. Where both have the
 * same thing (a plan for the same city), this phone's wins, as the one in hand.
 */
export function mergeTrips(mine: SavedTrips | null, theirs: SavedTrips | null): SavedTrips | null {
  if (!theirs) return mine;
  if (!mine) return theirs;
  const collections = { ...(theirs.collections ?? {}) };
  for (const [id, c] of Object.entries(mine.collections ?? {})) {
    const t = collections[id];
    collections[id] = t ? { ...t, ...c, placeIds: unique([...c.placeIds, ...t.placeIds]), reelIds: unique([...c.reelIds, ...t.reelIds]), addedAt: Math.min(c.addedAt, t.addedAt) } : c;
  }
  // Lists of things by key, both sides' kept. A key neither side has stays absent: an empty one
  // added would make the merged copy look different from this phone's when it isn't.
  const out: SavedTrips = { ...mine, onboarded: !!(mine.onboarded || theirs.onboarded), collections };
  for (const k of ['skipped', 'addedLocals', 'savedTrips', 'tripPlans', 'groups', 'remote', 'spotStatus', 'recapped']) {
    if (k in mine || k in theirs) out[k] = { ...((theirs[k] as object) ?? {}), ...((mine[k] as object) ?? {}) };
  }
  return {
    ...out,
    live: {
      places: byId(mine.live?.places, theirs.live?.places),
      cities: byId(mine.live?.cities, theirs.live?.cities),
      reels: byId(mine.live?.reels, theirs.live?.reels),
      placedAt: { ...(theirs.live?.placedAt ?? {}), ...(mine.live?.placedAt ?? {}) },
    },
  };
}

