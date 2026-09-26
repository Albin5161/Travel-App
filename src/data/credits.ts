// Photo credits shown in the app, from CREDITS.md. Creative Commons BY and BY-SA ask for the
// title, author, source, licence and any changes wherever the photo is shown publicly, so every
// one of those is here. Keep this in step with CREDITS.md when photos change.
import type { ImageSourcePropType } from 'react-native';

export type Credit = {
  photo: ImageSourcePropType;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  /** Where the app uses it, when that isn't what the photo shows. */
  standIn?: string;
};

const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`;
const CC = {
  'CC BY 2.5': 'https://creativecommons.org/licenses/by/2.5/',
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
} as const;
const cc = (license: keyof typeof CC) => ({ license, licenseUrl: CC[license] });

export const CREDITS: Credit[] = [
  {
    photo: require('@/assets/images/places/gok-temple.jpg'),
    title: 'Main entry to the Mahabaleshwar Temple at Gokaran',
    author: 'Nvvchar',
    ...cc('CC BY-SA 3.0'),
    sourceUrl: commons('Main entry to the Mahabaleshwar Temple at Gokaran.jpg'),
    standIn: 'Also stands in for Vaikom Mahadeva Temple',
  },
  {
    photo: require('@/assets/images/places/gok-kudle.jpg'),
    title: 'Kudle beach gokarna',
    author: 'Happyshopper',
    ...cc('CC BY 2.5'),
    sourceUrl: commons('Kudle beach gokarna.jpg'),
  },
  {
    photo: require('@/assets/images/places/gok-halfmoon.jpg'),
    title: 'Half Moon Beach Gokarna Karnatak 05',
    author: 'Sourabh.biswas003',
    ...cc('CC BY-SA 4.0'),
    sourceUrl: commons('PXL 20260103 091848995.MP Half Moon Beach Gokarna Karnatak 05.jpg'),
  },
  {
    photo: require('@/assets/images/places/gok-paradise.jpg'),
    title: 'Paradise beach gokarna, Paradise Beach Trail 18',
    author: 'Sourabh.biswas003',
    ...cc('CC BY-SA 4.0'),
    sourceUrl: commons('PXL 20260103 054657562.MP Paradise beach gokarna Paradise Beach Trail, Gokarna, Karnataka 581326 18.jpg'),
  },
  {
    photo: require('@/assets/images/places/gok-cafe.jpg'),
    title: 'Strawberry Farms, Kudle Beach, Gokarna 01',
    author: 'Devender Goyal',
    ...cc('CC BY-SA 4.0'),
    sourceUrl: commons('Strawberry Farms, Kudle Beach, Gokarna 01.jpg'),
    standIn: 'Also stands in for Ark Cafe, Kottayam',
  },
  {
    photo: require('@/assets/images/places/gok-thali.jpg'),
    title: 'Vegetarian thali Karnataka DSC0004',
    author: 'Maina Bosco',
    ...cc('CC BY-SA 4.0'),
    sourceUrl: commons('Vegetarian thali Karnataka DSC0004.jpg'),
    standIn: 'Also stands in for Thali at Meenachil Mess, Kottayam',
  },
];

/** Changes made to every Creative Commons photo above, as the licences ask to be stated. */
export const CHANGES = 'Resized; no other changes.';

/** Places from pasted videos: their photos come from Google or Wikimedia Commons, credited where shown. */
export const FROM_VIDEOS =
  'Photos of places from your videos come from Google Maps or Wikimedia Commons. Each shows its author, and a Commons photo its licence, wherever it appears. Commons photos are resized; no other changes. A place with no photo shows a frame from its video.';

export const UNSPLASH = {
  note: 'Photos of Gokarna, Fort Kochi and Meghalaya not listed above are from Unsplash, under the Unsplash License.',
  url: 'https://unsplash.com/license',
};

/** The Kottayam spots are real, but not yet photographed: these borrow other places' photos. */
export const STAND_INS = [
  { spot: 'Illickal Kallu', using: 'a Meghalaya valley (Unsplash)' },
  { spot: 'Marmala Waterfall', using: 'a Meghalaya waterfall (Unsplash)' },
  { spot: 'Kumarakom Backwaters', using: 'the Fort Kochi waterfront (Unsplash)' },
  { spot: 'Ark Cafe', using: 'a Gokarna café (listed above)' },
  { spot: 'Vaikom Mahadeva Temple', using: 'the Gokarna temple (listed above)' },
  { spot: 'Thali at Meenachil Mess', using: 'a Karnataka thali (listed above)' },
];
