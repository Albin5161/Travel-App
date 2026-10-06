/// <reference types="node" />
// The planner, checked on real trips: npm run test:planner
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addCustomStop, moveToDay, pinsOf, planNow, removeStop, reorder, togglePin, type PlannerInput, type TripPlan } from '@/data/planner';
import { ceilingMinutes, kindOf, LATEST_END, LUNCH_WINDOW, DINNER_WINDOW, roadLimit, sunFor } from '@/data/planner/schedule';
import type { Place } from '@/data/types';
import { sunTimes } from '@/lib/sun';

import { fortKochiStay, foodHeavy, gokarna, kochi, ladakh, leh, mumbai, P, prefs, sparse } from './fixtures';
import { look } from './report';

const plan = (saved: Place[], over: Partial<PlannerInput> = {}): TripPlan =>
  planNow({ cityId: 'test', saved, suggestions: [], prefs: prefs(), pins: [], removed: [], seed: 1, ...over });

const stopsOf = (p: TripPlan) => p.days.flatMap((d, day) => d.stops.map((s) => ({ ...s, day })));
const find = (p: TripPlan, name: string) => stopsOf(p).find((s) => s.place.name.startsWith(name));
const sunsetAt = (p: TripPlan) => sunFor(p.prefs.stay?.coords ?? stopsOf(p)[0].place.coords, p.prefs.start).sunset;

/** The longest wait in the plan that isn't an evening off before dinner. */
function longestHole(p: TripPlan) {
  let worst = 0;
  p.days.forEach((d) => {
    d.stops.forEach((s, i) => {
      if (i === 0) return;
      const prev = d.stops[i - 1];
      const wait = s.startMinutes - (prev.startMinutes + prev.place.minutes) - (s.legBefore?.minutes ?? 0);
      const dinner = s.place.type === 'food' && s.startMinutes >= DINNER_WINDOW[0] - 5;
      if (!dinner) worst = Math.max(worst, wait);
    });
  });
  return worst;
}

/** Every day inside the pace's hours, its latest end and its time on the road. Locked days are the traveller's own. */
function assertWithinLimits(p: TripPlan) {
  const pace = p.prefs.pace;
  p.days.forEach((d, i) => {
    if (d.stops.length === 0 || d.stops.some((s) => s.pinned)) return;
    const travel = d.stops.reduce((n, s) => n + (s.legBefore?.minutes ?? 0), 0) + (d.home?.minutes ?? 0);
    const doing = d.stops.reduce((n, s) => n + (s.place.type === 'food' ? s.place.minutes / 2 : s.place.minutes), 0);
    const last = d.stops[d.stops.length - 1];
    const end = last.startMinutes + last.place.minutes + (d.home?.minutes ?? 0);
    assert.ok(doing + travel <= ceilingMinutes(pace) + 1, `Day ${i + 1} asks ${Math.round(doing + travel)} min, over the ${pace} ceiling`);
    assert.ok(end <= LATEST_END[pace] + 5, `Day ${i + 1} ends at ${end}, past the ${pace} latest end`);
    assert.ok(travel <= roadLimit(pace) + 1, `Day ${i + 1} has ${travel} min on the road`);
    d.stops.forEach((s, k) => k > 0 && assert.ok(s.startMinutes >= d.stops[k - 1].startMinutes + d.stops[k - 1].place.minutes, 'stops overlap'));
  });
}

/** The sun goes down while you're at the place. */
function assertCoversSunset(p: TripPlan, name: string) {
  const s = find(p, name);
  assert.ok(s, `${name} is in the plan`);
  const sunset = sunsetAt(p);
  assert.ok(s.startMinutes <= sunset - 15 && s.startMinutes + s.place.minutes >= sunset, `${name} at ${s.startMinutes}–${s.startMinutes + s.place.minutes}, sunset ${sunset}`);
}

test('sunset comes from the app’s own sun: Kochi in mid-November sets about 6 PM', () => {
  const sun = sunTimes({ lat: 9.96, lng: 76.24 }, { y: 2026, m: 11, d: 14 }, 330);
  assert.ok(sun && Math.abs(sun.sunset - (18 * 60 + 1)) <= 8, `sunset ${sun?.sunset}`);
  assert.ok(sun && Math.abs(sun.sunrise - (6 * 60 + 17)) <= 8, `sunrise ${sun?.sunrise}`);
});

