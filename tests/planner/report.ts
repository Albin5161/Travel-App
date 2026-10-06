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

type AnyPlan = Pick<TripPlan, 'days' | 'left' | 'leftWhy'>;

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
    out.push(`  Day ${i + 1}${d.stops.length ? '' : '  (empty)'}`);
    let prevEnd: number | null = null;
    d.stops.forEach((s) => {
      const leg = s.legBefore?.minutes ?? 0;
      const wait = prevEnd === null ? 0 : s.startMinutes - prevEnd - leg;
      const tag = `${s.place.type}/${s.place.bestTime}${s.suggested ? ', local pick' : ''}${s.pinned ? ', locked' : ''}`;
      out.push(
        `    ${formatClock(s.startMinutes).padStart(8)}  ${s.place.name.padEnd(30)} ${hm(s.place.minutes).padEnd(7)} ${tag.padEnd(22)}` +
          (leg ? ` travel ${hm(leg)}` : '') +
          (wait >= 30 ? `   ← waits ${hm(wait)}` : ''),
      );
      prevEnd = s.startMinutes + s.place.minutes;
    });
    if (d.home && d.stops.length) out.push(`              back ${hm(d.home.minutes)}, home by ${formatClock((prevEnd ?? 0) + d.home.minutes)}`);
  });
  if (plan.left.length) {
    out.push('  Not in this plan:');
    plan.left.forEach((p) => out.push(`    - ${p.name}: ${plan.leftWhy?.[p.id] ?? '(no reason given)'}`));
  }
  const s = look(plan);
  out.push(`  = ${s.placed} placed, ${s.left} left out, longest wait ${hm(s.longestWait)}, ${hm(s.travel)} on the road`);
  return out.join('\n');
}
