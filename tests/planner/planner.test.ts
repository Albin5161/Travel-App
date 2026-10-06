/// <reference types="node" />
// The planner, checked on real trips: npm run test:planner
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addCustomStop, moveToDay, pinsOf, planNow, removeStop, reorder, togglePin, type PlannerInput, type TripPlan } from '@/data/planner';
import { ceilingMinutes, kindOf, LATEST_END, LUNCH_WINDOW, DINNER_WINDOW, roadLimit, sunFor } from '@/data/planner/schedule';
import type { Place } from '@/data/types';
import { sunTimes } from '@/lib/sun';

import { facts, fortKochiStay, foodHeavy, gokarna, kochi, ladakh, leh, mumbai, P, prefs, sparse } from './fixtures';
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
    // A day that goes out and comes back keeps to the road limit; one that moves on to another bed may be mostly a drive.
    const moving = !!d.sleep || !!p.nights?.[i - 1];
    if (!moving) assert.ok(travel <= roadLimit(pace) + 1, `Day ${i + 1} has ${travel} min on the road`);
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
  assert.ok(longestHole(p) <= 120, `a ${longestHole(p)} min hole`);
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
  // A morning waterfall and a sunset beach: the falls go as late as a morning allows, and the rest
  // of the gap is the drive and an afternoon with nothing saved to fill it.
  assert.ok(find(p, 'Athirappilly')!.startMinutes <= 11 * 60 + 30, 'the falls are still a morning stop');
  assert.ok(longestHole(p) <= 180, `a ${longestHole(p)} min hole`);
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
    assert.ok(longestHole(o) <= 120, `reshuffle has a ${longestHole(o)} min hole`);
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

// ── Step 2: Gemini's facts about places (recorded from the real model in gemini-facts.json) ─────

test('facts: a restaurant called "Cafe" is lunch, a sweet shop is dessert, and old places read as before', () => {
  const name = (list: Place[], n: string) => list.find((p) => p.name.startsWith(n))!;
  assert.equal(kindOf(name(mumbai, 'Leopold')), 'cafe', 'without facts, the name decides');
  assert.equal(kindOf(name(facts.mumbai, 'Leopold')), 'restaurant', 'Gemini says it’s a lunch place');
  assert.equal(name(facts.foodHeavy, 'Old Famous Jalebi').facts?.meal, 'dessert');
  assert.equal(kindOf(name(facts.foodHeavy, 'Old Famous Jalebi')), 'cafe');
  // A place saved before the facts existed has none, and nothing about it changes.
  mumbai.forEach((p) => assert.equal(p.facts, undefined));
});

test('facts: a beach ticked "sunset" that Gemini calls a morning place stays a morning place', () => {
  const beach = facts.gokarna.find((p) => p.name === 'Gokarna Beach')!;
  assert.equal(beach.facts?.sunset, true, 'the model does tick it');
  assert.equal(kindOf(beach), 'sight');
  assert.equal(kindOf(facts.gokarna.find((p) => p.name === 'Om Beach')!), 'sunset');
});