test('Gokarna, one balanced day: seven places within 4 km all fit, lunch at lunchtime, Om Beach at sunset', () => {
  const p = plan(gokarna);
  assert.equal(look(p).placed, 7);
  assert.equal(p.left.length, 0);
  assertWithinLimits(p);
  assertCoversSunset(p, 'Om Beach');
  const cafe = find(p, 'Strawberry')!;
  assert.ok(cafe.startMinutes >= LUNCH_WINDOW[0] && cafe.startMinutes <= LUNCH_WINDOW[1], `café at ${cafe.startMinutes}`);
  assert.ok(longestHole(p) <= 60, `a ${longestHole(p)} min hole`);
  assert.ok(look(p).firstStart <= 9 * 60, 'the day starts in the morning');
});

test('Gokarna, two days: no six-hour wait for the sunset', () => {
  const p = plan(gokarna, { prefs: prefs({ days: 2 }) });
  assert.equal(p.left.length, 0);
  assertWithinLimits(p);
  assertCoversSunset(p, 'Om Beach');
  assert.ok(longestHole(p) <= 60, `a ${longestHole(p)} min hole`);
});

test('can’t fit all: a relaxed day leaves a place out and says why, from that day’s real numbers', () => {
  const p = plan(gokarna, { prefs: prefs({ pace: 'relaxed' }) });
  assert.ok(p.left.length >= 1 && look(p).placed >= 5, 'more than the old three stops, fewer than all seven');
  assertWithinLimits(p);
  p.left.forEach((l) => assert.match(p.leftWhy?.[l.id] ?? '', /Day 1 would be about \d+(\.5)? h .* relaxed day is about 6 h\. Add a day/));
});

test('Kochi, two days: no 12:30 start by rule, lunch at lunchtime, no dead gaps', () => {
  const p = plan(kochi, { prefs: prefs({ days: 2 }) });
  assert.equal(p.left.length, 0);
  assertWithinLimits(p);
  assert.ok(look(p).firstStart <= 9 * 60, 'a day starts in the morning');
  assert.ok(longestHole(p) <= 60, `a ${longestHole(p)} min hole`);
  assert.ok(stopsOf(p).some((s) => s.place.type === 'food' && s.startMinutes >= LUNCH_WINDOW[0] && s.startMinutes <= LUNCH_WINDOW[1]), 'someone has lunch at lunchtime');
  assertCoversSunset(p, 'Fort Kochi Waterfront');
});

test('one-day trip: Kochi in a day keeps to the day and explains what it left', () => {
  const p = plan(kochi);
  assert.equal(p.days.length, 1);
  assertWithinLimits(p);
  assert.equal(look(p).placed + p.left.length, kochi.length);
  p.left.forEach((l) => assert.ok(p.leftWhy?.[l.id], `${l.name} has a reason`));
});

test('stay/base: each day leaves from and returns to where you’re staying', () => {
  const p = plan(kochi, { prefs: prefs({ days: 2, stay: fortKochiStay }) });
  assert.equal(p.left.length, 0);
  assertWithinLimits(p);
  p.days.forEach((d) => {
    assert.ok(d.stops[0].legBefore, 'the first stop has the way there');
    assert.ok(d.home, 'the day has the way back');
  });
});

test('Ladakh from Leh: far places aren’t passed off as day trips, and each says what it needs', () => {
  const p = plan(ladakh, { prefs: prefs({ days: 4, getting: 'drive', terrain: 'mountain', stay: leh }) });
  assertWithinLimits(p);
  const why = (name: string) => p.leftWhy?.[p.left.find((l) => l.name.startsWith(name))?.id ?? ''] ?? '';
  assert.match(why('Pangong'), /each way from Leh, too far to go and come back in a day\. It needs a night nearby/);
  assert.match(why('Hunder'), /needs a night nearby.*Diskit Monastery is close by/);
  assert.match(why('Diskit'), /each way from Leh/);
  // What is in the plan is around Leh: no day spends more than the pace allows on the road.
  ['Leh Palace', 'Shanti Stupa', 'Thiksey', 'Khardung', 'Magnetic'].forEach((n) => assert.ok(find(p, n), `${n} is planned`));
  assertCoversSunset(p, 'Shanti Stupa');
});

test('Ladakh at a packed pace: the nearer Nubra place becomes a (long) day trip, Pangong still doesn’t', () => {
  const p = plan(ladakh, { prefs: prefs({ days: 4, pace: 'packed', getting: 'drive', terrain: 'mountain', stay: leh }) });
  assertWithinLimits(p);
  assert.ok(find(p, 'Diskit'));
  assert.ok(p.left.some((l) => l.name.startsWith('Pangong')));
});

