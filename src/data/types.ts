import type { ImageSourcePropType } from 'react-native';

import type { LatLng, Point } from '@/lib/geo';

export type PlaceType = 'food' | 'stay' | 'sight' | 'experience';
export type DayPart = 'morning' | 'afternoon' | 'evening';
export type Platform = 'instagram' | 'youtube';

export type PlaceSource =
  | { kind: 'reel'; reelId: string; timestamp: string }
  | { kind: 'local' };

export interface Place {
  id: string;
  cityId: string;
  name: string;
  type: PlaceType;
  area: string;
  photo: ImageSourcePropType;
  why: string;
  source: PlaceSource;
  bestTime: DayPart;
  cost: 0 | 1 | 2 | 3;
  minutes: number;
  coords: LatLng;
  /** Position on the city's stylised map, in world units. */
  map: Point;
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
  hero: ImageSourcePropType;
  map: CityMapArt;
}

export interface Extraction {
  reel: Reel;
  city: City;
  places: Place[];
}
