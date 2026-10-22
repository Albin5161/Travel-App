import type { PinCard } from '@/components/mapPins';
import { costLabel } from '@/components/PlaceMeta';
import { getReel } from '@/data/api';
import type { Place } from '@/data/types';
import { formatDuration } from '@/lib/geo';

// What a place's pin and card on the Google map say, from what's already saved about it: no lookup,
// so nothing is paid for. Ratings aren't shown because we don't keep any.

// Words in a place's name that say what it is better than its kind does. First match wins.
const NAMED: [RegExp, string][] = [
  [/\b(bar|pub|brewery|taproom)\b/i, 'Bar'],
  [/\b(caf[eé]|coffee|roastery)\b/i, 'Cafe'],
  [/\b(beach)\b/i, 'Beach'],
  [/\b(temple|mandir|kovil|devasthan)/i, 'Temple'],
  [/\b(church|basilica|cathedral)\b/i, 'Church'],
  [/\b(mosque|masjid|dargah)\b/i, 'Mosque'],
  [/\b(fort|qila)\b/i, 'Fort'],
  [/\b(palace|mahal)\b/i, 'Palace'],
  [/\b(falls|waterfall)\b/i, 'Falls'],
  [/\b(lake|tal)\b/i, 'Lake'],
  [/\b(market|bazaar|bazar)\b/i, 'Market'],
  [/\b(museum|gallery)\b/i, 'Museum'],
  [/\b(park|garden|gardens)\b/i, 'Park'],
  [/\b(view ?point|peak|point|hill|top)\b/i, 'View'],
];

/** The sticker word: what kind of place, in one short word. */
export function kindWord(place: Place): string {
  const named = NAMED.find(([re]) => re.test(place.name));
  if (named) return named[1];
  if (place.type === 'food') {
    const meal = place.facts?.meal;
    if (meal === 'cafe') return 'Cafe';
    if (meal === 'dessert') return 'Sweets';
    if (meal === 'snack') return 'Snacks';
    return 'Food';
  }
  if (place.type === 'stay') return 'Stay';
  if (place.type === 'experience') return 'Activity';
  return 'Sight';
}

const BEST: Record<Place['bestTime'], string> = {
  morning: 'Best in the morning',
  afternoon: 'Best in the afternoon',
  evening: 'Best in the evening',
};

/** The card for a place. `stop` adds where it sits in a day's plan. */
export function pinCardOf(place: Place, stop?: { number: number; time: string }): PinCard {
  const facts: PinCard['facts'] = [];
  if (stop) facts.push({ icon: 'pin', text: `Stop ${stop.number} · ${stop.time}` });
  facts.push({ icon: 'clock', text: `${formatDuration(place.minutes)} there` });
  const cost = costLabel(place.cost);
  if (cost) facts.push({ icon: 'tag', text: cost === 'Free' ? 'Free to visit' : cost });
  facts.push({ icon: 'sun', text: place.facts?.window === 'sunset' ? 'Go for the sunset' : BEST[place.bestTime] });
  if (place.source.kind === 'reel') {
    const creator = getReel(place.source.reelId)?.creator;
    if (creator) facts.push({ icon: 'film', text: place.source.timestamp ? `From ${creator} · ${place.source.timestamp}` : `From ${creator}` });
  }
  return { kind: kindWord(place), area: place.area, line: place.why, facts };
}
