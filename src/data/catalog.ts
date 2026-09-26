import type { City, Place, Reel } from './types';

const photos = {
  gokTemple: require('@/assets/images/places/gok-temple.jpg'),
  gokMainBeach: require('@/assets/images/places/gok-mainbeach.jpg'),
  gokKudle: require('@/assets/images/places/gok-kudle.jpg'),
  gokCafe: require('@/assets/images/places/gok-cafe.jpg'),
  gokParadise: require('@/assets/images/places/gok-paradise.jpg'),
  gokHalfMoon: require('@/assets/images/places/gok-halfmoon.jpg'),
  gokOm: require('@/assets/images/places/gok-om.jpg'),
  gokThali: require('@/assets/images/places/gok-thali.jpg'),
  gokAerial: require('@/assets/images/places/gok-aerial.jpg'),
  kochiWaterfront: require('@/assets/images/places/kochi-waterfront.jpg'),
  kochiMural: require('@/assets/images/places/kochi-mural.jpg'),
  kochiStreet: require('@/assets/images/places/kochi-street.jpg'),
  kochiPier: require('@/assets/images/places/kochi-pier.jpg'),
  megValley: require('@/assets/images/places/meg-valley.jpg'),
  megFalls: require('@/assets/images/places/meg-falls.jpg'),
  megBridge: require('@/assets/images/places/meg-bridge.jpg'),
  megDawki: require('@/assets/images/places/meg-dawki.jpg'),
  // Kottayam placeholders: real places, stand-in photography until the district is shot.
  ktmIllickal: require('@/assets/images/places/meg-valley.jpg'),
  ktmMarmala: require('@/assets/images/places/meg-falls.jpg'),
  ktmKumarakom: require('@/assets/images/places/kochi-waterfront.jpg'),
  ktmCafe: require('@/assets/images/places/gok-cafe.jpg'),
  ktmVaikom: require('@/assets/images/places/gok-temple.jpg'),
  ktmThali: require('@/assets/images/places/gok-thali.jpg'),
};

export const heroDusk = require('@/assets/images/places/hero-dusk.jpg');

