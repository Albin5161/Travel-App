import type { ImageSourcePropType } from 'react-native';

import type { LatLng, Point, Terrain } from '@/lib/geo';

export type PlaceType = 'food' | 'stay' | 'sight' | 'experience';
/** Where a saved spot stands with you. Everything starts as 'want'. */
export type SpotStatus = 'want' | 'been';
export type DayPart = 'morning' | 'afternoon' | 'evening';
export type Platform = 'instagram' | 'youtube';

export type PlaceSource =
  | { kind: 'reel'; reelId: string; timestamp: string }
  | { kind: 'local' }
  /** Typed in by someone on the trip: "Lunch at Ammachi's", "Pick up Amma, 7:00". */
  | { kind: 'custom'; by: string; note?: string };

export interface Place {
  id: string;
  cityId: string;
  name: string;
  type: PlaceType;
  area: string;
  photo: ImageSourcePropType;
  /** Who took a Google photo. Google requires the credit wherever the photo is shown. */
  photoCredit?: string;
  why: string;
  source: PlaceSource;
  bestTime: DayPart;
  /** 0 free, 1–3 for ₹ to ₹₹₹; null when it isn't known, so nothing claims a price it doesn't have. */
  cost: 0 | 1 | 2 | 3 | null;
  minutes: number;
  coords: LatLng;
  /** Position on the city's stylised map, in world units. */
  map: Point;
  /**
   * Position on the region map (see `src/data/regions.ts`), for spots inside a
   * mapped region. Places outside every mapped region simply don't have one.
   */
  regionPoint?: Point;
  /** Order within its part of the day. */
  order: number;
}

export interface Reel {
  id: string;
  platform: Platform;
  creator: string;
  title: string;
  duration: string;
  thumbnail: ImageSourcePropType;
  cityId: string;
  placeIds: string[];
}

export interface CityMapArt {
  /** Coastline, sea on the west side. Omit for inland cities. */
  coast?: Point[];
  water?: { cx: number; cy: number; rx: number; ry: number }[];
  rivers?: Point[][];
  roads: Point[][];
  trails?: Point[][];
  borders?: Point[][];
  hills: { cx: number; cy: number; rx: number; ry: number }[];
  labels: { text: string; x: number; y: number; kind: 'sea' | 'area'; anchor?: 'start' | 'middle' | 'end' }[];
}

export interface City {
  id: string;
  name: string;
  state: string;
  /**
   * The admin area one level below the state — a district in India, a regency in
   * Bali, a province elsewhere. Derived, never typed by anyone: it is the index
   * that answers "am I in Ernakulam" and "is this near home".
   */
  district: string;
  /** The region map this city's spots are drawn on, if any. See `src/data/regions.ts`. */
  regionId?: string;
  hero: ImageSourcePropType;
  /** Who took a Google cover photo; shown with it, as Google requires. */
  heroCredit?: string;
  map: CityMapArt;
  /** Mountains, hills or flat, for travel times. Guessed from the places when absent. */
  terrain?: Terrain;
}

/** A district, as the app indexes it: a name plus a circle to test arrival against. */
export interface District {
  id: string;
  name: string;
  state: string;
  centre: LatLng;
  /** Radius in km of the circle used for the arrival geofence. */
  radiusKm: number;
}

/** A stylised multi-district map, drawn with the same art vocabulary as a city map. */
export interface Region {
  id: string;
  name: string;
  world: { x0: number; y0: number; w: number; h: number };
  districts: District[];
  map: CityMapArt;
}

export interface Extraction {
  reel: Reel;
  city: City;
  places: Place[];
}
