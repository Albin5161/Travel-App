import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canon, mergeTrips, type SavedTrips } from '@/lib/live/backupMerge';

// The backup must never lose anything from either side, and merging a copy with itself must change
// nothing: the app restarts when a merge gained something, so a merge that always "gains" would
// restart it on every launch.

const phone = (): SavedTrips => ({
  v: 1,
  onboarded: true,
  homeDistrictId: 'kottayam',
  collections: {
    delhi: { cityId: 'delhi', placeIds: ['g:red-fort', 'g:jama'], reelIds: ['ig:a'], addedAt: 200 },
  },
  tripPlans: { delhi: { cityId: 'delhi', days: ['phone plan'] } },
  savedTrips: { delhi: true },
  remote: {},
  live: { places: [{ id: 'g:red-fort' }, { id: 'g:jama' }], cities: [{ id: 'delhi' }], reels: [{ id: 'ig:a' }], placedAt: { 'g:red-fort': 1 } },
});

const account = (): SavedTrips => ({
  v: 1,
  onboarded: true,
  homeDistrictId: 'kochi',
  collections: {
    delhi: { cityId: 'delhi', placeIds: ['g:jama', 'g:qutub'], reelIds: ['ig:b'], addedAt: 100 },
    goa: { cityId: 'goa', placeIds: ['g:baga'], reelIds: ['yt:c'], addedAt: 150 },
  },
  tripPlans: { delhi: { cityId: 'delhi', days: ['account plan'] }, goa: { cityId: 'goa', days: ['goa plan'] } },
  savedTrips: { goa: true },
  remote: { goa: { tripId: 't1', code: 'ABC123', me: 'u1', owner: 'u1', ownerName: 'Albin' } },
  live: { places: [{ id: 'g:jama' }, { id: 'g:qutub' }, { id: 'g:baga' }], cities: [{ id: 'delhi' }, { id: 'goa' }], reels: [{ id: 'ig:b' }, { id: 'yt:c' }], placedAt: {} },
});

test('keeps every city, place and video from both', () => {
  const m = mergeTrips(phone(), account())!;
  assert.deepEqual(Object.keys(m.collections!).sort(), ['delhi', 'goa']);
  assert.deepEqual(m.collections!.delhi.placeIds, ['g:red-fort', 'g:jama', 'g:qutub']);
  assert.deepEqual(m.collections!.delhi.reelIds, ['ig:a', 'ig:b']);
  assert.equal(m.collections!.delhi.addedAt, 100);
  assert.deepEqual(m.live!.places!.map((p) => p.id), ['g:red-fort', 'g:jama', 'g:qutub', 'g:baga']);
  assert.deepEqual(m.live!.reels!.map((r) => r.id), ['ig:a', 'ig:b', 'yt:c']);
});

test('keeps plans and shared trips from both; the phone wins where both have one', () => {
  const m = mergeTrips(phone(), account())!;
  const plans = m.tripPlans as Record<string, { days: string[] }>;
  assert.deepEqual(plans.delhi.days, ['phone plan']);
  assert.deepEqual(plans.goa.days, ['goa plan']);
  assert.deepEqual(m.savedTrips, { goa: true, delhi: true });
  assert.ok((m.remote as Record<string, unknown>).goa);
  assert.equal(m.homeDistrictId, 'kottayam');
});

test('a copy merged with itself, or with nothing, is unchanged', () => {
  const p = phone();
  assert.equal(JSON.stringify(canon(mergeTrips(p, phone()))), JSON.stringify(canon(p)));
  assert.equal(mergeTrips(p, null), p);
  assert.deepEqual(mergeTrips(null, account()), account());
});

test('merging twice gains nothing the second time', () => {
  const once = mergeTrips(phone(), account())!;
  const twice = mergeTrips(once, account())!;
  assert.equal(JSON.stringify(canon(twice)), JSON.stringify(canon(once)));
});