export const cities: Record<string, City> = {
  gokarna: {
    id: 'gokarna',
    name: 'Gokarna',
    state: 'Karnataka',
    district: 'Uttara Kannada',
    hero: photos.gokAerial,
    map: {
      coast: [
        [300, -600], [305, 0], [340, 150], [352, 212], [330, 300], [290, 370], [330, 440],
        [420, 500], [438, 548], [415, 620], [385, 690], [430, 760], [545, 790], [560, 822],
        [540, 870], [470, 935], [520, 985], [555, 1012], [530, 1060], [488, 1105], [520, 1160],
        [548, 1190], [530, 1250], [515, 1400], [510, 2000],
      ],
      roads: [
        [[478, 250], [540, 330], [590, 470], [620, 640], [640, 780], [650, 960], [660, 1200], [670, 2000]],
        [[478, 250], [470, 120], [480, -600]],
        [[590, 470], [530, 520], [470, 540]],
        [[640, 780], [600, 810], [580, 820]],
      ],
      trails: [
        [[455, 560], [410, 650], [440, 740], [530, 800], [575, 825]],
        [[575, 830], [500, 925], [560, 1005], [570, 1012]],
        [[570, 1018], [495, 1100], [555, 1180]],
      ],
      hills: [
        { cx: 770, cy: 420, rx: 150, ry: 95 },
        { cx: 770, cy: 420, rx: 80, ry: 48 },
        { cx: 830, cy: 900, rx: 170, ry: 115 },
        { cx: 830, cy: 900, rx: 95, ry: 60 },
      ],
      labels: [
        { text: 'Arabian Sea', x: 150, y: 820, kind: 'sea' },
        { text: 'GOKARNA', x: 520, y: 330, kind: 'area' },
        { text: 'KUDLE', x: 405, y: 560, kind: 'area', anchor: 'end' },
        { text: 'OM', x: 525, y: 835, kind: 'area', anchor: 'end' },
        { text: 'HALF MOON', x: 520, y: 1024, kind: 'area', anchor: 'end' },
        { text: 'PARADISE', x: 512, y: 1200, kind: 'area', anchor: 'end' },
      ],
    },
  },
  kochi: {
    id: 'kochi',
    name: 'Kochi',
    state: 'Kerala',
    district: 'Ernakulam',
    regionId: 'kerala',
    hero: photos.kochiMural,
    map: {
      coast: [
        [300, 2000], [310, 900], [360, 600], [380, 470], [420, 380], [500, 300], [620, 270],
        [760, 250], [1000, 240], [1600, 230],
      ],
      water: [{ cx: 1080, cy: 700, rx: 190, ry: 430 }],
      roads: [
        [[430, 420], [520, 470], [640, 600], [760, 760], [900, 1000], [980, 2000]],
        [[540, 330], [520, 470]],
      ],
      hills: [],
      labels: [
        { text: 'Arabian Sea', x: 120, y: 700, kind: 'sea' },
        { text: 'FORT KOCHI', x: 560, y: 570, kind: 'area' },
        { text: 'MATTANCHERRY', x: 740, y: 830, kind: 'area', anchor: 'end' },
      ],
    },
  },
  meghalaya: {
    id: 'meghalaya',
    name: 'Meghalaya',
    state: 'Meghalaya',
    district: 'East Khasi Hills',
    hero: photos.megValley,
    terrain: 'hilly',
    map: {
      rivers: [[[700, 1500], [760, 1150], [820, 1020], [900, 850], [980, 600], [1100, 300], [1200, -200]]],
      roads: [
        [[480, 150], [380, 240], [300, 330], [260, 470]],
        [[380, 240], [560, 520], [700, 780], [820, 1020]],
      ],
      borders: [[[-500, 1250], [400, 1230], [900, 1180], [1600, 1160]]],
      hills: [
        { cx: 380, cy: 260, rx: 220, ry: 140 },
        { cx: 380, cy: 260, rx: 130, ry: 80 },
        { cx: 300, cy: 520, rx: 180, ry: 110 },
        { cx: 620, cy: 700, rx: 200, ry: 120 },
        { cx: 620, cy: 700, rx: 110, ry: 60 },
      ],
      labels: [
        { text: 'SOHRA', x: 330, y: 250, kind: 'area' },
        { text: 'DAWKI', x: 860, y: 1070, kind: 'area' },
        { text: 'Bangladesh', x: 420, y: 1330, kind: 'sea' },
      ],
    },
  },
  // Home. Inland, so no coast: Vembanad sits to the west and the ghats to the east.
  kottayam: {
    id: 'kottayam',
    name: 'Kottayam',
    state: 'Kerala',
    district: 'Kottayam',
    regionId: 'kerala',
    hero: photos.ktmKumarakom,
    map: {
      water: [{ cx: 110, cy: 700, rx: 215, ry: 430 }],
      rivers: [[[1120, 560], [900, 600], [700, 660], [540, 720], [400, 762], [300, 790]]],
      roads: [
        [[560, -250], [580, 100], [600, 400], [620, 700], [640, 1000], [660, 1450]],
        [[600, 400], [460, 428], [330, 452], [250, 470]],
        [[620, 700], [780, 762], [920, 842], [1020, 920]],
        [[580, 100], [420, 58], [300, 40]],
        [[640, 1000], [820, 1010], [900, 1010]],
      ],
      hills: [
        { cx: 980, cy: 900, rx: 172, ry: 122 },
        { cx: 980, cy: 900, rx: 100, ry: 70 },
        { cx: 1060, cy: 1250, rx: 140, ry: 100 },
      ],
      labels: [
        { text: 'Vembanad', x: 110, y: 700, kind: 'sea', anchor: 'middle' },
        { text: 'KOTTAYAM', x: 648, y: 384, kind: 'area' },
        { text: 'KUMARAKOM', x: 300, y: 430, kind: 'area', anchor: 'end' },
        { text: 'TEEKOY', x: 964, y: 828, kind: 'area' },
        { text: 'VAIKOM', x: 288, y: 18, kind: 'area', anchor: 'end' },
      ],
    },
  },
};

