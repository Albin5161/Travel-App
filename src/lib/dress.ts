import { distanceKm, type LatLng } from '@/lib/geo';
import { deviceStorage } from '@/lib/live/storage';

// What Amma and the child wear (Albin, 30 Oct 2026: "if the link is related to north indian, can we
// have north indian dress instead of saree"). Six outfits, one per part of India. A video's places
// decide it once they're known; before that, the part of India you're in; failing both, the kasavu
// saree they started in.

export type Dress = 'south' | 'north' | 'west' | 'east' | 'northeast' | 'mountains';

const BY_STATE: Record<string, Dress> = {
  'andhra pradesh': 'south',
  karnataka: 'south',
  kerala: 'south',
  'tamil nadu': 'south',
  telangana: 'south',
  goa: 'south',
  puducherry: 'south',
  lakshadweep: 'south',
  'andaman and nicobar islands': 'south',
  bihar: 'north',
  chhattisgarh: 'north',
  haryana: 'north',
  jharkhand: 'north',
  'madhya pradesh': 'north',
  punjab: 'north',
  'uttar pradesh': 'north',
  delhi: 'north',
  chandigarh: 'north',
  gujarat: 'west',
  maharashtra: 'west',
  rajasthan: 'west',
  'dadra and nagar haveli and daman and diu': 'west',
  odisha: 'east',
  'west bengal': 'east',
  'arunachal pradesh': 'northeast',
  assam: 'northeast',
  manipur: 'northeast',
  meghalaya: 'northeast',
  mizoram: 'northeast',
  nagaland: 'northeast',
  sikkim: 'northeast',
  tripura: 'northeast',
  'himachal pradesh': 'mountains',
  uttarakhand: 'mountains',
  'jammu and kashmir': 'mountains',
  ladakh: 'mountains',
};
// Other spellings the place data comes back with (as in lib/patterns).
const ALSO: Record<string, string> = {
  orissa: 'odisha',
  uttaranchal: 'uttarakhand',
  pondicherry: 'puducherry',
  'nct of delhi': 'delhi',
  'national capital territory of delhi': 'delhi',
  'new delhi': 'delhi',
  'jammu & kashmir': 'jammu and kashmir',
};

/** The outfit for a state's name ("Uttar Pradesh"), or null for one we don't know (or abroad). */
export function dressOfState(state: string | null | undefined): Dress | null {
  if (!state) return null;
  const name = state.trim().toLowerCase();
  return BY_STATE[ALSO[name] ?? name] ?? null;
}

/** The outfit for a read video's region, "Mumbai, Maharashtra, India": its state is the second part. */
export function dressOfRegion(region: string | null | undefined): Dress | null {
  const parts = (region ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return dressOfState(parts[1]) ?? dressOfState(parts[0]);
}

// Roughly where each state's middle is: enough to tell which part of India a position is in, which
// is all the outfit needs. Worked out on the phone; the position goes nowhere.
const MIDDLES: [Dress, number, number][] = [
  ['south', 15.9, 79.7], ['south', 15.3, 75.7], ['south', 10.4, 76.3], ['south', 11.1, 78.7],
  ['south', 17.9, 79.0], ['south', 15.4, 74.0], ['south', 11.9, 79.8],
  ['north', 25.6, 85.6], ['north', 21.3, 81.9], ['north', 29.1, 76.1], ['north', 23.6, 85.3],
  ['north', 23.5, 78.6], ['north', 31.0, 75.4], ['north', 26.8, 80.9], ['north', 28.6, 77.2],
  // Chandigarh sits right under the hills, so it and the nearest hill towns (Shimla, Dharamshala)
  // have points of their own.
  ['north', 30.73, 76.78], ['mountains', 31.1, 77.17], ['mountains', 32.22, 76.32],
  ['west', 22.3, 71.2], ['west', 19.4, 75.7], ['west', 26.6, 73.8],
  ['east', 20.5, 84.4], ['east', 23.7, 87.8],
  ['northeast', 28.2, 94.7], ['northeast', 26.2, 92.9], ['northeast', 24.7, 93.9], ['northeast', 25.5, 91.4],
  ['northeast', 23.2, 92.9], ['northeast', 26.2, 94.6], ['northeast', 27.5, 88.5], ['northeast', 23.8, 91.6],
  ['mountains', 31.9, 77.1], ['mountains', 30.1, 79.2], ['mountains', 33.6, 75.0], ['mountains', 34.2, 77.6],
];

/** The outfit for where a position is in India; null outside India. */
export function dressNear(at: LatLng): Dress | null {
  if (at.lat < 6 || at.lat > 37.5 || at.lng < 68 || at.lng > 98) return null;
  let best: Dress | null = null;
  let bestKm = Infinity;
  for (const [dress, lat, lng] of MIDDLES) {
    const km = distanceKm(at, { lat, lng });
    if (km < bestKm) [best, bestKm] = [dress, km];
  }
  return best;
}

const KEY = 'xplore.dressHere';
const DRESSES = new Set<string>(['south', 'north', 'west', 'east', 'northeast', 'mountains']);

/** The outfit for where you were when the app last had your position, kept on the phone. */
export function dressHere(): Dress | null {
  try {
    const v = deviceStorage?.getItem(KEY);
    return v && DRESSES.has(v) ? (v as Dress) : null;
  } catch {
    return null;
  }
}

export function rememberDressHere(at: LatLng) {
  const dress = dressNear(at);
  try {
    if (dress) deviceStorage?.setItem(KEY, dress);
  } catch {
    // Storage full or blocked: the outfit just falls back.
  }
}

/** What they wear: the video's part of India if it's known, else yours, else the kasavu saree. */
export const dressFor = (video: Dress | null | undefined): Dress => video ?? dressHere() ?? 'south';
