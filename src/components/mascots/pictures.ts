import type { Dress } from '@/lib/dress';

// Amma and the child in 3D, one picture per outfit and pose, cut out of their white background on
// the Mac. Amma is always on the left, framed from the hips up. Redrawn 30 Oct 2026 in the matte clay
// style of the app's 3D icons (simple dot-eyed faces): the first set's film-like faces didn't sit
// with the rest of the app. Full-size pictures in docs/mockups/mascot-clay/raw.

export type Pose = 'reading' | 'found' | 'worried' | 'idle';

/** Bundled pictures: what `require` hands back for an asset. */
export const PICTURES: Record<Dress, Record<Pose, number>> = {
  south: {
    reading: require('@/assets/images/mascots3d/south-reading.png'),
    found: require('@/assets/images/mascots3d/south-found.png'),
    worried: require('@/assets/images/mascots3d/south-worried.png'),
    idle: require('@/assets/images/mascots3d/south-idle.png'),
  },
  north: {
    reading: require('@/assets/images/mascots3d/north-reading.png'),
    found: require('@/assets/images/mascots3d/north-found.png'),
    worried: require('@/assets/images/mascots3d/north-worried.png'),
    idle: require('@/assets/images/mascots3d/north-idle.png'),
  },
  west: {
    reading: require('@/assets/images/mascots3d/west-reading.png'),
    found: require('@/assets/images/mascots3d/west-found.png'),
    worried: require('@/assets/images/mascots3d/west-worried.png'),
    idle: require('@/assets/images/mascots3d/west-idle.png'),
  },
  east: {
    reading: require('@/assets/images/mascots3d/east-reading.png'),
    found: require('@/assets/images/mascots3d/east-found.png'),
    worried: require('@/assets/images/mascots3d/east-worried.png'),
    idle: require('@/assets/images/mascots3d/east-idle.png'),
  },
  northeast: {
    reading: require('@/assets/images/mascots3d/northeast-reading.png'),
    found: require('@/assets/images/mascots3d/northeast-found.png'),
    worried: require('@/assets/images/mascots3d/northeast-worried.png'),
    idle: require('@/assets/images/mascots3d/northeast-idle.png'),
  },
  mountains: {
    reading: require('@/assets/images/mascots3d/mountains-reading.png'),
    found: require('@/assets/images/mascots3d/mountains-found.png'),
    worried: require('@/assets/images/mascots3d/mountains-worried.png'),
    idle: require('@/assets/images/mascots3d/mountains-idle.png'),
  },
};