test('facts: every trip still fits its limits, includes as many places, and eats lunch at lunchtime', () => {
  const trips: [Place[], Place[], Partial<PlannerInput>][] = [
    [gokarna, facts.gokarna, {}],
    [gokarna, facts.gokarna, { prefs: prefs({ days: 2 }) }],
    [kochi, facts.kochi, { prefs: prefs({ days: 2 }) }],
    [mumbai, facts.mumbai, { prefs: prefs({ days: 3 }) }],
    [foodHeavy, facts.foodHeavy, { prefs: prefs({ days: 2 }) }],
    [ladakh, facts.ladakh, { prefs: prefs({ days: 4, getting: 'drive', terrain: 'mountain', stay: leh }) }],
  ];
  for (const [plain, rich, over] of trips) {
    const before = plan(plain, over);
    const after = plan(rich, over);
    assertWithinLimits(after);
    assert.ok(look(after).placed >= look(before).placed, `${rich[0].name}: ${look(after).placed} placed, was ${look(before).placed}`);
    after.left.forEach((l) => assert.ok(after.leftWhy?.[l.id], `${l.name} has a reason`));
    // Whoever Gemini calls a lunch place has lunch between about 12 and 2.
    stopsOf(after)
      .filter((s) => s.place.facts?.meal === 'lunch')
      .forEach((s) => assert.ok(s.startMinutes >= LUNCH_WINDOW[0] - 5 && s.startMinutes <= LUNCH_WINDOW[1] + 15, `${s.place.name} at ${s.startMinutes}`));
    stopsOf(after)
      .filter((s) => s.place.facts?.meal === 'dinner')
      .forEach((s) => assert.ok(s.startMinutes >= DINNER_WINDOW[0] - 30, `${s.place.name} at ${s.startMinutes}`));
    // No morning place after one o'clock, no sunset place after the sun is down. (One the model
    // also calls good at sunset may be there for the sunset instead: that is what the tick is for.)
    const sunset = sunsetAt(after);
    const there = (s: { startMinutes: number; place: Place }) => s.startMinutes < sunset && s.startMinutes + s.place.minutes >= sunset - 5;
    stopsOf(after)
      .filter((s) => kindOf(s.place) === 'sight' && (s.place.facts?.window === 'morning' || s.place.facts?.window === 'early_morning'))
      .forEach((s) => assert.ok(s.startMinutes <= 13 * 60 || (s.place.facts?.sunset && there(s)), `${s.place.name} at ${s.startMinutes}`));
    stopsOf(after)
      .filter((s) => kindOf(s.place) === 'sunset')
      .forEach((s) => assert.ok(s.startMinutes < sunset && s.startMinutes + s.place.minutes >= sunset - 5, `${s.place.name} at ${s.startMinutes}, sunset ${sunset}`));
  }
});

// ── Refinement: what a place is, when to go, and how sure ───────────────────────────────────────

const withF = (p: Place, f: Place['facts'], bestTime = p.bestTime): Place => ({ ...p, bestTime, facts: f });
const startOf = (p: TripPlan, name: string) => find(p, name)!.startMinutes;

test('sunset: "also good at sunset" is not "best at sunset"', () => {
  const beach = facts.gokarna.find((p) => p.name === 'Gokarna Beach')!;
  assert.equal(beach.facts?.sunset, true);
  assert.equal(beach.facts?.window, 'morning');
  assert.equal(kindOf(beach), 'sight', 'ticked for sunset, best in the morning: a morning place');
  // An evening place ticked for sunset is an evening place too; only "best at sunset" claims the hour.
  const prom = withF(P('Promenade', 'sight', 'evening', 60, 14.53, 74.318), { window: 'evening', sunset: true, night: true }, 'evening');
  assert.equal(kindOf(prom), 'sight');
  assert.equal(kindOf(withF(prom, { window: 'sunset', sunset: true })), 'sunset');
});

test('sunset: the true sunset place gets the sunset, and the morning beach stays in the morning', () => {
  const p = plan(facts.gokarna);
  assert.equal(p.left.length, 0);
  assertCoversSunset(p, 'Om Beach');
  assert.ok(startOf(p, 'Gokarna Beach') < 12 * 60, `Gokarna Beach at ${startOf(p, 'Gokarna Beach')}`);
  // Two days, two beaches ticked for sunset, one best at it: only that one is held to the hour.
  const two = plan(facts.gokarna, { prefs: prefs({ days: 2 }) });
  assertCoversSunset(two, 'Om Beach');
  assert.ok(startOf(two, 'Kudle Beach') < sunsetAt(two) - 120, 'Kudle Beach, ticked for sunset but best in the afternoon, is an afternoon stop');
});

test('missing facts fall back: no facts, empty facts and half-filled facts all plan as before', () => {
  const plain = gokarna.find((p) => p.name === 'Om Beach')!;
  assert.equal(kindOf(plain), 'sunset', 'an old place is read from its name and "why" line');
  assert.equal(kindOf(withF(plain, {})), 'sunset', 'empty facts change nothing');
  assert.equal(kindOf(withF(plain, { parentArea: 'Gokarna' })), 'sunset', 'an area alone changes nothing');
  const cafe = gokarna.find((p) => p.name.startsWith('Strawberry'))!;
  assert.equal(kindOf(cafe), 'cafe');
  assert.equal(kindOf(withF(cafe, { window: 'afternoon' })), 'cafe', 'no meal given: the name still decides');
  assert.equal(kindOf(withF(cafe, { meal: 'unknown' })), 'cafe');
  assert.equal(kindOf(withF(cafe, { meal: 'lunch' })), 'restaurant');
  // A collection that is half old places and half new plans without trouble.
  const mixed = gokarna.map((p, i) => (i % 2 ? facts.gokarna[i] : p));
  const p = plan(mixed);
  assert.equal(p.left.length, 0);
  assertWithinLimits(p);
  assertCoversSunset(p, 'Om Beach');
});

