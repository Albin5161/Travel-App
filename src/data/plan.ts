import { travelLeg, type TravelMode } from '@/lib/geo';

import type { DayPart, Place } from './types';

export interface PlanStop {
  place: Place;
  startMinutes: number;
  legBefore?: { minutes: number; km: number; mode: TravelMode };
}

export interface PlanPart {
  part: DayPart;
  stops: PlanStop[];
}

export interface DayPlan {
  parts: PlanPart[];
  stops: PlanStop[];
  totalKm: number;
}

const PARTS: DayPart[] = ['morning', 'afternoon', 'evening'];
const PART_START: Record<DayPart, number> = { morning: 7 * 60, afternoon: 12 * 60 + 30, evening: 16 * 60 + 30 };

export function buildPlan(selected: Place[]): DayPlan {
  const ordered = PARTS.flatMap((part) =>
    selected.filter((p) => p.bestTime === part).sort((a, b) => a.order - b.order),
  );

  const stops: PlanStop[] = [];
  let cursor = PART_START.morning;
  let totalKm = 0;
  ordered.forEach((place, i) => {
    const prev = ordered[i - 1];
    const legBefore = prev ? travelLeg(prev.coords, place.coords) : undefined;
    if (legBefore) {
      cursor += legBefore.minutes;
      totalKm += legBefore.km;
    }
    cursor = Math.max(cursor, PART_START[place.bestTime]);
    stops.push({ place, startMinutes: Math.round(cursor / 5) * 5, legBefore });
    cursor += place.minutes;
  });

  const parts = PARTS.map((part) => ({ part, stops: stops.filter((s) => s.place.bestTime === part) })).filter(
    (p) => p.stops.length > 0,
  );
  return { parts, stops, totalKm };
}

/** A local pick for the evening if the plan has no dinner stop. */
export function findGap(selected: Place[], locals: Place[]): Place | undefined {
  const hasDinner = selected.some((p) => p.type === 'food' && p.bestTime === 'evening');
  if (hasDinner) return undefined;
  return locals.find((l) => l.type === 'food' && !selected.some((s) => s.id === l.id));
}
