// Every set of nights the offer could propose for a trip, scored: npm run planner:probe (a debugging aid).
import { build } from '@/data/planner/build';
import { candidates } from '@/data/planner/nights';
import { facts, leh, prefs } from './fixtures';

for (const pace of ['balanced', 'packed'] as const) {
  const p = prefs({ days: 4, pace, getting: 'drive', terrain: 'mountain', stay: leh });
  const input = { pool: facts.ladakh, suggestions: [], prefs: p, pins: new Map<string, number>(), seed: 1 };
  const plan = build(input);
  console.log(`\n${pace}: from the base alone ${Math.round(plan.cost)}`);
  const show = (b: typeof plan) => b.days.map((d) => `[${d.order.map((i) => facts.ladakh[i].name.split(' ')[0]).join(',')} ${Math.round(d.travel)}m/${Math.round(d.workload)}]`).join(' ');
  console.log('   ', show(plan));
  const t0 = performance.now();
  const all = candidates(input, plan).sort((a, b) => a.score - b.score);
  console.log(`  ${all.length} candidates in ${Math.round(performance.now() - t0)} ms`);
  for (const c of all) console.log(`  ${String(Math.round(c.score)).padStart(6)} (trip ${Math.round(c.built.cost)}) ${c.pattern.map((x) => x?.night.name ?? '-').join(' / ').padEnd(40)} ${show(c.built)}`);
}