test('low confidence: an unsure, even wrong, timing guess never drops a place or breaks a day', () => {
  // Every place given a time that makes no sense for it, and the model barely sure of any.
  const odd = ['night', 'sunset', 'early_morning', 'evening', 'night', 'early_morning', 'morning'] as const;
  const wrong = gokarna.map((p, i) => withF(p, { window: odd[i], meal: p.type === 'food' ? 'dinner' : null, sunset: i % 2 === 0, night: i % 3 === 0, sure: 0.1 }));
  const p = plan(wrong);
  assert.equal(look(p).placed, 7, 'all seven still fit');
  assertWithinLimits(p);
  const two = plan(wrong, { prefs: prefs({ days: 2 }) });
  assert.equal(two.left.length, 0);
  assertWithinLimits(two);
});

test('low confidence holds a place to its time half as firmly; no answer holds it fully', async () => {
  const { firmness } = await import('@/data/planner/schedule');
  const beach = gokarna[1];
  assert.equal(firmness(beach), 1, 'an old place');
  assert.equal(firmness(withF(beach, { window: 'morning' })), 1, 'facts without a confidence');
  assert.equal(firmness(withF(beach, { window: 'morning', sure: 1 })), 1);
  assert.equal(firmness(withF(beach, { window: 'morning', sure: 0 })), 0.5);
  assert.ok(firmness(withF(beach, { window: 'morning', sure: 0.6 })) > 0.5 && firmness(withF(beach, { window: 'morning', sure: 0.6 })) < 1);
});

test('what and when are separate: a lunch place best in the evening can be dinner; a dessert place can be a morning stop', () => {
  const fort = P('Old Fort', 'sight', 'morning', 90, 28.6562, 77.241);
  const bazaar = P('Bazaar', 'experience', 'afternoon', 90, 28.6506, 77.2303);
  const noon = withF(P('Noon Kitchen', 'food', 'afternoon', 60, 28.6494, 77.2337), { meal: 'lunch', window: 'afternoon' });
  const late = withF(P('Late Kitchen', 'food', 'evening', 60, 28.6497, 77.2335), { meal: 'lunch', window: 'evening' }, 'evening');
  const sweets = withF(P('Morning Sweets', 'food', 'morning', 20, 28.656, 77.2318), { meal: 'dessert', window: 'morning' }, 'morning');
  const p = plan([fort, bazaar, noon, late, sweets]);
  assert.equal(p.left.length, 0);
  assert.ok(startOf(p, 'Noon Kitchen') >= LUNCH_WINDOW[0] && startOf(p, 'Noon Kitchen') <= LUNCH_WINDOW[1], `lunch at ${startOf(p, 'Noon Kitchen')}`);
  assert.ok(startOf(p, 'Late Kitchen') >= DINNER_WINDOW[0] - 30, `a "lunch" place best in the evening eats at ${startOf(p, 'Late Kitchen')}`);
  assert.ok(startOf(p, 'Morning Sweets') <= 11 * 60 + 45, `dessert, best in the morning, at ${startOf(p, 'Morning Sweets')}`);
  // The same sweet shop, best in the evening, moves to the evening: the time fact decides, not "dessert".
  const evening = plan([fort, bazaar, noon, late, withF(sweets, { meal: 'dessert', window: 'evening' }, 'evening')]);
  assert.ok(startOf(evening, 'Morning Sweets') >= 16 * 60, `at ${startOf(evening, 'Morning Sweets')}`);
});