test('Mumbai, three days: all twelve fit, the sea-wall sunset is at sunset, dinner at dinner time', () => {
  const p = plan(mumbai, { prefs: prefs({ days: 3 }) });
  assert.equal(p.left.length, 0);
  assertWithinLimits(p);
  assertCoversSunset(p, 'Marine Drive');
  const dinner = find(p, 'Bademiya')!;
  assert.ok(dinner.startMinutes >= DINNER_WINDOW[0] - 30 && dinner.startMinutes <= DINNER_WINDOW[1], `dinner at ${dinner.startMinutes}`);
  assert.ok(longestHole(p) <= 75, `a ${longestHole(p)} min hole`);
});

test('food-heavy: breakfast in the morning, one dinner a day, never dinner in the afternoon', () => {
  const p = plan(foodHeavy, { prefs: prefs({ days: 2 }) });
  assert.equal(p.left.length, 0);
  assertWithinLimits(p);
  assert.ok(find(p, 'Paranthe')!.startMinutes <= 10 * 60 + 30, 'parathas are breakfast');
  const dinners = ['Karim', 'Al Jawahar'].map((n) => find(p, n)!);
  dinners.forEach((d) => assert.ok(d.startMinutes >= DINNER_WINDOW[0] - 30, `${d.place.name} at ${d.startMinutes}`));
  assert.notEqual(dinners[0].day, dinners[1].day, 'two dinner places, two evenings');
  // No two sit-down meals back to back.
  p.days.forEach((d) =>
    d.stops.forEach((s, i) => {
      if (i === 0) return;
      const prev = d.stops[i - 1];
      const straightAfter = s.startMinutes - (prev.startMinutes + prev.place.minutes) < 90;
      assert.ok(!(straightAfter && kindOf(s.place) === 'restaurant' && kindOf(prev.place) === 'restaurant'), `${prev.place.name} then ${s.place.name}`);
    }),
  );
});

test('sparse: two far-apart places make one honest day, the beach at sunset', () => {
  const p = plan(sparse, { prefs: prefs({ getting: 'drive' }) });
  assert.equal(p.left.length, 0);
  assertWithinLimits(p);
  assertCoversSunset(p, 'Cherai');
  assert.ok(longestHole(p) <= 90, `a ${longestHole(p)} min hole`);
});

test('locked places stay on their day; removed places stay out; both survive every reshuffle', () => {
  const pins = [{ placeId: kochi[7].id, day: 0 }];
  const removed = [kochi[6].id];
  for (let seed = 1; seed <= 8; seed++) {
    const p = plan(kochi, { prefs: prefs({ days: 2 }), pins, removed, seed });
    const mall = find(p, 'Lulu')!;
    assert.equal(mall.day, 0, `seed ${seed}: the mall is on Day 1`);
    assert.ok(mall.pinned);
    assert.ok(!find(p, 'Marine Drive'), `seed ${seed}: Marine Drive stays out`);
    assert.ok(!p.left.some((l) => l.id === removed[0]));
  }
});

test('reshuffle: a different plan that is just as valid, and the same seed is the same plan', () => {
  const base = { prefs: prefs({ days: 2 }) };
  const first = plan(kochi, base);
  const sig = (p: TripPlan) => p.days.map((d) => d.stops.map((s) => s.place.id).join('>')).join(' / ');
  const others = [2, 3, 4, 5, 6].map((seed) => plan(kochi, { ...base, seed }));
  assert.ok(others.some((o) => sig(o) !== sig(first)), 'at least one reshuffle differs');
  others.forEach((o) => {
    assertWithinLimits(o);
    assert.equal(o.left.length, first.left.length, 'a reshuffle leaves out no more');
    assert.ok(longestHole(o) <= 90, `reshuffle has a ${longestHole(o)} min hole`);
  });
  assert.equal(sig(plan(kochi, { ...base, seed: 3 })), sig(others[1]), 'seed 3 twice is one plan');
  assert.deepEqual(plan(gokarna).days, plan([...gokarna]).days);
});