export const reels: Record<string, Reel> = {
  'reel-gokarna': {
    id: 'reel-gokarna',
    platform: 'youtube',
    creator: '@konkan.trails',
    title: 'Gokarna in 48 hours: every beach you can walk to',
    duration: '12:40',
    thumbnail: photos.gokOm,
    cityId: 'gokarna',
    placeIds: ['gok-om', 'gok-temple', 'gok-mainbeach', 'gok-kudle', 'gok-cafe', 'gok-halfmoon', 'gok-paradise'],
  },
  'reel-kochi': {
    id: 'reel-kochi',
    platform: 'instagram',
    creator: '@slowdays.kochi',
    title: 'Fort Kochi, the slow way',
    duration: '0:48',
    thumbnail: photos.kochiMural,
    cityId: 'kochi',
    placeIds: ['kochi-waterfront', 'kochi-mural', 'kochi-street', 'kochi-pier'],
  },
  'reel-meghalaya': {
    id: 'reel-meghalaya',
    platform: 'instagram',
    creator: '@northeast.notes',
    title: "Meghalaya: 4 stops you won't forget",
    duration: '1:12',
    thumbnail: photos.megDawki,
    cityId: 'meghalaya',
    placeIds: ['meg-valley', 'meg-falls', 'meg-bridge', 'meg-dawki'],
  },
  'reel-kottayam': {
    id: 'reel-kottayam',
    platform: 'instagram',
    creator: '@kottayam.diaries',
    title: 'Hidden spots in Kottayam nobody tells you about',
    duration: '1:04',
    thumbnail: photos.ktmIllickal,
    cityId: 'kottayam',
    placeIds: ['ktm-illickal', 'ktm-marmala', 'ktm-kumarakom', 'ktm-cafe', 'ktm-vaikom'],
  },
};

const reel = (reelId: string, timestamp: string) => ({ kind: 'reel' as const, reelId, timestamp });

