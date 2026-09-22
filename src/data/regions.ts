// Region maps: a district-level view of somewhere you save a lot of spots, drawn with the same
// paper-map vocabulary as the city maps. Kerala is the only one for now, because it is home.
//
// District centres and radii are what the arrival geofences are built from. They are deliberately
// coarse — one region per district keeps us far inside iOS's 20-region limit, and an arrival is a
// "you're in Ernakulam" event, not a street-level one.

import type { Region } from './types';

export const KERALA: Region = {
  id: 'kerala',
  name: 'Kerala',
  world: { x0: 0, y0: 0, w: 1000, h: 1600 },
  districts: [
    { id: 'ernakulam', name: 'Ernakulam', state: 'Kerala', centre: { lat: 10.0, lng: 76.42 }, radiusKm: 30 },
    { id: 'kottayam', name: 'Kottayam', state: 'Kerala', centre: { lat: 9.62, lng: 76.55 }, radiusKm: 28 },
    { id: 'alappuzha', name: 'Alappuzha', state: 'Kerala', centre: { lat: 9.49, lng: 76.35 }, radiusKm: 25 },
    { id: 'idukki', name: 'Idukki', state: 'Kerala', centre: { lat: 9.85, lng: 76.97 }, radiusKm: 35 },
  ],
  map: {
    // The Arabian Sea lies west, so the coast runs top to bottom with land to its right.
    coast: [
      [190, -200], [200, 120], [175, 260], [150, 380], [165, 470], [200, 560], [235, 660],
      [250, 780], [235, 900], [210, 1010], [230, 1120], [265, 1240], [290, 1380], [300, 1800],
    ],
    // Vembanad, the lake Kottayam and Ernakulam share, as a chain of soft ellipses.
    water: [
      { cx: 360, cy: 640, rx: 55, ry: 120 },
      { cx: 395, cy: 830, rx: 48, ry: 130 },
      { cx: 430, cy: 1010, rx: 42, ry: 110 },
    ],
    rivers: [
      // Periyar, through Ernakulam.
      [[860, 470], [720, 500], [600, 530], [480, 570], [390, 600]],
      // Meenachil, through Kottayam town.
      [[840, 930], [700, 918], [600, 900], [500, 880], [440, 868]],
    ],
    roads: [
      // NH66 along the coast.
      [[230, 60], [215, 300], [200, 460], [245, 640], [270, 800], [255, 960], [280, 1130], [310, 1330], [320, 1600]],
      // MC Road, the inland spine through Kottayam.
      [[430, 180], [460, 380], [490, 560], [520, 740], [545, 920], [560, 1100], [590, 1300]],
      // Kottayam to Kumarakom.
      [[520, 900], [470, 880], [430, 860]],
      // Kottayam east into the hills.
      [[545, 920], [650, 960], [760, 1000]],
      // Kochi east towards the ghats.
      [[300, 470], [450, 490], [620, 500], [780, 510]],
    ],
    hills: [
      { cx: 860, cy: 380, rx: 160, ry: 110 },
      { cx: 860, cy: 380, rx: 95, ry: 62 },
      { cx: 880, cy: 780, rx: 150, ry: 120 },
      { cx: 880, cy: 780, rx: 88, ry: 68 },
      { cx: 820, cy: 1090, rx: 170, ry: 130 },
      { cx: 820, cy: 1090, rx: 100, ry: 75 },
    ],
    // District edges, drawn as quiet dotted lines rather than hard borders.
    borders: [
      [[240, 700], [420, 716], [600, 700], [780, 680], [1000, 658]],
      [[700, 700], [732, 900], [720, 1100], [690, 1280]],
      [[300, 1190], [480, 1206], [660, 1210], [860, 1188]],
    ],
    labels: [
      { text: 'Arabian Sea', x: 56, y: 900, kind: 'sea' },
      { text: 'ERNAKULAM', x: 470, y: 470, kind: 'area' },
      { text: 'KOTTAYAM', x: 508, y: 1012, kind: 'area' },
      { text: 'ALAPPUZHA', x: 316, y: 1096, kind: 'area', anchor: 'end' },
      { text: 'IDUKKI', x: 846, y: 906, kind: 'area' },
    ],
  },
};

export const regions: Record<string, Region> = { kerala: KERALA };

export const allDistricts = Object.values(regions).flatMap((r) => r.districts);

export const getRegion = (id: string | undefined) => (id ? regions[id] : undefined);

export const getDistrict = (id: string | undefined) =>
  id ? allDistricts.find((d) => d.id === id) : undefined;
