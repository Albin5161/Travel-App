// Old planner and new, side by side, on every test trip:
//   npm run planner:compare
import { planNow, type PlannerInput } from '@/data/planner';
import { sunFor } from '@/data/planner/schedule';
import { formatClock } from '@/lib/geo';

import { fortKochiStay, foodHeavy, gokarna, kochi, ladakh, leh, mumbai, prefs, sparse } from './fixtures';
import { planNow as planBefore } from './legacy';
import { print } from './report';

const cases: { title: string; input: Omit<PlannerInput, 'cityId' | 'suggestions' | 'seed'> }[] = [
  { title: 'Gokarna, 1 day, balanced', input: { saved: gokarna, prefs: prefs(), pins: [], removed: [] } },
  { title: 'Gokarna, 2 days, balanced', input: { saved: gokarna, prefs: prefs({ days: 2 }), pins: [], removed: [] } },
  { title: 'Gokarna, 1 day, relaxed (can’t fit all)', input: { saved: gokarna, prefs: prefs({ pace: 'relaxed' }), pins: [], removed: [] } },
  { title: 'Kochi, 2 days, balanced', input: { saved: kochi, prefs: prefs({ days: 2 }), pins: [], removed: [] } },
  { title: 'Kochi, 2 days, staying in Fort Kochi', input: { saved: kochi, prefs: prefs({ days: 2, stay: fortKochiStay }), pins: [], removed: [] } },
  { title: 'Ladakh, 4 days, own vehicle, staying in Leh', input: { saved: ladakh, prefs: prefs({ days: 4, getting: 'drive', terrain: 'mountain', stay: leh }), pins: [], removed: [] } },
  { title: 'Mumbai, 3 days, balanced', input: { saved: mumbai, prefs: prefs({ days: 3 }), pins: [], removed: [] } },
  { title: 'Old Delhi (food-heavy), 2 days', input: { saved: foodHeavy, prefs: prefs({ days: 2 }), pins: [], removed: [] } },
  { title: 'Two far-apart places (sparse), 1 day, own vehicle', input: { saved: sparse, prefs: prefs({ getting: 'drive' }), pins: [], removed: [] } },
  {
    title: 'Kochi, 2 days, Lulu Mall locked to Day 1, Marine Drive removed',
    input: { saved: kochi, prefs: prefs({ days: 2 }), pins: [{ placeId: kochi[7].id, day: 0 }], removed: [kochi[6].id] },
  },
];

for (const c of cases) {
  const input: PlannerInput = { cityId: 'test', suggestions: [], seed: 1, ...c.input };
  const at = input.prefs.stay?.coords ?? input.saved[0].coords;
  console.log(`\n${'='.repeat(100)}\n${c.title}   (sunset ${formatClock(sunFor(at, input.prefs.start).sunset)})\n${'='.repeat(100)}`);
  console.log(' BEFORE');
  console.log(print(planBefore(input)));
  console.log(' AFTER');
  const t0 = performance.now();
  const after = planNow(input);
  console.log(print(after));
  console.log(`  (planned in ${Math.round(performance.now() - t0)} ms)`);
}
