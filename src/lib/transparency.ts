import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

const QUERY = '(prefers-reduced-transparency: reduce)';

const webAsks = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches;

/**
 * Whether the person asked for less see-through UI: iOS's Reduce Transparency, or the browser's
 * prefers-reduced-transparency where it's supported. Glass turns solid when it's on.
 */
export function useReduceTransparency(): boolean {
  const [on, setOn] = useState(webAsks);
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.matchMedia) return;
      const mq = window.matchMedia(QUERY);
      const change = (e: MediaQueryListEvent) => setOn(e.matches);
      mq.addEventListener('change', change);
      return () => mq.removeEventListener('change', change);
    }
    let alive = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((v) => alive && setOn(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setOn);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}