const placeList: Place[] = [
  // Gokarna — from @konkan.trails
  {
    id: 'gok-temple', cityId: 'gokarna', name: 'Mahabaleshwar Temple', type: 'sight', area: 'Gokarna Town',
    photo: photos.gokTemple, why: "Gokarna's ancient Shiva temple. Go at dawn for the aarti and the quiet lanes.",
    source: reel('reel-gokarna', '0:34'), bestTime: 'morning', cost: 0, minutes: 45,
    coords: { lat: 14.5439, lng: 74.3187 }, map: [478, 250], order: 1,
  },
  {
    id: 'gok-mainbeach', cityId: 'gokarna', name: 'Gokarna Beach', type: 'sight', area: 'Gokarna Town',
    photo: photos.gokMainBeach, why: 'Two minutes from the temple. Fishing boats, and a slow chai to start the day.',
    source: reel('reel-gokarna', '1:05'), bestTime: 'morning', cost: 0, minutes: 40,
    coords: { lat: 14.5452, lng: 74.316 }, map: [372, 205], order: 2,
  },
  {
    id: 'gok-kudle', cityId: 'gokarna', name: 'Kudle Beach', type: 'sight', area: 'Kudle',
    photo: photos.gokKudle, why: 'A 20-minute walk over the headland from town. Wide, calm and easy to swim.',
    source: reel('reel-gokarna', '3:12'), bestTime: 'afternoon', cost: 0, minutes: 90,
    coords: { lat: 14.5288, lng: 74.3183 }, map: [455, 545], order: 1,
  },
  {
    id: 'gok-cafe', cityId: 'gokarna', name: 'Strawberry Farms Café', type: 'food', area: 'Kudle Beach',
    photo: photos.gokCafe, why: 'The beach shack for a long lunch: thalis, shakes and hammocks in the shade.',
    source: reel('reel-gokarna', '4:20'), bestTime: 'afternoon', cost: 2, minutes: 60,
    coords: { lat: 14.53, lng: 74.318 }, map: [545, 455], order: 2,
  },
  {
    id: 'gok-paradise', cityId: 'gokarna', name: 'Paradise Beach', type: 'sight', area: 'Cliff trail',
    photo: photos.gokParadise, why: "The wildest of the five. Rocky, no shacks, so carry water. Take a boat from Om if you're short on time.",
    source: reel('reel-gokarna', '9:02'), bestTime: 'afternoon', cost: 0, minutes: 75,
    coords: { lat: 14.5086, lng: 74.3225 }, map: [566, 1188], order: 3,
  },
  {
    id: 'gok-halfmoon', cityId: 'gokarna', name: 'Half Moon Beach', type: 'sight', area: 'Cliff trail',
    photo: photos.gokHalfMoon, why: 'Only reachable on foot or by boat, so it stays quiet. 30 minutes from Om on the cliff path.',
    source: reel('reel-gokarna', '7:45'), bestTime: 'afternoon', cost: 0, minutes: 60,
    coords: { lat: 14.514, lng: 74.3235 }, map: [572, 1010], order: 4,
  },
  {
    id: 'gok-om', cityId: 'gokarna', name: 'Om Beach', type: 'sight', area: 'Om Beach, Gokarna',
    photo: photos.gokOm, why: 'Walk the cliff path from Kudle around 5pm. The sunset lights up the whole bay.',
    source: reel('reel-gokarna', '1:42'), bestTime: 'evening', cost: 0, minutes: 120,
    coords: { lat: 14.5196, lng: 74.3242 }, map: [578, 820], order: 1,
  },
  // Gokarna — local recommendation (gap-fill only)
  {
    id: 'gok-prema', cityId: 'gokarna', name: 'Prema Restaurant', type: 'food', area: 'Gokarna Town',
    photo: photos.gokThali, why: 'A simple veg thali, and the gadbad ice cream everyone in town talks about.',
    source: { kind: 'local' }, bestTime: 'evening', cost: 1, minutes: 45,
    coords: { lat: 14.5441, lng: 74.3181 }, map: [452, 222], order: 2,
  },
  // Kochi — from @slowdays.kochi
  {
    id: 'kochi-mural', cityId: 'kochi', name: 'Fort Kochi Street Art', type: 'experience', area: 'Fort Kochi',
    photo: photos.kochiMural, why: 'Lanes of murals, many left over from the Biennale. Best explored on foot, early.',
    source: reel('reel-kochi', '0:18'), bestTime: 'morning', cost: 0, minutes: 90,
    coords: { lat: 9.9655, lng: 76.2445 }, map: [520, 470], regionPoint: [232, 512], order: 1,
  },
  {
    id: 'kochi-street', cityId: 'kochi', name: 'Jew Town, Mattancherry', type: 'sight', area: 'Mattancherry',
    photo: photos.kochiStreet, why: 'Antique shops and old spice warehouses. Go before noon, ahead of the crowds.',
    source: reel('reel-kochi', '0:29'), bestTime: 'morning', cost: 1, minutes: 120,
    coords: { lat: 9.9575, lng: 76.2596 }, map: [760, 760], regionPoint: [258, 548], order: 2,
  },
  {
    id: 'kochi-pier', cityId: 'kochi', name: 'Fort Kochi Jetty', type: 'experience', area: 'Fort Kochi',
    photo: photos.kochiPier, why: 'Take the ferry across the harbour for the cheapest view of the city.',
    source: reel('reel-kochi', '0:40'), bestTime: 'afternoon', cost: 1, minutes: 45,
    coords: { lat: 9.969, lng: 76.245 }, map: [540, 330], regionPoint: [214, 530], order: 1,
  },
  {
    id: 'kochi-waterfront', cityId: 'kochi', name: 'Fort Kochi Waterfront', type: 'sight', area: 'Fort Kochi',
    photo: photos.kochiWaterfront, why: 'Watch the Chinese fishing nets being hauled in at golden hour.',
    source: reel('reel-kochi', '0:05'), bestTime: 'evening', cost: 0, minutes: 60,
    coords: { lat: 9.967, lng: 76.242 }, map: [430, 420], regionPoint: [226, 498], order: 1,
  },
  // Meghalaya — from @northeast.notes
  {
    id: 'meg-valley', cityId: 'meghalaya', name: 'Mawkdok Dympep Valley', type: 'sight', area: 'Sohra road',
    photo: photos.megValley, why: 'The first big view on the drive to Sohra. Stop early, before the clouds roll in.',
    source: reel('reel-meghalaya', '0:06'), bestTime: 'morning', cost: 0, minutes: 30,
    coords: { lat: 25.443, lng: 91.819 }, map: [480, 150], order: 1,
  },
  {
    id: 'meg-falls', cityId: 'meghalaya', name: 'Nohkalikai Falls', type: 'sight', area: 'Sohra',
    photo: photos.megFalls, why: "India's tallest plunge waterfall. The viewpoint is a short walk from the car park.",
    source: reel('reel-meghalaya', '0:21'), bestTime: 'morning', cost: 1, minutes: 60,
    coords: { lat: 25.275, lng: 91.689 }, map: [300, 330], order: 2,
  },
  {
    id: 'meg-bridge', cityId: 'meghalaya', name: 'Nongriat Bridge Trail', type: 'experience', area: 'Nongriat',
    photo: photos.megBridge, why: 'Thousands of steps down to the root bridges. Start by 8am and pack light.',
    source: reel('reel-meghalaya', '0:39'), bestTime: 'afternoon', cost: 1, minutes: 240,
    coords: { lat: 25.249, lng: 91.672 }, map: [260, 470], order: 1,
  },
  {
    id: 'meg-dawki', cityId: 'meghalaya', name: 'Umngot River, Dawki', type: 'experience', area: 'Dawki',
    photo: photos.megDawki, why: "Water so clear the boats look like they're floating. Go around noon for the best light.",
    source: reel('reel-meghalaya', '0:58'), bestTime: 'evening', cost: 2, minutes: 90,
    coords: { lat: 25.186, lng: 92.02 }, map: [820, 1020], order: 1,
  },
  // Kottayam — from @kottayam.diaries. Home district: these are weekend spots, not a trip.
  {
    id: 'ktm-illickal', cityId: 'kottayam', name: 'Illickal Kallu', type: 'sight', area: 'Teekoy',
    photo: photos.ktmIllickal, why: 'Three rocks above the clouds, an hour and a half east. Go early: the mist closes in by eleven.',
    source: reel('reel-kottayam', '0:08'), bestTime: 'morning', cost: 1, minutes: 180,
    coords: { lat: 9.7167, lng: 76.7833 }, map: [1020, 920], regionPoint: [772, 1012], order: 1,
  },
  {
    id: 'ktm-marmala', cityId: 'kottayam', name: 'Marmala Waterfall', type: 'sight', area: 'Teekoy',
    photo: photos.ktmMarmala, why: 'A short scramble off the Teekoy road to a plunge pool most people drive straight past.',
    source: reel('reel-kottayam', '0:26'), bestTime: 'morning', cost: 0, minutes: 90,
    coords: { lat: 9.6833, lng: 76.75 }, map: [900, 1010], regionPoint: [726, 1058], order: 2,
  },
  {
    id: 'ktm-kumarakom', cityId: 'kottayam', name: 'Kumarakom Backwaters', type: 'experience', area: 'Kumarakom',
    photo: photos.ktmKumarakom, why: 'Twenty minutes west to Vembanad. Take the 5pm country boat, not the houseboat.',
    source: reel('reel-kottayam', '0:41'), bestTime: 'evening', cost: 2, minutes: 120,
    coords: { lat: 9.6178, lng: 76.43 }, map: [280, 470], regionPoint: [434, 858], order: 1,
  },
  {
    id: 'ktm-cafe', cityId: 'kottayam', name: 'Ark Cafe', type: 'food', area: 'Kottayam Town',
    photo: photos.ktmCafe, why: 'The one from the reel: filter coffee and beef ularthiyathu, five minutes off MC Road.',
    source: reel('reel-kottayam', '0:52'), bestTime: 'afternoon', cost: 1, minutes: 60,
    coords: { lat: 9.5916, lng: 76.5222 }, map: [620, 640], regionPoint: [522, 906], order: 2,
  },
  {
    id: 'ktm-vaikom', cityId: 'kottayam', name: 'Vaikom Mahadeva Temple', type: 'sight', area: 'Vaikom',
    photo: photos.ktmVaikom, why: 'North-west, on the way to Ernakulam. Worth the stop for the evening deeparadhana.',
    source: reel('reel-kottayam', '0:58'), bestTime: 'evening', cost: 0, minutes: 60,
    coords: { lat: 9.7486, lng: 76.3936 }, map: [310, 40], regionPoint: [428, 700], order: 3,
  },
  // Kottayam — local recommendation (gap-fill only)
  {
    id: 'ktm-thali', cityId: 'kottayam', name: 'Thali at Meenachil Mess', type: 'food', area: 'Kottayam Town',
    photo: photos.ktmThali, why: 'A proper Kerala sadya on a banana leaf. Lunch only, and they stop at two.',
    source: { kind: 'local' }, bestTime: 'afternoon', cost: 1, minutes: 45,
    coords: { lat: 9.5942, lng: 76.5188 }, map: [668, 704], regionPoint: [534, 930], order: 3,
  },
];

export const places: Record<string, Place> = Object.fromEntries(placeList.map((p) => [p.id, p]));

export const localPicks: Record<string, string[]> = {
  gokarna: ['gok-prema'],
  kottayam: ['ktm-thali'],
};

export const SAMPLE_LINK = 'https://youtu.be/konkan-trails-gokarna-48h';
