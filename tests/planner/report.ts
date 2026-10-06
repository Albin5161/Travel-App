// Reading a plan the way a person would, for the tests and for the before/after print-out: when
// each stop is, how long is spent waiting, and what was left out.
import type { TripPlan } from '@/data/planner';
import { formatClock } from '@/lib/geo';

export type Seen = {
  placed: number;
  left: number;
  /** The longest wait between leaving one stop (travel done) and starting the next, in minutes. */
  longestWait: number;
  /** Minutes on the road, all days. */
  travel: number;
  /** When the earliest and latest days start and the latest ends. */
  firstStart: number;
  latestEnd: number;
  days: { stops: number; start: number; end: number; wait: number; travel: number; span: number }[];
};

type AnyPlan = { days: (TripPlan['days'][number] | Omit<TripPlan['days'][number], 'sleep'>)[]; left: TripPlan['left']; leftWhy?: TripPlan['leftWhy'] };

export function look(plan: AnyPlan): Seen {
  const days = plan.days.map((d) => {
    let wait = 0;
    let travel = d.home?.minutes ?? 0;
    let prevEnd: number | null = null;
    d.stops.forEach((s) => {
      travel += s.legBefore?.minutes ?? 0;
      if (prevEnd !== null) wait = Math.max(wait, s.startMinutes - prevEnd - (s.legBefore?.minutes ?? 0));
      prevEnd = s.startMinutes + s.place.minutes;
    });
    const start = d.stops[0]?.startMinutes ?? 0;
    const end = (prevEnd ?? 0) + (d.home?.minutes ?? 0);
    return { stops: d.stops.length, start, end, wait, travel, span: end - start };
  });
  const full = days.filter((d) => d.stops > 0);
  return {
    placed: plan.days.reduce((n, d) => n + d.stops.filter((s) => !s.suggested).length, 0),
    left: plan.left.length,
    longestWait: Math.max(0, ...days.map((d) => d.wait)),
    travel: days.reduce((n, d) => n + d.travel, 0),
    firstStart: Math.min(...full.map((d) => d.start)),
    latestEnd: Math.max(0, ...full.map((d) => d.end)),
    days,
  };
}

const hm = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`);

export function print(plan: AnyPlan): string {
  const out: string[] = [];
  plan.days.forEach((d, i) => {
    const drive = !d.stops.length && d.home ? `  (travel day: ${hm(d.home.minutes)} on the road)` : '';
    out.push(`  Day ${i + 1}${d.stops.length ? '' : drive || '  (empty)'}${'sleep' in d && d.sleep ? `   → night in ${d.sleep.name}` : ''}`);
    let prevEnd: number | null = null;
    d.stops.forEach((s) => {
      const leg = s.legBefore?.minutes ?? 0;
      const wait = prevEnd === null ? 0 : s.startMinutes - prevEnd - leg;
      const tag = `${s.place.facts?.meal ?? s.place.type}/${s.place.facts?.window ?? s.place.bestTime}${s.suggested ? ', local pick' : ''}${s.pinned ? ', locked' : ''}`;
      out.push(
        `    ${formatClock(s.startMinutes).padStart(8)}  ${s.place.name.padEnd(30)} ${hm(s.place.minutes).padEnd(7)} ${tag.padEnd(26)}` +
          (leg ? ` travel ${hm(leg)}` : '') +
          (wait >= 30 ? `   ← waits ${hm(wait)}` : ''),
      );
      prevEnd = s.startMinutes + s.place.minutes;
    });
    if (d.home && d.stops.length) out.push(`              ${'sleep' in d && d.sleep ? `on to ${d.sleep.name}` : 'back'} ${hm(d.home.minutes)}, there by ${formatClock((prevEnd ?? 0) + d.home.minutes)}`);
  });
  if (plan.left.length) {
    out.push('  Not in this plan:');
    plan.left.forEach((p) => out.push(`    - ${p.name}: ${plan.leftWhy?.[p.id] ?? '(no reason given)'}`));
  }
  const s = look(plan);
  out.push(`  = ${s.placed} placed, ${s.left} left out, longest wait ${hm(s.longestWait)}, ${hm(s.travel)} on the road`);
  return out.join('\n');
}

/** A trip as a journey, day by day: where it starts, what's seen, how long on the road, where the night is spent. */
export function journey(plan: TripPlan): string {
  const base = plan.prefs.stay?.name ?? '(no base)';
  const out: string[] = [];
  let travel = 0;
  plan.days.forEach((d, i) => {
    const from = i === 0 ? base : (plan.nights?.[i - 1]?.name ?? base);
    const to = d.sleep?.name ?? base;
    const road = d.stops.reduce((n, s) => n + (s.legBefore?.minutes ?? 0), 0) + (d.home?.minutes ?? 0);
    travel += road;
    out.push(`  Day ${i + 1}`);
    out.push(`    Base:      ${from}`);
    out.push(`    Places:    ${d.stops.length ? d.stops.map((s) => `${s.place.name} ${formatClock(s.startMinutes)}`).join(' → ') : road ? '(none: a travel day)' : '(none)'}`);
    out.push(`    Travel:    ${road ? `about ${hm(road)}` : 'none'}`);
    out.push(`    Overnight: ${i === plan.days.length - 1 ? `${to} (trip ends)` : to}${to !== base ? '   ← away from the base' : ''}`);
  });
  const placed = plan.days.reduce((n, d) => n + d.stops.filter((s) => !s.suggested).length, 0);
  out.push(`  Included: ${placed}.  Left out: ${plan.left.length}.  On the road in all: about ${hm(travel)}.`);
  const away = (plan.nights ?? []).flatMap((n, k) => (n ? [`night ${k + 1} in ${n.name}`] : []));
  out.push(`  Nights away: ${away.length ? away.join(', ') : 'none'}.`);
  plan.left.forEach((p) => out.push(`    - ${p.name}: ${plan.leftWhy?.[p.id] ?? '(no reason given)'}`));
  return out.join('\n');
}
