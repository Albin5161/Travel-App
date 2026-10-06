// Three planners side by side on every test trip:
//   npm run planner:compare
// OLD      the planner before October 2026 (tests/planner/legacy.ts)
// PLAIN    today's planner on places as they were saved before (no Gemini facts)
// FACTS    today's planner on the same places with Gemini's recorded facts (gemini-facts.json)
import { planNow, type PlannerInput } from '@/data/planner';
import { kindOf, sunFor } from '@/data/planner/schedule';
import type { Place } from '@/data/types';
import { formatClock } from '@/lib/geo';

import { facts, foodHeavy, gokarna, kochi, ladakh, leh, mumbai, prefs } from './fixtures';
import { planNow as planBefore } from './legacy';
import { print } from './report';

type Case = { title: string; plain: Place[]; rich: Place[]; over: Partial<PlannerInput> };
const pick = (list: Place[], name: string) => list.find((p) => p.name.startsWith(name))!.id;
const ladakhPrefs = prefs({ days: 4, getting: 'drive', terrain: 'mountain', stay: leh });

const cases: Case[] = [
  { title: 'Gokarna, 1 day', plain: gokarna, rich: facts.gokarna, over: {} },
  { title: 'Gokarna, 2 days', plain: gokarna, rich: facts.gokarna, over: { prefs: prefs({ days: 2 }) } },
  { title: 'Kochi, 1 day', plain: kochi, rich: facts.kochi, over: {} },
  { title: 'Kochi, 2 days', plain: kochi, rich: facts.kochi, over: { prefs: prefs({ days: 2 }) } },
  { title: 'Ladakh, 4 days, own vehicle, staying in Leh', plain: ladakh, rich: facts.ladakh, over: { prefs: ladakhPrefs } },
  { title: 'Mumbai, 3 days', plain: mumbai, rich: facts.mumbai, over: { prefs: prefs({ days: 3 }) } },
  { title: 'Old Delhi (food-heavy), 2 days', plain: foodHeavy, rich: facts.foodHeavy, over: { prefs: prefs({ days: 2 }) } },
  { title: 'Kochi, 2 days, Lulu Mall locked to Day 1, Marine Drive removed', plain: kochi, rich: facts.kochi, over: { prefs: prefs({ days: 2 }) } },
];

const only = process.argv[2];
for (const c of cases) {
  if (only && !c.title.toLowerCase().includes(only.toLowerCase())) continue;
  const locked = c.title.includes('locked');
  const input = (saved: Place[]): PlannerInput => ({
    cityId: 'test',
    saved,
    suggestions: [],
    prefs: prefs(),
    seed: 1,
    pins: locked ? [{ placeId: pick(saved, 'Lulu'), day: 0 }] : [],
    removed: locked ? [pick(saved, 'Marine Drive')] : [],
    ...c.over,
  });
  const at = input(c.plain).prefs.stay?.coords ?? c.plain[0].coords;
  console.log(`\n${'='.repeat(104)}\n${c.title}   (14 Nov 2026, balanced, sunset ${formatClock(sunFor(at, input(c.plain).prefs.start).sunset)})\n${'='.repeat(104)}`);
  console.log(' OLD');
  console.log(print(planBefore(input(c.plain))));
  console.log(' PLAIN (no Gemini facts)');
  console.log(print(planNow(input(c.plain))));
  console.log(' FACTS (with Gemini facts)');
  console.log(print(planNow(input(c.rich))));
  if (!c.title.includes('2 days') && !locked) {
    console.log(' How each place is read (name → without facts → with Gemini’s facts):');
    c.plain.forEach((p, i) => {
      const r = c.rich[i];
      const f = r.facts;
      const said = f ? [f.meal, f.window, f.sunset && 'sunset✓', f.sunrise && 'sunrise✓', f.night && 'night✓'].filter(Boolean).join(', ') : 'nothing';
      console.log(`    ${p.name.padEnd(30)} ${`${kindOf(p)}/${p.bestTime}`.padEnd(22)} → ${`${kindOf(r)}/${r.bestTime}`.padEnd(22)} (Gemini: ${said})`);
    });
  }
}
