// Mock API. Shaped like the real one so a backend can replace it without touching screens.
import { cities, localPicks, places, reels } from './catalog';
import type { City, Extraction, Place, Platform, Reel } from './types';

// Long enough for the loader to show every stage of what extraction really does.
const LATENCY_MS = 2800;

export function detectPlatform(input: string): Platform | null {
  const url = input.trim().toLowerCase();
  if (/(^|\/\/|\.)(instagram\.com|instagr\.am)\//.test(url)) return 'instagram';
  if (/(^|\/\/|\.)(youtube\.com|youtu\.be)\//.test(url)) return 'youtube';
  return null;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function reelForLink(url: string): Reel {
  const u = url.toLowerCase();
  if (u.includes('kottayam')) return reels['reel-kottayam'];
  if (u.includes('kochi')) return reels['reel-kochi'];
  if (u.includes('meghalaya') || u.includes('shillong') || u.includes('dawki')) return reels['reel-meghalaya'];
  if (u.includes('gokarna')) return reels['reel-gokarna'];
  const order = ['reel-kottayam', 'reel-gokarna', 'reel-kochi', 'reel-meghalaya'];
  return reels[order[hash(url) % order.length]];
}

/**
 * Demo links, one per sample video, shaped like the real thing so platform detection stays honest:
 * the YouTube one reads as YouTube, the reels as Instagram. Home offers them one at a time.
 */
export const EXAMPLE_LINKS: { cityId: string; url: string }[] = [
  { cityId: 'kochi', url: 'https://www.instagram.com/reel/slowdays-kochi/' },
  { cityId: 'kottayam', url: 'https://www.instagram.com/reel/kottayam-diaries/' },
  { cityId: 'gokarna', url: 'https://youtu.be/gokarna-in-48-hours' },
  { cityId: 'meghalaya', url: 'https://www.instagram.com/reel/meghalaya-4-stops/' },
];

/** Title, creator and thumbnail. Fast, like an oEmbed lookup. */
export async function getLinkPreview(url: string): Promise<Reel> {
  await new Promise((r) => setTimeout(r, 250));
  return reelForLink(url);
}

export async function extractPlaces(url: string): Promise<Extraction> {
  await new Promise((r) => setTimeout(r, LATENCY_MS));
  const reel = reelForLink(url);
  return {
    reel,
    city: cities[reel.cityId],
    places: reel.placeIds.map((id) => places[id]),
  };
}

export const getCity = (id: string): City | undefined => cities[id];

/**
 * The line under a city's name. District and state, minus whichever of them just repeats the name
 * (Meghalaya is both a state and, here, the city).
 */
export function cityPlaceLine(city: City): string {
  return [city.district, city.state].filter((part, i, all) => part !== city.name && all.indexOf(part) === i).join(' · ');
}
export const getPlace = (id: string): Place | undefined => places[id];
export const getReel = (id: string): Reel | undefined => reels[id];
export const getLocalPicks = (cityId: string): Place[] => (localPicks[cityId] ?? []).map((id) => places[id]);