test('a small gap is not traded for a late start', () => {
  // Two morning sights and lunch: about half an hour to spare before the lunch hour.
  const a = P('Palace', 'sight', 'morning', 120, 9.9655, 76.2445);
  const b = P('Museum', 'sight', 'morning', 70, 9.9662, 76.2437);
  const lunch = withF(P('Harbour Kitchen', 'food', 'afternoon', 60, 9.9668, 76.2487), { meal: 'lunch', window: 'afternoon' });
  const p = plan([a, b, lunch]);
  const d = look(p).days[0];
  assert.ok(d.start <= 8 * 60 + 5, `the day sets out at ${d.start}, not later to swallow a ${d.wait} min wait`);
  assert.ok(d.wait >= 15 && d.wait <= 45, `a ${d.wait} min breather before lunch is left alone`);
});

test('a genuine free afternoon is allowed, and nothing is invented to fill it', () => {
  const morning = withF(P('Hill Temple', 'sight', 'morning', 60, 14.5439, 74.3187), { window: 'morning' });
  const dusk = withF(P('West Beach', 'sight', 'evening', 60, 14.5196, 74.3242), { window: 'sunset', sunset: true }, 'evening');
  const pick = P('Somewhere Else', 'food', 'evening', 45, 14.5441, 74.3181);
  const p = plan([morning, dusk], { suggestions: [pick] });
  assert.equal(p.left.length, 0, 'both places are in the plan');
  assertCoversSunset(p, 'West Beach');
  assert.ok(startOf(p, 'Hill Temple') <= 11 * 60 + 30, 'the temple is still a morning stop');
  assert.ok(longestHole(p) >= 120, 'the afternoon between them is free');
  assert.ok(stopsOf(p).filter((s) => !s.suggested).length === 2 && !stopsOf(p).some((s) => s.suggested && s.startMinutes < DINNER_WINDOW[0] - 45), 'no stop is made up for the gap');
});

test('the model changing its mind about one place moves that place, not the whole day', () => {
  const flip = (to: 'morning' | 'afternoon') => facts.gokarna.map((p) => (p.name === 'Half Moon Beach' ? withF(p, { ...p.facts, window: to }, to) : p));
  // One day: everything else stays where it was, to within a couple of hours.
  const [a, b] = [plan(flip('morning')), plan(flip('afternoon'))];
  assert.equal(look(a).placed, 7);
  assert.equal(look(b).placed, 7);
  gokarna
    .filter((p) => p.name !== 'Half Moon Beach')
    .forEach((p) => assert.ok(Math.abs(startOf(a, p.name) - startOf(b, p.name)) <= 120, `${p.name}: ${startOf(a, p.name)} against ${startOf(b, p.name)}`));
  // Two days: which places share a day can change (seven places this close are a near tie), but
  // both trips hold everything, keep to the limits, and keep the sunset.
  for (const to of ['morning', 'afternoon'] as const) {
    const two = plan(flip(to), { prefs: prefs({ days: 2 }) });
    assert.equal(two.left.length, 0);
    assertWithinLimits(two);
    assertCoversSunset(two, 'Om Beach');
    assert.ok(longestHole(two) <= 90);
  }
});

// ── Step 3: nights away from the base ───────────────────────────────────────────────────────────

const ladakhInput = (pace: 'balanced' | 'packed' = 'balanced', saved: Place[] = facts.ladakh): Partial<PlannerInput> & { saved: Place[] } => ({
  saved,
  prefs: prefs({ days: 4, pace, getting: 'drive', terrain: 'mountain', stay: leh }),
});
const accept = (saved: Place[], over: Partial<PlannerInput>): TripPlan => {
  const first = plan(saved, over);
  assert.ok(first.offer, 'there is an offer to accept');
  return plan(saved, { ...over, nights: first.offer.nights });
};

test('a city trip from one base is untouched: no nights, no offer, every day out and back', () => {
  const p = plan(kochi, { prefs: prefs({ days: 2, stay: fortKochiStay }) });
  assert.equal(p.nights, undefined);
  assert.equal(p.offer, undefined);
  p.days.forEach((d) => assert.equal(d.sleep, undefined));
  assert.equal(p.left.length, 0);
  // And with no base at all there is nothing to be away from.
  assert.equal(plan(ladakh, { prefs: prefs({ days: 4, getting: 'drive', terrain: 'mountain' }) }).offer, undefined);
});

