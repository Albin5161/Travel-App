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

/** The meal a place to eat is for, as the model knows it. `unknown` when it can't tell. */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'cafe' | 'snack' | 'dessert' | 'unknown';
/** When a place is at its best, finer than morning / afternoon / evening. */
export type TimeWindow = 'early_morning' | 'morning' | 'afternoon' | 'sunset' | 'evening' | 'night';

/**
 * What the model knows of a place that helps time it in a day: facts about the place, never a plan.
 * Every field is optional: a place saved before these were asked for has none, and the planner
 * falls back to its kind, its best part of the day and its name.
 */
export interface PlaceFacts {
  // What it is.
  /** For a place to eat: the kind of food stop. Says nothing about the hour. */
  meal?: MealType | null;
  /** The wider area its `area` is part of: "Fort Kochi" is in "Kochi". */
  parentArea?: string | null;

  // When to go.
  /** Its best time. `sunset` here means "go for the sunset": the one strong claim on that hour. */
  window?: TimeWindow | null;
  /**
   * It can also be good at sunset, at sunrise, or after dark. Weaker than `window`: a beach that's
   * best in the morning and pretty at sunset is still a morning place.
   */
  sunset?: boolean;
  sunrise?: boolean;
  night?: boolean;

  /**
   * How sure the model was of the timing answers above, 0 to 1. The less sure, the more loosely the
   * planner holds the place to them. Absent means as sure as any.
   */
  sure?: number | null;
}

export interface Place {
  id: string;
  cityId: string;
  name: string;
  type: PlaceType;
  area: string;
  photo: ImageSourcePropType;
  /** Who took a Google photo. Google requires the credit wherever the photo is shown. */
  photoCredit?: string;
  /**
   * The picture is a frame from the video (or a reel's cover), not a photo of the place: when a
   * photo was last looked for, so it's looked for again after 30 days, not on every launch.
   */
  photoFromVideo?: number;
  why: string;
  source: PlaceSource;
  bestTime: DayPart;
  /** Finer facts for timing, from links read since October 2026. Absent on older places. */
  facts?: PlaceFacts;
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
  /**
   * Frames from the video itself (YouTube's, at about a quarter, half and three quarters in). A place
   * without a photo of its own shows one of these, never the thumbnail with its title text.
   */
  frames?: string[];
  /** How many pictures an Instagram photo post has; 0 for a reel. Absent on YouTube and on anything read before posts' pictures were. */
  slides?: number;
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
