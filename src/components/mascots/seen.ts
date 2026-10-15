import { deviceStorage } from '@/lib/live/storage';

// How often each mascot scene has played on this phone, so a scene seen many times can be shorter:
// a tester loved Amma and the child, and worried the same scene would bore by the tenth plan.

const KEY = 'xplore.mascots.seen';
type Scene = 'planning';

/** Counts one more showing of `scene` and says how many there have been, this one included. */
export function countShowing(scene: Scene): number {
  try {
    const seen = JSON.parse(deviceStorage?.getItem(KEY) ?? '{}') as Partial<Record<Scene, number>>;
    const n = (seen[scene] ?? 0) + 1;
    deviceStorage?.setItem(KEY, JSON.stringify({ ...seen, [scene]: n }));
    return n;
  } catch {
    // No storage: every time is the first.
    return 1;
  }
}