test('a plan saved before nights existed still edits and retimes', () => {
  let p = plan(kochi, { prefs: prefs({ days: 2, stay: fortKochiStay }) });
  // As it comes back from storage: no nights, no offer, no sleep on any day.
  p = { cityId: p.cityId, prefs: p.prefs, days: p.days, left: p.left, leftWhy: p.leftWhy, removed: p.removed, seed: p.seed };
  const first = p.days[0].stops[0].place.id;
  p = moveToDay(reorder(p, 0, first, 1), 0, first, 1);
  p.days.forEach((d) => {
    assert.ok(d.home, 'each day still ends back at the stay');
    assert.equal(d.sleep, undefined);
  });
});

test('far places near each other bring an offer of a night there; the plan itself stays on its base', () => {
  const p = plan(facts.ladakh, ladakhInput());
  // Nothing was changed for the traveller: every night at the base, the far places still explained.
  assert.equal(p.nights, undefined);
  p.days.forEach((d) => assert.equal(d.sleep, undefined));
  assert.match(p.leftWhy?.[p.left.find((l) => l.name.startsWith('Hunder'))!.id] ?? '', /night nearby/);
  // And the way out is offered, with the planner's own estimate in the reason.
  assert.ok(p.offer);
  assert.match(p.offer.title, /^Stay in Nubra Valley on night \d\?$/);
  assert.match(p.offer.reason, /about 3 h from Leh, by our estimate/);
  const gained = p.offer.gains.map((id) => facts.ladakh.find((x) => x.id === id)!.name).sort();
  assert.deepEqual(gained, ['Diskit Monastery', 'Hunder Sand Dunes']);
  assert.equal(p.offer.nights.length, 3, 'one entry per night');
});

test('accepted: the two Nubra places are seen around one night there, not as two round trips', () => {
  const p = accept(facts.ladakh, ladakhInput());
  assertWithinLimits(p);
  const k = p.nights!.findIndex(Boolean);
  assert.equal(p.days[k].sleep?.name, 'Nubra Valley');
  for (const name of ['Diskit', 'Hunder']) {
    const s = find(p, name);
    assert.ok(s, `${name} is in the plan`);
    assert.ok(s.day === k || s.day === k + 1, `${name} is on the day into or out of Nubra, not on a round trip of its own`);
  }
  assertCoversSunset(p, 'Shanti Stupa');
  // Still out of reach at this pace, and still says why.
  assert.match(p.leftWhy?.[p.left.find((l) => l.name.startsWith('Pangong'))!.id] ?? '', /Pangong|night nearby|each way/);
});

test('the day after a night away starts from there, and the day into it ends there', async () => {
  const { travelLegFor } = await import('@/lib/geo');
  const p = accept(facts.ladakh, ladakhInput());
  const k = p.nights!.findIndex(Boolean);
  const night = p.nights![k]!;
  const into = p.days[k];
  const out = p.days[k + 1];
  const lastIn = into.stops[into.stops.length - 1].place;
  assert.equal(into.home?.minutes, travelLegFor(lastIn.coords, night.coords, 'drive', 'mountain').minutes, 'the day ends at the night’s place');
  if (out.stops.length) {
    assert.equal(out.stops[0].legBefore?.minutes, travelLegFor(night.coords, out.stops[0].place.coords, 'drive', 'mountain').minutes, 'the next day sets out from it');
  } else {
    assert.equal(out.home?.minutes, travelLegFor(night.coords, leh.coords, 'drive', 'mountain').minutes, 'a travel day back to the base');
  }
  assert.ok((into.home?.minutes ?? 999) < 60, 'no long drive back that evening');
});

test('several different nights away can be held in one trip, and Pangong becomes reachable', () => {
  const p = accept(facts.ladakh, ladakhInput('packed'));
  assertWithinLimits(p);
  const away = p.nights!.filter(Boolean).map((n) => n!.name);
  assert.deepEqual([...new Set(away)].sort(), ['Nubra Valley', 'Pangong']);
  assert.equal(p.left.length, 0, 'all eight places fit');
  assert.ok(find(p, 'Pangong'));
  // The journey is connected: each day sleeps where the next begins.
  p.days.forEach((d, i) => assert.equal(d.sleep?.name, p.nights![i]?.name));
});

