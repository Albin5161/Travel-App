import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { cityName } from './cityNames';
import type { City } from './types';

// A city's cover, with no credit to show (30 Oct 2026). Our own photo for each city people visit most,
// and for a video of a whole state ("Meghalaya", "Ladakh"): picked by hand from Unsplash under its free
// licence, which asks for no credit, and kept with the website (public/city-photos) so they don't add
// to the app's size. Any other town shows its state's craft pattern: a state's photo would show
// Charminar for Warangal, and a frame of the video was too often a person.

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
  // Added 30 Oct: Kerala's districts and spots, more towns across India, and the places abroad people
  // most often go. A place we couldn't find a photo that clearly shows it gets its state's pattern.
  'idukki', 'palakkad', 'kannur', 'kasaragod', 'vagamon', 'kumarakom', 'athirappilly', 'kovalam', 'guruvayur',
  'mangaluru', 'udupi', 'chikmagalur', 'tirupati', 'warangal', 'mount abu', 'ranthambore', 'bikaner', 'ajmer',
  'mathura', 'vrindavan', 'prayagraj', 'kasol', 'dalhousie', 'auli', 'pelling', 'cherrapunji', 'dawki',
  'kohima', 'bhubaneswar', 'sundarbans', 'lonavala', 'mahabaleshwar', 'nashik', 'alibaug', 'dwarka',
  'somnath', 'vadodara', 'indore', 'gwalior', 'orchha', 'patna', 'jim corbett', 'kedarnath', 'gulmarg',
  'pahalgam', 'sonmarg', 'nubra', 'chittorgarh', 'kumbhalgarh',
  'vietnam', 'hanoi', 'ho chi minh city', 'da nang', 'hoi an', 'thailand', 'bangkok', 'phuket', 'krabi',
  'chiang mai', 'bali', 'ubud', 'dubai', 'abu dhabi', 'singapore', 'kuala lumpur', 'langkawi', 'sri lanka',
  'ella', 'maldives', 'kathmandu', 'pokhara', 'bhutan', 'tokyo', 'kyoto', 'paris', 'london', 'switzerland',
  'rome', 'venice', 'istanbul', 'cappadocia', 'cairo', 'new york', 'seoul', 'hong kong', 'sydney', 'baku',
  'almaty',
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
  // The ones that point at a file of another name: a state's photo that is this very place.
  'bodh gaya': 's-bihar',
  bodhgaya: 's-bihar',
  imphal: 's-manipur',
  aizawl: 's-mizoram',
  agartala: 's-tripura',
  sohra: 'cherrapunji',
  cherrapunjee: 'cherrapunji',
  'jim corbett national park': 'jim corbett',
  corbett: 'jim corbett',
  'nubra valley': 'nubra',
  saigon: 'ho chi minh city',
  'ho chi minh': 'ho chi minh city',
  danang: 'da nang',
  'new york city': 'new york',
  nyc: 'new york',
  manhattan: 'new york',
  // A video of a whole country: its best-known place.
  nepal: 'kathmandu',
  japan: 'tokyo',
  france: 'paris',
  italy: 'rome',
  turkey: 'istanbul',
  türkiye: 'istanbul',
  egypt: 'cairo',
  'united arab emirates': 'dubai',
  uae: 'dubai',
  malaysia: 'kuala lumpur',
  indonesia: 'bali',
  'south korea': 'seoul',
  korea: 'seoul',
  australia: 'sydney',
  azerbaijan: 'baku',
  kazakhstan: 'almaty',
  'united kingdom': 'london',
  england: 'london',
  uk: 'london',
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
  const known = CITY.has(city) ? city : CITY_ALSO[city];
  // A name with spaces is saved with dashes ("mount abu" is mount-abu.webp).
  if (known) return known.replace(/ /g, '-');
  return STATE[STATE_ALSO[city] ?? city] ?? null;
}

// The web finds the photos beside the page. A phone asks the dev server it was loaded from while in
// development, and the live site otherwise.
const HOST = Constants.expoConfig?.hostUri;
const BASE = Platform.OS === 'web' ? '' : __DEV__ && HOST ? `http://${HOST}` : 'https://xplore.expo.app';

const coverUri = (file: string) => `${BASE}/city-photos/${file}.webp`;

// Every state's craft pattern as a cover (the share story's patterns, drawn out once on 30 Oct 2026
// into public/city-photos/pattern-<state>.jpg): for a town we have no photo of. Never a frame of its
// video, which was often a person (Vietnam, Palakkad).
const PATTERNED = new Set([
  'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa', 'gujarat', 'haryana',
  'himachal pradesh', 'jharkhand', 'karnataka', 'kerala', 'madhya pradesh', 'maharashtra', 'manipur',
  'meghalaya', 'mizoram', 'nagaland', 'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana',
  'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal', 'delhi', 'jammu and kashmir', 'ladakh', 'puducherry',
]);
/** The pattern for a town in `state`; anywhere else (abroad, a territory without one) gets paisley on indigo. */
const patternUri = (state: string) => {
  const st = lower(state);
  const name = STATE_ALSO[st] ?? st;
  return `${BASE}/city-photos/pattern-${(PATTERNED.has(name) ? name : 'elsewhere').replace(/ /g, '-')}.jpg`;
};

const uriOf = (img: City['hero']) => (img && typeof img === 'object' && 'uri' in img ? String(img.uri) : null);

/** The city wearing its cover, with no credit to show: our photo of it, else its state's pattern. */
export function withCover(city: City): City {
  const file = coverName(city.name);
  const uri = file ? coverUri(file) : patternUri(city.state);
  if (uriOf(city.hero) === uri && !city.heroCredit) return city;
  return { ...city, hero: { uri }, heroCredit: undefined };
}
