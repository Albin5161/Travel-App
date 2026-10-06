// Places for the planner's tests: real coordinates, with the kind, best time and visit length the
// app would hold for them. Made by hand so the tests need no network and no photos.
import type { TripPrefs } from '@/data/planner';
import type { DayPart, Place, PlaceFacts, PlaceType } from '@/data/types';

import recorded from './gemini-facts.json' with { type: 'json' };

let made = 0;
export function P(name: string, type: PlaceType, bestTime: DayPart, minutes: number, lat: number, lng: number, why = '', area = ''): Place {
  made++;
  return {
    id: `t${made}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    cityId: 'test',
    name,
    type,
    area,
    photo: 0,
    why,
    source: { kind: 'local' },
    bestTime,
    cost: null,
    minutes,
    coords: { lat, lng },
    map: [0, 0],
    order: made,
  };
}

export const prefs = (over: Partial<TripPrefs> = {}): TripPrefs => ({
  when: 'dates',
  // A fixed day, so sunset is the same every time the tests run.
  start: '2026-11-14',
  days: 1,
  pace: 'balanced',
  getting: 'local',
  terrain: 'flat',
  stay: null,
  ...over,
});

export const gokarna = [
  P('Mahabaleshwar Temple', 'sight', 'morning', 45, 14.5439, 74.3187, 'Gokarna’s ancient Shiva temple. Go early for the aarti and the quiet lanes.', 'Gokarna Town'),
  P('Gokarna Beach', 'sight', 'morning', 40, 14.5452, 74.316, 'Two minutes from the temple. Fishing boats, and a slow chai.', 'Gokarna Town'),
  P('Kudle Beach', 'sight', 'afternoon', 90, 14.5288, 74.3183, 'Wide, calm and easy to swim.', 'Kudle'),
  P('Strawberry Farms Café', 'food', 'afternoon', 60, 14.53, 74.318, 'The beach shack for a long lunch.', 'Kudle'),
  P('Paradise Beach', 'sight', 'afternoon', 75, 14.5086, 74.3225, 'The wildest of the five.', 'Cliff trail'),
  P('Half Moon Beach', 'sight', 'afternoon', 60, 14.514, 74.3235, 'Only reachable on foot or by boat.', 'Cliff trail'),
  P('Om Beach', 'sight', 'evening', 120, 14.5196, 74.3242, 'Walk the cliff path around 5pm. The sunset lights up the whole bay.', 'Om Beach'),
];

export const kochi = [
  P('Fort Kochi Street Art', 'experience', 'morning', 90, 9.9655, 76.2445, 'Lanes of murals. Best on foot, early.', 'Fort Kochi'),
  P('Jew Town, Mattancherry', 'sight', 'morning', 120, 9.9575, 76.2596, 'Antique shops and old spice warehouses. Go before noon.', 'Mattancherry'),
  P('Fort Kochi Jetty', 'experience', 'afternoon', 45, 9.969, 76.245, 'Take the ferry across the harbour.', 'Fort Kochi'),
  P('Fort Kochi Waterfront', 'sight', 'evening', 60, 9.967, 76.242, 'Watch the Chinese fishing nets hauled in at golden hour.', 'Fort Kochi'),
  P('Kashi Art Café', 'food', 'afternoon', 60, 9.9662, 76.2437, 'Breakfast and cake in a gallery courtyard.', 'Fort Kochi'),
  P('Seagull Restaurant', 'food', 'afternoon', 60, 9.9668, 76.2487, 'Seafood on a deck over the harbour.', 'Fort Kochi'),
  P('Marine Drive', 'sight', 'evening', 60, 9.9816, 76.2755, 'The evening walkway along the backwaters.', 'Ernakulam'),
  P('Lulu Mall', 'experience', 'afternoon', 120, 10.0271, 76.3081, 'One of India’s biggest malls.', 'Edappally'),
];

export const leh = { name: 'Leh', coords: { lat: 34.1526, lng: 77.5771 }, at: 0 };
export const ladakh = [
  P('Leh Palace', 'sight', 'morning', 60, 34.1663, 77.5868, 'The old royal palace over the town.', 'Leh'),
  P('Shanti Stupa', 'sight', 'evening', 45, 34.1737, 77.5746, 'Climb up for the sunset over Leh.', 'Leh'),
  P('Thiksey Monastery', 'sight', 'morning', 90, 34.0567, 77.6669, 'Morning prayers in a hilltop monastery.', 'Thiksey'),
  P('Pangong Lake', 'sight', 'morning', 180, 33.7595, 78.6674, 'The blue lake on the border.', 'Pangong'),
  P('Diskit Monastery', 'sight', 'morning', 90, 34.5413, 77.5607, 'The giant Maitreya above Nubra.', 'Nubra Valley'),
  P('Hunder Sand Dunes', 'experience', 'evening', 90, 34.5858, 77.4698, 'Double-humped camels on cold desert dunes.', 'Nubra Valley'),
  P('Khardung La', 'sight', 'morning', 20, 34.2787, 77.6047, 'One of the highest motorable passes.', 'Khardung La'),
  P('Magnetic Hill', 'sight', 'afternoon', 20, 34.1713, 77.3517, 'The road where cars seem to roll uphill.', 'Leh–Kargil road'),
];

export const mumbai = [
  P('Gateway of India', 'sight', 'morning', 45, 18.922, 72.8347, 'The arch on the harbour.', 'Colaba'),
  P('Elephanta Caves', 'sight', 'morning', 180, 18.9633, 72.9315, 'Rock-cut temples, an hour out by ferry.', 'Elephanta Island'),
  P('Colaba Causeway', 'experience', 'afternoon', 60, 18.915, 72.8258, 'Street shopping.', 'Colaba'),
  P('Leopold Cafe', 'food', 'afternoon', 60, 18.9227, 72.8316, 'The old Irani café everyone ends up at.', 'Colaba'),
  P('Chhatrapati Shivaji Terminus', 'sight', 'morning', 30, 18.9398, 72.8355, 'The Gothic railway station.', 'Fort'),
  P('Britannia & Co.', 'food', 'afternoon', 60, 18.9347, 72.84, 'Berry pulao at a Parsi institution. Lunch only.', 'Ballard Estate'),
  P('Marine Drive', 'sight', 'evening', 60, 18.944, 72.823, 'Sit on the sea wall for the sunset.', 'Marine Drive'),
  P('Haji Ali Dargah', 'sight', 'afternoon', 60, 18.9827, 72.8089, 'The mosque out in the sea.', 'Worli'),
  P('Bandra Bandstand', 'sight', 'evening', 60, 19.045, 72.819, 'The promenade at golden hour.', 'Bandra'),
  P('Juhu Beach', 'sight', 'evening', 75, 19.0988, 72.8267, 'Pav bhaji and the evening crowd.', 'Juhu'),
  P('Siddhivinayak Temple', 'sight', 'morning', 45, 19.017, 72.8302, 'Go early to beat the queue.', 'Prabhadevi'),
  P('Bademiya', 'food', 'evening', 45, 18.9234, 72.8322, 'Late-night kebabs behind the Taj.', 'Colaba'),
];

/** Old Delhi: more places to eat than to see. */
export const foodHeavy = [
  P('Red Fort', 'sight', 'morning', 120, 28.6562, 77.241, 'The Mughal fort.', 'Old Delhi'),
  P('Jama Masjid', 'sight', 'morning', 60, 28.6507, 77.2334, 'India’s largest mosque.', 'Old Delhi'),
  P('Chandni Chowk', 'experience', 'afternoon', 90, 28.6506, 77.2303, 'The old bazaar.', 'Old Delhi'),
  P('Paranthe Wali Gali', 'food', 'morning', 45, 28.6562, 77.2303, 'Stuffed parathas for breakfast.', 'Old Delhi'),
  P('Karim’s', 'food', 'evening', 60, 28.6494, 77.2337, 'Mughlai since 1913.', 'Old Delhi'),
  P('Al Jawahar', 'food', 'evening', 60, 28.6497, 77.2335, 'Next door to Karim’s, and as good.', 'Old Delhi'),
  P('Natraj Dahi Bhalle', 'food', 'afternoon', 30, 28.6565, 77.2296, 'Chaat at the corner.', 'Old Delhi'),
  P('Old Famous Jalebi Wala', 'food', 'afternoon', 20, 28.656, 77.2318, 'Hot jalebis.', 'Old Delhi'),
  P('Giani’s Di Hatti', 'food', 'afternoon', 30, 28.6577, 77.2227, 'Rabri falooda.', 'Old Delhi'),
  P('Indian Coffee House', 'food', 'afternoon', 45, 28.6328, 77.2197, 'Filter coffee on a terrace.', 'Connaught Place'),
];

/** Two places, and a long way between them. */
export const sparse = [
  P('Athirappilly Falls', 'sight', 'morning', 90, 10.2851, 76.5698, 'Kerala’s biggest waterfall.', 'Athirappilly'),
  P('Cherai Beach', 'sight', 'evening', 60, 10.1416, 76.1783, 'A quiet beach for the sunset.', 'Cherai'),
];

export const fortKochiStay = { name: 'Fort Kochi', coords: { lat: 9.9658, lng: 76.2421 }, at: 0 };

// ── The same places with Gemini's facts ─────────────────────────────────────────────────────────
// What the real model answered about each place (gemini-facts.json, recorded by record-facts.ts),
// put on the place the way the app does when a link is read: the finer facts, and the best part of
// the day worked out from the window. Visit lengths and kinds are left as above, so old against new
// differs only by the facts.

type Recorded = { window: PlaceFacts['window']; mealType: PlaceFacts['meal']; sunsetRelevant: boolean; sunriseRelevant: boolean; nightRelevant: boolean; parentArea: string | null; factsConfidence?: number | null };
const PART: Record<NonNullable<PlaceFacts['window']>, DayPart> = { early_morning: 'morning', morning: 'morning', afternoon: 'afternoon', sunset: 'evening', evening: 'evening', night: 'evening' };

export function withFacts(city: string, places: Place[]): Place[] {
  return places.map((p) => {
    const r = (recorded as Record<string, Recorded | undefined>)[`${city}: ${p.name}`];
    if (!r) return p;
    return {
      ...p,
      bestTime: r.window ? PART[r.window] : p.bestTime,
      facts: { meal: p.type === 'food' ? r.mealType : null, window: r.window, sunset: r.sunsetRelevant, sunrise: r.sunriseRelevant, night: r.nightRelevant, parentArea: r.parentArea, sure: r.factsConfidence ?? null },
    };
  });
}

export const facts = {
  gokarna: withFacts('Gokarna', gokarna),
  kochi: withFacts('Kochi', kochi),
  ladakh: withFacts('Ladakh', ladakh),
  mumbai: withFacts('Mumbai', mumbai),
  foodHeavy: withFacts('Old Delhi', foodHeavy),
  sparse: withFacts('Central Kerala', sparse),
};
