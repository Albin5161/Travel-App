import { planNow } from '@/data/planner';
import { facts, ladakh, leh, prefs } from './fixtures';
import { print } from './report';
for (const pace of ['balanced', 'packed'] as const) {
  const input = { cityId: 't', saved: facts.ladakh, suggestions: [], prefs: prefs({ days: 4, pace, getting: 'drive' as const, terrain: 'mountain' as const, stay: leh }), pins: [], removed: [], seed: 1 };
  const t0 = performance.now();
  const base = planNow(input);
  console.log(`\n${pace}: offer after ${Math.round(performance.now() - t0)} ms →`, base.offer ? `${base.offer.title}\n   ${base.offer.reason}\n   nights: ${base.offer.nights.map((n) => n?.name ?? 'Leh').join(' / ')}` : 'none');
  if (base.offer) {
    const next = planNow({ ...input, nights: base.offer.nights });
    console.log(print(next));
    next.days.forEach((d, i) => console.log(`   day ${i + 1} sleeps: ${d.sleep?.name ?? 'Leh'}; last leg ${d.home?.minutes ?? '-'} min`));
  }
}
void ladakh;
