import { getCity } from './api';
import { places } from './catalog';
import type { DayPart, Place } from './types';

export interface CustomStopInput {
  cityId: string;
  title: string;
  note?: string;
  bestTime: DayPart;
  minutes: number;
  by: string;
  /** A stop it happens near, for the map pin and the travel time. Without one, it's in the city. */
  near?: Place;
}

/**
 * A stop someone typed in, shaped like any other place so the plan, the map, the pass and the vote
 * all take it as is. It has no location of its own, so it borrows the one it's near: zero travel
 * from there, and its pin sits on that stop's.
 */
export function customPlace(input: CustomStopInput, id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`): Place {
  const city = getCity(input.cityId);
  // Nothing to be near: somewhere in the city, so travel times stay sensible.
  const near = input.near ?? Object.values(places).find((p) => p.cityId === input.cityId);
  return {
    id,
    cityId: input.cityId,
    name: input.title.trim(),
    type: 'experience',
    area: input.note?.trim() || `Added by ${input.by}`,
    photo: city?.hero ?? near?.photo ?? 0,
    why: input.note?.trim() ?? '',
    source: { kind: 'custom', by: input.by, note: input.note?.trim() || undefined },
    bestTime: input.bestTime,
    cost: 0,
    minutes: input.minutes,
    coords: near?.coords ?? { lat: 0, lng: 0 },
    map: near?.map ?? [500, 700],
    order: 99,
  };
}

export const isCustom = (p: Place) => p.source.kind === 'custom';

/** The stops people typed in, so a rebuilt plan (regenerate, new answers) keeps them. */
export function customStops(plan: { days: { stops: { place: Place }[] }[] } | undefined) {
  const out: { place: Place; day: number }[] = [];
  plan?.days.forEach((d, day) => d.stops.forEach((s) => isCustom(s.place) && out.push({ place: s.place, day })));
  return out;
}
