import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { cityName } from './cityNames';
import type { City, Reel } from './types';

// A city's cover, with no credit to show (30 Oct 2026). Our own photo for each city people visit most,
// and for a video of a whole state ("Meghalaya", "Ladakh"): picked by hand from Unsplash under its free
// licence, which asks for no credit, and kept with the website (public/city-photos) so they don't add
// to the app's size. Any other town, here or abroad, shows a frame of its own video: a state's photo
// would show Charminar for Warangal.

/** Cities with their own photo, by the name the app files them under (lower case). */
const CITY = new Set([
  'delhi', 'mumbai', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'jaipur', 'udaipur', 'jodhpur',
  'jaisalmer', 'pushkar', 'agra', 'varanasi', 'lucknow', 'rishikesh', 'haridwar', 'amritsar', 'chandigarh',
  'shimla', 'manali', 'dharamshala', 'spiti', 'leh', 'srinagar', 'nainital', 'mussoorie', 'darjeeling',
  'gangtok', 'shillong', 'kaziranga', 'tawang', 'konark', 'goa', 'panaji', 'gokarna', 'hampi', 'mysuru',
  'coorg', 'ooty', 'kodaikanal', 'puducherry', 'madurai', 'thanjavur', 'mahabalipuram', 'rameswaram',
  'kanyakumari', 'kochi', 'munnar', 'alappuzha', 'kottayam', 'varkala', 'thiruvananthapuram', 'kozhikode',
  'wayanad', 'thrissur', 'ahmedabad', 'kutch', 'pune', 'aurangabad', 'khajuraho', 'andaman',
  'visakhapatnam', 'bhopal', 'ujjain',
]);

/** Other names a city comes under that cityName() doesn't file: the photo they share. */
const CITY_ALSO: Record<string, string> = {
  puri: 'konark',
  'mcleod ganj': 'dharamshala',
  mcleodganj: 'dharamshala',
  'fort kochi': 'kochi',
  'north goa': 'goa',
  'south goa': 'goa',
  'rann of kutch': 'kutch',
  bhuj: 'kutch',
  mamallapuram: 'mahabalipuram',
  'port blair': 'andaman',
  'havelock island': 'andaman',
  'swaraj dweep': 'andaman',
  ellora: 'aurangabad',
  'chhatrapati sambhajinagar': 'aurangabad',
  'leh ladakh': 'leh',
};

/** A video of a whole state or union territory: its photo (some share one with their best-known city). */
const STATE: Record<string, string> = {
  'andhra pradesh': 's-andhra-pradesh',
  'arunachal pradesh': 's-arunachal-pradesh',
  assam: 'kaziranga',
  bihar: 's-bihar',
  chhattisgarh: 's-chhattisgarh',
  goa: 's-goa',
  gujarat: 's-gujarat',
  haryana: 's-haryana',
  'himachal pradesh': 's-himachal-pradesh',
  jharkhand: 's-jharkhand',
  karnataka: 's-karnataka',
  kerala: 's-kerala',
  'madhya pradesh': 's-madhya-pradesh',
  maharashtra: 's-maharashtra',
  manipur: 's-manipur',
  meghalaya: 's-meghalaya',
  mizoram: 's-mizoram',
  nagaland: 's-nagaland',
  odisha: 's-odisha',
  punjab: 's-punjab',
  rajasthan: 's-rajasthan',
  sikkim: 's-sikkim',
  'tamil nadu': 's-tamil-nadu',
  telangana: 's-telangana',
  tripura: 's-tripura',
  'uttar pradesh': 's-uttar-pradesh',
  uttarakhand: 's-uttarakhand',
  'west bengal': 's-west-bengal',
  'andaman and nicobar islands': 'andaman',
  chandigarh: 'chandigarh',
  'dadra and nagar haveli and daman and diu': 's-dadra-daman-diu',
  delhi: 's-delhi',
  'jammu and kashmir': 's-jammu-kashmir',
  ladakh: 's-ladakh',
  lakshadweep: 's-lakshadweep',
  puducherry: 'puducherry',
};

// Other spellings the place data comes back with (as in lib/dress).
const STATE_ALSO: Record<string, string> = {
  orissa: 'odisha',
  uttaranchal: 'uttarakhand',
  pondicherry: 'puducherry',
  'nct of delhi': 'delhi',
  'national capital territory of delhi': 'delhi',
  'new delhi': 'delhi',
  'jammu & kashmir': 'jammu and kashmir',
  'andaman & nicobar islands': 'andaman and nicobar islands',
};

const lower = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/** Our photo's file name for a city, or a state read as the place; none for any other town. */
export function coverName(name: string): string | null {
  const city = lower(cityName(name));
  if (CITY.has(city)) return city;
  if (CITY_ALSO[city]) return CITY_ALSO[city];
  return STATE[STATE_ALSO[city] ?? city] ?? null;
}

// The web finds the photos beside the page. A phone asks the dev server it was loaded from while in
// development, and the live site otherwise.
const HOST = Constants.expoConfig?.hostUri;
const BASE = Platform.OS === 'web' ? '' : __DEV__ && HOST ? `http://${HOST}` : 'https://xplore.expo.app';

const coverUri = (file: string) => `${BASE}/city-photos/${file}.webp`;

const uriOf = (img: City['hero']) => (img && typeof img === 'object' && 'uri' in img ? String(img.uri) : null);

/** The same frame of the video as the city's first cover always was (extract's framePhoto, turn 1). */
const frameOf = (reel: Reel): City['hero'] => (reel.frames?.length ? { uri: reel.frames[1 % reel.frames.length] } : reel.thumbnail);

/**
 * The city wearing its cover, with no credit to show: our photo, else a frame of its video (`reel`).
 * Without the video at hand, a town comes back as it was.
 */
export function withCover(city: City, reel?: Reel): City {
  const file = coverName(city.name);
  const hero = file ? { uri: coverUri(file) } : reel ? frameOf(reel) : null;
  if (!hero) return city;
  const same = city.hero === hero || (uriOf(hero) !== null && uriOf(city.hero) === uriOf(hero));
  if (same && !city.heroCredit) return city;
  return { ...city, hero, heroCredit: undefined };
}