test('editing still works: reorder, move, remove, lock and typed-in stops keep a timed plan', () => {
  let p = plan(kochi, { prefs: prefs({ days: 2 }) });
  const all = stopsOf(p).length;
  const first = p.days[0].stops[0].place.id;
  p = reorder(p, 0, first, 1);
  assert.equal(p.days[0].stops[1].place.id, first, 'the traveller’s order is kept');
  p = moveToDay(p, 0, first, 1);
  assert.equal(stopsOf(p).length, all);
  assert.ok(p.days[1].stops.some((s) => s.place.id === first));
  p = togglePin(p, 1, first);
  assert.deepEqual(pinsOf(p), [{ placeId: first, day: 1 }]);
  const gone = p.days[0].stops[0].place.id;
  p = removeStop(p, 0, gone);
  assert.ok(p.removed.includes(gone) && p.left.some((l) => l.id === gone));
  const typed: Place = { ...P('Pick up Amma', 'experience', 'morning', 15, 9.966, 76.243), source: { kind: 'custom', by: 'me' } };
  p = addCustomStop(p, 0, typed);
  assert.ok(p.days[0].stops.some((s) => s.place.id === typed.id && s.pinned));
  p.days.forEach((d) => d.stops.forEach((s, k) => k > 0 && assert.ok(s.startMinutes >= d.stops[k - 1].startMinutes + d.stops[k - 1].place.minutes)));
  // Regenerating keeps the lock and the removal.
  const again = planNow({ cityId: 'test', saved: [...kochi, typed], suggestions: [], prefs: p.prefs, pins: pinsOf(p), removed: p.removed, seed: 2 });
  assert.equal(find(again, kochi.find((k) => k.id === first)!.name)!.day, 1);
  assert.ok(!stopsOf(again).some((s) => s.place.id === gone));
});

test('a place with no location is never scheduled, and says so', () => {
  const lost = P('Somewhere', 'sight', 'morning', 60, NaN, NaN);
  const p = plan([...gokarna, lost]);
  assert.ok(!find(p, 'Somewhere'));
  assert.match(p.leftWhy?.[lost.id] ?? '', /spot on the map/);
});

test('two days asked for are two days used: no seven-stop day beside a blank one, at any time of year', () => {
  const pick = P('Prema Restaurant', 'food', 'evening', 45, 14.5441, 74.3181);
  for (const start of ['2026-10-10', '2026-12-21', '2027-03-20', '2027-06-21']) {
    const p = plan(gokarna, { suggestions: [pick], prefs: prefs({ days: 2, start }) });
    assert.equal(p.left.length, 0, start);
    p.days.forEach((d, i) => assert.ok(d.stops.filter((s) => !s.suggested).length >= 2, `${start}: Day ${i + 1} has ${d.stops.length} stops`));
    assertCoversSunset(p, 'Om Beach');
  }
  // More days than there is to do: the spare day is left empty, never filled with a dinner alone.
  const long = plan(sparse, { suggestions: [pick], prefs: prefs({ days: 3, getting: 'drive' }) });
  long.days.forEach((d) => assert.ok(d.stops.length === 0 || d.stops.some((s) => !s.suggested)));
});

test('a local dinner pick is added only at dinner time, and only when the day has no dinner', () => {
  const pick = P('Prema Restaurant', 'food', 'evening', 45, 14.5441, 74.3181);
  const p = plan(gokarna, { suggestions: [pick], prefs: prefs({ days: 2 }) });
  const added = stopsOf(p).filter((s) => s.suggested);
  assert.ok(added.length <= 1);
  added.forEach((s) => assert.ok(s.startMinutes >= DINNER_WINDOW[0] - 45, `pick at ${s.startMinutes}`));
});

test('a long list is still planned quickly: 40 places over 5 days', () => {
  const many = Array.from({ length: 40 }, (_, i) =>
    P(`Place ${i}`, i % 5 === 0 ? 'food' : 'sight', (['morning', 'afternoon', 'evening'] as const)[i % 3], 30 + (i % 4) * 20, 28.55 + ((i * 37) % 23) / 200, 77.15 + ((i * 53) % 29) / 200),
  );
  const t0 = performance.now();
  const p = plan(many, { prefs: prefs({ days: 5 }) });
  const ms = performance.now() - t0;
  assertWithinLimits(p);
  assert.ok(ms < 4000, `took ${Math.round(ms)} ms`);
  assert.ok(look(p).placed >= 25, `placed ${look(p).placed}`);
  p.left.forEach((l) => assert.ok(p.leftWhy?.[l.id], `${l.name} has a reason`));
});
