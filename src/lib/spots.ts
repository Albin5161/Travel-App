// Saved spots, organised. Geography is the index here, never the filter UI: every spot already
// knows its district through its city, so the only split anyone sees is Near home / Away.

import { getCity } from '@/data/api';
import { allDistricts } from '@/data/regions';
import type { District, Place, PlaceType } from '@/data/types';

import { distanceKm, travelLeg, type LatLng } from './geo';

/** The district a spot belongs to, by name (cities carry it; a spot never states its own). */
export function districtOf(place: Place): string {
  return getCity(place.cityId)?.district ?? 'Elsewhere';
}

export function stateOf(place: Place): string {
  return getCity(place.cityId)?.state ?? '';
}

/** The district you are standing in, or null if none of the known circles contain you. */
export function districtAt(where: LatLng): District | null {
  let best: { d: District; km: number } | null = null;
  for (const d of allDistricts) {
    const km = distanceKm(where, d.centre);
    if (km <= d.radiusKm && (!best || km < best.km)) best = { d, km };
  }
  return best?.d ?? null;
}

// ---------------------------------------------------------------------------
// Filters people actually touch
// ---------------------------------------------------------------------------

/** Spot kinds as a person would name them, mapped onto the catalog's blunter `PlaceType`. */
export type SpotKind = 'all' | 'food' | 'sight' | 'experience' | 'stay';

export const KIND_LABEL: Record<SpotKind, string> = {
  all: 'Everything',
  food: 'Food & cafés',
  sight: 'Places to see',
  experience: 'Things to do',
  stay: 'Stays',
};

export const matchesKind = (p: Place, kind: SpotKind) => kind === 'all' || (p.type as PlaceType) === kind;

/** Weekend reach, in drive-time minutes from where you are. `null` means no limit. */
export type ReachMinutes = 45 | 90 | 180 | null;

export const REACH_LABEL: Record<string, string> = {
  '45': 'Under 45 min',
  '90': 'Under 1½ hrs',
  '180': 'Under 3 hrs',
  null: 'Any distance',
};

/**
 * Drive time from a point to a spot. Uses the same detour-corrected estimate as trip planning,
 * so a 40 km hop through Kerala's roads reads as the hour and a half it really is, not 40 minutes.
 */
export const driveMinutes = (from: LatLng, p: Place) => travelLeg(from, p.coords).minutes;

export function withinReach(from: LatLng, p: Place, reach: ReachMinutes) {
  return reach === null || driveMinutes(from, p) <= reach;
}

// ---------------------------------------------------------------------------
// Clusters: what turns a pile of pins into a plan
// ---------------------------------------------------------------------------

export interface Cluster {
  id: string;
  /** The locality the spots share, e.g. "Fort Kochi". */
  label: string;
  district: string;
  spots: Place[];
  centre: LatLng;
}

/**
 * Group spots that sit close enough to visit in one outing. Single-link clustering on real
 * distance: two spots join the same cluster when they are within `radiusKm` of each other.
 */
export function clusterSpots(spots: Place[], radiusKm = 6): Cluster[] {
  const groups: Place[][] = [];
  for (const spot of spots) {
    const hit = groups.find((g) => g.some((other) => distanceKm(other.coords, spot.coords) <= radiusKm));
    if (hit) hit.push(spot);
    else groups.push([spot]);
  }
  return groups
    .map((spots) => {
      const lat = spots.reduce((n, p) => n + p.coords.lat, 0) / spots.length;
      const lng = spots.reduce((n, p) => n + p.coords.lng, 0) / spots.length;
      // The area name the spots agree on most often is the cluster's name.
      const tally = new Map<string, number>();
      spots.forEach((p) => tally.set(p.area, (tally.get(p.area) ?? 0) + 1));
      const label = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return {
        id: spots.map((p) => p.id).join('+'),
        label,
        district: districtOf(spots[0]),
        spots: [...spots].sort((a, b) => a.name.localeCompare(b.name)),
        centre: { lat, lng },
      };
    })
    .sort((a, b) => b.spots.length - a.spots.length);
}

// ---------------------------------------------------------------------------
// Weekend routes: the answer to "I have five hours and a bike"
// ---------------------------------------------------------------------------

export interface WeekendRoute {
  id: string;
  label: string;
  spots: Place[];
  /** Drive time out, plus time at each spot, plus the drive back. */
  totalMinutes: number;
  driveMinutes: number;
  /** Rupee band, summed from each spot's cost tier; null when any spot's price isn't known. */
  cost: number | null;
}

const COST_BAND = [0, 250, 700, 1600];

/**
 * Build one outing per cluster: drive out, visit the spots nearest-first, drive home. Routes that
 * don't fit the time you have are dropped rather than trimmed, because a half-done outing is a lie.
 */
export function weekendRoutes(from: LatLng, spots: Place[], budgetMinutes = 330): WeekendRoute[] {
  return clusterSpots(spots)
    .map((cluster) => {
      const out = travelLeg(from, cluster.centre).minutes;
      // Visit order: nearest to the way in first, so the route reads as a line not a scribble.
      const ordered = [...cluster.spots].sort(
        (a, b) => distanceKm(from, a.coords) - distanceKm(from, b.coords),
      );
      let hop = 0;
      for (let i = 1; i < ordered.length; i++) {
        hop += travelLeg(ordered[i - 1].coords, ordered[i].coords).minutes;
      }
      const back = travelLeg(ordered[ordered.length - 1].coords, from).minutes;
      const drive = out + hop + back;
      const atSpots = ordered.reduce((n, p) => n + p.minutes, 0);
      return {
        id: cluster.id,
        label: cluster.label,
        spots: ordered,
        driveMinutes: drive,
        totalMinutes: drive + atSpots,
        cost: ordered.some((p) => p.cost === null) ? null : ordered.reduce((n, p) => n + COST_BAND[p.cost ?? 0], 0),
      };
    })
    .filter((r) => r.totalMinutes <= budgetMinutes)
    .sort((a, b) => b.spots.length - a.spots.length || a.totalMinutes - b.totalMinutes);
}