test('a change of bed is not suggested for a small gain', () => {
  // A waterfall an hour and a half off: a fine day trip, so nobody is asked to pack.
  const base = { name: 'Fort Kochi', coords: { lat: 9.9658, lng: 76.2421 }, at: 0 };
  const p = plan([...kochi, sparse[0]], { prefs: prefs({ days: 3, getting: 'drive', stay: base }) });
  assert.equal(p.offer, undefined);
  assert.ok(find(p, 'Athirappilly'), 'it is simply planned as a day out');
  // Nothing left out, nothing to gain: no offer either.
  assert.equal(plan(mumbai, { prefs: prefs({ days: 3, stay: { name: 'Colaba', coords: { lat: 18.92, lng: 72.83 }, at: 0 } }) }).offer, undefined);
});

test('the same works anywhere: two hill-station places far from a coastal base', () => {
  const base = { name: 'Fort Kochi', coords: { lat: 9.9658, lng: 76.2421 }, at: 0 };
  const hills = [
    P('Top Station', 'sight', 'morning', 60, 10.1218, 77.2437, 'The view over the Western Ghats.', 'Munnar'),
    P('Eravikulam National Park', 'sight', 'morning', 120, 10.1927, 77.0605, 'Nilgiri tahr on the high grassland.', 'Munnar'),
  ];
  const p = plan([...kochi, ...hills], { prefs: prefs({ days: 4, getting: 'drive', terrain: 'hilly', stay: base }) });
  assert.ok(p.offer, 'a night in the hills is offered');
  assert.match(p.offer.title, /Munnar/);
  const taken = plan([...kochi, ...hills], { prefs: prefs({ days: 4, getting: 'drive', terrain: 'hilly', stay: base }), nights: p.offer.nights });
  assertWithinLimits(taken);
  hills.forEach((h) => assert.ok(find(taken, h.name), `${h.name} is planned`));
});

test('locked and removed places hold with nights away, through every reshuffle', () => {
  const saved = facts.ladakh;
  const palace = saved.find((p) => p.name === 'Leh Palace')!.id;
  const hill = saved.find((p) => p.name === 'Magnetic Hill')!.id;
  const over = { ...ladakhInput(), pins: [{ placeId: palace, day: 0 }], removed: [hill] };
  const first = plan(saved, over);
  assert.ok(first.offer);
  const pattern = first.offer.nights.map((n) => n?.name ?? null);
  for (let seed = 1; seed <= 6; seed++) {
    const p = plan(saved, { ...over, nights: first.offer.nights, seed });
    assertWithinLimits(p);
    assert.equal(find(p, 'Leh Palace')!.day, 0, `seed ${seed}: the palace stays on Day 1`);
    assert.ok(!find(p, 'Magnetic Hill'), `seed ${seed}: Magnetic Hill stays out`);
    assert.deepEqual(p.nights!.map((n) => n?.name ?? null), pattern, `seed ${seed}: the nights are where the traveller put them`);
    assert.ok(find(p, 'Diskit') && find(p, 'Hunder'));
  }
});

test('nights that can no longer work are let go, never left as no plan', () => {
  const first = plan(facts.ladakh, ladakhInput('packed'));
  assert.ok(first.offer);
  // The same nights on a relaxed trip: the drives between them are too long for its days.
  const p = plan(facts.ladakh, { ...ladakhInput(), prefs: prefs({ days: 4, pace: 'relaxed', getting: 'drive', terrain: 'mountain', stay: leh }), nights: first.offer.nights });
  assert.ok(look(p).placed >= 3, 'there is still a plan');
  assertWithinLimits(p);
});

test('the planner names no place: nights away come from distances, not from a list of destinations', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../../src/data/planner/', import.meta.url);
  const files = [...readdirSync(dir).map((f) => new URL(f, dir)), new URL('../../src/data/planner.ts', import.meta.url)];
  for (const f of files) {
    // Comments may give an example; the code may not branch on one.
    const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /ladakh|\bleh\b|nubra|pangong|hunder|diskit|kochi|gokarna|mumbai|delhi/i, `${f.pathname} names a place`);
  }
});
